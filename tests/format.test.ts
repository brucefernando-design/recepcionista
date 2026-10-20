import { test } from "node:test";
import assert from "node:assert/strict";
import { callDuration, formatSpokenTimeEs, formatTime12h, relativeTime } from "../lib/format";

test("spoken time spanish formats naturally", () => {
  assert.equal(formatSpokenTimeEs("15:00"), "las 3 de la tarde");
  assert.equal(formatSpokenTimeEs("10:00"), "las 10 de la mañana");
  assert.equal(formatSpokenTimeEs("13:00"), "la 1 de la tarde");
  assert.equal(formatSpokenTimeEs("15:30"), "las 3 y media de la tarde");
  assert.equal(formatSpokenTimeEs("12:00"), "las 12 del mediodía");
  assert.equal(formatTime12h("15:00"), "3:00 PM");
  assert.equal(formatTime12h("09:30"), "9:30 AM");
});

test("relative time buckets", () => {
  const now = Date.now();
  assert.equal(relativeTime(new Date(now - 10_000).toISOString()), "just now");
  assert.equal(relativeTime(new Date(now - 5 * 60_000).toISOString()), "5m ago");
  assert.equal(relativeTime(new Date(now - 3 * 3600_000).toISOString()), "3h ago");
  assert.equal(relativeTime(new Date(now - 2 * 86400_000).toISOString()), "2d ago");
});

test("call duration formats minutes and seconds", () => {
  assert.equal(
    callDuration("2026-07-13T10:00:00Z", "2026-07-13T10:02:30Z"),
    "2m 30s"
  );
  assert.equal(
    callDuration("2026-07-13T10:00:00Z", "2026-07-13T10:00:45Z"),
    "45s"
  );
});

test("call duration guards nonsense ranges", () => {
  assert.equal(callDuration("2026-07-13T10:00:00Z"), null);
  assert.equal(
    callDuration("2026-07-13T10:00:00Z", "2026-07-13T09:00:00Z"),
    null
  );
});
