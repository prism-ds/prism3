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
 * #4476: HOW LATE A 0 ms HAND-BACK MUST COME BACK TO COUNT AS LATE. While Figma's window is hidden, Chromium first runs a
 * timer at the next whole second, so after a short stretch of work a hand-back is about a second late (950 ms after 50 ms
 * of work); after about five minutes hidden it runs it at the next whole minute. A visible window's hand-back is late
 * only by what Figma does in between: #724's cold 648-member build averaged 77–118 ms. 250 ms sits above that average
 * with margin and well below the ~950 ms a second-aligned host gives a 50 ms stretch. A threshold of a whole second
 * missed the second-aligned stage entirely, because every one of its delays is under a second (#4506 review).
 */
export const THROTTLE_MS = 250;
/**
 * #4476: WHAT READS AS THROTTLING: a sustained run of late hand-backs, not one slow tick. Each late hand-back in a row
 * counts one, or two if it is at least `THROTTLE_LONG_MS` late; `THROTTLE_RUN` reads as throttled, and one prompt
 * hand-back starts the count again. A second-aligned host meets it in four hand-backs (each under a second late, about
 * 4 s), which come first while hidden, so the minute-aligned stage normally begins already throttled; a run started after
 * five minutes hidden meets it in two minute-aligned hand-backs. A foreground has to be slow four times running, or held
 * 5 s twice running, which #724's 77–118 ms average is nowhere near.
 */
export const THROTTLE_RUN = 4;
/** #4476: a hand-back this late counts twice toward `THROTTLE_RUN`: far past any second-aligned delay or foreground tick. */
export const THROTTLE_LONG_MS = 5000;
/** #4476: prompt hand-backs in a row after which a throttled stretch is forgotten (see `handBack`). */
export const THROTTLE_CLEAR = 2;
/**
 * #4476: THE MOST WORK BETWEEN TWO HAND-BACKS WHILE THROTTLED. Throttled, each hand-back costs up to a second, then up to
 * a minute, however little work came before it, so the run is bounded only by doing more work per hand-back. The stretch
 * starts at the last hand-back's own delay and doubles at each late one after, up to this cap. 15 s is under a quarter of
 * the ~70 s hold that dropped Figma's own connections (#684), so the host still answers; at a second-aligned wake that is
 * about 15 s of work a second's wait, and at a minute-aligned wake about 15 s of work a minute, so a run takes about four
 * times its work time where it took up to an hour (#4476). A live measurement can move it; nothing derives it.
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
 * - Each 0 ms hand-back is timed. A sustained run of late ones (`THROTTLE_MS`, `THROTTLE_RUN`, `THROTTLE_LONG_MS`) is
 *   throttling: the work between hand-backs then grows to the last one's delay and doubles at each late one after,
 *   capped at `THROTTLED_PACE_MAX_MS`. The next prompt hand-back drops it back to `PACE_MS`, so the window is answering
 *   every 50 ms again within one stretch of work after it shows; the stretch itself is remembered for `THROTTLE_CLEAR`
 *   prompt hand-backs, because under second alignment a long stretch can end just before a whole second.
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
  let late = 0;       // late hand-backs in a row, a long one counted twice
  let prompt = 0;     // prompt hand-backs in a row
  let now = false;    // throttled now: work stretches to `stretch`
  let stretch = 0;    // the throttled stretch, remembered across a prompt hand-back or two
  let seen = false;
  const take = async (ms: number | undefined, every: boolean): Promise<void> => {
    if (!ms && !(every && !now) && clock.now() - last < (now ? stretch : PACE_MS)) return;
    if (!every) before?.();
    const asked = clock.now();
    await clock.wait(ms ?? 0);
    const back = clock.now();
    if (!ms) {
      const delay = back - asked;
      if (delay >= THROTTLE_MS) {
        late += delay >= THROTTLE_LONG_MS ? 2 : 1; prompt = 0;
        // Throttled after a sustained late run. Each further late hand-back doubles the stretch, from the one remembered.
        if (late >= THROTTLE_RUN) {
          now = true; seen = true;
          stretch = Math.min(THROTTLED_PACE_MAX_MS, Math.max(PACE_MS, delay, 2 * stretch));
        }
      } else {
        // A prompt hand-back drops straight back to the 50 ms pace: the window may be showing again. Under second
        // alignment a long stretch can also end just before a whole second, so the stretch is remembered until
        // `THROTTLE_CLEAR` prompt ones in a row: throttling read again meanwhile resumes it rather than growing from 50 ms.
        prompt++; late = 0; now = false;
        if (prompt >= THROTTLE_CLEAR) stretch = 0;
      }
    }
    last = back;
  };
  const fn = (ms?: number): Promise<void> => take(ms, false);
  Object.defineProperty(fn, 'every', { value: (): Promise<void> => take(0, true) });
  return Object.defineProperty(fn, 'throttled', { get: () => seen }) as HandBack;
};
