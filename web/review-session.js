import { auditDocuments, buildReport, parseTerminology } from "./audit.js";

export const MAX_AI_CHARS = 60000;

export function createReviewSession(onChange, requestMemo) {
  let revision = 0, controller, result = null, memo = "", status = "", pending = false, signature = "";
  const inputSignature = (inputs) => JSON.stringify([inputs.english, inputs.french, inputs.terminology]);
  const state = () => ({result, memo, status, pending});
  const publish = () => onChange(state());
  function invalidate() {
    revision++;
    controller?.abort();
    controller = undefined;
    result = null; memo = ""; pending = false; signature = ""; status = "Text changed. Run the checks again.";
    publish();
  }
  function run(inputs) {
    invalidate();
    result = auditDocuments(inputs.english, inputs.french, parseTerminology(inputs.terminology));
    signature = inputSignature(inputs);
    status = result.valid ? "Local checks complete. Meaning and completeness need human review." : "Paste both language versions.";
    publish();
    return result;
  }
  async function generateMemo(inputs) {
    const checked = run(inputs);
    if (!checked.valid) return;
    if (!inputs.apiKey.trim()) {status = "Enter your OpenAI key to request a memo."; publish(); return;}
    if (inputs.english.length > MAX_AI_CHARS || inputs.french.length > MAX_AI_CHARS) {
      status = `AI review supports up to ${MAX_AI_CHARS.toLocaleString()} characters per language. No text was sent. Split the document into matched sections; local checks still cover the supplied text.`;
      publish(); return;
    }
    const currentRevision = revision;
    controller = new AbortController();
    pending = true; status = "Requesting AI review of the full supplied text…"; publish();
    try {
      const response = await requestMemo(inputs, checked, controller.signal);
      if (currentRevision !== revision) return;
      memo = response; status = "AI suggestions available. A bilingual reviewer must verify them.";
    } catch (error) {
      if (currentRevision !== revision) return;
      status = error.name === "AbortError" ? "AI request cancelled." : `AI memo unavailable: ${error.message}`;
    } finally {
      if (currentRevision === revision) {pending = false; controller = undefined; publish();}
    }
  }
  function report(inputs) {
    if (!result || signature !== inputSignature(inputs)) run(inputs);
    return result.valid ? buildReport(result, memo) : null;
  }
  return {invalidate, run, generateMemo, report, state};
}
