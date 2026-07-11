const $ = (id) => document.getElementById(id);

const sampleEnglish = `Privacy Notice

The service level for bilingual client delivery is five business days. The vendor must deliver a privacy notice, accessibility statement, and final report by July 28, 2026.

The total fixed fee is $4,800 plus HST. A 20% deposit is due before work begins. The deadline may move only with written approval from the project lead.

Please contact the project manager at 613-555-0148 if terminology changes after approval.`;

const sampleFrench = `Avis de confidentialité

Le niveau de service pour la livraison bilingue aux clients est de cinq jours ouvrables. Le fournisseur doit remettre un avis de confidentialité, une déclaration d'accessibilité et le rapport final d'ici le 28 juillet 2026.

Les frais fixes totaux sont de 4 800 $ plus TVH. Un dépôt de 15 % est exigible avant le début des travaux. The deadline may move only with written approval from the project lead.

Veuillez communiquer avec le gestionnaire de projet au 613-555-0148 si la terminologie change après l'approbation.`;

let lastReport = "";

function normalize(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseTerminology(raw) {
  return raw
    .split(";")
    .map((pair) => pair.trim())
    .filter(Boolean)
    .map((pair) => {
      const [english, french] = pair.split("=").map((part) => part?.trim());
      return { english, french };
    })
    .filter((pair) => pair.english && pair.french);
}

function extractNumbers(text) {
  return [...text.matchAll(/\b\d{1,3}(?:[,\s]\d{3})*(?:\.\d+)?\s?%?|\b\d+\s?%/g)].map((m) =>
    m[0].replace(/\s/g, " ").trim()
  );
}

function extractDates(text) {
  return [
    ...text.matchAll(
      /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec|janv|févr|mars|avr|mai|juin|juil|août|sept|oct|nov|déc)[a-zéû.]*\s+\d{1,2},?\s+\d{4}|\b\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December|janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\s+\d{4}/gi
    )
  ].map((m) => m[0]);
}

function sentenceCount(text) {
  return text.split(/[.!?。]+/).filter((part) => part.trim().length > 12).length;
}

function bulletCount(text) {
  return text.split("\n").filter((line) => /^\s*(?:[-*•]|\d+[.)])\s+/.test(line)).length;
}

function addFinding(findings, severity, title, detail, action) {
  findings.push({ severity, title, detail, action });
}

function deterministicAudit(english, french, terminology) {
  const findings = [];
  const enNorm = normalize(english);
  const frNorm = normalize(french);

  if (!english.trim() || !french.trim()) {
    addFinding(
      findings,
      "high",
      "Both language versions are required",
      "The audit needs pasted English and French text to compare coverage.",
      "Paste both versions, then rerun the audit."
    );
    return { score: 0, findings };
  }

  for (const pair of terminology) {
    const enHit = enNorm.includes(normalize(pair.english));
    const frHit = frNorm.includes(normalize(pair.french));
    if (enHit && !frHit) {
      addFinding(
        findings,
        "high",
        `Missing French term: ${pair.french}`,
        `The English source uses "${pair.english}", but the expected French term was not found.`,
        "Confirm the approved terminology or update the glossary pair."
      );
    }
    if (!enHit && frHit) {
      addFinding(
        findings,
        "medium",
        `French term without English anchor: ${pair.french}`,
        `The French text includes "${pair.french}", but the English anchor "${pair.english}" was not detected.`,
        "Check whether the source term changed or the glossary needs updating."
      );
    }
  }

  const enNumbers = extractNumbers(english);
  const frNumbers = extractNumbers(french);
  const missingNumbers = enNumbers.filter((num) => !frNumbers.includes(num));
  if (missingNumbers.length) {
    addFinding(
      findings,
      "high",
      "Number mismatch risk",
      `Numbers in English but not French: ${[...new Set(missingNumbers)].join(", ")}.`,
      "Review money, percentages, phone numbers, deadlines, and quantities manually."
    );
  }

  const enDates = extractDates(english);
  const frDates = extractDates(french);
  if (enDates.length !== frDates.length) {
    addFinding(
      findings,
      "medium",
      "Date count differs",
      `English has ${enDates.length} detected date(s); French has ${frDates.length}.`,
      "Verify deadlines and effective dates against the source document."
    );
  }

  const englishFragments = french.match(/\b(?:the|and|with|deadline|approval|project|service level|privacy notice)\b[^.!?\n]*/gi) || [];
  if (englishFragments.length) {
    addFinding(
      findings,
      "high",
      "Likely untranslated English fragment",
      `Detected: "${englishFragments[0].trim()}".`,
      "Translate or intentionally mark quoted/source-language text."
    );
  }

  const enSentences = sentenceCount(english);
  const frSentences = sentenceCount(french);
  if (Math.abs(enSentences - frSentences) > 2) {
    addFinding(
      findings,
      "medium",
      "Sentence coverage drift",
      `English has ${enSentences} substantial sentence(s); French has ${frSentences}.`,
      "Check whether a paragraph was merged, omitted, or added during translation."
    );
  }

  const enBullets = bulletCount(english);
  const frBullets = bulletCount(french);
  if (enBullets !== frBullets) {
    addFinding(
      findings,
      "low",
      "Bullet structure differs",
      `English bullet count: ${enBullets}; French bullet count: ${frBullets}.`,
      "Review list formatting before client delivery."
    );
  }

  const ratio = french.length / Math.max(english.length, 1);
  if (ratio < 0.65 || ratio > 1.65) {
    addFinding(
      findings,
      "medium",
      "Length ratio looks unusual",
      `French length is ${(ratio * 100).toFixed(0)}% of English length.`,
      "Use this as a coverage prompt, not a translation-quality verdict."
    );
  }

  if (!findings.length) {
    addFinding(
      findings,
      "low",
      "No obvious deterministic issues",
      "The quick checks did not find glossary, number, date, untranslated-fragment, or structure risks.",
      "Run a human review or AI memo for nuance before final delivery."
    );
  }

  const penalty = findings.reduce((total, finding) => {
    if (finding.severity === "high") return total + 18;
    if (finding.severity === "medium") return total + 10;
    return total + 4;
  }, 0);

  return { score: Math.max(0, 100 - penalty), findings };
}

