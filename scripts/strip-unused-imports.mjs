#!/usr/bin/env node
/**
 * Strip unused imports from migrated admin pages. Handles both multi-line
 * and inline import patterns.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(__dirname, "..", "app");

const TARGETS = ["PageHeader", "Button", "FormField", "StatusPill", "useMemo"];

function walk(dir) {
  const out = [];
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    const s = fs.statSync(p);
    if (s.isDirectory()) out.push(...walk(p));
    else if (p.endsWith(".tsx") || p.endsWith(".ts")) out.push(p);
  }
  return out;
}

function countUsagesOutsideImports(src, name) {
  // Remove import blocks completely, then count usages.
  let withoutImports = src
    .replace(/import\s+\{([\s\S]*?)\}\s+from\s+["'][^"']+["']\s*;?/g, "")
    .replace(/import\s+\w+\s+from\s+["'][^"']+["']\s*;?/g, "");
  const re = new RegExp(`\\b${name}\\b`, "g");
  return (withoutImports.match(re) || []).length;
}

const files = walk(appDir);
let cleaned = 0;

for (const file of files) {
  let src = fs.readFileSync(file, "utf8");
  let changed = false;

  for (const name of TARGETS) {
    // Skip if not imported at all
    if (!new RegExp(`\\b${name}\\b`).test(src)) continue;

    const usageCount = countUsagesOutsideImports(src, name);
    if (usageCount > 0) continue; // still used somewhere

    // Pattern 1: bare line inside multi-line import block
    let newSrc = src.replace(new RegExp(`^(\\s*)${name},?\\s*$\\n`, "gm"), "");

    // Pattern 2: standalone single-import line
    newSrc = newSrc.replace(
      new RegExp(`^\\s*import\\s+\\{\\s*${name}\\s*\\}\\s+from\\s+["'][^"']+["']\\s*;?\\s*$\\n?`, "gm"),
      "",
    );

    // Pattern 3: inline multi-import, name in middle/end of list
    // import { A, NAME, B } from "..."; → import { A, B } from "...";
    newSrc = newSrc.replace(
      new RegExp(`(import\\s+\\{[^}]*?)\\b${name}\\s*,\\s*([^}]*\\})`, "g"),
      "$1$2",
    );
    // import { A, NAME } from "..."; → import { A } from "...";
    newSrc = newSrc.replace(
      new RegExp(`(import\\s+\\{[^}]*?),\\s*${name}\\s*(\\})`, "g"),
      "$1$2",
    );
    // import { NAME, A } from "..."; → import { A } from "...";
    newSrc = newSrc.replace(
      new RegExp(`(import\\s+\\{)\\s*${name}\\s*,\\s*([^}]*\\})`, "g"),
      "$1$2",
    );

    // Pattern 4: inline `import { NAME } from "..."` (only-import case)
    newSrc = newSrc.replace(
      new RegExp(`^\\s*import\\s+\\{\\s*${name}\\s*\\}\\s+from\\s+["'][^"']+["']\\s*;?\\s*$\\n?`, "gm"),
      "",
    );

    // Collapse triple+ blank lines
    newSrc = newSrc.replace(/\n\n\n+/g, "\n\n");

    if (newSrc !== src) {
      src = newSrc;
      changed = true;
    }
  }

  if (changed) {
    fs.writeFileSync(file, src);
    cleaned++;
    console.log("cleaned:", path.relative(appDir, file));
  }
}

console.log(`\nTotal cleaned: ${cleaned} files`);
