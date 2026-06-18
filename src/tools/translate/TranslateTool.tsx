import { ArrowLeftRight, X } from "lucide-react";
import { type KeyboardEvent, useMemo, useRef, useState } from "react";
import { CopyButton } from "@/components/CopyButton";
import { HistoryButton } from "@/components/HistoryButton";
import { useHistory } from "@/core/hooks/useHistory";
import { useToolInput } from "@/core/hooks/useToolInput";
import { type I18nKey, type I18nParams, useI18n } from "@/core/i18n";
import { useAppStore } from "@/core/store";
import { streamChatCompletion } from "./client";
import {
  AUTO,
  buildMessages,
  type DetectedCategory,
  detectCategory,
  LANGUAGES,
  languageById,
  mapDetectedInput,
  type ProviderId,
  resolveLanguages,
  STYLE_IDS,
  type StyleId,
  validateEndpointUrl,
} from "./translate";

const LONG_INPUT_THRESHOLD = 20_000;

const STYLE_LABEL_KEYS: Record<StyleId, I18nKey> = {
  general: "tools.translate.style.general",
  formal: "tools.translate.style.formal",
  casual: "tools.translate.style.casual",
  technical: "tools.translate.style.technical",
  literal: "tools.translate.style.literal",
  polish: "tools.translate.style.polish",
};

const CATEGORY_LABEL_KEYS: Record<DetectedCategory, I18nKey> = {
  chinese: "tools.translate.category.chinese",
  japanese: "tools.translate.category.japanese",
  korean: "tools.translate.category.korean",
  russian: "tools.translate.category.russian",
  latin: "tools.translate.category.latin",
  unknown: "tools.translate.category.unknown",
};

type RunStatus = "idle" | "streaming" | "stopped" | "done";

interface RunSnapshot {
  input: string;
  effectiveSource: string;
  effectiveTarget: string;
  style: StyleId;
  provider: ProviderId;
  model: string;
  flipped: boolean;
}

interface RunError {
  key: I18nKey;
  params?: I18nParams;
  detail?: string;
}

