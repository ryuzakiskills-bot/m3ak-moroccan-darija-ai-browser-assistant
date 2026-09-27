import React, { useState } from 'react';
import { AvatarState } from '../../shared/types';
import { AI_NAME, AVATAR_ASSET_PATH } from '../../shared/constants';

interface AssistantAvatarProps {
  state?: AvatarState;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showStatusDot?: boolean;
  className?: string;
}

const SIZE_CLASSES = {
  xs: 'w-7 h-7',
  sm: 'w-9 h-9',
  md: 'w-11 h-11',
  lg: 'w-14 h-14',
  xl: 'w-20 h-20',
};

const STATE_RING_CLASSES: Record<AvatarState, string> = {
  idle: 'ring-1 ring-emerald-500/30',
  thinking: 'ring-2 ring-amber-400/80 animate-pulse-ring',
  speaking: 'ring-2 ring-emerald-400/90 animate-pulse-ring',
  success: 'ring-2 ring-emerald-500',
  error: 'ring-2 ring-rose-500/80',
  waiting: 'ring-2 ring-sky-400/75',
};

const STATE_DOT_CLASSES: Record<AvatarState, { color: string; label: string }> = {
  idle: { color: 'bg-emerald-500', label: 'Online' },
  thinking: { color: 'bg-amber-400', label: 'Thinking' },
  speaking: { color: 'bg-emerald-400', label: 'Speaking' },
  success: { color: 'bg-emerald-500', label: 'Done' },
  error: { color: 'bg-rose-500', label: 'Attention' },
  waiting: { color: 'bg-sky-400', label: 'Waiting for you' },
};

/**
 * Dedicated, consistent AI Avatar component used across:
 * Extension popup, Side panel, Chat messages, Voice interaction,
 * Loading state, Success state, Empty state, Onboarding, and Notifications.
 */
export const AssistantAvatar: React.FC<AssistantAvatarProps> = ({
  state = 'idle',
  size = 'md',
  showStatusDot = false,
  className = '',
}) => {
  const [imgError, setImgError] = useState(false);

  const sizeClass = SIZE_CLASSES[size];
  const ringClass = STATE_RING_CLASSES[state];
  const dotInfo = STATE_DOT_CLASSES[state];

  return (
    <div
      className={`relative inline-flex shrink-0 items-center justify-center rounded-full bg-slate-900 ${sizeClass} ${ringClass} transition-transform duration-150 ${className}`}
      title={`${AI_NAME} — ${dotInfo.label}`}
    >
      {!imgError ? (
        <img
          src={AVATAR_ASSET_PATH}
          alt={`${AI_NAME} AI Browser Assistant Avatar`}
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
          className="h-full w-full rounded-full object-cover"
        />
      ) : (
        /* Resilient SVG fallback for Zero-Broken-Image compliance */
        <div className="flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-emerald-600 to-teal-900 text-white font-semibold text-xs">
          م
        </div>
      )}

      {showStatusDot && (
        <span
          className={`absolute -bottom-0.5 -right-0.5 block h-3 w-3 rounded-full border-2 border-slate-950 ${dotInfo.color}`}
          aria-label={dotInfo.label}
        />
      )}
    </div>
  );
};
