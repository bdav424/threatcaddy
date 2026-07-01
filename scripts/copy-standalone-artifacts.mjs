#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { copyFile, mkdir, readdir, readFile, stat, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, '..');
const sourceDir = resolve(projectRoot, 'dist-single');
const sourceHtml = join(sourceDir, 'index.html');
const standardWorkspaceDir = resolve(projectRoot, '..');
const standardWorkspaceHtml = join(standardWorkspaceDir, 'threatcaddy-standalone.html');
const sidecarManifestName = '.threatcaddy-standalone-sidecars.json';
const standaloneSidecarPatterns = [
  /^browser-ponyfill-.*\.js$/,
  /^search\.worker-.*\.js$/,
  /^chunk-reload-guard\.js$/,
];

function usage() {
  console.error([
    'Usage: node scripts/copy-standalone-artifacts.mjs --dist|--workspace|--target <dir>',
    '',
    'Copies dist-single/index.html as threatcaddy-standalone.html and copies',
    'top-level standalone JS sidecars next to it.',
    '',
    '--workspace refreshes the standard standalone PR copy at:',
    `  ${standardWorkspaceHtml}`,
  ].join('\n'));
}

const args = process.argv.slice(2);
let targetDir;

for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  if (arg === '--dist') {
    targetDir = resolve(projectRoot, 'dist');
  } else if (arg === '--workspace') {
    targetDir = resolve(projectRoot, '..');
  } else if (arg === '--target') {
    const next = args[i + 1];
    if (!next) {
      usage();
      process.exit(1);
    }
    targetDir = resolve(projectRoot, next);
    i += 1;
  } else if (arg === '--help' || arg === '-h') {
    usage();
    process.exit(0);
  } else {
    console.error(`Unknown argument: ${arg}`);
    usage();
    process.exit(1);
  }
}

if (!targetDir) {
  usage();
  process.exit(1);
}

if (!existsSync(sourceHtml)) {
  console.error('Missing dist-single/index.html. Run pnpm build:single first.');
  process.exit(1);
}

await mkdir(targetDir, { recursive: true });

const copied = [];
const removed = [];
const targetHtml = join(targetDir, 'threatcaddy-standalone.html');
await copyFile(sourceHtml, targetHtml);
copied.push(targetHtml);

const entries = await readdir(sourceDir);
const sourceJsEntries = new Set(entries.filter((entry) => entry.endsWith('.js')));
const manifestPath = join(targetDir, sidecarManifestName);

let previousSidecars = [];
try {
  const manifestContents = await readFile(manifestPath, 'utf8');
  const parsed = JSON.parse(manifestContents);
  if (Array.isArray(parsed?.sidecars)) {
    previousSidecars = parsed.sidecars.filter((entry) => typeof entry === 'string');
  }
} catch {
  previousSidecars = [];
}

if (targetDir === standardWorkspaceDir) {
  const targetEntries = await readdir(targetDir);
  const cleanupCandidates = new Set(previousSidecars);

  for (const entry of targetEntries) {
    if (standaloneSidecarPatterns.some((pattern) => pattern.test(entry))) {
      cleanupCandidates.add(entry);
    }
  }

  for (const entry of cleanupCandidates) {
    if (sourceJsEntries.has(entry)) continue;
    const stalePath = join(targetDir, entry);
    if (!targetEntries.includes(entry)) continue;
    await unlink(stalePath);
    removed.push(stalePath);
  }
}

for (const entry of entries) {
  if (!entry.endsWith('.js')) continue;
  const sourcePath = join(sourceDir, entry);
  const sourceStat = await stat(sourcePath);
  if (!sourceStat.isFile()) continue;
  const targetPath = join(targetDir, entry);
  await copyFile(sourcePath, targetPath);
  copied.push(targetPath);
}

await writeFile(
  manifestPath,
  `${JSON.stringify({ sidecars: Array.from(sourceJsEntries).sort() }, null, 2)}\n`,
  'utf8',
);
copied.push(manifestPath);

console.log(`Copied standalone artifacts from ${sourceDir}`);
for (const file of copied) {
  console.log(`- ${file}`);
}
if (removed.length > 0) {
  console.log('');
  console.log('Removed stale standalone sidecars:');
  for (const file of removed) {
    console.log(`- ${file}`);
  }
}

if (targetHtml === standardWorkspaceHtml) {
  console.log('');
  console.log(`Standard standalone PR copy refreshed: ${targetHtml}`);
} else {
  console.log('');
  console.log(`Standalone HTML written to: ${targetHtml}`);
  console.log(`Standard standalone PR copy remains: ${standardWorkspaceHtml}`);
}
