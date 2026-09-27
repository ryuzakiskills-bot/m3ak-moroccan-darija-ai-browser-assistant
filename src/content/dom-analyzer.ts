import {
  PageButtonSummary,
  PageContext,
  PageElement,
  PageFormSummary,
  PageImageSummary,
  PageInputSummary,
  PageLinkSummary,
} from '../shared/types';
import { isSensitiveElement } from '../shared/utils';

const INTERACTIVE_SELECTOR = [
  'button',
  'a[href]',
  'input:not([type="hidden"])',
  'textarea',
  'select',
  '[role="button"]',
  '[role="link"]',
  '[role="tab"]',
  '[role="checkbox"]',
  '[role="radio"]',
].join(', ');

const IGNORED_TAGS = new Set([
  'script',
  'style',
  'noscript',
  'template',
  'svg',
  'path',
  'head',
  'meta',
  'link',
]);

/**
 * Inspects a DOM container (defaults to document.body in content script mode).
 * Assigns temporary element IDs (data-m3ak-id="element_1", etc.),
 * stores semantic descriptors for safe re-resolution across DOM re-renders,
 * and returns a compact, privacy-preserving PageContext for the AI.
 * NEVER sends raw passwords or sensitive field values to the AI.
 */
export class DOMAnalyzer {
  private elementMap = new Map<string, HTMLElement>();
  private descriptorMap = new Map<string, PageElement>();

