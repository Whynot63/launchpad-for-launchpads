import assert from "node:assert/strict";
import { test } from "node:test";
import { shouldUpdatePrice } from "./deviation.ts";

const usd = (dollars: number) => BigInt(dollars) * 10n ** 18n;

test("updates when the contract has no price yet", () => {
  assert.equal(shouldUpdatePrice(undefined, usd(3000)), true);
});

test("keeps the price when the market moved exactly 5%", () => {
  assert.equal(shouldUpdatePrice(usd(3000), usd(3150)), false);
  assert.equal(shouldUpdatePrice(usd(3000), usd(2850)), false);
});

test("updates when the market rose more than 5%", () => {
  assert.equal(shouldUpdatePrice(usd(3000), usd(3151)), true);
});

test("updates when the market fell more than 5%", () => {
  assert.equal(shouldUpdatePrice(usd(3000), usd(2849)), true);
});

test("keeps the price when the market barely moved", () => {
  assert.equal(shouldUpdatePrice(usd(3000), usd(3010)), false);
});
