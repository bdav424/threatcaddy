#!/usr/bin/env node

import { readFile } from 'node:fs/promises';

const options = parseArgs(process.argv.slice(2));
const noLivePatterns = [
  ['fetch-call', /\bfetch\s*\(/],
  ['xhr', /\bXMLHttpRequest\b/],
  ['websocket-call', /\bWebSocket\s*\(/],
  ['eventsource-call', /\bEventSource\s*\(/],
  ['sendbeacon-call', /\bnavigator\.sendBeacon\s*\(/],
  ['localstorage-access', /\blocalStorage\./],
  ['sessionstorage-access', /\bsessionStorage\./],
  ['indexeddb-access', /\bindexedDB\./],
  ['dexie-import-or-ref', /\bDexie\b|from ["']dexie["']|import\(["']dexie["']\)/],
  ['provider-sdk-import', /from ["'](?:openai|@openai|anthropic|@anthropic|@slack)["']|import\(["'](?:openai|@openai|anthropic|@anthropic|@slack)["']\)/],
  ['requester-call', /\brequester\s*\(/],
  ['send-call', /\.send\s*\(/],
  ['stream-call', /\.stream\s*\(/],
];

const fixturePatterns = [
  ['mailto', /mailto:/],
  ['urn', /urn:/],
  ['proxy', /\bnew\s+Proxy\b/],
  ['accessor', /Object\.defineProperty\s*\(/],
  ['ownKeys', /\bownKeys\b/],
  ['getOwnPropertyDescriptor', /\bgetOwnPropertyDescriptor\b/],
  ['getPrototypeOf', /\bgetPrototypeOf\b/],
];

if (options.prodFiles.length === 0 && options.testFiles.length === 0) {
  usage('At least one --prod or --tests file is required.');
}

const prodContents = await readFiles(options.prodFiles);
const testContents = await readFiles(options.testFiles);
const noLiveMatches = findMatches(prodContents, noLivePatterns);
const fixtureCounts = countFixtures(testContents, fixturePatterns);
const missingFixtures = options.requireRuntimeFixtures
  ? fixturePatterns.map(([name]) => name).filter((name) => fixtureCounts.get(name) === 0)
  : [];

console.log('# AssistantCaddy Runtime Boundary Scan');
console.log(`prod_files: ${options.prodFiles.length}`);
console.log(`test_files: ${options.testFiles.length}`);
console.log(`no_live_matches: ${noLiveMatches.length}`);
for (const [name] of fixturePatterns) {
  console.log(`fixture_${name}: ${fixtureCounts.get(name) || 0}`);
}

if (noLiveMatches.length > 0) {
  console.log('');
  console.log('## no-live matches');
  for (const match of noLiveMatches.slice(0, 40)) {
    console.log(`${match.file}:${match.line}:${match.name}:${match.text.trim()}`);
  }
  if (noLiveMatches.length > 40) {
    console.log(`... ${noLiveMatches.length - 40} additional matches omitted`);
  }
}

if (missingFixtures.length > 0) {
  console.log('');
  console.log(`missing_required_fixtures: ${missingFixtures.join(',')}`);
}

const passed = noLiveMatches.length === 0 && missingFixtures.length === 0;
console.log(`status: ${passed ? 'pass' : 'fail'}`);
if (!passed) process.exitCode = 1;

function parseArgs(args) {
  const parsed = {
    prodFiles: [],
    testFiles: [],
    requireRuntimeFixtures: false,
  };
  let mode = null;

  for (const arg of args) {
    if (arg === '--prod') {
      mode = 'prod';
      continue;
    }
    if (arg === '--tests') {
      mode = 'tests';
      continue;
    }
    if (arg === '--require-runtime-fixtures') {
      parsed.requireRuntimeFixtures = true;
      continue;
    }
    if (!mode) usage(`File argument ${arg} must follow --prod or --tests.`);
    if (mode === 'prod') parsed.prodFiles.push(arg);
    if (mode === 'tests') parsed.testFiles.push(arg);
  }

  return parsed;
}

function usage(message) {
  if (message) console.error(message);
  console.error('Usage: node scripts/assistantcaddy-runtime-boundary-scan.mjs [--require-runtime-fixtures] --prod <files...> --tests <files...>');
  process.exit(2);
}

async function readFiles(files) {
  return Promise.all(files.map(async (file) => ({
    file,
    content: await readFile(file, 'utf8'),
  })));
}

function findMatches(files, patterns) {
  const matches = [];
  for (const { file, content } of files) {
    const lines = content.split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
      const text = lines[index];
      for (const [name, pattern] of patterns) {
        if (pattern.test(text)) {
          matches.push({ file, line: index + 1, name, text });
        }
      }
    }
  }
  return matches;
}

function countFixtures(files, patterns) {
  const counts = new Map(patterns.map(([name]) => [name, 0]));
  for (const { content } of files) {
    for (const [name, pattern] of patterns) {
      const matches = content.match(new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`));
      counts.set(name, (counts.get(name) || 0) + (matches ? matches.length : 0));
    }
  }
  return counts;
}
