// The agent's rule is checked before any quote: these runs never reach the network.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { checkRule, cents, spentToday } from "./agent-rule.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const rule = { merchants: ["shop.near"], maxPerPurchaseUsd: "2", maxPerDayUsd: "5" };
const now = Date.UTC(2026, 10, 11, 12);

function run(args, log = []) {
  const dir = mkdtempSync(join(tmpdir(), "hasp-agent-"));
  writeFileSync(join(dir, "rule.json"), JSON.stringify(rule));
  writeFileSync(join(dir, "log.json"), JSON.stringify(log));
  return new Promise((resolve) => {
    execFile(
      process.execPath,
      [join(root, "scripts", "hasp-agent.mjs"), ...args],
      { cwd: root, env: { ...process.env, HASP_AGENT_RULE: join(dir, "rule.json"), HASP_AGENT_LOG: join(dir, "log.json"), HASP_RPC: "http://127.0.0.1:9" } },
      (error, stdout) => resolve({ code: error?.code ?? 0, stdout }),
    );
  });
}

describe("the agent's rule", () => {
  it("allows a listed merchant within both limits", () => {
    const v = checkRule(rule, [], { to: "shop.near", usd: "1.50", now });
    assert.equal(v.ok, true);
    assert.equal(v.cents, 150);
  });

  it("stops a merchant that is not on the list", () => {
    assert.match(checkRule(rule, [], { to: "other.near", usd: "1", now }).reason, /not on the agent's list/);
  });

  it("stops a purchase over the per-purchase limit", () => {
    assert.match(checkRule(rule, [], { to: "shop.near", usd: "2.01", now }).reason, /over the \$2 limit per purchase/);
  });

  it("stops a purchase that would pass the daily limit, counting only today's settled ones", () => {
    const log = [
      { at: now - 3600_000, status: "SUCCESS", cents: 200 },
      { at: now - 7200_000, status: "SUCCESS", cents: 200 },
      { at: now - 7200_000, status: "REFUNDED", cents: 200 },
      { at: now - 86_400_000, status: "SUCCESS", cents: 200 },
    ];
    assert.equal(spentToday(log, now), 400);
    assert.match(checkRule(rule, log, { to: "shop.near", usd: "2", now }).reason, /daily limit/);
    assert.equal(checkRule(rule, log, { to: "shop.near", usd: "1", now }).ok, true);
  });

  it("reads prices as cents and refuses anything else", () => {
    assert.equal(cents("1"), 100);
    assert.equal(cents("4.5"), 450);
    for (const bad of ["0", "", "-1", "1.234", "abc"]) assert.equal(cents(bad), null, bad);
  });
});

describe("hasp-agent.mjs", () => {
  it("stops before a quote when the merchant is not listed", async () => {
    const { code, stdout } = await run(["buy", "--to", "other.near", "--usd", "1"]);
    assert.equal(code, 2);
    assert.match(stdout, /STOPPED: other\.near is not on the agent's list/);
    assert.match(stdout, /nothing was quoted or sent/);
    assert.doesNotMatch(stdout, /quote {4}/);
  });

  it("stops before a quote when the price is over the limit", async () => {
    const { code, stdout } = await run(["buy", "--to", "shop.near", "--usd", "3", "--send"]);
    assert.equal(code, 2);
    assert.match(stdout, /over the \$2 limit per purchase/);
  });

  it("refuses to pay without the agent's account set", async () => {
    const { code, stdout } = await run(["buy", "--to", "shop.near", "--usd", "1", "--send"]);
    assert.equal(code, 1);
    assert.match(stdout, /Set HASP_AGENT_ACCOUNT/);
  });
});
