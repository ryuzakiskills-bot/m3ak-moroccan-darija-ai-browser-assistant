import React, { useEffect, useState } from 'react';
import { ActionType } from '../../shared/types';
import { domAnalyzer } from '../../content/dom-analyzer';
import { elementHighlighter } from '../../content/element-highlighter';
import { AssistantAvatar } from './AssistantAvatar';

interface VisualHighlightOverlayProps {
  targetElementId: string | null;
  instruction: string;
  action: ActionType;
  requiresConfirmation?: boolean;
  stepNumber?: number;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

interface OverlayBox {
  top: number;
  left: number;
  width: number;
  height: number;
}

/**
 * Non-destructive visual highlight overlay that tracks the target DOM element
 * inside the active webpage viewport with a glowing border, subtle pulse,
 * pointer arrow ("← CLICK HERE"), and Darija instruction tooltip.
 * Does not modify page layout, block clicks, or break scrolling.
 */
export const VisualHighlightOverlay: React.FC<VisualHighlightOverlayProps> = ({
  targetElementId,
  instruction,
  action,
  requiresConfirmation = false,
  stepNumber = 1,
  containerRef,
}) => {
  const [box, setBox] = useState<OverlayBox | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!targetElementId || !container) {
      setBox(null);
      return;
    }

    const updatePosition = () => {
      const activeContainer = containerRef.current;
      if (!activeContainer) return;

      const targetEl = domAnalyzer.resolveElement(
        targetElementId,
        activeContainer
      );
      if (!targetEl) {
        setBox(null);
        return;
      }

      const containerRect = activeContainer.getBoundingClientRect();
      const targetRect = targetEl.getBoundingClientRect();

      setBox({
        top: targetRect.top - containerRect.top + activeContainer.scrollTop,
        left: targetRect.left - containerRect.left + activeContainer.scrollLeft,
        width: targetRect.width,
        height: targetRect.height,
      });
    };

    // Scroll element into view on initial target change
    const targetEl = domAnalyzer.resolveElement(targetElementId, container);
    if (targetEl) {
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    updatePosition();
    const timer = setTimeout(updatePosition, 180);

    container.addEventListener('scroll', updatePosition, { passive: true });
    window.addEventListener('resize', updatePosition, { passive: true });

    return () => {
      clearTimeout(timer);
      container.removeEventListener('scroll', updatePosition);
      window.removeEventListener('resize', updatePosition);
    };
  }, [targetElementId, instruction, action, containerRef]);

  if (!targetElementId || !box) {
    return null;
  }

  const badge = elementHighlighter.getActionBadgeLabel(
    action,
    requiresConfirmation
  );

  // Place tooltip above the element if it is far enough from the top, otherwise below
  const showAbove = box.top > 110;
  const borderColor = requiresConfirmation
    ? 'border-amber-500 shadow-[0_0_0_4px_rgba(245,158,11,0.22),0_0_24px_rgba(245,158,11,0.45)]'
    : 'border-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.22),0_0_24px_rgba(16,185,129,0.45)]';

  const pointerBg = requiresConfirmation
    ? 'bg-amber-600 text-white border-amber-400'
    : 'bg-emerald-600 text-white border-emerald-400';

  return (
    <div
      data-m3ak-overlay="true"
      className="pointer-events-none absolute top-0 left-0 right-0 z-40 overflow-visible"
    >
      {/* Glowing Border around the target DOM element */}
      <div
        style={{
          transform: `translate3d(${Math.max(4, box.left - 6)}px, ${Math.max(4, box.top - 6)}px, 0)`,
          width: `${box.width + 12}px`,
          height: `${box.height + 12}px`,
        }}
        className={`
          pointer-events-none absolute top-0 left-0 rounded-xl border-2
          transition-transform duration-150 animate-pulse-ring
          ${borderColor}
        `}
      />

      {/* Pointer Badge ("← CLICK HERE / كليكي هنا") */}
      <div
        style={{
          transform: `translate3d(${Math.min(
            Math.max(12, box.left + box.width + 14),
            540
          )}px, ${Math.max(8, box.top + box.height / 2 - 16)}px, 0)`,
        }}
        className="pointer-events-none absolute top-0 left-0 z-50 flex items-center"
      >
        <div
          className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-semibold shadow-lg animate-pointer-bounce whitespace-nowrap ${pointerBg}`}
        >
          <span>← {badge.englishHint}</span>
          <span aria-hidden="true">·</span>
          <span className="font-darija" dir="rtl">
            {badge.darijaLabel}
          </span>
        </div>
      </div>

      {/* Compact Darija Instruction Tooltip Card */}
      <div
        style={{
          transform: `translate3d(${Math.max(
            12,
            Math.min(box.left, 380)
          )}px, ${
            showAbove
              ? Math.max(8, box.top - 86)
              : box.top + box.height + 14
          }px, 0)`,
        }}
        className="pointer-events-none absolute top-0 left-0 z-50 max-w-xs sm:max-w-sm"
      >
        <div className="flex items-start gap-2.5 rounded-xl border border-slate-700/90 bg-slate-900/95 px-3.5 py-2.5 text-slate-100 shadow-2xl backdrop-blur-md">
          <AssistantAvatar
            state={requiresConfirmation ? 'waiting' : 'speaking'}
            size="xs"
            className="mt-0.5"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2 text-[11px] text-slate-400">
              <span className="font-mono-tabular text-emerald-400">
                Step {stepNumber} · {targetElementId}
              </span>
              <span className="font-darija text-slate-300" dir="rtl">
                خطوة {stepNumber}
              </span>
            </div>
            <p
              className="mt-0.5 text-xs font-medium leading-relaxed text-white font-darija"
              dir="rtl"
            >
              {instruction}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
