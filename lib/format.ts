// Small display helpers shared across the dashboard.

export function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const sec = Math.round(diffMs / 1000);
  if (sec < 60) return "just now";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function callDuration(startedAt: string, endedAt?: string): string | null {
  if (!endedAt) return null;
  const sec = Math.round(
    (new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000
  );
  if (sec <= 0 || sec > 3600 * 6) return null;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export function formatTime12h(time: string): string {
  const [hStr, mStr] = time.split(":");
  const h = Number(hStr);
  const m = mStr ?? "00";
  if (isNaN(h)) return time;
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${m} ${period}`;
}

export function formatSpokenTimeEs(time: string): string {
  const [hStr, mStr] = time.split(":");
  const h = Number(hStr);
  const m = Number(mStr ?? 0);
  if (isNaN(h)) return time;

  const h12 = h % 12 || 12;
  const period =
    h === 12
      ? "del mediodía"
      : h >= 12 && h < 19
      ? "de la tarde"
      : h >= 19
      ? "de la noche"
      : "de la mañana";
  const minutesPart =
    m === 30
      ? " y media"
      : m === 15
      ? " y cuarto"
      : m > 0
      ? ` y ${m}`
      : "";
  const article = h12 === 1 ? "la" : "las";

  return `${article} ${h12}${minutesPart} ${period}`;
}