export default function TranslateTool() {
  const { t } = useI18n();
  const [input, setInput] = useToolInput("translate");
  const { entries, record } = useHistory("translate");
  const source = useAppStore((state) => state.translate.source);
  const target = useAppStore((state) => state.translate.target);
  const style = useAppStore((state) => state.translate.style);
  const provider = useAppStore((state) => state.translate.provider);
  const providers = useAppStore((state) => state.translate.providers);
  const setTranslateLanguages = useAppStore((state) => state.setTranslateLanguages);
  const setTranslateStyle = useAppStore((state) => state.setTranslateStyle);

  const [output, setOutput] = useState("");
  const [status, setStatus] = useState<RunStatus>("idle");
  const [runError, setRunError] = useState<RunError | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [snapshot, setSnapshot] = useState<RunSnapshot | null>(null);
  const [confirmingLongInput, setConfirmingLongInput] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const streaming = status === "streaming";
  const detected = useMemo(() => (input.trim() ? detectCategory(input) : null), [input]);
  // Auto never counts as "same language" — the smart flip covers that case.
  const sameLanguageBlocked = source !== AUTO && source === target && style !== "polish";
  const hasOutput = output !== "";
  const swapDisabled =
    streaming ||
    (hasOutput
      ? !snapshot || snapshot.effectiveSource === AUTO
      : source === AUTO && (input.trim() === "" || mapDetectedInput(input) === null));

  function resetRunView() {
    setOutput("");
    setStatus("idle");
    setRunError(null);
    setTruncated(false);
  }

  function configError(): RunError | null {
    const config = providers[provider];
    if (provider !== "custom" && config.apiKey.trim() === "") {
      return { key: "tools.translate.errors.noApiKey" };
    }
    if (provider === "custom" && config.model.trim() === "") {
      return { key: "tools.translate.errors.noModel" };
    }
    if (!validateEndpointUrl(config.endpointUrl).ok) {
      return { key: "tools.translate.errors.invalidEndpoint" };
    }
    return null;
  }

  async function runTranslation() {
    setConfirmingLongInput(false);
    const setupProblem = configError();
    if (setupProblem) {
      setOutput("");
      setTruncated(false);
      setStatus("idle");
      setRunError(setupProblem);
      return;
    }

    const config = providers[provider];
    const resolution = resolveLanguages(input, source, target, style);
    const run: RunSnapshot = {
      input,
      effectiveSource: resolution.source,
      effectiveTarget: resolution.target,
      style,
      provider,
      model: config.model,
      flipped: resolution.flipped,
    };
    setSnapshot(run);
    setOutput("");
    setRunError(null);
    setTruncated(false);
    setStatus("streaming");

    const controller = new AbortController();
    abortRef.current = controller;
    let text = "";
    const events = streamChatCompletion({
      endpointUrl: config.endpointUrl,
      apiKey: config.apiKey.trim(),
      model: config.model,
      messages: buildMessages(run.input, run.effectiveSource, run.effectiveTarget, run.style),
      signal: controller.signal,
    });
    for await (const event of events) {
      if (event.type === "delta") {
        text += event.text;
        setOutput(text);
      } else if (event.type === "aborted") {
        setStatus("stopped");
      } else if (event.type === "error") {
        setRunError({
          key: event.errorKey,
          params: event.params,
          detail: event.detail,
        });
        setStatus("stopped");
      } else if (event.finishReason === "length") {
        setTruncated(true);
        setStatus("done");
      } else {
        // History records the request-start snapshot input, only on clean completion.
        record(run.input, text);
        setStatus("done");
      }
    }
    abortRef.current = null;
  }

  function onTranslateClick() {
    if (streaming) {
      abortRef.current?.abort();
      return;
    }
    if (input.trim() === "" || sameLanguageBlocked) return;
    if (input.length > LONG_INPUT_THRESHOLD) {
      setConfirmingLongInput(true);
      return;
    }
    void runTranslation();
  }

  function onSwap() {
    if (swapDisabled) return;
    if (hasOutput && snapshot) {
      // The previous input is intentionally discarded — not recorded anywhere.
      setInput(output);
      resetRunView();
      setTranslateLanguages(snapshot.effectiveTarget, snapshot.effectiveSource);
      return;
    }
    const newTarget = source === AUTO ? mapDetectedInput(input) : source;
    if (newTarget === null) return;
    setTranslateLanguages(target, newTarget);
  }

  function onClear() {
    setInput("");
    // While streaming, only the input clears; the in-flight output keeps going.
    if (!streaming) resetRunView();
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      onTranslateClick();
    }
  }

  const flipLabel =
    snapshot?.flipped && status !== "idle" ? languageById(snapshot.effectiveTarget)?.label : null;
  const statusLabel =
    status === "streaming"
      ? `● ${t("tools.translate.status.streaming")}`
      : status === "stopped"
        ? t("tools.translate.status.stopped")
        : status === "done"
          ? t("tools.translate.status.done")
          : "";

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: tool-scoped Cmd/Ctrl+Enter shortcut
    <div className="flex h-full flex-col gap-3 p-4" onKeyDown={onKeyDown}>
      <div className="flex flex-wrap items-center gap-2">
        <fieldset
          aria-label={t("tools.translate.styleLabel")}
          disabled={streaming}
          className="hidden w-fit rounded-lg bg-muted p-1 md:inline-flex"
        >
          {STYLE_IDS.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setTranslateStyle(item)}
              className={`rounded-md px-3 py-1 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary ${
                style === item
                  ? "bg-surface font-medium text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t(STYLE_LABEL_KEYS[item])}
            </button>
          ))}
        </fieldset>
        <select
          aria-label={t("tools.translate.styleLabel")}
          disabled={streaming}
          value={style}
          onChange={(event) => setTranslateStyle(event.target.value as StyleId)}
          className="rounded-lg border border-border bg-surface px-2 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary md:hidden"
        >
          {STYLE_IDS.map((item) => (
            <option key={item} value={item}>
              {t(STYLE_LABEL_KEYS[item])}
            </option>
          ))}
        </select>
        <div className="ml-auto flex items-center gap-2">
          <HistoryButton entries={entries} onRestore={setInput} />
          <button
            type="button"
            onClick={onTranslateClick}
            disabled={!streaming && (input.trim() === "" || sameLanguageBlocked)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground shadow-sm outline-none transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-40"
          >
            {streaming ? t("tools.translate.stop") : t("tools.translate.translate")}
            {!streaming && <kbd className="text-xs opacity-70">⌘↵</kbd>}
          </button>
        </div>
      </div>

      {sameLanguageBlocked && (
        <p className="text-xs text-muted-foreground">{t("tools.translate.sameLanguageHint")}</p>
      )}

      {confirmingLongInput && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/60 p-3 text-sm">
          <span>{t("tools.translate.longInputConfirm")}</span>
          <button
            type="button"
            onClick={() => void runTranslation()}
            className="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-primary"
          >
            {t("tools.translate.continue")}
          </button>
          <button
            type="button"
            onClick={() => setConfirmingLongInput(false)}
            className="rounded-md border border-border px-2.5 py-1 text-xs outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary"
          >
            {t("tools.translate.cancel")}
          </button>
        </div>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 md:grid-cols-[1fr_auto_1fr]">
        <div className="flex min-h-64 flex-col rounded-lg border border-border bg-surface">
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <select
              aria-label={t("tools.translate.source")}
              disabled={streaming}
              value={source}
              onChange={(event) => setTranslateLanguages(event.target.value, target)}
              className="rounded-md border border-border bg-surface px-2 py-1 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <option value={AUTO}>{t("tools.translate.autoDetect")}</option>
              {LANGUAGES.map((language) => (
                <option key={language.id} value={language.id}>
                  {language.label}
                </option>
              ))}
            </select>
            {source === AUTO && detected && (
              <span className="text-xs text-muted-foreground">
                {t("tools.translate.detected", {
                  language: t(CATEGORY_LABEL_KEYS[detected]),
                })}
              </span>
            )}
          </div>
          <textarea
            aria-label={t("tools.translate.input")}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={t("tools.translate.placeholder")}
            className="min-h-0 flex-1 resize-none bg-transparent p-3 font-mono text-sm leading-5 outline-none"
          />
          <div className="flex items-center justify-between border-t border-border px-3 py-1.5 text-xs text-muted-foreground">
            <span>{t("tools.translate.charCount", { count: input.length })}</span>
            <button
              type="button"
              aria-label={t("tools.translate.clear")}
              onClick={onClear}
              className="flex h-6 w-6 items-center justify-center rounded-md outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary"
            >
              <X className="h-3.5 w-3.5" strokeWidth={1.75} />
            </button>
          </div>
        </div>

        <div className="flex items-center justify-center">
          <button
            type="button"
            aria-label={t("tools.translate.swap")}
            onClick={onSwap}
            disabled={swapDisabled}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-border outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-40"
          >
            <ArrowLeftRight className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </div>

        <div className="flex min-h-64 flex-col rounded-lg border border-border bg-muted/60">
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <select
              aria-label={t("tools.translate.target")}
              disabled={streaming}
              value={target}
              onChange={(event) => setTranslateLanguages(source, event.target.value)}
              className="rounded-md border border-border bg-surface px-2 py-1 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {LANGUAGES.map((language) => (
                <option key={language.id} value={language.id}>
                  {language.label}
                </option>
              ))}
            </select>
            {flipLabel && <span className="text-xs text-muted-foreground">⇄ {flipLabel}</span>}
            <div className="ml-auto">
              <CopyButton text={output} />
            </div>
          </div>
          <div
            role="region"
            aria-label={t("tools.translate.output")}
            className="min-h-0 flex-1 overflow-auto p-3"
          >
            {hasOutput && (
              <pre className="whitespace-pre-wrap break-words font-mono text-sm leading-5">
                {output}
              </pre>
            )}
            {truncated && (
              <div
                role="alert"
                className="mt-2 rounded-md border border-border bg-surface p-2 font-mono text-xs text-error"
              >
                {t("tools.translate.truncated")}
              </div>
            )}
            {runError && (
              <div
                role="alert"
                className="mt-2 rounded-md border border-border bg-surface p-2 font-mono text-xs text-error"
              >
                {t(runError.key, runError.params)}
                {runError.detail ? ` — ${runError.detail}` : ""}
              </div>
            )}
            {!hasOutput && !runError && !truncated && (
              <p className="text-sm text-muted-foreground">{t("tools.translate.empty")}</p>
            )}
          </div>
          <div className="flex items-center justify-between border-t border-border px-3 py-1.5 text-xs text-muted-foreground">
            <span>{statusLabel}</span>
            <span>{snapshot && status !== "idle" ? snapshot.model : ""}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
