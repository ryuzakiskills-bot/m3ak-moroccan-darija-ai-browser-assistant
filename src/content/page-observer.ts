import { debounce } from '../shared/utils';

export interface UserInteractionEvent {
  elementId: string;
  interactionType: 'click' | 'input' | 'change' | 'submit';
  valuePresent?: boolean;
  description: string;
}

/**
 * Observes DOM mutations and user interactions on the webpage
 * so the AI agent can detect when the user completes a guided step
 * and verify the result before moving to the next step.
 * Prevents infinite loops, ignores overlay mutations, and deduplicates events.
 */
export class PageObserver {
  private mutationObserver: MutationObserver | null = null;
  private observedRoot: HTMLElement | null = null;
  private onUserInteractionCallback:
    | ((ev: UserInteractionEvent) => void)
    | null = null;
  private onDomMutatedCallback: (() => void) | null = null;
  private lastEventKey = '';
  private lastEventTimestamp = 0;

  private emitDeduplicated(ev: UserInteractionEvent): void {
    const now = Date.now();
    const key = `${ev.interactionType}:${ev.elementId}`;
    if (key === this.lastEventKey && now - this.lastEventTimestamp < 350) {
      return;
    }
    this.lastEventKey = key;
    this.lastEventTimestamp = now;
    this.onUserInteractionCallback?.(ev);
  }

  private handleClick = (e: MouseEvent) => {
    const rawTarget = e.target as HTMLElement | null;
    if (!rawTarget) return;
    if (
      rawTarget.closest(
        '[data-m3ak-overlay="true"], #m3ak-standalone-highlight-root'
      )
    ) {
      return;
    }

    const target = rawTarget.closest?.('[data-m3ak-id]') as HTMLElement | null;
    if (!target) return;

    const elementId = target.getAttribute('data-m3ak-id');
    if (!elementId) return;

    const tag = target.tagName.toLowerCase();
    // For text inputs/selects/textareas, wait until the user types or changes value
    if (
      (tag === 'input' &&
        !['submit', 'button', 'checkbox', 'radio'].includes(
          (target as HTMLInputElement).type
        )) ||
      tag === 'textarea' ||
      tag === 'select'
    ) {
      return;
    }

    const label = (
      target.innerText ||
      target.textContent ||
      target.getAttribute('aria-label') ||
      ''
    )
      .trim()
      .replace(/\s+/g, ' ')
      .slice(0, 50);

    // Defer slightly so page click handlers (like React state updates) run first
    setTimeout(() => {
      this.emitDeduplicated({
        elementId,
        interactionType: 'click',
        description: `User clicked on ${tag} "${label}" (${elementId})`,
      });
    }, 30);
  };

  private handleChange = (e: Event) => {
    const rawTarget = e.target as HTMLElement | null;
    if (!rawTarget) return;

    const target = rawTarget.closest?.('[data-m3ak-id]') as
      | HTMLInputElement
      | HTMLSelectElement
      | HTMLTextAreaElement
      | null;
    if (!target) return;

    const elementId = target.getAttribute('data-m3ak-id');
    if (!elementId) return;

    const hasVal = Boolean(target.value && target.value.trim().length > 0);
    if (!hasVal) return;

    this.emitDeduplicated({
      elementId,
      interactionType: 'change',
      valuePresent: true,
      description: `User entered value in ${target.tagName.toLowerCase()} (${elementId})`,
    });
  };

  private handleKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Enter') return;
    const rawTarget = e.target as HTMLElement | null;
    if (!rawTarget) return;

    const target = rawTarget.closest?.('[data-m3ak-id]') as
      | HTMLInputElement
      | null;
    if (!target) return;

    const elementId = target.getAttribute('data-m3ak-id');
    if (!elementId) return;

    const hasVal = Boolean(target.value && target.value.trim().length > 0);
    if (!hasVal) return;

    this.emitDeduplicated({
      elementId,
      interactionType: 'input',
      valuePresent: true,
      description: `User submitted input in ${elementId}`,
    });
  };

  public attach(
    root: HTMLElement,
    callbacks: {
      onUserInteraction: (ev: UserInteractionEvent) => void;
      onDomMutated: () => void;
    }
  ): void {
    this.detach();
    this.observedRoot = root;
    this.onUserInteractionCallback = callbacks.onUserInteraction;
    this.onDomMutatedCallback = debounce(callbacks.onDomMutated, 400);

    root.addEventListener('click', this.handleClick, true);
    root.addEventListener('change', this.handleChange, true);
    root.addEventListener('keydown', this.handleKeyDown, true);

    this.mutationObserver = new MutationObserver((mutations) => {
      const significant = mutations.some((m) => {
        if (m.type !== 'childList') return false;
        const targetNode = m.target as HTMLElement | null;
        if (
          targetNode?.closest?.(
            '[data-m3ak-overlay="true"], #m3ak-standalone-highlight-root'
          )
        ) {
          return false;
        }
        // Ignore mutations that only added/removed our own overlay nodes
        const nonOverlayChanges =
          Array.from(m.addedNodes).some(
            (n) =>
              n.nodeType === 1 &&
              !(n as HTMLElement).hasAttribute('data-m3ak-overlay') &&
              (n as HTMLElement).id !== 'm3ak-standalone-highlight-root'
          ) ||
          Array.from(m.removedNodes).some(
            (n) =>
              n.nodeType === 1 &&
              !(n as HTMLElement).hasAttribute('data-m3ak-overlay') &&
              (n as HTMLElement).id !== 'm3ak-standalone-highlight-root'
          );
        return nonOverlayChanges;
      });

      if (significant) {
        this.onDomMutatedCallback?.();
      }
    });

    this.mutationObserver.observe(root, {
      childList: true,
      subtree: true,
    });
  }

  public detach(): void {
    if (this.observedRoot) {
      this.observedRoot.removeEventListener('click', this.handleClick, true);
      this.observedRoot.removeEventListener('change', this.handleChange, true);
      this.observedRoot.removeEventListener(
        'keydown',
        this.handleKeyDown,
        true
      );
      this.observedRoot = null;
    }
    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
      this.mutationObserver = null;
    }
  }
}

export const pageObserver = new PageObserver();
