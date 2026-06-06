import type { ToolResult } from "@/core/types";

const DIGITS = "0123456789abcdefghijklmnopqrstuvwxyz";

function parseInBase(input: string, base: number): bigint | null {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return null;

  let body = trimmed;
  let negative = false;

  if (body.startsWith("-")) {
    negative = true;
    body = body.slice(1);
  }

  if (!body) return null;

  const bigBase = BigInt(base);
  let result = 0n;

  for (const char of body) {
    const digit = DIGITS.indexOf(char);
    if (digit < 0 || digit >= base) return null;
    result = result * bigBase + BigInt(digit);
  }

  return negative ? -result : result;
}

function formatInBase(value: bigint, base: number): string {
  if (value === 0n) return "0";

  const negative = value < 0n;
  let remaining = negative ? -value : value;
  const bigBase = BigInt(base);
  let output = "";

  while (remaining > 0n) {
    output = DIGITS[Number(remaining % bigBase)] + output;
    remaining /= bigBase;
  }

  return negative ? `-${output}` : output;
}

export function convertRadix(
  input: string,
  fromBase: number,
  toBase: number,
): ToolResult {
  if (fromBase < 2 || fromBase > 36 || toBase < 2 || toBase > 36) {
    return { ok: false, error: "Base must be between 2 and 36" };
  }

  const value = parseInBase(input, fromBase);
  if (value === null) {
    return { ok: false, error: `Invalid digits for base ${fromBase}` };
  }

  return { ok: true, value: formatInBase(value, toBase) };
}

/** Space-separated nibbles of the unsigned binary representation. */
export function toBinaryGroups(value: bigint): string {
  const binary = formatInBase(value < 0n ? -value : value, 2);
  const padded = binary.padStart(Math.ceil(binary.length / 4) * 4, "0");
  return padded.replace(/(.{4})(?=.)/g, "$1 ");
}
