#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { copyFile, mkdir, readdir, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, '..');
const sourceDir = resolve(projectRoot, 'dist-single');
const sourceHtml = join(sourceDir, 'index.html');

function usage() {
  console.error([
    'Usage: node scripts/copy-standalone-artifacts.mjs --dist|--workspace|--target <dir>',
    '',
    'Copies dist-single/index.html as threatcaddy-standalone.html and copies',
    'top-level standalone JS sidecars next to it.',
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
const targetHtml = join(targetDir, 'threatcaddy-standalone.html');
await copyFile(sourceHtml, targetHtml);
copied.push(targetHtml);

const entries = await readdir(sourceDir);
for (const entry of entries) {
  if (!entry.endsWith('.js')) continue;
  const sourcePath = join(sourceDir, entry);
  const sourceStat = await stat(sourcePath);
  if (!sourceStat.isFile()) continue;
  const targetPath = join(targetDir, entry);
  await copyFile(sourcePath, targetPath);
  copied.push(targetPath);
}

console.log(`Copied standalone artifacts from ${sourceDir}`);
for (const file of copied) {
  console.log(`- ${file}`);
}
