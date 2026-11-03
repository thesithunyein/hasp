import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_YOCTO,
  fitsAmount,
  parseNearToYocto,
  validAccount,
} from "./rule.ts";

const NEAR = 10n ** 24n;

describe("parseNearToYocto", () => {
  it("parses whole and fractional NEAR to yocto", () => {
    assert.equal(parseNearToYocto("1"), NEAR);
    assert.equal(parseNearToYocto("0.02"), 2n * 10n ** 22n);
    assert.equal(parseNearToYocto("1.5"), NEAR + NEAR / 2n);
    assert.equal(parseNearToYocto("0.00000001"), 10n ** 16n);
    assert.equal(parseNearToYocto(" 0.02 "), 2n * 10n ** 22n);
  });

  it("refuses zero, malformed and over-precise values", () => {
    const rejected = [
      "",
      "0",
      "0.0",
      "00",
      "-1",
      ".5",
      "1.",
      "1.123456789",
      "abc",
      "1,5",
    ];
    for (const value of rejected) {
      assert.equal(parseNearToYocto(value), null, value);
    }
  });

  it("keeps a large amount exact", () => {
    assert.equal(parseNearToYocto("1000000"), 1_000_000n * NEAR);
  });
});

describe("validAccount", () => {
  it("accepts named accounts and 64-hex account ids", () => {
    assert.equal(validAccount("alice.near"), true);
    assert.equal(validAccount("vendor.sithunyein.near"), true);
    assert.equal(validAccount("a_b-c.near"), true);
    assert.equal(validAccount("0123456789abcdef".repeat(4)), true);
    assert.equal(validAccount("ALICE.NEAR"), true);
  });

  it("refuses malformed accounts", () => {
    assert.equal(validAccount("a"), false);
    assert.equal(validAccount("alice..near"), false);
    assert.equal(validAccount("-alice.near"), false);
    assert.equal(validAccount("alice.near."), false);
    assert.equal(validAccount("x".repeat(65)), false);
  });
});

describe("fitsAmount", () => {
  it("allows 1 yocto up to 0.02 NEAR", () => {
    assert.equal(fitsAmount(1n), true);
    assert.equal(fitsAmount(MAX_YOCTO), true);
  });

  it("refuses zero and anything above 0.02 NEAR", () => {
    assert.equal(fitsAmount(0n), false);
    assert.equal(fitsAmount(MAX_YOCTO + 1n), false);
  });
});
