import test from "node:test";
import assert from "node:assert/strict";

import { syncCronTasks } from "./cron";

test("syncCronTasks removes disabled or stale jobs and keeps enabled ones active", () => {
  const existing = new Map<string, any>([
    ["keep", { stop: () => "stop-keep" }],
    ["remove-disabled", { stop: () => "stop-disabled" }],
    ["remove-stale", { stop: () => "stop-stale" }],
  ] as Array<[string, any]>);

  const next = syncCronTasks(existing as any, [
    { id: "keep", enabled: true, schedule: "0 8 * * *", timezone: "Asia/Shanghai" },
    { id: "remove-disabled", enabled: false, schedule: "0 9 * * *", timezone: "Asia/Shanghai" },
  ]);

  assert.equal(next.has("keep"), true);
  assert.equal(next.has("remove-disabled"), false);
  assert.equal(next.has("remove-stale"), false);
});
