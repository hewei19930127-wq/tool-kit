import { Pipette } from "lucide-react";
import { useMemo, useState } from "react";
import { useToolInput } from "@/core/hooks/useToolInput";
import { contrastRatio, parseColor, wcagLevels } from "./color";
import { pickColor } from "./eyedropper";

function Badge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-xs ${
        ok ? "bg-success/20 text-success" : "bg-error/20 text-error"
      }`}
    >
      {label} {ok ? "pass" : "fail"}
    </span>
  );
}

export default function ColorTool() {
  const [input, setInput] = useToolInput("color");
  const [foreground, setForeground] = useState("#000000");
  const [background, setBackground] = useState("#ffffff");

  const models = useMemo(() => (input.trim() ? parseColor(input) : null), [input]);
  const ratio = useMemo(() => contrastRatio(foreground, background), [background, foreground]);
  const swatch = models?.ok ? models.value.hex : "transparent";
  const levels = ratio.ok ? wcagLevels(ratio.value) : null;

  async function eyedrop() {
    const picked = await pickColor();
    if (picked) setInput(picked);
  }

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          aria-label="Color input"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="#ff0000, rgb(...), hsl(...), or a CSS name"
          className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-1.5 font-mono text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"
        />
        <button
          type="button"
          onClick={eyedrop}
          className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1.5 text-sm outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary"
        >
          <Pipette className="h-4 w-4" strokeWidth={1.75} />
          Pick
        </button>
        <div
          role="img"
          aria-label="Color swatch"
          className="h-8 w-8 rounded-md border border-border"
          style={{ background: swatch }}
        />
      </div>

      {models && !models.ok && (
        <p role="alert" className="text-sm text-error">
          {models.error}
        </p>
      )}
      {models?.ok && (
        <div className="flex flex-col">
          {(["hex", "rgb", "hsl", "hsv"] as const).map((key) => (
            <div key={key} className="flex items-baseline gap-3 border-b border-border py-2">
              <span className="w-16 shrink-0 text-xs uppercase text-muted-foreground">{key}</span>
              <span aria-label={key} className="break-all font-mono text-sm">
                {models.value[key]}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-md border border-border p-3">
        <div className="mb-2 text-xs uppercase text-muted-foreground">Contrast checker</div>
        <div className="flex flex-wrap items-center gap-3">
          <input
            aria-label="Foreground"
            value={foreground}
            onChange={(event) => setForeground(event.target.value)}
            className="w-28 rounded-md border border-border bg-background px-2 py-1 font-mono text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"
          />
          <input
            aria-label="Background"
            value={background}
            onChange={(event) => setBackground(event.target.value)}
            className="w-28 rounded-md border border-border bg-background px-2 py-1 font-mono text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"
          />
          <div className="rounded px-3 py-1" style={{ color: foreground, background }}>
            Aa
          </div>
          {ratio.ok && levels && (
            <>
              <span aria-label="Contrast ratio" className="font-mono text-sm">
                {ratio.value.toFixed(2)}:1
              </span>
              <Badge ok={levels.aaLarge} label="AA large" />
              <Badge ok={levels.aa} label="AA" />
              <Badge ok={levels.aaa} label="AAA" />
            </>
          )}
          {!ratio.ok && (
            <span role="alert" className="text-sm text-error">
              {ratio.error}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
