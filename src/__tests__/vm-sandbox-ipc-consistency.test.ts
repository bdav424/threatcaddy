import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// desktop/*.mjs files are plain JS, outside tsconfig's "include": ["src"], so tsc -b
// gives zero protection against a typo in an IPC channel name string — preload.mjs and
// vm-sandbox.mjs each hardcode the same channel names as separate string literals, and
// nothing but a human re-reading both files catches them drifting apart. This test
// automates that cross-file audit so a future edit to either file that breaks the
// pairing fails the suite immediately instead of only failing at runtime inside
// Electron (which isn't exercised by any other test in this repo).

const desktopDir = path.join(process.cwd(), 'desktop');
const preloadSrc = fs.readFileSync(path.join(desktopDir, 'preload.mjs'), 'utf8');
const vmSandboxSrc = fs.readFileSync(path.join(desktopDir, 'vm-sandbox.mjs'), 'utf8');

function extractQuotedChannels(src: string, callPattern: RegExp): Set<string> {
  const channels = new Set<string>();
  for (const match of src.matchAll(callPattern)) channels.add(match[1]);
  return channels;
}

describe('vm-sandbox IPC channel name consistency (preload.mjs <-> vm-sandbox.mjs)', () => {
  it('every channel preload.mjs invokes has a matching ipcMain.handle in vm-sandbox.mjs', () => {
    const invoked = extractQuotedChannels(preloadSrc, /ipcRenderer\.invoke\('(vmsandbox:[a-z-]+)'/g);
    const handled = extractQuotedChannels(vmSandboxSrc, /ipcMain\.handle\('(vmsandbox:[a-z-]+)'/g);
    expect(invoked.size).toBeGreaterThan(0); // sanity check the regex actually matched something
    expect([...invoked].sort()).toEqual([...handled].sort());
  });

  it('every event preload.mjs subscribes to has a matching sendToRenderer emit in vm-sandbox.mjs', () => {
    const subscribed = extractQuotedChannels(preloadSrc, /ipcRenderer\.on\('(vmsandbox:[a-z-]+)'/g);
    const emitted = extractQuotedChannels(vmSandboxSrc, /sendToRenderer\('(vmsandbox:[a-z-]+)'/g);
    expect(subscribed.size).toBeGreaterThan(0);
    expect([...subscribed].sort()).toEqual([...emitted].sort());
  });

  it('the exposeInMainWorld global name matches what bridges.ts reads', () => {
    const bridgesSrc = fs.readFileSync(path.join(process.cwd(), 'src', 'lib', 'bridges.ts'), 'utf8');
    const exposedMatch = /exposeInMainWorld\('(threatcaddyVmSandbox)'/.exec(preloadSrc);
    expect(exposedMatch).not.toBeNull();
    expect(bridgesSrc).toContain(`.${exposedMatch![1]}`);
  });

  it('every method the VmSandboxBridge TS interface declares is actually exposed in preload.mjs', () => {
    const bridgesSrc = fs.readFileSync(path.join(process.cwd(), 'src', 'lib', 'bridges.ts'), 'utf8');
    const ifaceBlock = /export interface VmSandboxBridge \{([\s\S]*?)\n\}/.exec(bridgesSrc);
    expect(ifaceBlock).not.toBeNull();
    const declaredMethods = [...ifaceBlock![1].matchAll(/^\s+([a-zA-Z]+)\(/gm)].map((m) => m[1]);
    expect(declaredMethods.length).toBeGreaterThan(0);

    const exposedBlock = /exposeInMainWorld\('threatcaddyVmSandbox', \{([\s\S]*?)\n\}\);/.exec(preloadSrc);
    expect(exposedBlock).not.toBeNull();
    const exposedMethods = [...exposedBlock![1].matchAll(/^\s+([a-zA-Z]+):/gm)].map((m) => m[1]);

    expect([...declaredMethods].sort()).toEqual([...exposedMethods].sort());
  });

  it('registerVmSandbox is imported by main.mjs under the exact export name vm-sandbox.mjs uses', () => {
    const mainSrc = fs.readFileSync(path.join(desktopDir, 'main.mjs'), 'utf8');
    expect(vmSandboxSrc).toMatch(/export function registerVmSandbox\(/);
    expect(mainSrc).toMatch(/import \{ registerVmSandbox \} from '\.\/vm-sandbox\.mjs';/);
    expect(mainSrc).toMatch(/registerVmSandbox\(\);/);
  });

  it('getConfiguredWatchDir is imported from virtual-bridge.mjs under the exact export name it uses', () => {
    const virtualBridgeSrc = fs.readFileSync(path.join(desktopDir, 'virtual-bridge.mjs'), 'utf8');
    expect(virtualBridgeSrc).toMatch(/export function getConfiguredWatchDir\(/);
    expect(vmSandboxSrc).toMatch(/import \{ getConfiguredWatchDir \} from '\.\/virtual-bridge\.mjs';/);
    expect(vmSandboxSrc).toMatch(/getConfiguredWatchDir\(\)/);
  });
});
