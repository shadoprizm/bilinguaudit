export const NOT_EVALUATED = [
  "Translation meaning, negation, grammar and omitted or added ideas require a bilingual reviewer.",
  "Passages are paired by order, not meaning. Reordered or merged passages need manual alignment.",
  "Dates support named English/French months and YYYY-MM-DD. Ambiguous numeric dates need manual review.",
  "Number checks support decimal digits, English/French separators, %, $, €, £ and currency codes; written numbers and unit conversions need review."
];

export function normalize(text) {
  return String(text).normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[’']/g, "").replace(/\s+/g, " ").trim();
}

export function parseTerminology(raw) {
  return String(raw).split(";").filter((s) => s.trim()).map((entry) => {
    const separator = entry.indexOf("=");
    return separator < 0 ? null : {
      english: entry.slice(0, separator).trim(), french: entry.slice(separator + 1).trim()
    };
  }).filter((pair) => pair?.english && pair?.french);
}

const MONTH_NAMES = [
  ["january", "jan", "janvier", "janv"], ["february", "feb", "fevrier", "fevr"],
  ["march", "mar", "mars"], ["april", "apr", "avril", "avr"], ["may", "mai"],
  ["june", "jun", "juin"], ["july", "jul", "juillet", "juil"], ["august", "aug", "aout"],
  ["september", "sep", "sept", "septembre"], ["october", "oct", "octobre"],
  ["november", "nov", "novembre"], ["december", "dec", "decembre"]
];
const months = new Map(MONTH_NAMES.flatMap((names, index) => names.map((name) => [name, index + 1])));
const monthPattern = [...months.keys()].sort((a, b) => b.length - a.length).join("|");
const namedDate = new RegExp(`\\b(?:(?<monthFirst>${monthPattern})\\.?[ \\t]+(?<dayFirst>\\d{1,2})(?:st|nd|rd|th)?[,]?[ \\t]+(?<yearFirst>\\d{4})|(?<dayLast>\\d{1,2})(?:er)?[ \\t]+(?<monthLast>${monthPattern})\\.?[ \\t]+(?<yearLast>\\d{4}))\\b`, "giu");
const isoDate = /\b(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})\b/gu;
const phone = /(?<!\d)(?:\+?1[ .-]?)?\(?\d{3}\)?[ .-]\d{3}[ .-]\d{4}(?!\d)/gu;
const numeric = /(?<![\p{L}\p{N}])(?<prefix>[-+]?[$€£]?[ \t\u00a0\u202f]*[-+]?)(?<number>(?:\d{1,3}(?:[, \u00a0\u202f]\d{3})+|\d+)(?:[.,]\d+)?)(?<suffix>[ \t\u00a0\u202f]*(?:%|[$€£]|CAD\b|USD\b|EUR\b|GBP\b))?(?![\p{L}\p{N}])/gu;

function dateKey(year, month, day) {
  const valid = month >= 1 && month <= 12 && day >= 1 && day <= new Date(Date.UTC(year, month, 0)).getUTCDate();
  return valid ? `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}` : null;
}

function decimalKey(raw, language) {
  let digits = raw.replace(/[ \u00a0\u202f]/g, "");
  if (language === "en") digits = digits.replace(/,/g, "");
  else digits = digits.replace(",", ".");
  const [integer, fraction = ""] = digits.split(".");
  const whole = integer.replace(/^0+(?=\d)/, "");
  const tail = fraction.replace(/0+$/, "");
  return `${whole}${tail ? `.${tail}` : ""}`;
}

export function extractValues(text, language) {
  // Accent folding preserves offsets for the supported precomposed month names.
  const folded = text.replace(/[éèêë]/gi, "e").replace(/[ûùü]/gi, "u").replace(/[àâä]/gi, "a").replace(/[ôö]/gi, "o");
  const values = [];
  const excluded = [];
  function add(match, kind, value) {
    const raw = text.slice(match.index, match.index + match[0].length).trim();
    values.push({kind, value, raw, offset: match.index});
    excluded.push([match.index, match.index + match[0].length]);
  }
  for (const match of folded.matchAll(namedDate)) {
    const g = match.groups;
    const key = dateKey(Number(g.yearFirst || g.yearLast), months.get(g.monthFirst?.toLowerCase() || g.monthLast.toLowerCase()), Number(g.dayFirst || g.dayLast));
    add(match, key ? "date" : "invalid-date", key || normalize(match[0]));
  }
  for (const match of text.matchAll(isoDate)) {
    const key = dateKey(Number(match.groups.year), Number(match.groups.month), Number(match.groups.day));
    add(match, key ? "date" : "invalid-date", key || match[0]);
  }
  for (const match of text.matchAll(phone)) {
    let digits = match[0].replace(/\D/g, "");
    if (digits.length === 11) digits = digits.slice(1);
    add(match, "phone", digits);
  }
  const masked = text.split("");
  for (const [start, end] of excluded) masked.fill(" ", start, end);
  for (const match of masked.join("").matchAll(numeric)) {
    const g = match.groups;
    const marker = (g.prefix.match(/[$€£]/)?.[0] || g.suffix?.trim() || "").toUpperCase();
    const sign = g.prefix.includes("-") ? "-" : "";
    values.push({
      kind: marker === "%" ? "percent" : marker ? `currency:${marker}` : "number",
      value: `${sign}${decimalKey(g.number, language)}`,
      raw: text.slice(match.index, match.index + match[0].length).trim(), offset: match.index
    });
  }
  return values.sort((a, b) => a.offset - b.offset);
}

