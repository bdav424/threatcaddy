#!/usr/bin/env node
import { readFile } from 'node:fs/promises';

const options = parseArgs(process.argv.slice(2));

const patterns = [
  ['fetch-call', /\bfetch\s*\(/],
  ['xhr-constructor', /\bnew\s+XMLHttpRequest\s*\(/],
  ['xhr-reference', /\bXMLHttpRequest\b/],
  ['websocket-constructor', /\bnew\s+WebSocket\s*\(/],
  ['eventsource-constructor', /\bnew\s+EventSource\s*\(/],
  ['sendbeacon-call', /\bnavigator\.sendBeacon\s*\(/],
  ['localstorage-access', /\blocalStorage\./],
  ['sessionstorage-access', /\bsessionStorage\./],
  ['indexeddb-access', /\bindexedDB\./],
  ['dexie-import', /from\s+["']dexie["']|import\s*\(\s*["']dexie["']\s*\)/],
  ['dexie-constructor', /\bnew\s+Dexie\s*\(/],
  ['provider-sdk-import', /from\s+["'](?:openai|@openai\/[^"']+|anthropic|@anthropic\/[^"']+|@slack\/[^"']+|slack)["']|import\s*\(\s*["'](?:openai|@openai\/[^"']+|anthropic|@anthropic\/[^"']+|@slack\/[^"']+|slack)["']\s*\)/],
  ['credential-resolver-call', /\b(?:resolveCredential|credentialResolver|resolveSecret|secretResolver)\s*\(/],
  ['schema-writer-call', /\b(?:schemaWriter|writeSchema|applyMigration|migrateSchema)\s*\(/],
  ['child-process-call', /(?<!\.)\b(?:spawn|exec|execFile)\s*\(/],
  ['execute-method-call', /\.execute\s*\(/],
  ['request-method-call', /\.request\s*\(/],
  ['send-method-call', /\.send\s*\(/],
  ['stream-method-call', /\.stream\s*\(/],
  ['post-message-call', /\.postMessage\s*\(/],
];

if (options.files.length === 0) usage(2, 'At least one --files argument is required.');

const scanned = await Promise.all(options.files.map(readScannableFile));
const matches = [];

for (const file of scanned) {
  const lines = file.content.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const text = lines[index];
    if (options.ignoreComments && /^\s*(?:\/\/|\*|\/\*)/.test(text)) continue;
    for (const [name, pattern] of patterns) {
      if (pattern.test(text)) {
        matches.push({
          file: file.path,
          line: index + 1,
          pattern: name,
          text: text.trim(),
        });
      }
    }
  }
}

console.log('# AssistantCaddy No-Live Call Scan');
console.log(`files_scanned: ${scanned.length}`);
console.log(`matches: ${matches.length}`);

if (matches.length > 0) {
  console.log('');
  console.log('## matches');
  for (const match of matches.slice(0, options.maxMatches)) {
    console.log(`${match.file}:${match.line}:${match.pattern}:${truncate(match.text, options.maxLineChars)}`);
  }
  if (matches.length > options.maxMatches) {
    console.log(`... ${matches.length - options.maxMatches} additional matches omitted`);
  }
}

const passed = matches.length === 0;
console.log(`status: ${passed ? 'pass' : 'fail'}`);
if (!passed) process.exitCode = 1;

async function readScannableFile(path) {
  return {
    path,
    content: await readFile(path, 'utf8'),
  };
}

function parseArgs(args) {
  const parsed = {
    files: [],
    help: false,
    ignoreComments: true,
    maxLineChars: 220,
    maxMatches: 80,
  };
  let mode = null;

  for (const arg of args) {
    if (arg === '--help' || arg === '-h') {
      parsed.help = true;
      continue;
    }
    if (arg === '--files') {
      mode = 'files';
      continue;
    }
    if (arg === '--include-comments') {
      parsed.ignoreComments = false;
      continue;
    }
    if (arg.startsWith('--max-matches=')) {
      parsed.maxMatches = parsePositiveInt(arg, '--max-matches=');
      continue;
    }
    if (arg.startsWith('--max-line-chars=')) {
      parsed.maxLineChars = parsePositiveInt(arg, '--max-line-chars=');
      continue;
    }
    if (arg.startsWith('--')) usage(2, `Unknown option: ${arg}`);
    if (!mode) usage(2, `File argument ${arg} must follow --files.`);
    parsed.files.push(arg);
  }

  if (parsed.help) usage(0);
  return parsed;
}

function parsePositiveInt(arg, prefix) {
  const value = Number.parseInt(arg.slice(prefix.length), 10);
  if (!Number.isFinite(value) || value <= 0) usage(2, `${prefix.slice(0, -1)} must be a positive integer.`);
  return value;
}

function truncate(text, limit) {
  return text.length > limit ? `${text.slice(0, limit)}...` : text;
}

function usage(exitCode, message) {
  if (message) console.error(message);
  console.error('Usage: node scripts/assistantcaddy-no-live-call-scan.mjs --files <files...> [--include-comments] [--max-matches=<n>] [--max-line-chars=<n>]');
  process.exit(exitCode);
}
