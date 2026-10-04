# BilinguAudit

English/French document checks for glossary occurrences, numeric values, dates
and structure. Findings include source passages and line references. There is
no translation-quality score: meaning, negation, omitted clauses and grammar
always require a bilingual reviewer.

## Quickstart

Requires Node.js 22+ and npm.

```sh
npm ci
npm start
```

Paste both language versions and optional glossary pairs such as
`privacy notice=avis de confidentialité; deadline=date limite`. Run Audit runs
local checks only. Download generates one report for the current inputs.
Editing either version or the glossary invalidates earlier results and memos.

## What is checked

- Decimal numeric values, repeated occurrences, signs, percentages, currency
  markers/codes and formatted North American phone numbers.
- English grouping and decimals (`1,234.50`) and French grouping/decimals
  (`1 234,50`, including non-breaking and narrow non-breaking spaces).
- Named English/French dates and ISO `YYYY-MM-DD`, compared by calendar value.
- Matching term occurrences with word boundaries, passage counts and bullets.
- Selected patterns that may indicate untranslated English, requiring review.

Example: `July 28, 2026` versus `28 juillet 2027` produces a value finding with
both source passages. `$4,800` and `4 800 $` are treated as equivalent.

Passages are split at line breaks and selected sentence boundaries, then paired
**by order**, not meaning. Swapped values in corresponding passages can be
flagged. If passage counts differ, values are compared across the whole document
and the report explicitly warns that alignment was not established. Reordered
or merged passages can cause false alarms or hide correspondence errors.

Numeric dates such as `01/02/2026`, scientific notation, written numbers, currency
conversion, unit conversion, and general translation meaning are not evaluated.
Currency markers are compared literally: `$` is not assumed to mean CAD or USD.
Glossary count differences may be intentional. These checks support a reviewer;
they do not replace professional translation or certify legal compliance.

## Optional AI suggestions

Generate AI memo is a separate, explicit action using your OpenAI API key. It
sends both full texts, glossary and local findings to OpenAI and may incur API
charges. The app does not save the key. Do not send confidential material without
authorization. Deterministic checks and sample loading never call OpenAI.

The memo request supports up to 60,000 characters per language. Longer input is
rejected before transmission, never silently truncated. Split longer documents
into matched sections. AI output is untrusted plain text and needs reviewer
verification; it may miss mistakes or suggest incorrect changes. Editing inputs
cancels the request and prevents old responses from replacing current findings.

## Validation

```sh
npm test
npm run build
```

`npm test` runs comparison and review-session regressions plus static-asset
checks. `npm run build` validates the static asset set; there is no bundler.
Vercel serves `web/` using `vercel.json`.

Tests cover locale formatting, changed years/months, signs/currencies, repeated
values, passage swaps, glossary boundaries, stale responses, current-input
reports and full-input AI coverage. Browser verification checks plain-text
rendering of malicious input and report downloads.

This release provides free local checks and optional user-requested AI memos.
Paid subscriptions, saved glossaries, document imports and managed review
services are not implemented or offered by the app.

Built by North Star Holdings.
