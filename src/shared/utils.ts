import { SENSITIVE_KEYWORDS } from './constants';
import { PageElement } from './types';

export function generateId(prefix = 'id'): string {
  return `${prefix}_${Math.random().toString(36).substring(2, 9)}_${Date.now().toString(36)}`;
}

export function isSensitiveElement(el: Partial<PageElement>): boolean {
  const combined = [
    el.text || '',
    el.ariaLabel || '',
    el.placeholder || '',
    el.label || '',
    el.name || '',
    el.type || '',
  ]
    .join(' ')
    .toLowerCase();

  if (el.type === 'password') return true;

  return SENSITIVE_KEYWORDS.some((kw) => combined.includes(kw.toLowerCase()));
}

export function containsArabicScript(text: string): boolean {
  return /[\u0600-\u06FF]/.test(text);
}

export function formatTimeShort(timestamp: number): string {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(timestamp));
  } catch {
    return '';
  }
}

export function debounce<T extends (...args: any[]) => void>(
  fn: T,
  delayMs: number
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      fn(...args);
    }, delayMs);
  };
}
