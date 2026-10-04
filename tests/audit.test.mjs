import assert from "node:assert/strict";
import test from "node:test";
import {auditDocuments, extractValues, parseTerminology, buildReport} from "../web/audit.js";
import {createReviewSession, MAX_AI_CHARS} from "../web/review-session.js";

const values = (en, fr) => auditDocuments(en, fr).findings.filter((f) => f.id === "values");

test("equivalent English/French grouping, decimals and percent spacing", () => {
  for (const [en, fr] of [["Total: $4,800.", "Total : 4 800 $."], ["Total: $1,234.50.", "Total : 1\u202f234,50 $."], ["Deposit: 20%.", "Dépôt : 20 %."], ["Value: 2026.", "Valeur : 2026."], ["Loss: -$100.", "Perte : -100 $."]]) assert.equal(values(en, fr).length, 0, `${en} / ${fr}`);
});
test("four-digit values, signs, currency and repeated occurrences are compared", () => {
  for (const [en, fr] of [["Total: $2026.", "Total : 2027 $."], ["Value: -100.", "Valeur : 100."], ["Price: 100 USD.", "Prix : 100 CAD."], ["Fees: 100, 100.", "Frais : 100."], ["Fees: 100.", "Frais : 100, 900."]]) assert.ok(values(en, fr).length, `${en} / ${fr}`);
});
test("dates are compared by calendar value", () => {
  assert.equal(values("Due November 12, 2026.", "Date : 12 novembre 2026.").length, 0);
  assert.equal(values("Due 2026-08-12.", "Date : 12 août 2026.").length, 0);
  for (const fr of ["Date : 12 novembre 2027.", "Date : 12 décembre 2026.", "Date : 13 novembre 2026."]) assert.ok(values("Due November 12, 2026.", fr).length);
  assert.ok(auditDocuments("Due February 30, 2026.", "Date : 30 février 2026.").findings.some((f) => f.id === "date-invalid"));
});
test("phone formatting compares complete numbers", () => {
  assert.equal(values("Call (613) 555-0148.", "Téléphone : 613-555-0148.").length, 0);
  assert.ok(values("Call 613-555-0148.", "Téléphone : 613-555-0149.").length);
});
test("swapped values in ordered passages carry line evidence", () => {
  const result = auditDocuments("Deposit: $100.\nBalance: $200.", "Dépôt : 200 $.\nSolde : 100 $.");
  assert.equal(result.findings.filter((f) => f.id === "values").length, 2);
  assert.ok(result.findings.some((f) => f.evidence.some((e) => e.side === "French" && e.line === 2)));
});
test("alignment fallback is visible instead of silently aligning unmatched passages", () => {
  const result = auditDocuments("Total: 100.\nDue soon.", "Total : 100.");
  assert.equal(result.alignment, "whole document");
  assert.ok(result.findings.some((f) => f.id === "alignment"));
});
test("semantic accuracy is explicitly not evaluated and has no quality score", () => {
  const result = auditDocuments("Payment is not required.", "Le paiement est obligatoire.");
  assert.equal(result.score, undefined);
  assert.ok(result.notEvaluated.some((s) => /meaning.*negation/.test(s)));
  assert.match(buildReport(result), /not a translation-quality score/);
});
test("glossary uses occurrence counts and word boundaries", () => {
  const terms = parseTerminology(" privacy notice = avis de confidentialité ; broken ; API=API ");
  assert.equal(terms.length, 2);
  assert.equal(auditDocuments("rapid", "rapide", [{english:"API",french:"API"}]).findings.length, 0);
  assert.ok(auditDocuments("Privacy notice. Privacy notice.", "Avis de confidentialité.", terms).findings.some((f) => f.id === "glossary"));
  assert.equal(parseTerminology("name=a=b")[0].french, "a=b");
});
test("missing text cannot produce a report", () => {
  const session = createReviewSession(() => {}, () => {throw new Error("should not call");});
  assert.equal(session.report({english:"",french:"Bonjour",terminology:""}), null);
});
test("download regenerates for current text and clears an earlier memo", async () => {
  const session = createReviewSession(() => {}, async () => "OLD MEMO");
  const first = {english:"Total: 100.",french:"Total : 100.",terminology:"",apiKey:"test-placeholder"};
  await session.generateMemo(first);
  assert.match(session.report(first), /OLD MEMO/);
  const report = session.report({...first,french:"Total : 900."});
  assert.match(report, /900/); assert.doesNotMatch(report, /OLD MEMO/);
});
test("old AI responses and errors cannot overwrite a newer review", async () => {
  let resolve, reject, signal;
  const session = createReviewSession(() => {}, (_, __, s) => {signal=s; return new Promise((yes,no) => {resolve=yes;reject=no;});});
  const input = {english:"Total: 100.",french:"Total : 100.",terminology:"",apiKey:"test-placeholder"};
  const old = session.generateMemo(input);
  session.run({...input,french:"Total : 900."});
  assert.equal(signal.aborted, true);
  resolve("stale memo"); await old;
  assert.equal(session.state().memo, ""); assert.match(session.report({...input,french:"Total : 900."}), /900/);
  const older = session.generateMemo(input); session.invalidate(); reject(new Error("late failure")); await older;
  assert.equal(session.state().result, null);
  assert.doesNotMatch(session.state().status, /late failure/);
});
test("AI gets the full input or rejects it before any request", async () => {
  let calls = 0;
  const session = createReviewSession(() => {}, async (input) => {calls++; assert.ok(input.english.endsWith("END")); return "memo";});
  const input = {english:"a".repeat(6500)+"END",french:"b".repeat(6500),terminology:"",apiKey:"test-placeholder"};
  await session.generateMemo(input); assert.equal(calls, 1);
  await session.generateMemo({...input,english:"a".repeat(MAX_AI_CHARS+1)});
  assert.equal(calls, 1); assert.match(session.state().status, /No text was sent/);
});
test("large integer values retain exact digits", () => {
  assert.equal(extractValues("Value: 9007199254740993.", "en")[0].value, "9007199254740993");
});
