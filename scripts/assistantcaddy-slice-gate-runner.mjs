#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const ACTUAL_CALL_PATTERN = /(fetch\s*\(|XMLHttpRequest|WebSocket\s*\(|EventSource\s*\(|indexedDB|localStorage|sessionStorage|new\s+Dexie|Dexie\.|from ['"]dexie|from ['"](?:openai|@openai|anthropic|@anthropic|@slack)|import\(['"](?:openai|@openai|anthropic|@anthropic|@slack)|schema\w*\s*\(|\.version\s*\(|\.stores\s*\(|export\w*\s*\(|import\w*\s*\(|backup\w*\s*\(|restore\w*\s*\(|sync\w*\s*\(|provider\w*\s*\(|credential\w*\s*\(|requester\w*\s*\(|child_process|spawn\s*\(|execFile\s*\(|\.execute\s*\(|\.request\s*\(|\.send\s*\(|\.stream\s*\()/;

const options = parseArgs(process.argv.slice(2));

if (options.help) usage(0);
if (options.writeSet.length === 0) usage(2, 'At least one --write-set file is required.');

const gateResults = [];

runGate('exact_status', ['git', ['status', '--short', '--', ...options.writeSet]]);

if (options.vitestFiles.length > 0) {
  runGate('focused_vitest', ['pnpm', ['exec', 'vitest', 'run', ...options.vitestFiles]]);
}

if (!options.skipTsc) {
  runGate('tsc_no_emit', ['pnpm', ['exec', 'tsc', '--noEmit', '--pretty', 'false']]);
}

if (!options.skipBuild) {
  runGate('tsc_build', ['pnpm', ['exec', 'tsc', '-b', '--pretty', 'false']]);
}

if (!options.skipRuntimeScan && (options.prodFiles.length > 0 || options.testFiles.length > 0)) {
  const args = ['scripts/assistantcaddy-runtime-boundary-scan.mjs'];
  if (options.requireRuntimeFixtures) args.push('--require-runtime-fixtures');
  if (options.prodFiles.length > 0) args.push('--prod', ...options.prodFiles);
  if (options.testFiles.length > 0) args.push('--tests', ...options.testFiles);
  runGate('runtime_boundary_scan', ['node', args]);
}

runNoLiveScan();
runGate('diff_check', ['git', ['diff', '--check', '--', ...options.writeSet]]);
runWhitespaceScan();

const passed = gateResults.filter((gate) => gate.status === 'pass').length;
const failed = gateResults.filter((gate) => gate.status === 'fail').length;
const skipped = gateResults.filter((gate) => gate.status === 'skip').length;

console.log('# AssistantCaddy Slice Gate Summary');
console.log(`write_set_files: ${options.writeSet.length}`);
console.log(`prod_files: ${options.prodFiles.length}`);
console.log(`test_files: ${options.testFiles.length}`);
console.log(`vitest_files: ${options.vitestFiles.length}`);
console.log(`gates_passed: ${passed}`);
console.log(`gates_failed: ${failed}`);
console.log(`gates_skipped: ${skipped}`);

for (const gate of gateResults) {
  console.log(`gate:${gate.name}:${gate.status}:exit=${gate.exitCode}`);
  if (gate.summary) console.log(`  ${gate.summary}`);
}

console.log(`status: ${failed === 0 ? 'pass' : 'fail'}`);
if (failed > 0) process.exitCode = 1;

function runGate(name, [command, args]) {
  if (options.dryRun) {
    gateResults.push({ name, status: 'skip', exitCode: 0, summary: `dry-run ${shellLine(command, args)}` });
    return;
  }
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    maxBuffer: options.maxOutputChars,
  });
  const output = `${result.stdout || ''}${result.stderr || ''}`.trim();
  const status = result.status === 0 ? 'pass' : 'fail';
  gateResults.push({
    name,
    status,
    exitCode: result.status ?? 1,
    summary: summarizeOutput(output),
  });
}

