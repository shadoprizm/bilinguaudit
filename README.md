# BilinguAudit

BilinguAudit is a browser-based Canadian English/French document audit tool for consultants, municipal vendors, proposal writers, translation freelancers, and small agencies that need to catch bilingual delivery issues before a file goes to a client.

The MVP runs with no account and no database. Paste English and French text, enter critical terminology, and get an instant audit for coverage gaps, terminology consistency, untranslated fragments, numbers/date mismatches, and formatting drift. Users can optionally paste their own OpenAI API key for an AI-generated reviewer memo; the key stays in the browser and is not stored.

## Features

- English/French side-by-side paste audit
- Terminology glossary consistency checks
- Untranslated fragment, number, date, and structure drift detection
- Optional BYO OpenAI audit memo
- Copy/download report for client QA records

## Run Locally

```bash
npm install
npm start
```

Then open the local URL shown by `serve`.

## Validate

```bash
npm test
```

## Monetization

- Free: paste-based audit for short documents, deterministic checks, downloadable report.
- Pro: $29/month for longer documents, saved glossary packs, branded PDF reports, batch audits, and managed OpenAI proxy.
- Service upsell: $199 fixed bilingual document audit for vendors responding to Canadian public-sector or government-adjacent RFPs.

Built by North Star Holdings.
