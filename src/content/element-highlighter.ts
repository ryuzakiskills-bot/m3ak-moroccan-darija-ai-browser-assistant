import { ActionType, ElementPosition } from '../shared/types';
import { domAnalyzer } from './dom-analyzer';

export interface HighlightConfig {
  elementId: string;
  instruction: string;
  action: ActionType;
  requiresConfirmation?: boolean;
  stepNumber?: number;
}

const STANDALONE_OVERLAY_ID = 'm3ak-standalone-highlight-root';
const STANDALONE_STYLE_ID = 'm3ak-standalone-highlight-keyframes';

/**
 * Computes a truthful spatial description of a real DOM element's position
 * in the viewport (never faking an element location).
 */
export function describeSpatialLocation(
  pos: Pick<ElementPosition, 'top' | 'left' | 'width' | 'height'>,
  lang: 'darija' | 'en' | 'fr' = 'darija'
): string {
  const vw = typeof window !== 'undefined' ? window.innerWidth || 1280 : 1280;
  const vh = typeof window !== 'undefined' ? window.innerHeight || 800 : 800;

  const centerX = pos.left + pos.width / 2;
  const centerY = pos.top + pos.height / 2;

  const isTop = centerY < vh * 0.34;
  const isBottom = centerY > vh * 0.68;
  const isLeft = centerX < vw * 0.36;
  const isRight = centerX > vw * 0.64;

  if (lang === 'en') {
    const vPart = isTop ? 'at the top' : isBottom ? 'near the bottom' : 'in the middle';
    const hPart = isRight ? 'on the right' : isLeft ? 'on the left' : 'in the center';
    return isTop && isRight
      ? 'at the top-right'
      : isTop && isLeft
      ? 'at the top-left'
      : `${vPart}, ${hPart}`;
  }

  if (lang === 'fr') {
    if (isTop && isRight) return 'en haut à droite';
    if (isTop && isLeft) return 'en haut à gauche';
    if (isBottom && isRight) return 'en bas à droite';
    if (isBottom && isLeft) return 'en bas à gauche';
    if (isTop) return 'en haut de la page';
    if (isBottom) return 'en bas de la page';
    return 'au centre de la page';
  }

  // Default: Moroccan Darija
  if (isTop && isRight) return 'لفوق على اليمين';
  if (isTop && isLeft) return 'لفوق على اليسار';
  if (isBottom && isRight) return 'لتحت على اليمين';
  if (isBottom && isLeft) return 'لتحت على اليسار';
  if (isTop) return 'لفوق فـ الصفحة';
  if (isBottom) return 'لتحت فـ الصفحة';
  if (isRight) return 'على اليمين';
  if (isLeft) return 'على اليسار';
  return 'فالوسط ديال الصفحة';
}

/**
 * Visual Highlight & Animated Guide Arrow Engine for Chrome Extension Content Script
 * - Never modifies website layout or blocks clicks (pointer-events: none)
 * - Renders a glowing target ring, animated directional guide arrow, and compact HUD label
 * - Updates smoothly on scroll/resize
 */
export class ElementHighlighter {
  private currentConfig: HighlightConfig | null = null;
  private standaloneOverlayEl: HTMLDivElement | null = null;
  private currentTargetEl: HTMLElement | null = null;
  private boundUpdatePosition: (() => void) | null = null;

