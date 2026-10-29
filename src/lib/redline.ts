export const ASSETS = ["email", "linkedin", "one-pager", "ad"] as const;
export type Asset = (typeof ASSETS)[number];

export type Verdict = "ship" | "narrow" | "kill";

export type Claim = {
  quote: string;
  verdict: Verdict;
  reason: string;
  rewrite: string;
};

export type Sheet = {
  decision: "ship" | "hold";
  buyer: string;
  claims: Claim[];
  withheld: string[];
};

export type FlaggedSentence = {
  sentence: string;
  stray: string[];
};

const DIGIT = /(?<![A-Za-z])\d+(?:\.\d+)?(?![A-Za-z])/g;

export function digitCores(value: string): Set<string> {
  return new Set(value.match(DIGIT) ?? []);
}

export function strayDigits(value: string, source: string): string[] {
  const allowed = digitCores(source);
  const stray = new Set<string>();
  for (const core of value.match(DIGIT) ?? []) {
    if (!allowed.has(core)) stray.add(core);
  }
  return [...stray];
}

export function numberGate(draft: string, source: string): FlaggedSentence[] {
  return draft
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
    .map((sentence) => ({ sentence, stray: strayDigits(sentence, source) }))
    .filter((row) => row.stray.length > 0);
}

export function applyGate(sheet: Sheet, source: string): Sheet {
  const withheld = new Set<string>();
  const claims = sheet.claims.map((claim) => {
    const stray = [
      ...strayDigits(claim.quote, source),
      ...strayDigits(claim.rewrite, source),
      ...strayDigits(claim.reason, source),
    ];
    for (const core of stray) withheld.add(core);
    if (stray.length === 0) return claim;
    return {
      quote: claim.quote,
      verdict: "kill" as const,
      reason: `The number ${stray.join(", ")} is not in the source. Code killed this, not the model.`,
      rewrite: "",
    };
  });

  const decision = claims.length > 0 && claims.every((claim) => claim.verdict === "ship") ? "ship" : "hold";
  return {
    decision,
    buyer: sheet.buyer,
    claims,
    withheld: [...withheld],
  };
}

export const SLOPPY = {
  id: "sloppy",
  label: "Sloppy email",
  source: `Product: Northline Queue.
What it does: Closes repeat printer and VPN tickets when they match a documented checklist. Anything off the checklist stays with a person.
Proof: In a 6-week pilot at one site, 80% of in-scope L1 and L2 tickets were closed without a person. The pilot covered 1 site and 2 ticket types.
Limit: Does not handle priority-one incidents. No result has been measured across more than one site.
Not established: No customer count. No cost saving. No claim about all IT tickets.`,
  draft: `Subject: Cut your support cost in half

Northline Queue uses AI to resolve 80% of all IT tickets in minutes, and teams at 200 enterprises already run it in production. Customers see a 50% drop in support cost in the first month, including priority-one incidents. Happy to book 15 minutes this week.`,
};

export const CAREFUL = {
  id: "careful",
  label: "Careful email",
  source: SLOPPY.source,
  draft: `Subject: One-site pilot, two ticket types

We ran a 6-week pilot at one site. For printer and VPN tickets that matched a checklist, 80% of in-scope L1 and L2 tickets closed without a person. It does not take priority-one incidents, and we have not measured it past that one site. If those two ticket types are a real share of your queue, I can walk through what the pilot did and did not cover.`,
};
