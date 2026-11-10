// Tests for the pure parts of public/checkout.js: prices, accounts, refund addresses, the coin
// list and the exact quote it asks NEAR Intents for. Run: node --test scripts/checkout.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

function loadCore() {
  const source = readFileSync(new URL("../public/checkout.js", import.meta.url), "utf8");
  const context = { module: { exports: {} } };
  vm.runInNewContext(source, context);
  return context.module.exports;
}

const core = loadCore();

test("a price becomes USDC base units, six decimals", () => {
  assert.equal(core.usdToBase("5"), "5000000");
  assert.equal(core.usdToBase("4.50"), "4500000");
  assert.equal(core.usdToBase("0.01"), "10000");
  assert.equal(core.usdToBase("1.5"), "1500000");
});

test("a price that is not a plain amount, is zero, or is too large is refused", () => {
  for (const bad of ["", "0", "0.00", "-1", "1.234", "1e3", "abc", "10000.01", " "]) {
    assert.equal(core.usdToBase(bad), null, bad);
  }
  assert.equal(core.usdToBase("10000"), "10000000000");
});

test("only a NEAR account can receive", () => {
  assert.ok(core.validNearAccount("sithunyein.near"));
  assert.ok(core.validNearAccount("a".repeat(64).replace(/a/g, "f")));
  assert.ok(!core.validNearAccount("Sithu.near"));
  assert.ok(!core.validNearAccount("0x2527D02599Ba641c19FEa793cD0F167589a0f10D"));
  assert.ok(!core.validNearAccount("a"));
});

test("a refund address is checked against the chain it is on", () => {
  assert.equal(core.refundProblem("near", "buyer.near"), null);
  assert.equal(core.refundProblem("base", "0x2527D02599Ba641c19FEa793cD0F167589a0f10D"), null);
  assert.equal(core.refundProblem("sol", "13QkxhNMrTPxoCkRdYdJ65tFuwXPhL5gLS2Z5Nr6gjRK"), null);
  assert.equal(core.refundProblem("btc", "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq"), null);
  assert.match(core.refundProblem("base", "buyer.near"), /starts with 0x/);
  assert.match(core.refundProblem("near", "Buyer Name"), /not a NEAR account/);
  assert.match(core.refundProblem("sol", ""), /Enter your Solana address/);
});

test("the quote asks for exact USDC on NEAR, paid to the merchant, refunded to the buyer", () => {
  const now = Date.UTC(2026, 10, 11, 0, 0, 0);
  const q = core.quoteRequest({ originAsset: "nep141:wrap.near", amount: "5000000", refundTo: "buyer.near", to: "shop.near", chain: "near", now });
  assert.equal(q.swapType, "EXACT_OUTPUT");
  assert.equal(q.destinationAsset, core.USDC_NEAR);
  assert.equal(q.amount, "5000000");
  assert.equal(q.recipient, "shop.near");
  assert.equal(q.recipientType, "DESTINATION_CHAIN");
  assert.equal(q.refundTo, "buyer.near");
  assert.equal(q.refundType, "ORIGIN_CHAIN");
  assert.equal(q.depositType, "ORIGIN_CHAIN");
  assert.equal(q.dry, false);
  assert.equal(q.deadline, "2026-11-11T01:00:00.000Z");
  const btc = core.quoteRequest({ originAsset: "x", amount: "1", refundTo: "y", to: "z", chain: "btc", now });
  assert.equal(btc.deadline, "2026-11-11T03:00:00.000Z");
});

test("coins with a minimum above the price are left out, popular coins come first", () => {
  const tokens = [
    { assetId: "a", blockchain: "tron", symbol: "USDT" },
    { assetId: "b", blockchain: "sol", symbol: "SOL" },
    { assetId: "c", blockchain: "near", symbol: "wNEAR" },
    { assetId: "d", blockchain: "doge", symbol: "DOGE" },
    { assetId: "e", blockchain: "bsc", symbol: "BNB" },
  ];
  const five = core.payable(tokens, "5").map((t) => t.assetId);
  assert.deepEqual(five, ["c", "b", "d"]);
  const big = core.payable(tokens, "1000").map((t) => t.assetId);
  assert.ok(big.includes("a") && big.includes("e"));
  assert.equal(core.coinName(tokens[2]), "NEAR");
});

test("every 1Click status reads as a plain sentence, and only three are final", () => {
  for (const s of ["PENDING_DEPOSIT", "KNOWN_DEPOSIT_TX", "INCOMPLETE_DEPOSIT", "PROCESSING", "SUCCESS", "REFUNDED", "FAILED"]) {
    assert.ok(core.statusText(s).length > 3, s);
  }
  assert.deepEqual(
    ["PENDING_DEPOSIT", "PROCESSING", "SUCCESS", "REFUNDED", "FAILED"].map(core.finalStatus),
    [false, false, true, true, true],
  );
});

test("the amount to send is rounded up, never below the quote", () => {
  assert.equal(core.sendAmount("286646832515135381220734", 24), "0.286647");
  assert.equal(core.sendAmount("286646000000000000000000", 24), "0.286646");
  assert.equal(core.sendAmount("1014689", 6), "1.014689");
  assert.equal(core.sendAmount("12288631", 9), "0.012289");
  assert.equal(core.sendAmount("123456", 8), "0.00123456");
  assert.equal(core.sendAmount("487000000000001", 18), "0.000488");
  assert.equal(core.sendAmount("abc", 6), null);
});

test("time left reads in minutes, hours or days", () => {
  const now = Date.UTC(2026, 10, 11);
  assert.equal(core.timeLeft(new Date(now + 45 * 60000).toISOString(), now), "about 45 minutes");
  assert.equal(core.timeLeft(new Date(now + 3 * 3600000).toISOString(), now), "about 3 hours");
  assert.equal(core.timeLeft(new Date(now + 73 * 3600000).toISOString(), now), "about 3 days");
  assert.equal(core.timeLeft(new Date(now - 1000).toISOString(), now), null);
});

test("coin badges: a chain mark only when the coin is not the chain's own, and only letters in the label", () => {
  const native = core.coinBadge("ETH", "eth");
  const bridged = core.coinBadge("USDC", "base");
  assert.equal((native.match(/<circle/g) || []).length, 3);
  assert.equal((bridged.match(/<circle/g) || []).length, 4);
  assert.match(bridged, />B<\/text>/);
  assert.match(core.coinBadge("wNEAR", "near"), />NEAR<\/text>/);
  assert.doesNotMatch(core.coinBadge("<img onerror=x>", "near"), /<img/);
});
