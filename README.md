# Redline

A pre-send review for marketing copy. You paste the approved source and the draft you want to send. Redline decides whether it ships.

It is not a copy generator. The model does not get the last word.

## The problem

Most AI marketing tools make the draft worse in a specific way: they add a number. "80% of in-scope tickets in one pilot" becomes "80% of all tickets" and then "used by 200 enterprises." A junior marketer, or a model, will send that. A reviewer should catch it before a customer does.

## What is code, and what is the model

**Number gate.** Runs in the browser, instantly, with no model. Any number in the draft that does not appear in the source is blocked. `50` and `200` die here. `80` does not, because `80` is in the source.

**Language red team.** One structured call. It reads the draft as a skeptical buyer and marks each claim `ship`, `narrow`, or `kill`. "80% of all IT tickets" must be narrowed, because the source says 80% of in-scope L1 and L2 tickets at one site. "Including priority-one incidents" must be killed, because the source says the product does not take those.

**Second gate.** After the model returns, the same number check runs on its output. If it invents a figure while rewriting a line, that line is killed and the decision is forced to hold.

## Try the two presets

The sloppy email should hold. It reuses a true 80 and surrounds it with claims the source does not make.

The careful email stays inside the pilot, names the limit, and does not add a customer count. It should be allowed to ship, or only be narrowed on wording.

## Run

```bash
npm install
VITE_AUTH_ENABLED=false npm run dev
```

The language red team needs `XAI_API_KEY` in the environment. The number gate works without it.

## Where to read

- [src/lib/redline.ts](src/lib/redline.ts) is the number gate. It does not call a model.
- [src/lib/redline.functions.ts](src/lib/redline.functions.ts) is the one model call, and the second gate that runs after it.
- [src/components/redline-app.tsx](src/components/redline-app.tsx) is the desk.


## Resume line

Built a pre-send review that separates invented numbers (deterministic) from overclaimed wording (a grounded model pass), and discards the model's output when it invents a figure.
