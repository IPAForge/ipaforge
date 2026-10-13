/** Time source. Injected so signing timestamps and token expiry are deterministic in tests. */
export interface Clock {
  now(): Date;
}

export const systemClock: Clock = { now: () => new Date() };

export const fixedClock = (date: Date): Clock => ({ now: () => new Date(date) });
