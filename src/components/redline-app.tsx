import { useEffect, useMemo, useRef, useState } from "react";
import { runRedline } from "@/lib/redline.functions";
import {
  ASSETS,
  CAREFUL,
  SLOPPY,
  numberGate,
  type Asset,
  type Sheet,
  type Verdict,
} from "@/lib/redline";

const PRESETS = [SLOPPY, CAREFUL];

export function RedlineApp() {
  const [asset, setAsset] = useState<Asset>("email");
  const [source, setSource] = useState(SLOPPY.source);
  const [draft, setDraft] = useState(SLOPPY.draft);
  const [presetId, setPresetId] = useState(SLOPPY.id);
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [error, setError] = useState("");
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [seconds, setSeconds] = useState(0);
  const runId = useRef(0);
  const resultRef = useRef<HTMLElement>(null);

  const flagged = useMemo(() => numberGate(draft, source), [draft, source]);

  useEffect(() => {
    if (status !== "running") return;
    setSeconds(0);
    const id = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(id);
  }, [status]);

  useEffect(() => {
    if (!sheet) return;
    resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [sheet]);

  function load(id: string) {
    const preset = PRESETS.find((item) => item.id === id);
    if (!preset) return;
    setPresetId(preset.id);
    setSource(preset.source);
    setDraft(preset.draft);
    setSheet(null);
    setStatus("idle");
    setError("");
    runId.current += 1;
  }

  async function review() {
    const id = ++runId.current;
    setStatus("running");
    setError("");
    setSheet(null);
    try {
      const result = await runRedline({ data: { source, draft, asset } });
      if (id !== runId.current) return;
      if (!result.ok) {
        setStatus("error");
        setError(result.error);
        return;
      }
      setSheet(result.sheet);
      setStatus("done");
    } catch (caught) {
      if (id !== runId.current) return;
      setStatus("error");
      setError(caught instanceof Error ? caught.message : "The review failed.");
    }
  }

  const surviving = sheet?.claims.filter((claim) => claim.verdict === "ship").map((claim) => claim.quote) ?? [];
  const narrowed = sheet?.claims.filter((claim) => claim.verdict === "narrow" && claim.rewrite) ?? [];

  return (
    <div className="min-h-screen">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6">
          <div className="flex items-baseline justify-between gap-4">
            <p className="font-serif text-2xl tracking-tight text-ink">Redline</p>
            <p className="text-xs uppercase tracking-widest text-faint">Pre-send review</p>
          </div>
          <div className="max-w-2xl">
            <h1 className="font-serif text-4xl leading-tight text-ink sm:text-5xl">
              Nothing ships that the source does not support.
            </h1>
            <p className="mt-4 text-base leading-relaxed text-muted">
              Code blocks any number the approved source does not contain. The model then red-teams the wording,
              and it does not get the last word.
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="space-y-6">
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => load(preset.id)}
                disabled={status === "running"}
                className={`rounded-full border px-3 py-1.5 text-sm ${
                  presetId === preset.id
                    ? "border-ink bg-ink text-on-ink"
                    : "border-line-strong bg-surface text-ink"
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <label className="block">
            <span className="text-xs uppercase tracking-widest text-faint">Approved source</span>
            <textarea
              value={source}
              onChange={(event) => {
                setSource(event.target.value);
                setPresetId("custom");
                setSheet(null);
                setStatus("idle");
                setError("");
                runId.current += 1;
              }}
              disabled={status === "running"}
              rows={8}
              className="mt-2 w-full resize-y rounded-md border border-line bg-surface px-3 py-3 text-sm leading-relaxed text-ink outline-none focus:border-accent"
            />
          </label>

          <label className="block">
            <span className="text-xs uppercase tracking-widest text-faint">Draft you want to send</span>
            <textarea
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value);
                setPresetId("custom");
                setSheet(null);
                setStatus("idle");
                setError("");
                runId.current += 1;
              }}
              disabled={status === "running"}
              rows={8}
              className="mt-2 w-full resize-y rounded-md border border-line bg-surface px-3 py-3 text-sm leading-relaxed text-ink outline-none focus:border-accent"
            />
          </label>

          <div className="rounded-lg border border-line bg-surface p-4 lg:hidden">
            <ActionPanel
              asset={asset}
              setAsset={setAsset}
              status={status}
              seconds={seconds}
              error={error}
              onReview={review}
            />
          </div>

          <div className="rounded-lg border border-line bg-surface p-4">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="font-serif text-xl text-ink">Number gate</h2>
              <p className="text-xs uppercase tracking-widest text-faint">Code, not the model</p>
            </div>
            {flagged.length === 0 ? (
              <p className="mt-3 text-sm leading-relaxed text-muted">
                Every number in this draft appears in the source. That does not make the wording true.
              </p>
            ) : (
              <ul className="mt-3 space-y-3">
                {flagged.map((row) => (
                  <li key={row.sentence} className="border-l-2 border-bad pl-3">
                    <p className="text-sm leading-relaxed text-ink">{row.sentence}</p>
                    <p className="mt-1 text-xs text-bad">Blocked: {row.stray.join(", ")}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-lg border border-line bg-surface p-4 text-sm leading-relaxed text-muted lg:hidden">
            <p className="text-xs uppercase tracking-widest text-faint">What the model is for</p>
            <p className="mt-3">
              An 80 in the source does not license “80% of all tickets.” The number gate cannot see that. The red team
              can, and code still strikes any figure it invents while doing it.
            </p>
          </div>
        </section>

        <aside className="hidden space-y-4 lg:sticky lg:top-6 lg:block lg:self-start">
          <div className="rounded-lg border border-line bg-surface p-4">
            <ActionPanel
              asset={asset}
              setAsset={setAsset}
              status={status}
              seconds={seconds}
              error={error}
              onReview={review}
            />
          </div>

          <div className="rounded-lg border border-line bg-surface p-4 text-sm leading-relaxed text-muted">
            <p className="text-xs uppercase tracking-widest text-faint">What the model is for</p>
            <p className="mt-3">
              An 80 in the source does not license “80% of all tickets.” The number gate cannot see that. The red team
              can, and code still strikes any figure it invents while doing it.
            </p>
          </div>
        </aside>

        {sheet ? (
          <section ref={resultRef} className="rise scroll-mt-6 lg:col-span-2">
            <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-4">
              <div>
                <p className="text-xs uppercase tracking-widest text-faint">Decision</p>
                <p className="font-serif text-5xl text-ink">{sheet.decision === "ship" ? "Ship" : "Hold"}</p>
              </div>
              <p className="max-w-xl text-sm leading-relaxed text-muted">{sheet.buyer}</p>
            </div>

            {(surviving.length > 0 || narrowed.length > 0) && (
              <div className="mt-6 rounded-lg border border-line bg-good-bg p-4">
                <h2 className="text-xs uppercase tracking-widest text-good">What you can still send</h2>
                <ul className="mt-3 space-y-2 text-sm leading-relaxed text-ink">
                  {surviving.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                  {narrowed.map((claim) => (
                    <li key={claim.rewrite}>{claim.rewrite}</li>
                  ))}
                </ul>
              </div>
            )}

            <ul className="mt-6 space-y-3">
              {sheet.claims.map((claim) => (
                <li key={claim.quote} className="rounded-lg border border-line bg-surface p-4">
                  <div className="flex items-center justify-between gap-3">
                    <VerdictMark verdict={claim.verdict} />
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-ink">{claim.quote}</p>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{claim.reason}</p>
                </li>
              ))}
            </ul>

            {sheet.withheld.length > 0 ? (
              <p className="mt-4 text-sm text-bad">Struck by code after the model ran: {sheet.withheld.join(", ")}</p>
            ) : null}
          </section>
        ) : null}
      </main>
    </div>
  );
}

function ActionPanel({
  asset,
  setAsset,
  status,
  seconds,
  error,
  onReview,
}: {
  asset: Asset;
  setAsset: (asset: Asset) => void;
  status: "idle" | "running" | "done" | "error";
  seconds: number;
  error: string;
  onReview: () => void;
}) {
  return (
    <>
      <p className="text-xs uppercase tracking-widest text-faint">Asset</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {ASSETS.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setAsset(item)}
            disabled={status === "running"}
            className={`rounded-full border px-3 py-1.5 text-sm capitalize ${
              asset === item ? "border-accent bg-wash text-accent" : "border-line text-ink"
            }`}
          >
            {item}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={onReview}
        disabled={status === "running"}
        aria-busy={status === "running"}
        className="mt-4 w-full rounded-md bg-accent px-4 py-3 text-sm font-medium text-accent-fg transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-70"
      >
        {status === "running" ? `Reading the wording · ${seconds}s` : "Red-team the wording"}
      </button>
      {status === "running" ? (
        <p className="mt-3 text-sm leading-relaxed text-muted">
          The number gate already finished. This pass only checks the wording. It usually takes about 15 seconds.
        </p>
      ) : null}
      {error ? <p className="mt-3 text-sm leading-relaxed text-bad">{error}</p> : null}
    </>
  );
}

function VerdictMark({ verdict }: { verdict: Verdict }) {
  const styles = {
    ship: "bg-good-bg text-good",
    narrow: "bg-warn-bg text-warn",
    kill: "bg-bad-bg text-bad",
  } as const;
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs uppercase tracking-widest ${styles[verdict]}`}>{verdict}</span>
  );
}
