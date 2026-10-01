/**
 * US equity market session, derived from the clock rather than from a feed.
 *
 * xStocks trade on chain at any hour, but the equities behind them do not: when New York
 * is closed, market makers widen or step away, so a mint still works and simply prices
 * worse. This exists to say so before someone signs, not to block them.
 *
 * Regular hours and full-day holidays are modelled. Early closes — the half sessions
 * around Thanksgiving and Christmas — are not, so an afternoon on one of those days reads
 * as open when the exchange has already closed.
 */

export type SessionState = "open" | "pre" | "after" | "weekend" | "holiday" | "overnight";

export interface MarketSession {
  state: SessionState;
  /** Two or three words for a badge. */
  label: string;
  /** One sentence on what it means for a mint. */
  detail: string;
  /** True only during the regular 09:30–16:00 session. */
  isOpen: boolean;
}

const NEW_YORK = "America/New_York";

const OPEN_MINUTE = 9 * 60 + 30;
const CLOSE_MINUTE = 16 * 60;
const PRE_MINUTE = 4 * 60;
const AFTER_MINUTE = 20 * 60;

interface NewYorkTime {
  year: number;
  month: number;
  day: number;
  /** 0 is Sunday. */
  weekday: number;
  minutes: number;
}

/** The wall clock in New York, whatever the viewer's own time zone is. */
function newYorkTime(now: Date): NewYorkTime {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: NEW_YORK,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    weekday: "short",
    hour: "numeric",
    minute: "numeric",
    hour12: false
  }).formatToParts(now);

  const read = (type: string) => parts.find((part) => part.type === type)?.value ?? "0";
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return {
    year: Number(read("year")),
    month: Number(read("month")),
    day: Number(read("day")),
    weekday: Math.max(0, weekdays.indexOf(read("weekday"))),
    // Midnight formats as 24 in some runtimes; normalise it back to 0.
    minutes: (Number(read("hour")) % 24) * 60 + Number(read("minute"))
  };
}

const key = (month: number, day: number) => month * 100 + day;

/** Shifts a holiday off a weekend the way the exchange does: back to Friday, on to Monday. */
function observed(year: number, month: number, day: number): number {
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  if (weekday === 6) return key(month, day - 1);
  if (weekday === 0) return key(month, day + 1);
  return key(month, day);
}

/** Nth weekday of a month, e.g. the third Monday in January. */
function nth(year: number, month: number, weekday: number, n: number): number {
  const first = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  return key(month, 1 + ((weekday - first + 7) % 7) + (n - 1) * 7);
}

/** Last given weekday of a month, e.g. the final Monday in May. */
function last(year: number, month: number, weekday: number): number {
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const end = new Date(Date.UTC(year, month - 1, days)).getUTCDay();
  return key(month, days - ((end - weekday + 7) % 7));
}

/** Good Friday, two days before Easter (anonymous Gregorian computus). */
function goodFriday(year: number): number {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;

  const easter = new Date(Date.UTC(year, month - 1, day));
  easter.setUTCDate(easter.getUTCDate() - 2);
  return key(easter.getUTCMonth() + 1, easter.getUTCDate());
}

/** Full-day exchange holidays for a year, as month*100+day keys. */
function holidays(year: number): Set<number> {
  return new Set([
    observed(year, 1, 1), // New Year's Day
    nth(year, 1, 1, 3), // Martin Luther King Jr. Day
    nth(year, 2, 1, 3), // Washington's Birthday
    goodFriday(year),
    last(year, 5, 1), // Memorial Day
    observed(year, 6, 19), // Juneteenth
    observed(year, 7, 4), // Independence Day
    nth(year, 9, 1, 1), // Labor Day
    nth(year, 11, 4, 4), // Thanksgiving
    observed(year, 12, 25) // Christmas
  ]);
}

const DETAIL: Record<SessionState, string> = {
  open: "New York is open, so routes are at their deepest.",
  pre: "Pre-market. The equities behind this basket trade thinly until 09:30 New York.",
  after: "After hours. Liquidity thins until the next session opens.",
  weekend: "US equity markets are closed for the weekend; expect wider pricing.",
  holiday: "US equity markets are closed for a holiday; expect wider pricing.",
  overnight: "US equity markets are closed overnight; expect wider pricing."
};

const LABEL: Record<SessionState, string> = {
  open: "Market open",
  pre: "Pre-market",
  after: "After hours",
  weekend: "Weekend",
  holiday: "Market holiday",
  overnight: "Market closed"
};

/**
 * The current US equity session.
 *
 * @param now Instant to classify; defaults to the present.
 * @returns State, a short label, and one sentence on what it means for a mint.
 */
export function marketSession(now: Date = new Date()): MarketSession {
  const time = newYorkTime(now);

  const state: SessionState =
    time.weekday === 0 || time.weekday === 6
      ? "weekend"
      : holidays(time.year).has(key(time.month, time.day))
        ? "holiday"
        : time.minutes >= OPEN_MINUTE && time.minutes < CLOSE_MINUTE
          ? "open"
          : time.minutes >= PRE_MINUTE && time.minutes < OPEN_MINUTE
            ? "pre"
            : time.minutes >= CLOSE_MINUTE && time.minutes < AFTER_MINUTE
              ? "after"
              : "overnight";

  return {state, label: LABEL[state], detail: DETAIL[state], isOpen: state === "open"};
}