function segments(text) {
  const result = [];
  let start = 0;
  for (const match of text.matchAll(/\n+|(?<=[.!?])[ \t]+(?=\p{Lu})/gu)) {
    if (text.slice(start, match.index).trim()) result.push({text: text.slice(start, match.index), offset: start});
    start = match.index + match[0].length;
  }
  if (text.slice(start).trim()) result.push({text: text.slice(start), offset: start});
  return result;
}

function location(text, side, offset, excerpt) {
  return {side, line: text.slice(0, offset).split("\n").length, offset, excerpt: excerpt.slice(0, 240)};
}

function countTerms(text, term) {
  const escaped = normalize(term).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return [...normalize(text).matchAll(new RegExp(`(?<![\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])`, "gu"))].length;
}

function difference(source, target) {
  const remaining = [...target];
  return source.filter((token) => {
    const index = remaining.findIndex((other) => other.kind === token.kind && other.value === token.value);
    if (index < 0) return true;
    remaining.splice(index, 1);
    return false;
  });
}

export function auditDocuments(english, french, terminology = []) {
  english = String(english).replace(/\r\n/g, "\n");
  french = String(french).replace(/\r\n/g, "\n");
  const findings = [];
  const checked = ["Required text", "Glossary occurrences", "Numbers, percentages, currencies and phone numbers", "Named and ISO dates", "Passage and bullet counts", "Possible untranslated fragments"];
  const add = (id, severity, title, detail, evidence = []) => findings.push({id, severity, title, detail, evidence});
  if (!english.trim() || !french.trim()) {
    add("input", "high", "Both language versions are required", "Paste both versions before running the checks.");
    return {valid: false, findings, checked: [], notEvaluated: NOT_EVALUATED};
  }
  for (const pair of terminology) {
    const en = countTerms(english, pair.english), fr = countTerms(french, pair.french);
    if (en !== fr) add("glossary", "medium", `Review glossary term: ${pair.french}`,
      `“${pair.english}” occurs ${en} time(s); “${pair.french}” occurs ${fr} time(s). A difference can be intentional; verify the approved usage.`);
  }
  const enSegments = segments(english), frSegments = segments(french);
  const aligned = enSegments.length === frSegments.length;
  if (!aligned) add("alignment", "medium", "Passage counts differ",
    `English has ${enSegments.length} passage(s); French has ${frSegments.length}. Values were compared across the whole document. Reordered, split or merged passages need manual review.`);
  const pairs = aligned ? enSegments.map((segment, i) => [segment, frSegments[i]]) : [[{text: english, offset: 0}, {text: french, offset: 0}]];
  pairs.forEach(([en, fr], index) => {
    const enValues = extractValues(en.text, "en"), frValues = extractValues(fr.text, "fr");
    const missing = difference(enValues, frValues), added = difference(frValues, enValues);
    if (missing.length || added.length) {
      add("values", "high", aligned ? `Review values in passage ${index + 1}` : "Review document values",
        `Unmatched English values: ${missing.map((t) => t.raw).join(", ") || "none"}. Unmatched French values: ${added.map((t) => t.raw).join(", ") || "none"}. Check value, currency and date, including repeated occurrences.`,
        [...missing.map((t) => location(english, "English", en.offset + t.offset, en.text.trim())), ...added.map((t) => location(french, "French", fr.offset + t.offset, fr.text.trim()))]);
    }
    for (const [text, side, segment, tokens] of [[english, "English", en, enValues], [french, "French", fr, frValues]]) {
      for (const token of tokens.filter((t) => t.kind === "invalid-date")) add("date-invalid", "medium", "Invalid calendar date", token.raw, [location(text, side, segment.offset + token.offset, token.raw)]);
    }
  });
  const enBullets = english.split("\n").filter((line) => /^\s*(?:[-*•]|\d+[.)])\s+/.test(line)).length;
  const frBullets = french.split("\n").filter((line) => /^\s*(?:[-*•]|\d+[.)])\s+/.test(line)).length;
  if (enBullets !== frBullets) add("bullets", "medium", "Bullet counts differ", `English: ${enBullets}. French: ${frBullets}. Verify list coverage.`);
  for (const match of french.matchAll(/\b(?:the|with|deadline|approval|service level|privacy notice)\b[^.!?\n]*/gi)) {
    add("fragment", "low", "Possible untranslated fragment", "This word pattern may also be a name or quotation; a reviewer should decide.", [location(french, "French", match.index, match[0])]);
  }
  return {valid: true, findings, checked, notEvaluated: NOT_EVALUATED, alignment: aligned ? "passage order" : "whole document"};
}

export function buildReport(result, memo = "") {
  return ["BilinguAudit review record", `Generated: ${new Date().toISOString()}`, `Findings: ${result.findings.length}`, "Human review required; this is not a translation-quality score.",
    "", "Checks performed:", ...result.checked.map((check) => `- ${check}`), "", "Not evaluated:", ...result.notEvaluated.map((check) => `- ${check}`), "", "Findings:",
    ...(result.findings.length ? result.findings.map((f) => `[${f.severity.toUpperCase()}] ${f.title}\n${f.detail}\n${f.evidence.map((e) => `${e.side} line ${e.line}: ${e.excerpt}`).join("\n")}`) : ["No mismatches detected by these checks. Translation meaning and completeness still require review."]),
    ...(memo ? ["", "AI reviewer memo (suggestions requiring human review):", memo] : [])].join("\n");
}