function runNoLiveScan() {
  if (options.skipNoLiveScan || options.prodFiles.length === 0) {
    gateResults.push({ name: 'actual_call_no_live_scan', status: 'skip', exitCode: 0, summary: 'no prod files or scan skipped' });
    return;
  }
  const matches = [];
  for (const file of options.prodFiles) {
    const content = readFileSync(file, 'utf8');
    const lines = content.split(/\r?\n/);
    lines.forEach((line, index) => {
      if (ACTUAL_CALL_PATTERN.test(line)) matches.push(`${file}:${index + 1}:${line.trim()}`);
    });
  }
  gateResults.push({
    name: 'actual_call_no_live_scan',
    status: matches.length === 0 ? 'pass' : 'fail',
    exitCode: matches.length === 0 ? 0 : 1,
    summary: matches.length === 0 ? 'matches=0' : `matches=${matches.length}; ${matches.slice(0, 8).join(' | ')}`,
  });
}

function runWhitespaceScan() {
  const matches = [];
  for (const file of options.writeSet) {
    const content = readFileSync(file, 'utf8');
    const lines = content.split(/\r?\n/);
    lines.forEach((line, index) => {
      if (/[ \t]+$/.test(line)) matches.push(`${file}:${index + 1}`);
    });
  }
  gateResults.push({
    name: 'trailing_whitespace',
    status: matches.length === 0 ? 'pass' : 'fail',
    exitCode: matches.length === 0 ? 0 : 1,
    summary: matches.length === 0 ? 'matches=0' : `matches=${matches.length}; ${matches.slice(0, 20).join(', ')}`,
  });
}

function parseArgs(args) {
  const parsed = {
    dryRun: false,
    help: false,
    maxLineChars: 700,
    maxOutputChars: 1_000_000,
    prodFiles: [],
    requireRuntimeFixtures: false,
    skipBuild: false,
    skipNoLiveScan: false,
    skipRuntimeScan: false,
    skipTsc: false,
    testFiles: [],
    vitestFiles: [],
    writeSet: [],
  };
  let mode = null;

  for (const arg of args) {
    if (arg === '--help' || arg === '-h') {
      parsed.help = true;
      continue;
    }
    if (arg === '--dry-run') {
      parsed.dryRun = true;
      continue;
    }
    if (arg === '--require-runtime-fixtures') {
      parsed.requireRuntimeFixtures = true;
      continue;
    }
    if (arg === '--skip-tsc') {
      parsed.skipTsc = true;
      continue;
    }
    if (arg === '--skip-build') {
      parsed.skipBuild = true;
      continue;
    }
    if (arg === '--skip-runtime-scan') {
      parsed.skipRuntimeScan = true;
      continue;
    }
    if (arg === '--skip-no-live-scan') {
      parsed.skipNoLiveScan = true;
      continue;
    }
    if (arg === '--write-set' || arg === '--prod' || arg === '--tests' || arg === '--vitest') {
      mode = arg.slice(2);
      continue;
    }
    if (arg.startsWith('--max-line-chars=')) {
      const value = Number.parseInt(arg.slice('--max-line-chars='.length), 10);
      if (!Number.isFinite(value) || value < 80) usage(2, '--max-line-chars must be at least 80.');
      parsed.maxLineChars = value;
      continue;
    }
    if (arg.startsWith('--')) usage(2, `Unknown option: ${arg}`);
    if (!mode) usage(2, `File argument ${arg} must follow --write-set, --prod, --tests, or --vitest.`);
    if (mode === 'write-set') parsed.writeSet.push(arg);
    if (mode === 'prod') parsed.prodFiles.push(arg);
    if (mode === 'tests') parsed.testFiles.push(arg);
    if (mode === 'vitest') parsed.vitestFiles.push(arg);
  }

  if (parsed.vitestFiles.length === 0) parsed.vitestFiles = [...parsed.testFiles];
  return parsed;
}

function summarizeOutput(output) {
  if (!output) return '';
  const compact = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(-12)
    .join(' | ');
  return compact.length > options.maxLineChars
    ? `${compact.slice(0, options.maxLineChars)}...`
    : compact;
}

function shellLine(command, args) {
  return [command, ...args].map((part) => (part.includes(' ') ? JSON.stringify(part) : part)).join(' ');
}

function usage(exitCode, message) {
  if (message) console.error(message);
  console.error('Usage: node scripts/assistantcaddy-slice-gate-runner.mjs --write-set <files...> [--prod <files...>] [--tests <files...>] [--vitest <files...>] [--require-runtime-fixtures] [--dry-run] [--skip-tsc] [--skip-build] [--skip-runtime-scan] [--skip-no-live-scan] [--max-line-chars=<n>]');
  process.exit(exitCode);
}
