/** 0.02 NEAR, in yoctoNEAR. */
export const MAX_YOCTO = 20_000_000_000_000_000_000_000n;

export const NEAR_ASSET = "nep141:wrap.near";
export const USDC_ASSET =
  "nep141:17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1";

const NAMED =
  /^(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$/;

export function parseNearToYocto(input: string): bigint | null {
  const s = input.trim();
  if (!/^\d+(\.\d{1,8})?$/.test(s)) return null;
  if (/^0+(\.0+)?$/.test(s)) return null;
  const [whole, frac = ""] = s.split(".");
  const padded = (frac + "0".repeat(24)).slice(0, 24);
  return BigInt(whole) * 10n ** 24n + BigInt(padded);
}

export function validAccount(input: string): boolean {
  const s = input.trim().toLowerCase();
  if (s.length < 2 || s.length > 64) return false;
  if (/^[0-9a-f]{64}$/.test(s)) return true;
  return NAMED.test(s);
}

export function fitsAmount(yocto: bigint): boolean {
  return yocto > 0n && yocto <= MAX_YOCTO;
}
