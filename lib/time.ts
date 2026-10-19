/** All plan times are West Africa Time (Africa/Lagos, UTC+1, no daylight saving). */
export const TZ = "Africa/Lagos";
export const OFFSET = "+01:00";

export function watToIso(date: string, time: string): string {
  return new Date(`${date}T${time}:00${OFFSET}`).toISOString();
}

/** Split an ISO timestamp into WAT date (YYYY-MM-DD) and time (HH:MM). */
export function isoToWat(iso: string): { date: string; time: string } {
  const d = new Date(new Date(iso).getTime() + 60 * 60 * 1000);
  const s = d.toISOString();
  return { date: s.slice(0, 10), time: s.slice(11, 16) };
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * "Mon 19 Oct, 09:00" in WAT. Built by hand rather than with Intl, so the server and every
 * browser produce exactly the same text (Intl output differs slightly between engines).
 */
export function formatWat(iso: string): string {
  const d = new Date(new Date(iso).getTime() + 60 * 60 * 1000);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}, ${hh}:${mm}`;
}

export function monthKey(iso: string): string {
  return isoToWat(iso).date.slice(0, 7);
}