  public highlight(
    config: HighlightConfig,
    rootContainer?: HTMLElement | null
  ): HTMLElement | null {
    this.currentConfig = config;
    const target = domAnalyzer.resolveElement(config.elementId, rootContainer);

    if (!target) {
      this.clearHighlight();
      return null;
    }

    this.currentTargetEl = target;

    target.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'nearest',
    });

    if (!rootContainer || rootContainer === document.body) {
      this.renderStandaloneOverlay(target, config);
    }

    return target;
  }

  public clearHighlight(): void {
    this.currentConfig = null;
    this.currentTargetEl = null;

    if (this.boundUpdatePosition) {
      window.removeEventListener('scroll', this.boundUpdatePosition, true);
      window.removeEventListener('resize', this.boundUpdatePosition, true);
      this.boundUpdatePosition = null;
    }

    if (this.standaloneOverlayEl) {
      this.standaloneOverlayEl.remove();
      this.standaloneOverlayEl = null;
    }

    const existing = document.getElementById(STANDALONE_OVERLAY_ID);
    if (existing) {
      existing.remove();
    }
  }

  public getCurrentHighlight(): HighlightConfig | null {
    return this.currentConfig;
  }

  public getActionBadgeLabel(
    action: ActionType,
    requiresConfirmation?: boolean
  ): {
    darijaLabel: string;
    englishHint: string;
  } {
    if (requiresConfirmation) {
      return {
        darijaLabel: 'تأكد قبل ما تكليكي ⚠️',
        englishHint: 'CONFIRM ACTION',
      };
    }

    switch (action) {
      case 'click':
        return {
          darijaLabel: 'كليكي هنا 👈',
          englishHint: 'CLICK HERE',
        };
      case 'focus':
      case 'type':
      case 'input':
        return {
          darijaLabel: 'كتب هنا ✍️',
          englishHint: 'TYPE HERE',
        };
      case 'select':
        return {
          darijaLabel: 'ختار من هنا ▾',
          englishHint: 'SELECT OPTION',
        };
      case 'scroll':
        return {
          darijaLabel: 'شوف هنا 👇',
          englishHint: 'LOOK HERE',
        };
      default:
        return {
          darijaLabel: 'ها هو هنا 👈',
          englishHint: 'LOCATED HERE',
        };
    }
  }

  private ensureKeyframesStyle(): void {
    if (document.getElementById(STANDALONE_STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STANDALONE_STYLE_ID;
    style.setAttribute('data-m3ak-overlay', 'true');
    style.textContent = `
      @keyframes m3akGuideBounce {
        0%, 100% { transform: translateX(0); }
        50% { transform: translateX(-7px); }
      }
      @keyframes m3akRingPulse {
        0%, 100% { box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.28), 0 0 24px rgba(6, 182, 212, 0.45); }
        50% { box-shadow: 0 0 0 7px rgba(6, 182, 212, 0.36), 0 0 32px rgba(16, 185, 129, 0.65); }
      }
    `;
    document.head.appendChild(style);
  }

  private renderStandaloneOverlay(
    target: HTMLElement,
    config: HighlightConfig
  ): void {
    this.ensureKeyframesStyle();

    let root = document.getElementById(
      STANDALONE_OVERLAY_ID
    ) as HTMLDivElement | null;
    if (!root) {
      root = document.createElement('div');
      root.id = STANDALONE_OVERLAY_ID;
      root.setAttribute('data-m3ak-overlay', 'true');
      root.style.cssText =
        'position:fixed;inset:0;pointer-events:none;z-index:2147483646;overflow:visible;';
      document.body.appendChild(root);
    }
    this.standaloneOverlayEl = root;

    const ringBox = document.createElement('div');
    const arrowPointerBox = document.createElement('div');
    const tooltipBox = document.createElement('div');

    const isConfirm = Boolean(config.requiresConfirmation);
    const borderColor = isConfirm ? '#f59e0b' : '#10b981';

    ringBox.style.cssText = `
      position: fixed;
      pointer-events: none;
      border: 2px solid ${borderColor};
      border-radius: 10px;
      animation: m3akRingPulse 2s ease-in-out infinite;
      transition: transform 120ms ease-out, width 120ms ease-out, height 120ms ease-out;
    `;

    const badge = this.getActionBadgeLabel(
      config.action,
      config.requiresConfirmation
    );

    arrowPointerBox.style.cssText = `
      position: fixed;
      pointer-events: none;
      display: flex;
      align-items: center;
      z-index: 2147483646;
    `;

    const arrowInner = document.createElement('div');
    arrowInner.style.cssText = `
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: ${isConfirm ? 'linear-gradient(135deg, #d97706, #b45309)' : 'linear-gradient(135deg, #059669, #0891b2)'};
      color: #ffffff;
      border: 1px solid ${isConfirm ? '#fbbf24' : '#34d399'};
      border-radius: 9999px;
      padding: 5px 12px;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 11.5px;
      font-weight: 700;
      white-space: nowrap;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.55), 0 0 16px rgba(16, 185, 129, 0.35);
      animation: m3akGuideBounce 1.1s ease-in-out infinite;
    `;
    arrowInner.textContent = `← ${badge.darijaLabel}`;
    arrowPointerBox.appendChild(arrowInner);

    tooltipBox.style.cssText = `
      position: fixed;
      pointer-events: none;
      background: rgba(6, 12, 24, 0.94);
      backdrop-filter: blur(16px);
      color: #f8fafc;
      border: 1px solid ${borderColor};
      border-radius: 12px;
      padding: 8px 12px;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 12px;
      line-height: 1.5;
      max-width: 310px;
      box-shadow: 0 14px 32px rgba(0, 0, 0, 0.65);
      direction: rtl;
    `;

    const headerSpan = document.createElement('div');
    headerSpan.style.cssText =
      'font-weight:700;color:#34d399;margin-bottom:2px;font-size:11px;';
    headerSpan.textContent = `M3ak · ${badge.darijaLabel}`;

    const bodySpan = document.createElement('div');
    bodySpan.textContent = config.instruction;

    tooltipBox.appendChild(headerSpan);
    tooltipBox.appendChild(bodySpan);

    root.replaceChildren(ringBox, arrowPointerBox, tooltipBox);

    const updatePos = () => {
      if (!this.currentTargetEl || !document.contains(this.currentTargetEl)) {
        this.clearHighlight();
        return;
      }
      const rect = this.currentTargetEl.getBoundingClientRect();
      ringBox.style.transform = `translate3d(${Math.max(2, rect.left - 5)}px, ${Math.max(2, rect.top - 5)}px, 0)`;
      ringBox.style.width = `${rect.width + 10}px`;
      ringBox.style.height = `${rect.height + 10}px`;

      const arrowLeft =
        rect.right + 150 < window.innerWidth
          ? rect.right + 12
          : Math.max(8, rect.left - 135);
      const arrowTop = Math.max(8, rect.top + rect.height / 2 - 15);
      arrowPointerBox.style.transform = `translate3d(${arrowLeft}px, ${arrowTop}px, 0)`;

      const topPos =
        rect.top > 95 ? Math.max(8, rect.top - 72) : rect.bottom + 12;
      const leftPos = Math.max(
        8,
        Math.min(rect.left, window.innerWidth - 324)
      );
      tooltipBox.style.transform = `translate3d(${leftPos}px, ${topPos}px, 0)`;
    };

    if (this.boundUpdatePosition) {
      window.removeEventListener('scroll', this.boundUpdatePosition, true);
      window.removeEventListener('resize', this.boundUpdatePosition, true);
    }
    this.boundUpdatePosition = updatePos;
    window.addEventListener('scroll', updatePos, true);
    window.addEventListener('resize', updatePos, true);

    updatePos();
  }
}

export const elementHighlighter = new ElementHighlighter();
