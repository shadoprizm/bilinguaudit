import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const required = [
  "web/index.html",
  "web/styles.css",
  "web/app.js",
  "README.md",
  "package.json",
  "vercel.json"
];

for (const file of required) {
  const path = join(root, file);
  const stat = statSync(path);
  if (!stat.size) throw new Error(`${file} is empty`);
}

const html = readFileSync(join(root, "web/index.html"), "utf8");
const app = readFileSync(join(root, "web/app.js"), "utf8");

for (const token of ["BilinguAudit", "North Star Holdings", "Try It Now", "Free", "Pro"]) {
  if (!html.includes(token)) throw new Error(`Missing landing token: ${token}`);
}

for (const token of ["runAudit", "callOpenAI", "downloadReport", "terminology"]) {
  if (!app.includes(token)) throw new Error(`Missing app token: ${token}`);
}

console.log("BilinguAudit smoke test passed.");
