import { ChevronDown, Pipette, Save } from "lucide-react";
import { useMemo, useState } from "react";
import { useHistory } from "@/core/hooks/useHistory";
import { useToolInput } from "@/core/hooks/useToolInput";
import { useI18n } from "@/core/i18n";
import { resultError } from "@/core/i18n/result";
import { contrastRatio, parseColor, wcagLevels } from "./color";
import { pickColor } from "./eyedropper";
import { palettes } from "./palettes";

function Badge({ ok, label }: { ok: boolean; label: string }) {
  const { t } = useI18n();

  return (
    <span
      className={`rounded px-1.5 py-0.5 text-xs ${
        ok ? "bg-success/20 text-success" : "bg-error/20 text-error"
      }`}
    >
      {label} {ok ? t("tools.color.pass") : t("tools.color.fail")}
    </span>
  );
}

export default function ColorTool() {
  const { t } = useI18n();
  const [input, setInput] = useToolInput("color");
  const [foreground, setForeground] = useState("#000000");
  const [background, setBackground] = useState("#ffffff");
  const { entries, record } = useHistory("color");
  const [palettesOpen, setPalettesOpen] = useState(true);
  const [activePaletteId, setActivePaletteId] =
    useState<(typeof palettes)[number]["id"]>("tailwind");

  const models = useMemo(() => (input.trim() ? parseColor(input) : null), [input]);
  const ratio = useMemo(() => contrastRatio(foreground, background), [background, foreground]);
  const swatch = models?.ok ? models.value.hex : "transparent";
  const levels = ratio.ok ? wcagLevels(ratio.value) : null;
  const activePalette = palettes.find((palette) => palette.id === activePaletteId) ?? palettes[0];

  async function eyedrop() {
    const picked = await pickColor();
    if (picked) setInput(picked);
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          aria-label={t("tools.color.input")}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={t("tools.color.placeholder")}
          className="min-w-0 flex-1 rounded-md border border-border bg-surface px-3 py-1.5 font-mono text-sm outline-none focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/20"
        />
        <button
          type="button"
          disabled={!models?.ok}
          onClick={() => {
            if (models?.ok) record(models.value.hex, models.value.hex);
          }}
          className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1.5 text-sm outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-40"
        >
          <Save className="h-4 w-4" strokeWidth={1.75} />
          {t("tools.color.save")}
        </button>
        <button
          type="button"
          onClick={eyedrop}
          className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1.5 text-sm outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary"
        >
          <Pipette className="h-4 w-4" strokeWidth={1.75} />
          {t("tools.color.pick")}
        </button>
        <div
          role="img"
          aria-label={t("tools.color.swatch")}
          className="h-8 w-8 rounded-md border border-border"
          style={{ background: swatch }}
        />
      </div>

      {entries.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase text-muted-foreground">
            {t("tools.color.history")}
          </span>
          {entries.map((entry) => (
            <button
              key={entry.input}
              type="button"
              aria-label={`${t("tools.color.history")} ${entry.input}`}
              title={entry.input}
              onClick={() => setInput(entry.input)}
              className="h-7 w-7 rounded-md border border-border outline-none transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-primary"
              style={{ background: entry.input }}
            />
          ))}
        </div>
      )}

      {models && !models.ok && (
        <p role="alert" className="text-sm text-error">
          {resultError(models, t)}
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
        <div className="mb-2 text-xs uppercase text-muted-foreground">
          {t("tools.color.contrastChecker")}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <input
            aria-label={t("tools.color.foreground")}
            value={foreground}
            onChange={(event) => setForeground(event.target.value)}
            className="w-28 rounded-md border border-border bg-surface px-2 py-1 font-mono text-sm outline-none focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/20"
          />
          <input
            aria-label={t("tools.color.background")}
            value={background}
            onChange={(event) => setBackground(event.target.value)}
            className="w-28 rounded-md border border-border bg-surface px-2 py-1 font-mono text-sm outline-none focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/20"
          />
          <div className="rounded px-3 py-1" style={{ color: foreground, background }}>
            Aa
          </div>
          {ratio.ok && levels && (
            <>
              <span aria-label={t("tools.color.contrastRatio")} className="font-mono text-sm">
                {ratio.value.toFixed(2)}:1
              </span>
              <Badge ok={levels.aaLarge} label={t("tools.color.aaLarge")} />
              <Badge ok={levels.aa} label={t("tools.color.aa")} />
              <Badge ok={levels.aaa} label={t("tools.color.aaa")} />
            </>
          )}
          {!ratio.ok && (
            <span role="alert" className="text-sm text-error">
              {resultError(ratio, t)}
            </span>
          )}
        </div>
      </div>

      <div className="rounded-md border border-border p-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-expanded={palettesOpen}
            onClick={() => setPalettesOpen((open) => !open)}
            className="inline-flex items-center gap-1.5 rounded-md text-xs uppercase text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary"
          >
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform ${palettesOpen ? "" : "-rotate-90"}`}
              strokeWidth={1.75}
            />
            {t("tools.color.palettes")}
          </button>
          <div className="ml-auto inline-flex gap-1">
            {palettes.map((palette) => (
              <button
                key={palette.id}
                type="button"
                onClick={() => setActivePaletteId(palette.id)}
                className={`rounded-md border px-2 py-0.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  palette.id === activePaletteId
                    ? "border-border bg-muted"
                    : "border-transparent text-muted-foreground hover:bg-muted"
                }`}
              >
                {t(palette.nameKey)}
              </button>
            ))}
          </div>
        </div>
        {palettesOpen && (
          <div className="mt-3 flex flex-col gap-1.5">
            {activePalette.groups.map((group) => (
              <div key={group.name} className="flex items-center gap-2">
                <span className="w-24 shrink-0 font-mono text-xs text-muted-foreground">
                  {group.name}
                </span>
                <div className="flex flex-1 gap-1">
                  {group.colors.map((color) => (
                    <button
                      key={color.name}
                      type="button"
                      aria-label={color.name}
                      title={`${color.name} ${color.hex}`}
                      onClick={() => setInput(color.hex)}
                      className="h-6 flex-1 rounded outline-none transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-primary"
                      style={{ background: color.hex }}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