  public inspectPage(
    rootContainer?: HTMLElement | null,
    virtualMeta?: { title: string; url: string }
  ): PageContext {
    const root = rootContainer || document.body;
    this.elementMap.clear();

    const headings: string[] = [];
    root.querySelectorAll<HTMLElement>('h1, h2, h3').forEach((h) => {
      if (!this.isElementVisible(h) || this.isInsideOverlayOrIgnored(h)) return;
      const text = (h.textContent || '').trim().replace(/\s+/g, ' ');
      if (text && headings.length < 8) {
        headings.push(text.slice(0, 120));
      }
    });

    // Check for any visible status/completion banners on the page
    const banners: string[] = [];
    root
      .querySelectorAll<HTMLElement>(
        '[data-status-banner], [role="alert"], .status-banner'
      )
      .forEach((b) => {
        if (!this.isElementVisible(b) || this.isInsideOverlayOrIgnored(b)) return;
        const txt = (b.textContent || '').trim().replace(/\s+/g, ' ');
        if (txt) banners.push(`SUCCESS_BANNER: ${txt.slice(0, 160)}`);
      });

    const rawNodes = Array.from(
      root.querySelectorAll<HTMLElement>(INTERACTIVE_SELECTOR)
    );

    const elements: PageElement[] = [];
    let counter = 1;

    const rootRect = root.getBoundingClientRect();

    for (const node of rawNodes) {
      if (this.isInsideOverlayOrIgnored(node)) continue;
      if (!this.isElementVisible(node)) continue;

      const rect = node.getBoundingClientRect();
      const elementId = `element_${counter++}`;
      node.setAttribute('data-m3ak-id', elementId);
      this.elementMap.set(elementId, node);

      const tag = node.tagName.toLowerCase();
      const inputEl = node as
        | HTMLInputElement
        | HTMLSelectElement
        | HTMLTextAreaElement;

      const label = this.findAssociatedLabel(node, root);
      const text = this.extractCleanText(node);
      const placeholder = node.getAttribute('placeholder') || undefined;
      const ariaLabel = node.getAttribute('aria-label') || undefined;
      const role =
        node.getAttribute('role') || this.inferImplicitRole(tag, inputEl.type);
      const name = node.getAttribute('name') || undefined;
      const inputType =
        tag === 'input'
          ? (inputEl.type || 'text').toLowerCase()
          : tag === 'select'
          ? 'select'
          : tag === 'textarea'
          ? 'textarea'
          : undefined;

      // Privacy-first: NEVER send raw passwords or sensitive field values to the AI.
      // Only expose boolean metadata `valuePresent`.
      let valuePresent = false;
      if (tag === 'input' || tag === 'textarea' || tag === 'select') {
        if (inputType === 'checkbox' || inputType === 'radio') {
          valuePresent = Boolean((node as HTMLInputElement).checked);
        } else {
          valuePresent = Boolean(
            inputEl.value && inputEl.value.trim().length > 0
          );
        }
      }

      const partialEl: Partial<PageElement> = {
        id: elementId,
        tag,
        text,
        role,
        type: inputType,
        inputType,
        placeholder,
        ariaLabel,
        label,
        name,
      };

      const stableSelector = this.buildSemanticSelector(node, elementId);

      const pageElement: PageElement = {
        id: elementId,
        tag,
        text,
        role,
        type: inputType,
        inputType,
        placeholder,
        ariaLabel,
        label,
        name,
        valuePresent,
        href:
          tag === 'a'
            ? (node.getAttribute('href') || '').slice(0, 120) || undefined
            : undefined,
        visible: true,
        disabled: Boolean((node as HTMLButtonElement).disabled),
        isSensitive: isSensitiveElement(partialEl),
        selector: stableSelector,
        position: {
          top: Math.round(rect.top - rootRect.top),
          left: Math.round(rect.left - rootRect.left),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        },
      };

      elements.push(pageElement);
      this.descriptorMap.set(elementId, pageElement);
    }

    const paragraphs = Array.from(
      root.querySelectorAll<HTMLElement>(
        'p, li, span, strong, [data-page-summary], [data-price], .price'
      )
    )
      .filter(
        (p) => this.isElementVisible(p) && !this.isInsideOverlayOrIgnored(p)
      )
      .map((p) => (p.textContent || '').trim().replace(/\s+/g, ' '))
      .filter((t) => t.length > 4 && t.length < 320);

    const uniqueTextSnippets: string[] = [];
    const seenSnippets = new Set<string>();
    for (const snippet of [...banners, ...headings, ...paragraphs]) {
      const normalized = snippet.toLowerCase();
      if (!seenSnippets.has(normalized)) {
        seenSnippets.add(normalized);
        uniqueTextSnippets.push(snippet);
      }
      if (uniqueTextSnippets.length >= 18) break;
    }

    const visibleText = uniqueTextSnippets.join(' | ').slice(0, 1200);
    const summaryText = [...banners, ...headings.slice(0, 3), ...paragraphs.slice(0, 4)]
      .join(' | ')
      .slice(0, 500);

    const buttons: PageButtonSummary[] = elements
      .filter((el) => el.tag === 'button' || el.role === 'button')
      .slice(0, 15)
      .map((el) => ({
        id: el.id,
        text: el.text || el.label || el.ariaLabel || 'Button',
        ariaLabel: el.ariaLabel,
      }));

    const links: PageLinkSummary[] = elements
      .filter((el) => el.tag === 'a' || el.role === 'link')
      .slice(0, 15)
      .map((el) => ({
        id: el.id,
        text: el.text || el.ariaLabel || el.href || 'Link',
        href: el.href,
      }));

    const inputs: PageInputSummary[] = elements
      .filter(
        (el) =>
          el.tag === 'input' || el.tag === 'textarea' || el.tag === 'select'
      )
      .slice(0, 15)
      .map((el) => ({
        id: el.id,
        label: el.label,
        placeholder: el.placeholder,
        type: el.inputType || el.type,
        name: el.name,
        valuePresent: el.valuePresent,
      }));

    const forms: PageFormSummary[] = Array.from(
      root.querySelectorAll<HTMLFormElement>('form')
    )
      .filter(
        (f) => this.isElementVisible(f) && !this.isInsideOverlayOrIgnored(f)
      )
      .slice(0, 6)
      .map((f, idx) => ({
        id: f.id || `form_${idx + 1}`,
        name: f.getAttribute('name') || f.getAttribute('aria-label') || undefined,
        action: (f.getAttribute('action') || '').slice(0, 100) || undefined,
        fieldCount: f.querySelectorAll('input, select, textarea').length,
      }));

    const images: PageImageSummary[] = Array.from(
      root.querySelectorAll<HTMLImageElement>('img')
    )
      .filter(
        (img) =>
          this.isElementVisible(img) && !this.isInsideOverlayOrIgnored(img)
      )
      .map((img) => ({
        alt: (img.alt || img.title || '').trim().slice(0, 100),
        src: (img.getAttribute('src') || '').slice(0, 120) || undefined,
      }))
      .filter((img) => Boolean(img.alt || img.src))
      .slice(0, 8);

    return {
      pageTitle: virtualMeta?.title || document.title || 'Current Webpage',
      url: virtualMeta?.url || window.location.href,
      headings,
      buttons,
      links,
      inputs,
      forms,
      images,
      visibleText,
      summaryText,
      elements,
      timestamp: Date.now(),
    };
  }

