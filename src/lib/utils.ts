export function generateCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export function formatTime(ts: string | null): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function elapsed(start: string | null, end?: string | null): string {
  if (!start) return '—';
  const ms = (end ? new Date(end).getTime() : Date.now()) - new Date(start).getTime();
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const MINI_GAME_TYPES = ['sliding', 'wordsearch', 'simon'] as const;
export type MiniGameType = typeof MINI_GAME_TYPES[number];

export function randomMiniGame(): MiniGameType {
  return MINI_GAME_TYPES[Math.floor(Math.random() * MINI_GAME_TYPES.length)];
}
