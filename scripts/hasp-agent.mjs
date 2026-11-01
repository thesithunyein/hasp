// The agent. It may ask for one quote. It never sends NEAR.
const MAX = 20_000_000_000_000_000_000_000n;
const NEAR = "nep141:wrap.near";
const USDC =
  "nep141:17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1";

const amountArg = process.argv[2] ?? "";
const account = (process.argv[3] ?? "").trim().toLowerCase();

function yocto(input) {
  if (!/^\d+(\.\d{1,8})?$/.test(input) || /^0+(\.0+)?$/.test(input)) return null;
  const [whole, frac = ""] = input.split(".");
  const padded = (frac + "0".repeat(24)).slice(0, 24);
  return BigInt(whole) * 10n ** 24n + BigInt(padded);
}

function accountOk(value) {
  if (value.length < 2 || value.length > 64) return false;
  if (/^[0-9a-f]{64}$/.test(value)) return true;
  return /^(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$/.test(value);
}

if (!accountOk(account)) {
  console.log("DROPPED");
  console.log("That is not a NEAR account. Nothing was deposited.");
  process.exit(2);
}

const atoms = yocto(amountArg.trim());
if (atoms === null) {
  console.log("DROPPED");
  console.log("Amount is not a NEAR value. Nothing was deposited.");
  process.exit(2);
}

const deadline = new Date(Date.now() + 10 * 60 * 1000).toISOString();
const res = await fetch("https://1click.chaindefuser.com/v0/quote", {
  method: "POST",
  headers: { "content-type": "application/json", accept: "application/json" },
  body: JSON.stringify({
    dry: true,
    swapType: "EXACT_INPUT",
    slippageTolerance: 100,
    originAsset: NEAR,
    depositType: "ORIGIN_CHAIN",
    destinationAsset: USDC,
    amount: atoms.toString(),
    recipient: account,
    recipientType: "INTENTS",
    refundTo: account,
    refundType: "ORIGIN_CHAIN",
    deadline,
  }),
});

if (!res.ok) {
  console.log("FAILED");
  console.log(`Quote refused (${res.status}). Nothing was deposited.`);
  process.exit(1);
}

const body = await res.json();
const out = body.quote?.amountOutFormatted ?? "";
const usd = body.quote?.amountOutUsd ?? "";

if (atoms > MAX) {
  console.log("DROPPED");
  console.log(`Above 0.02 NEAR. Quote was ${out} USDC. Nothing was deposited.`);
  process.exit(2);
}

console.log("FITS");
console.log(`${amountArg.trim()} NEAR -> ${out} USDC${usd ? ` (${usd})` : ""}.`);
console.log("Nothing was deposited. Open it once on the clasp.");
process.exit(0);
