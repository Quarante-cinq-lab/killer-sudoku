/**
 * Chronomètre : un temps cumulé, plus l'instant de départ s'il tourne. Les fonctions reçoivent l'heure
 * actuelle (`now`, en millisecondes), ce qui les rend faciles à tester.
 */
export interface Clock {
  baseMs: number;
  /** Instant où le chronomètre a été (re)lancé, ou null s'il est arrêté. */
  since: number | null;
}

/** Heure actuelle pour le chronomètre (insensible aux changements d'heure de l'appareil). */
export const now = (): number => performance.now();

export const stoppedClock = (baseMs: number): Clock => ({ baseMs, since: null });

export function startClock(clock: Clock, now: number): Clock {
  return clock.since === null ? { ...clock, since: now } : clock;
}

export function stopClock(clock: Clock, now: number): Clock {
  return clock.since === null ? clock : { baseMs: readClock(clock, now), since: null };
}

export function readClock(clock: Clock, now: number): number {
  return clock.baseMs + (clock.since === null ? 0 : Math.max(0, now - clock.since));
}

/** Format hh:mm:ss. */
export function formatTime(ms: number): string {
  const total = Math.floor(ms / 1000);
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor(total / 60) % 60)}:${pad(total % 60)}`;
}