  /**
   * Resolves a temporary element ID (e.g. "element_23") to its live DOM node.
   * If the website re-rendered its DOM and replaced the node, performs multi-stage
   * semantic re-resolution using stored metadata (selector, text, aria-label, role,
   * label/placeholder, and nearby structural position).
   */
  public resolveElement(
    targetElementId: string,
    rootContainer?: HTMLElement | null
  ): HTMLElement | null {
    if (!targetElementId) return null;

    const root = rootContainer || document.body;

    // 1. Direct live map lookup
    const cached = this.elementMap.get(targetElementId);
    if (cached && document.contains(cached) && this.isElementVisible(cached)) {
      return cached;
    }

    // 2. Direct attribute lookup
    try {
      const byAttr = root.querySelector<HTMLElement>(
        `[data-m3ak-id="${CSS.escape(targetElementId)}"]`
      );
      if (byAttr && this.isElementVisible(byAttr)) {
        this.elementMap.set(targetElementId, byAttr);
        return byAttr;
      }
    } catch {
      // ignore invalid selector syntax
    }

    // 3. Semantic re-resolution if DOM re-rendered
    const desc = this.descriptorMap.get(targetElementId);
    if (!desc) return null;

    // 3a. Try stable semantic selector fallback first
    if (desc.selector && !desc.selector.startsWith('[data-m3ak-id=')) {
      try {
        const bySelector = root.querySelector<HTMLElement>(desc.selector);
        if (bySelector && this.isElementVisible(bySelector)) {
          bySelector.setAttribute('data-m3ak-id', targetElementId);
          this.elementMap.set(targetElementId, bySelector);
          return bySelector;
        }
      } catch {
        // continue to semantic matching
      }
    }

    // 3b. Score all visible candidate interactive elements semantically
    const candidates = Array.from(
      root.querySelectorAll<HTMLElement>(INTERACTIVE_SELECTOR)
    ).filter(
      (node) =>
        !this.isInsideOverlayOrIgnored(node) && this.isElementVisible(node)
    );

    let bestCandidate: HTMLElement | null = null;
    let bestScore = 0;

    for (const candidate of candidates) {
      let score = 0;
      const candTag = candidate.tagName.toLowerCase();
      const candRole =
        candidate.getAttribute('role') ||
        this.inferImplicitRole(candTag, (candidate as HTMLInputElement).type);
      const candText = this.extractCleanText(candidate).toLowerCase();
      const candAria = (candidate.getAttribute('aria-label') || '').toLowerCase();
      const candPlaceholder = (
        candidate.getAttribute('placeholder') || ''
      ).toLowerCase();
      const candName = (candidate.getAttribute('name') || '').toLowerCase();
      const candLabel = (
        this.findAssociatedLabel(candidate, root) || ''
      ).toLowerCase();

      if (candTag === desc.tag) score += 2;
      if (candRole === desc.role) score += 2;

      if (desc.name && candName === desc.name.toLowerCase()) score += 6;
      if (desc.ariaLabel && candAria === desc.ariaLabel.toLowerCase()) score += 6;
      if (
        desc.placeholder &&
        candPlaceholder === desc.placeholder.toLowerCase()
      ) {
        score += 5;
      }
      if (desc.label && candLabel === desc.label.toLowerCase()) score += 5;
      if (desc.text && candText && candText === desc.text.toLowerCase()) {
        score += 6;
      } else if (
        desc.text &&
        candText &&
        (candText.includes(desc.text.toLowerCase()) ||
          desc.text.toLowerCase().includes(candText))
      ) {
        score += 3;
      }

      // Nearby structure / position proximity tie-breaker
      const rootRect = root.getBoundingClientRect();
      const rect = candidate.getBoundingClientRect();
      const topDiff = Math.abs(rect.top - rootRect.top - desc.position.top);
      const leftDiff = Math.abs(rect.left - rootRect.left - desc.position.left);
      if (topDiff < 60 && leftDiff < 80) {
        score += 2;
      }

      if (score > bestScore) {
        bestScore = score;
        bestCandidate = candidate;
      }
    }

    // Require a meaningful semantic match score (>= 6)
    if (bestCandidate && bestScore >= 6) {
      bestCandidate.setAttribute('data-m3ak-id', targetElementId);
      this.elementMap.set(targetElementId, bestCandidate);
      return bestCandidate;
    }

    return null;
  }

