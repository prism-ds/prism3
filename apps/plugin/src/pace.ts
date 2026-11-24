/**
 * THE #3170 CADENCE, in one place (Q3170.5 A): work on the main thread hands it back at every boundary it has (a page, a
 * set, a stage) and again once about `PACE_MS` of work has run inside one, so Figma's panel and canvas answer between.
 * `main.ts` paces the writes and the read after open by it, and `update-plan.ts` paces its reads of a set's members by it
 * (#3301): a set whose members are large held the thread for 24 members' reads at a time.
 */
export const PACE_MS = 50;

/** A hand-back offered after each small piece of work (a member read, a plan projected), taken only once about
 *  `PACE_MS` has run since the last one was taken. `handBack` is the caller's own (`breathe`). */
export const pacer = (handBack: () => Promise<void>): (() => Promise<void>) => {
  let last = Date.now();
  return async (): Promise<void> => {
    if (Date.now() - last < PACE_MS) return;
    await handBack();
    last = Date.now();
  };
};

/**
 * #4476: HOW LATE A 0 ms HAND-BACK MUST COME BACK TO READ AS THROTTLED. While Figma's window is hidden, Chromium runs a
 * timer at the next whole second, and after about five minutes hidden at the next whole minute. So a hidden window's
 * hand-back is up to 1 s late, then up to 60 s. A visible one is late only by what Figma does in between: #724's cold
 * 648-member build averaged 77–118 ms a hand-back. 1 s sits above that average with margin, and below nearly every
 * minute-aligned wait; and `THROTTLE_RUN` late hand-backs in a row are asked for, so one long reconcile in the
 * foreground does not read as a hidden window.
 */
export const THROTTLE_MS = 1000;
/** #4476: how many late hand-backs in a row read as throttling. One prompt hand-back ends it. */
export const THROTTLE_RUN = 2;
/**
 * #4476: THE MOST WORK BETWEEN TWO HAND-BACKS WHILE THROTTLED. Throttled, each hand-back costs up to a minute however
 * little work came before it, so the run is bounded only by doing more work per hand-back. The work since the last one
 * grows to the last hand-back's own delay, so a run spends no more time waiting than working, up to this cap. 15 s is
 * under a quarter of the ~70 s hold that dropped Figma's own connections (#684), so the host still answers; at a
 * minute-aligned wake that is about 15 s of work a minute, so a run takes at most about four times its work time where
 * it took up to an hour (#4476). A live measurement can move it; nothing derives it.
 */
export const THROTTLED_PACE_MAX_MS = 15_000;

/** What `handBack` reads and waits by. Injected so a test can throttle its own clock (#4476). */
export interface HandBackClock { now: () => number; wait: (ms: number) => Promise<void> }
/** A real clock: `Date.now` read at each call (so a test that steps `Date.now` steps this too), and a real macrotask. */
export const REAL_CLOCK: HandBackClock = {
  now: () => Date.now(),
  wait: (ms) => new Promise<void>((resolve) => { setTimeout(resolve, ms); }),
};

/** An executor `yieldTo` that knows when the host is throttling it (#4476, #724). */
export interface HandBack {
  (ms?: number): Promise<void>;
  /** The same hand-back at a boundary that has always handed back at every pass, a page or a set (#3110, #3177): taken
   *  every time while the host is prompt, and only by the throttled pace while it is throttled. */
  readonly every: () => Promise<void>;
  /** True from the first throttled reading to the end of the run: what the progress line's note reads. */
  readonly throttled: boolean;
}

/**
 * #4476, #724: THE RUN'S HAND-BACK, offered at every boundary the executor has and taken only when it pays.
 *
 * - Taken once `PACE_MS` of work has run since the last one (#724: a warm build no longer yields 162 times around 1 ms of
 *   work; a boundary after 50 ms of work still yields, so the visible window answers as often as before).
 * - Each 0 ms hand-back is timed. `THROTTLE_RUN` in a row at least `THROTTLE_MS` late is throttling: the work between
 *   hand-backs then grows to the last one's delay, capped at `THROTTLED_PACE_MAX_MS`, and the next prompt hand-back
 *   drops it back to `PACE_MS`, so the window is answering every 50 ms again within one stretch of work after it shows.
 * - A wait the executor asks for (`ms > 0`, the reference back-off) is always kept and never timed: it is the executor's
 *   own delay, not the host's.
 * - `every` is for a boundary that hands back at each pass on purpose (a page of the file, a set of the update): it keeps
 *   doing so while the host is prompt, and joins the throttled pace only while throttled. The 50 ms budget is the
 *   executors' chunks', where #724 measured the hand-backs costing more than the work.
 *
 * `throttled` stays true for the rest of the run once seen, so the note explains a slow run when the designer returns.
 * `before` runs just before each hand-back taken inside a stretch of work (never at an `every` boundary, whose caller has
 * just posted its own reading), so a reading posted there reaches the panel with it (#3170's `again`).
 */
export const handBack = (clock: HandBackClock = REAL_CLOCK, before?: () => void): HandBack => {
  let last = clock.now();
  let late = 0;
  let pace = PACE_MS;
  let seen = false;
  const take = async (ms: number | undefined, every: boolean): Promise<void> => {
    if (!ms && !(every && late < THROTTLE_RUN) && clock.now() - last < pace) return;
    if (!every) before?.();
    const asked = clock.now();
    await clock.wait(ms ?? 0);
    const back = clock.now();
    if (!ms) {
      const delay = back - asked;
      late = delay >= THROTTLE_MS ? late + 1 : 0;
      if (late >= THROTTLE_RUN) seen = true;
      pace = late >= THROTTLE_RUN ? Math.min(THROTTLED_PACE_MAX_MS, Math.max(PACE_MS, delay)) : PACE_MS;
    }
    last = back;
  };
  const fn = (ms?: number): Promise<void> => take(ms, false);
  Object.defineProperty(fn, 'every', { value: (): Promise<void> => take(0, true) });
  return Object.defineProperty(fn, 'throttled', { get: () => seen }) as HandBack;
};

