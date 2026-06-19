import { readFile } from 'node:fs/promises';
import path from 'node:path';

const repoRoot = process.cwd();
const options = parseOptions(process.argv.slice(2));

const docs = [
  {
    label: 'ledger',
    filePath: path.join(repoRoot, 'docs/assistantcaddy-rollout-ledger-2026-06-05.md'),
  },
  {
    label: 'handoff',
    filePath: path.join(repoRoot, 'docs/assistantcaddy-workspace-overhaul-handoff-2026-06-06.md'),
  },
];

const loadedDocs = await Promise.all(
  docs.map(async (doc) => ({
    ...doc,
    content: await readFile(doc.filePath, 'utf8'),
  })),
);

const docSummaries = loadedDocs.map(buildDocSummary);
const hasSections = docSummaries.some((summary) => summary.sections.length > 0);

if (options.quietNoChange && !hasSections) {
  console.log(
    `no_change: ledger>${sinceLineForDoc('ledger')} handoff>${sinceLineForDoc('handoff')} sections=0`,
  );
  process.exit(0);
}

console.log('# AssistantCaddy Watch Summary');
console.log(`repo: ${repoRoot}`);
console.log(`sections: ${options.sections}`);
console.log(`candidate_context: ${options.context}`);
console.log(`max_line_chars: ${options.maxLineChars}`);
printSinceLineHeader();
console.log('');

for (const summary of docSummaries) {
  printDocSummary(summary);
}

function parseOptions(args) {
  return {
    sections: parseBoundedInteger(readArg(args, '--sections'), 1, 1, 4),
    context: parseBoundedInteger(readArg(args, '--context'), 1, 0, 3),
    maxLineChars: parseBoundedInteger(readArg(args, '--max-line-chars'), 360, 80, 2000),
    quietNoChange: args.includes('--quiet-no-change'),
    sinceLine: parseBoundedInteger(readArg(args, '--since-line'), 0, 0, Number.MAX_SAFE_INTEGER),
    sinceLedgerLine: parseBoundedInteger(readArg(args, '--since-ledger-line'), 0, 0, Number.MAX_SAFE_INTEGER),
    sinceHandoffLine: parseBoundedInteger(readArg(args, '--since-handoff-line'), 0, 0, Number.MAX_SAFE_INTEGER),
  };
}

function parseBoundedInteger(value, fallback, min, max) {
  const parsed = Number(value || fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(parsed)));
}

function readArg(args, name) {
  const index = args.indexOf(name);
  if (index === -1) return null;
  return args[index + 1] || null;
}

function buildDocSummary(doc) {
  const sinceLine = sinceLineForDoc(doc.label);
  const lines = doc.content.split(/\r?\n/);
  const sections = splitSections(lines)
    .filter((section) => isRolloutSectionHeading(section.headingText))
    .filter((section) => sinceLine === 0 || section.headingLine > sinceLine)
    .slice(-options.sections);
  return { ...doc, sinceLine, sections };
}

function printDocSummary(doc) {
  const { sinceLine, sections } = doc;
  console.log(`## ${doc.label}: latest ${sections.length} rollout sections`);
  if (sections.length === 0) {
    console.log(sinceLine > 0 ? `- no rollout sections found after line ${sinceLine}` : '- no rollout sections found');
    console.log('');
    return;
  }

  for (const section of sections) {
    console.log('');
    console.log(formatLine(section.headingLine, section.headingText));
    for (const entry of section.body) {
      if (isStatusLine(entry.text) || isWatchRoutingLine(entry.text)) {
        console.log(formatLine(entry.line, entry.text));
      }
    }

    const candidates = section.body.filter((entry) => /`?MEMORY-CANDIDATE`?:/.test(entry.text));
    if (candidates.length > 0) {
      console.log('memory_candidates:');
      const printedLines = new Set();
      for (const candidate of candidates) {
        for (const contextEntry of contextWindow(section.body, candidate, options.context)) {
          if (printedLines.has(contextEntry.line)) continue;
          printedLines.add(contextEntry.line);
          console.log(formatLine(contextEntry.line, contextEntry.text));
        }
      }
    } else {
      console.log('memory_candidates: none in selected section');
    }
  }
  console.log('');
}

function formatLine(line, text) {
  return `${line}: ${truncateText(text, options.maxLineChars)}`;
}

function truncateText(text, maxChars) {
  if (text.length <= maxChars) return text;
  const omitted = text.length - maxChars;
  return `${text.slice(0, maxChars)}... [truncated ${omitted} chars]`;
}

function splitSections(lines) {
  const sections = [];
  let current = null;

  lines.forEach((text, index) => {
    const line = index + 1;
    if (/^#{2,3} /.test(text)) {
      if (current) sections.push(current);
      current = { headingLine: line, headingText: text, body: [] };
      return;
    }
    if (current) current.body.push({ line, text });
  });

  if (current) sections.push(current);
  return sections;
}

function isRolloutSectionHeading(heading) {
  return /^(## (TC V3|Current State)|### Process Hotwash)/.test(heading);
}

function isStatusLine(text) {
  return /^Status:/.test(text);
}

function isWatchRoutingLine(text) {
  return /^- `(PROCESS|NEXT|PROMOTION|SMOKE \/ PORTS|HASHES|SOURCE SANITY|GATES|CHECKPOINT|REPEATED TOKEN WASTE|MEMORY|AUTOMATION|NEXT-WAVE INSTRUCTION)/.test(text);
}

function contextWindow(entries, target, radius) {
  if (radius === 0) return [target];
  const targetIndex = entries.indexOf(target);
  if (targetIndex === -1) return [target];
  return entries.slice(Math.max(0, targetIndex - radius), Math.min(entries.length, targetIndex + radius + 1));
}

function printSinceLineHeader() {
  const ledgerLine = sinceLineForDoc('ledger');
  const handoffLine = sinceLineForDoc('handoff');
  if (ledgerLine > 0) console.log(`since_ledger_line: ${ledgerLine}`);
  if (handoffLine > 0) console.log(`since_handoff_line: ${handoffLine}`);
}

function sinceLineForDoc(label) {
  if (label === 'ledger' && options.sinceLedgerLine > 0) return options.sinceLedgerLine;
  if (label === 'handoff' && options.sinceHandoffLine > 0) return options.sinceHandoffLine;
  return options.sinceLine;
}
