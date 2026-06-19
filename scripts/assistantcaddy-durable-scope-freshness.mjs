#!/usr/bin/env node
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');

const boundaryFile = 'src/lib/connector-runtime-persistence-implementation-boundary.ts';
const prodFiles = [
  'src/lib/connector-runtime-persistence-implementation-boundary.ts',
  'src/lib/connector-runtime-durable-state-implementation-manifest.ts',
  'src/lib/durable-persistence-operations-implementation-manifest.ts',
  'src/lib/durable-persistence-runtime-activation-plan.ts',
];
const testFiles = [
  'src/__tests__/connector-runtime-persistence-implementation-boundary.test.ts',
  'src/__tests__/connector-runtime-durable-state-implementation-manifest.test.ts',
  'src/__tests__/durable-persistence-operations-implementation-manifest.test.ts',
  'src/__tests__/durable-persistence-runtime-activation-plan.test.ts',
];
const expectedSyncFiles = [
  'src/lib/sync-engine.ts',
  'src/lib/sync-middleware.ts',
  'src/lib/sync-sanitize.ts',
  'src/lib/cloud-sync.ts',
  'server/src/index.ts',
  'server/src/types.ts',
];
const bannedStalePaths = [
  'src/lib/sync.ts',
  'server/',
];
const liveCallPattern = /(fetch\s*\(|XMLHttpRequest|WebSocket\s*\(|EventSource\s*\(|indexedDB|localStorage|sessionStorage|new\s+Dexie|Dexie\.|from ['"]dexie|schema\w*\s*\(|\.version\s*\(|\.stores\s*\(|export\w*\s*\(|import\w*\s*\(|backup\w*\s*\(|restore\w*\s*\(|sync\w*\s*\(|provider\w*\s*\(|credential\w*\s*\(|requester\w*\s*\(|child_process|spawn\s*\(|execFile\s*\(|\.execute\s*\(|\.request\s*\(|\.send\s*\(|\.stream\s*\()/;

function readRepoFile(file) {
  return readFileSync(path.join(repoRoot, file), 'utf8');
}

function extractStringLiterals(value) {
  const matches = [];
  const literalPattern = /'([^']+)'|"([^"]+)"/g;
  let match;
  while ((match = literalPattern.exec(value)) !== null) {
    matches.push(match[1] ?? match[2]);
  }
  return matches;
}

function sameList(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function pathExistsAsFile(file) {
  const fullPath = path.join(repoRoot, file);
  return existsSync(fullPath) && statSync(fullPath).isFile();
}

const failures = [];
const boundaryText = readRepoFile(boundaryFile);
const requiredFiles = [];
const requiredFilesPattern = /requiredFiles:\s*Object\.freeze\(\[([\s\S]*?)\]\)/g;
let requiredMatch;
while ((requiredMatch = requiredFilesPattern.exec(boundaryText)) !== null) {
  requiredFiles.push(...extractStringLiterals(requiredMatch[1]));
}

const missingFiles = requiredFiles.filter((file) => !pathExistsAsFile(file));
const broadDirectoryEntries = requiredFiles.filter((file) => file.endsWith('/'));
if (missingFiles.length > 0) failures.push(`missing required files: ${missingFiles.join(', ')}`);
if (broadDirectoryEntries.length > 0) failures.push(`broad directory entries: ${broadDirectoryEntries.join(', ')}`);

const syncSection = boundaryText.match(/section:\s*'sync'[\s\S]*?requiredFiles:\s*Object\.freeze\(\[([\s\S]*?)\]\)/);
const syncFiles = syncSection ? extractStringLiterals(syncSection[1]) : [];
if (!sameList(syncFiles, expectedSyncFiles)) {
  failures.push(`sync files mismatch: ${syncFiles.join(', ') || '<none>'}`);
}

const bannedLiteralPattern = new RegExp(
  bannedStalePaths
    .map((entry) => `['"]${entry.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`)
    .join('|'),
);
const staleProdMatches = prodFiles.flatMap((file) => {
  const text = readRepoFile(file);
  return text
    .split('\n')
    .map((line, index) => ({ file, line: index + 1, text: line }))
    .filter((entry) => bannedLiteralPattern.test(entry.text));
});
if (staleProdMatches.length > 0) {
  failures.push(`stale production literals: ${staleProdMatches.map((entry) => `${entry.file}:${entry.line}`).join(', ')}`);
}

const testText = testFiles.map(readRepoFile).join('\n');
const missingNegativeTests = bannedStalePaths.filter((entry) => !testText.includes(`'${entry}'`) && !testText.includes(`"${entry}"`));
if (missingNegativeTests.length > 0) failures.push(`missing negative test literals: ${missingNegativeTests.join(', ')}`);

const liveCallMatches = prodFiles.flatMap((file) => {
  const text = readRepoFile(file);
  return text
    .split('\n')
    .map((line, index) => ({ file, line: index + 1, text: line }))
    .filter((entry) => liveCallPattern.test(entry.text));
});
if (liveCallMatches.length > 0) {
  failures.push(`live call-site matches: ${liveCallMatches.map((entry) => `${entry.file}:${entry.line}`).join(', ')}`);
}

console.log('# AssistantCaddy Durable Scope Freshness');
console.log(`required_files: ${requiredFiles.length}`);
console.log(`missing_required_files: ${missingFiles.length}`);
console.log(`broad_directory_entries: ${broadDirectoryEntries.length}`);
console.log(`sync_required_files: ${syncFiles.length}`);
console.log(`stale_prod_literal_matches: ${staleProdMatches.length}`);
console.log(`missing_negative_test_literals: ${missingNegativeTests.length}`);
console.log(`live_call_matches: ${liveCallMatches.length}`);
console.log(`status: ${failures.length === 0 ? 'pass' : 'fail'}`);

if (failures.length > 0) {
  console.error(`failures: ${failures.join('; ')}`);
  process.exit(1);
}
