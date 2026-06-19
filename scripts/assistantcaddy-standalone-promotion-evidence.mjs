#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const repoRoot = process.cwd();
const primaryRoot = path.resolve(repoRoot, '..');
const secondaryRoot =
  process.env.THREATCADDY_SECONDARY_STANDALONE_DIR || '/Users/brdavies/workspace';
const distRoot = path.join(repoRoot, 'dist-single');
const manifestPath = path.join(primaryRoot, '.threatcaddy-standalone-sidecars.json');
const ports = process.argv.includes('--no-ports') ? [] : ['4181', '4173'];

const sidecars = readSidecars();
const htmlTargets = [
  ['dist', path.join(distRoot, 'index.html')],
  ['primary', path.join(primaryRoot, 'threatcaddy-standalone.html')],
  ['secondary', path.join(secondaryRoot, 'threatcaddy-standalone.html')],
];

let failed = false;

console.log('# AssistantCaddy Standalone Promotion Evidence');
emitParity('html', htmlTargets);

for (const sidecar of sidecars) {
  emitParity(`sidecar:${sidecar}`, [
    ['dist', path.join(distRoot, sidecar)],
    ['primary', path.join(primaryRoot, sidecar)],
    ['secondary', path.join(secondaryRoot, sidecar)],
  ]);
}

for (const port of ports) {
  emitPort(port);
}

process.exit(failed ? 1 : 0);

function readSidecars() {
  if (!existsSync(manifestPath)) {
    fail(`missing sidecar manifest: ${manifestPath}`);
    return [];
  }

  try {
    const parsed = JSON.parse(readFileSync(manifestPath, 'utf8'));
    if (!Array.isArray(parsed.sidecars)) {
      fail(`invalid sidecar manifest: ${manifestPath}`);
      return [];
    }

    return parsed.sidecars.filter((name) => typeof name === 'string' && name.length > 0);
  } catch (error) {
    fail(`failed to parse sidecar manifest: ${String(error)}`);
    return [];
  }
}

function emitParity(label, targets) {
  const rows = targets.map(([name, file]) => [name, file, sha256(file)]);
  const hashes = new Set(rows.map(([, , hash]) => hash).filter(Boolean));
  const ok = hashes.size === 1 && rows.every(([, , hash]) => Boolean(hash));
  console.log(`${label}_parity: ${ok ? 'pass' : 'fail'}`);

  for (const [name, file, hash] of rows) {
    console.log(`- ${name}: ${hash || 'missing'} ${file}`);
  }

  if (!ok) {
    failed = true;
  }
}

function sha256(file) {
  if (!existsSync(file)) {
    return null;
  }

  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

function emitPort(port) {
  const result = spawnSync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN'], {
    encoding: 'utf8',
  });
  const output = `${result.stdout || ''}${result.stderr || ''}`.trim();

  if (result.status === 0 && output) {
    console.log(`port_${port}: listener`);
    console.log(output);
    return;
  }

  console.log(`port_${port}: clear`);
}

function fail(message) {
  failed = true;
  console.error(`error: ${message}`);
}
