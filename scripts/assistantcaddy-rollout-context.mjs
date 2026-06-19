import { readFile } from 'node:fs/promises';
import path from 'node:path';

const repoRoot = process.cwd();
const options = parseOptions(process.argv.slice(2));

const ledgerPath = path.join(repoRoot, 'docs/assistantcaddy-rollout-ledger-2026-06-05.md');
const handoffPath = path.join(repoRoot, 'docs/assistantcaddy-workspace-overhaul-handoff-2026-06-06.md');
const memoryPath = path.join(repoRoot, 'docs/codex-experience-memory.md');

const [ledger, handoff, memory] = await Promise.all([
  readMarkdown(ledgerPath),
  readMarkdown(handoffPath),
  readMarkdown(memoryPath),
]);

console.log(`# AssistantCaddy Rollout Context`);
console.log(`repo: ${repoRoot}`);
console.log(`sections: ${options.sections}`);
console.log(`memory_lines_per_section: ${options.memoryLines}`);
console.log('');

printLatestSections('ledger', ledger, options.sections);
printLatestSections('handoff', handoff, options.sections);
printMemoryRouting(memory, options.memoryLines);

async function readMarkdown(filePath) {
  return readFile(filePath, 'utf8');
}

function parseOptions(args) {
  const sections = Number(readArg(args, '--sections') || '2');
  return {
    sections: Number.isFinite(sections) && sections > 0 ? Math.min(Math.floor(sections), 6) : 2,
    memoryLines: parseBoundedInteger(readArg(args, '--memory-lines'), 8, 1, 40),
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

function printLatestSections(label, content, limit) {
  const sections = splitSections(content)
    .filter((section) => /^(## (TC V3|Current State)|## .*Runtime|## .*Dispatch|## .*Promotion)/.test(section.heading))
    .slice(-limit);

  console.log(`## ${label}: latest ${sections.length} sections`);
  for (const section of sections) {
    console.log('');
    console.log(section.heading);
    for (const line of section.body) {
      if (isRoutingLine(line)) console.log(line);
    }
  }
  console.log('');
}

function splitSections(content) {
  const lines = content.split(/\r?\n/);
  const sections = [];
  let current = null;

  for (const line of lines) {
    if (/^#{2,3} /.test(line)) {
      if (current) sections.push(current);
      current = { heading: line, body: [] };
      continue;
    }
    if (current) current.body.push(line);
  }

  if (current) sections.push(current);
  return sections;
}

function isRoutingLine(line) {
  return (
    /^Status:/.test(line) ||
    /^- `(BASELINE|SLICE|PARTIAL|CANONICAL|ACCEPTED|WRITE SET|WORKER|THREAD|SOURCE|GATES|STATIC|PORTS|BROWSER|CHECKPOINT|PROMOTION|NEXT|RESIDUAL|SAFETY|TEMP|HASHES|PARITY|FINAL|PROCESS|ROSTER|BOUNDARIES|DISPATCH|LOCAL EVIDENCE|SUPERSEDED|CLOSED)/.test(line)
  );
}

function printMemoryRouting(memory, memoryLines) {
  const sections = splitSections(memory)
    .filter((section) =>
      [
        '## Current Project Shortcuts',
        '### Multi-Chat Coordination',
        '### Source Gates',
        '### Browser And Ports',
        '### Retrospectives And Automation',
      ].includes(section.heading),
    );

  console.log('## memory: routing snippets');
  for (const section of sections) {
    console.log('');
    console.log(section.heading);
    const matches = section.body.filter((line) => line.startsWith('- ') && isMemoryRoutingLine(line));
    for (const line of matches.slice(0, memoryLines)) {
      console.log(line);
    }
    if (matches.length > memoryLines) {
      console.log(`- ... ${matches.length - memoryLines} matching memory lines omitted by --memory-lines`);
    }
  }
  console.log('');
}

function isMemoryRoutingLine(line) {
  return /(worker|DONE PACKET|SOURCE-GATED|checkpoint|standalone|promotion|port|tail|bounded|script|automation|memory|ledger|handoff|worker chats|pinned|source sanity|diff --check)/i.test(line);
}
