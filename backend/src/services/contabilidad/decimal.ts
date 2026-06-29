import type { DecimalString } from "./types";

export type Money = bigint;

export const ZERO_MONEY = 0n;

export function moneyFrom(value: unknown): Money {
  const raw = String(value ?? "0").trim().replace(/\s/g, "").replace(",", ".");
  const negative = raw.startsWith("-");
  const unsigned = negative ? raw.slice(1) : raw;
  const [integerRaw = "0", decimalRaw = ""] = unsigned.split(".");
  const integerPart = integerRaw.replace(/\D/g, "") || "0";
  const decimalPart = decimalRaw.replace(/\D/g, "").padEnd(2, "0").slice(0, 2);
  const cents = BigInt(integerPart) * 100n + BigInt(decimalPart || "0");

  return negative ? -cents : cents;
}

export function addMoney(values: Money[]): Money {
  return values.reduce((total, value) => total + value, ZERO_MONEY);
}

export function isZero(value: Money): boolean {
  return value === ZERO_MONEY;
}

export function isNegative(value: Money): boolean {
  return value < ZERO_MONEY;
}

export function absMoney(value: Money): Money {
  return value < ZERO_MONEY ? -value : value;
}

export function formatMoney(value: Money): DecimalString {
  const negative = value < ZERO_MONEY;
  const cents = negative ? -value : value;
  const integer = cents / 100n;
  const decimals = String(cents % 100n).padStart(2, "0");

  return `${negative ? "-" : ""}${integer}.${decimals}`;
}

export function displayMoney(value: Money): DecimalString {
  const negative = value < ZERO_MONEY;
  const cents = negative ? -value : value;
  const integer = cents / 100n;
  const decimals = String(cents % 100n).padStart(2, "0");
  const integerWithThousands = String(integer).replace(/\B(?=(\d{3})+(?!\d))/g, ".");

  return `${negative ? "-" : ""}${integerWithThousands},${decimals}`;
}
