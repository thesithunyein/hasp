// The agent's rule, checked before it asks NEAR Intents for anything: which merchants it may
// pay, how much per purchase, and how much per day (UTC). No network, so it is easy to test.

const NAMED = /^(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$/;

export function validAccount(value) {
  const s = String(value ?? "").trim();
  if (s.length < 2 || s.length > 64) return false;
  return /^[0-9a-f]{64}$/.test(s) || NAMED.test(s);
}

/** Dollars as integer cents, or null. "1" -> 100, "4.50" -> 450. */
export function cents(value) {
  const s = String(value ?? "").trim();
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const [whole, frac = ""] = s.split(".");
  const c = Number(whole) * 100 + Number((frac + "00").slice(0, 2));
  return c > 0 ? c : null;
}

export function dollars(c) {
  return `$${(c / 100).toFixed(c % 100 === 0 ? 0 : 2)}`;
}

function day(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Cents already spent today, from the agent's own log of settled purchases. */
export function spentToday(log, now = Date.now()) {
  const today = day(now);
  return (log ?? []).filter((e) => e && e.status === "SUCCESS" && day(e.at) === today).reduce((sum, e) => sum + (e.cents || 0), 0);
}

/**
 * { ok: true, cents } or { ok: false, reason }.
 * rule: { merchants: string[], maxPerPurchaseUsd: string, maxPerDayUsd: string }
 */
export function checkRule(rule, log, { to, usd, now = Date.now() }) {
  const account = String(to ?? "").trim().toLowerCase();
  if (!validAccount(account)) return { ok: false, reason: "that is not a NEAR account" };
  const c = cents(usd);
  if (c === null) return { ok: false, reason: "the price is not a dollar amount like 1 or 4.50" };
  const merchants = (rule?.merchants ?? []).map((m) => String(m).trim().toLowerCase());
  if (!merchants.includes(account)) return { ok: false, reason: `${account} is not on the agent's list of merchants` };
  const per = cents(rule?.maxPerPurchaseUsd);
  if (per === null || c > per) return { ok: false, reason: `${dollars(c)} is over the ${per === null ? "missing" : dollars(per)} limit per purchase` };
  const perDay = cents(rule?.maxPerDayUsd);
  const spent = spentToday(log, now);
  if (perDay === null || spent + c > perDay) {
    return { ok: false, reason: `${dollars(spent)} already spent today; ${dollars(c)} more would pass the ${perDay === null ? "missing" : dollars(perDay)} daily limit` };
  }
  return { ok: true, cents: c, spent, perDay, per };
}