async function callOpenAI(apiKey, english, french, terminology, deterministicFindings) {
  if (!apiKey.trim()) return null;

  const prompt = `You are a Canadian bilingual document QA reviewer. Review the English and French text for terminology, missing content, numbers/dates, and delivery risk. Keep the memo concise and practical.

Terminology pairs: ${terminology.map((p) => `${p.english} = ${p.french}`).join("; ")}

Deterministic findings:
${deterministicFindings.map((f) => `- ${f.severity}: ${f.title} — ${f.detail}`).join("\n")}

English:
${english.slice(0, 6000)}

French:
${french.slice(0, 6000)}`;

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey.trim()}`
    },
    body: JSON.stringify({
      model: "gpt-5.4-mini",
      input: prompt,
      max_output_tokens: 700
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAI memo failed: ${response.status} ${text.slice(0, 160)}`);
  }

  const data = await response.json();
  return data.output_text || data.output?.flatMap((item) => item.content || []).map((c) => c.text).join("\n");
}

function renderResults(score, findings, aiMemo = null) {
  $("score").textContent = score;
  $("heroScore").textContent = score;
  const list = $("findings");
  list.innerHTML = "";

  for (const finding of findings) {
    const card = document.createElement("article");
    card.className = `result-card severity-${finding.severity}`;
    card.innerHTML = `<strong>${finding.title}</strong><p>${finding.detail}</p><p><em>${finding.action}</em></p>`;
    list.appendChild(card);
  }

  if (aiMemo) {
    const card = document.createElement("article");
    card.className = "result-card severity-low";
    card.innerHTML = `<strong>AI reviewer memo</strong><p>${aiMemo.replace(/\n/g, "<br>")}</p>`;
    list.prepend(card);
  }
}

async function runAudit() {
  const english = $("englishText").value;
  const french = $("frenchText").value;
  const terminology = parseTerminology($("terminology").value);
  const { score, findings } = deterministicAudit(english, french, terminology);
  renderResults(score, findings);

  let aiMemo = "";
  try {
    aiMemo = await callOpenAI($("apiKey").value, english, french, terminology, findings);
    if (aiMemo) renderResults(score, findings, aiMemo);
  } catch (error) {
    addFinding(findings, "medium", "AI memo unavailable", error.message, "Check the API key and retry.");
    renderResults(score, findings);
  }

  lastReport = [
    "BilinguAudit Report",
    `Generated: ${new Date().toISOString()}`,
    `Score: ${score}`,
    "",
    ...findings.map((f, index) => `${index + 1}. [${f.severity.toUpperCase()}] ${f.title}\n${f.detail}\nAction: ${f.action}`),
    aiMemo ? `\nAI reviewer memo:\n${aiMemo}` : ""
  ].join("\n\n");
}

function downloadReport() {
  if (!lastReport) runAudit().then(downloadReport);
  const blob = new Blob([lastReport || "Run an audit first."], { type: "text/plain" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `bilinguaudit-report-${new Date().toISOString().slice(0, 10)}.txt`;
  link.click();
  URL.revokeObjectURL(link.href);
}

$("loadSample").addEventListener("click", () => {
  $("englishText").value = sampleEnglish;
  $("frenchText").value = sampleFrench;
  runAudit();
});

$("runAudit").addEventListener("click", runAudit);
$("downloadReport").addEventListener("click", downloadReport);

renderResults("--", [
  {
    severity: "low",
    title: "Ready for review",
    detail: "Paste both language versions or load the sample to run the first audit.",
    action: "Add terminology pairs for the document type you are delivering."
  }
]);