  private isInsideOverlayOrIgnored(node: HTMLElement): boolean {
    const tag = node.tagName.toLowerCase();
    if (IGNORED_TAGS.has(tag)) return true;
    if (
      node.closest(
        '[data-m3ak-overlay="true"], #m3ak-standalone-highlight-root, script, style, noscript, template, [aria-hidden="true"]'
      )
    ) {
      return true;
    }
    return false;
  }

  private isElementVisible(node: HTMLElement): boolean {
    const rect = node.getBoundingClientRect();
    const style = window.getComputedStyle(node);
    return (
      rect.width > 4 &&
      rect.height > 4 &&
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      parseFloat(style.opacity || '1') > 0.05
    );
  }

  private buildSemanticSelector(node: HTMLElement, fallbackId: string): string {
    const tag = node.tagName.toLowerCase();
    const id = node.getAttribute('id');
    if (id) {
      return `${tag}#${CSS.escape(id)}`;
    }
    const name = node.getAttribute('name');
    if (name) {
      return `${tag}[name="${CSS.escape(name)}"]`;
    }
    const ariaLabel = node.getAttribute('aria-label');
    if (ariaLabel) {
      return `${tag}[aria-label="${CSS.escape(ariaLabel)}"]`;
    }
    return `[data-m3ak-id="${fallbackId}"]`;
  }

  private findAssociatedLabel(
    node: HTMLElement,
    root: HTMLElement
  ): string | undefined {
    const id = node.getAttribute('id');
    if (id) {
      try {
        const explicitLabel = root.querySelector(
          `label[for="${CSS.escape(id)}"]`
        );
        if (explicitLabel?.textContent) {
          return explicitLabel.textContent.trim().replace(/\s+/g, ' ');
        }
      } catch {
        // ignore invalid id selector
      }
    }

    const parentLabel = node.closest('label');
    if (parentLabel) {
      const clone = parentLabel.cloneNode(true) as HTMLElement;
      clone
        .querySelectorAll('input, select, textarea')
        .forEach((c) => c.remove());
      const txt = (clone.textContent || '').trim().replace(/\s+/g, ' ');
      if (txt) return txt;
    }

    const prevSibling = node.previousElementSibling;
    if (prevSibling && prevSibling.tagName.toLowerCase() === 'label') {
      const txt = (prevSibling.textContent || '').trim().replace(/\s+/g, ' ');
      if (txt) return txt;
    }

    return undefined;
  }

  private extractCleanText(node: HTMLElement): string {
    const tag = node.tagName.toLowerCase();
    if (tag === 'input') {
      const inp = node as HTMLInputElement;
      if (inp.type === 'submit' || inp.type === 'button') {
        return (inp.value || '').trim().slice(0, 80);
      }
      return '';
    }
    if (tag === 'select') {
      const sel = node as HTMLSelectElement;
      const selectedOption = sel.options[sel.selectedIndex];
      return selectedOption ? selectedOption.text.trim().slice(0, 80) : '';
    }
    return (node.innerText || node.textContent || '')
      .trim()
      .replace(/\s+/g, ' ')
      .slice(0, 80);
  }

  private inferImplicitRole(tag: string, type?: string): string {
    if (tag === 'button') return 'button';
    if (tag === 'a') return 'link';
    if (tag === 'select') return 'combobox';
    if (tag === 'textarea') return 'textbox';
    if (tag === 'input') {
      if (type === 'checkbox') return 'checkbox';
      if (type === 'radio') return 'radio';
      if (type === 'submit' || type === 'button') return 'button';
      return 'textbox';
    }
    return 'interactive';
  }
}

export const domAnalyzer = new DOMAnalyzer();
