import { useMemo, useState } from "react";
import { useToolInput } from "@/core/hooks/useToolInput";
import { type I18nKey, useI18n } from "@/core/i18n";
import { resultError } from "@/core/i18n/result";
import { convertRadix, toBinaryGroups } from "./radix";

const TARGET_BASES = [2, 8, 10, 16] as const;
const LABEL_KEYS: Record<number, I18nKey> = {
  2: "tools.radix.labels.binary",
  8: "tools.radix.labels.octal",
  10: "tools.radix.labels.decimal",
  16: "tools.radix.labels.hexadecimal",
};

type RadixRows =
  | { error: string }
  | {
      values: {
        base: (typeof TARGET_BASES)[number];
        result: ReturnType<typeof convertRadix>;
      }[];
      bitwise: string;
    };

export default function RadixTool() {
  const { t } = useI18n();
  const [input, setInput] = useToolInput("radix");
  const [fromBase, setFromBase] = useState(10);

  const rows = useMemo<RadixRows | null>(() => {
    if (!input.trim()) return null;

    const decimal = convertRadix(input, fromBase, 10);
    if (!decimal.ok) return { error: resultError(decimal, t) };

    const value = BigInt(decimal.value);
    return {
      values: TARGET_BASES.map((base) => ({
        base,
        result: convertRadix(input, fromBase, base),
      })),
      bitwise: toBinaryGroups(value),
    };
  }, [fromBase, input, t]);

  return (
    <div className="flex h-full flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          aria-label={t("tools.radix.input")}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={t("tools.radix.placeholder")}
          className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-1.5 font-mono text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"
        />
        <label htmlFor="radix-source-base" className="text-sm text-muted-foreground">
          {t("tools.radix.fromBase")}
        </label>
        <select
          id="radix-source-base"
          aria-label={t("tools.radix.sourceBase")}
          value={fromBase}
          onChange={(event) => setFromBase(Number(event.target.value))}
          className="rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {Array.from({ length: 35 }, (_, index) => index + 2).map((base) => (
            <option key={base} value={base}>
              {base}
            </option>
          ))}
        </select>
      </div>

      {!rows && <p className="text-sm text-muted-foreground">{t("tools.radix.empty")}</p>}
      {rows && "error" in rows && (
        <div role="alert" className="font-mono text-sm text-error">
          {rows.error}
        </div>
      )}
      {rows && "values" in rows && (
        <div className="flex min-h-0 flex-col overflow-auto">
          {rows.values.map((row) => (
            <div key={row.base} className="flex items-baseline gap-3 border-b border-border py-2">
              <span className="w-28 shrink-0 text-xs uppercase text-muted-foreground">
                {t(LABEL_KEYS[row.base])}
              </span>
              <span aria-label={t(LABEL_KEYS[row.base])} className="break-all font-mono text-sm">
                {row.result.ok ? row.result.value : resultError(row.result, t)}
              </span>
            </div>
          ))}
          <div className="flex items-baseline gap-3 py-2">
            <span className="w-28 shrink-0 text-xs uppercase text-muted-foreground">
              {t("tools.radix.labels.bitwise")}
            </span>
            <span className="break-all font-mono text-sm">{rows.bitwise}</span>
          </div>
        </div>
      )}
    </div>
  );
}
