import { createServerFn } from "@tanstack/react-start";
import { applyGate, type Asset, type Claim, type Sheet, type Verdict } from "@/lib/redline";

const ASSET_SET = new Set<Asset>(["email", "linkedin", "one-pager", "ad"]);

export const runRedline = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const raw = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
    const source = typeof raw.source === "string" ? raw.source.trim().slice(0, 6000) : "";
    const draft = typeof raw.draft === "string" ? raw.draft.trim().slice(0, 4000) : "";
    const asset = typeof raw.asset === "string" && ASSET_SET.has(raw.asset as Asset) ? (raw.asset as Asset) : "email";
    if (source.length < 40) throw new Error("Paste the approved source. A few sentences.");
    if (draft.length < 40) throw new Error("Paste the draft you want to send.");
    return { source, draft, asset };
  })
  .handler(async ({ data }): Promise<{ ok: true; sheet: Sheet } | { ok: false; error: string }> => {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) return { ok: false, error: "The language red team needs the model, and it is not available here." };

    const system = `You red-team a marketing draft against an approved source. You do not write a better campaign.
The asset is a ${data.asset}.
Return JSON:
{"buyer": string, "claims": [{"quote": string, "verdict": "ship"|"narrow"|"kill", "reason": string, "rewrite": string}]}
Rules:
- buyer is one sentence: who reads this asset and what they will not forgive.
- 4 to 6 claims. Each quote is a short contiguous span copied from the draft, not a paraphrase.
- ship: the quote says only what the source says, including its limits.
- narrow: a true core is overstated. rewrite is one sentence that matches the source. Empty string otherwise.
- kill: the source does not support it, or it contradicts a limit. rewrite is empty.
- Never introduce a number, percent, time, or customer count that is not written in the source.
- Do not praise the draft. Do not add slogans.
Return only JSON.`;

    try {
      const sheet = await once(apiKey, system, data.source, data.draft);
      if (!sheet) return { ok: false, error: "The draft could not be reviewed. Try a plainer version." };
      return { ok: true, sheet: applyGate(sheet, data.source) };
    } catch (error) {
      if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
        return { ok: false, error: "The review took too long. Try again." };
      }
      const message = error instanceof Error ? error.message : "The model could not be reached.";
      return { ok: false, error: message };
    }
  });

async function once(apiKey: string, system: string, source: string, draft: string): Promise<Sheet | null> {
  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    signal: AbortSignal.timeout(45_000),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "grok-4.5",
      temperature: 0,
      max_tokens: 900,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: `SOURCE\n${source}\n\nDRAFT\n${draft}` },
      ],
    }),
  });
  if (!res.ok) {
    if (res.status === 429) throw new Error("The model is rate-limited. Wait a moment and run it again.");
    throw new Error(`The model returned an error (${res.status}).`);
  }
  const body = (await res.json()) as { choices?: { message?: { content?: unknown } }[] };
  const text = typeof body.choices?.[0]?.message?.content === "string" ? body.choices[0].message.content : "";
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const raw = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
    const claims = Array.isArray(raw.claims) ? raw.claims.map(claim).filter((item): item is Claim => Boolean(item)) : [];
    if (claims.length === 0) return null;
    return {
      decision: "hold",
      buyer: clip(raw.buyer, 220) || "A reader who has seen this pitch before.",
      claims: claims.slice(0, 6),
      withheld: [],
    };
  } catch {
    return null;
  }
}

function claim(value: unknown): Claim | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const quote = clip(raw.quote, 280);
  if (!quote) return null;
  const verdict: Verdict = raw.verdict === "ship" || raw.verdict === "narrow" || raw.verdict === "kill" ? raw.verdict : "kill";
  return {
    quote,
    verdict,
    reason: clip(raw.reason, 280) || "The source does not support this wording.",
    rewrite: verdict === "narrow" ? clip(raw.rewrite, 280) : "",
  };
}

function clip(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}
