# Running ThreatCaddy as a Desktop App

## Quick start

```sh
pnpm install
pnpm build
pnpm desktop:start
```

The desktop wrapper opens at `http://127.0.0.1:4174/` (or the next available port if 4174 is busy).

## How it works

`pnpm desktop:start` launches Electron. On startup, Electron:

1. Picks a free port starting at 4174.
2. Starts a loopback HTTP server that serves `dist/` on `127.0.0.1:<port>`.
3. Opens a `BrowserWindow` and calls `loadURL('http://127.0.0.1:<port>/')`.

The loopback server (not `file://`) is required because Vite-built ES modules rely
on CORS-safe same-origin requests. A `file://` origin breaks module loading.

## Service worker

In the Electron context, the loopback server serves a no-op `sw.js` that immediately
installs and activates. This prevents the VitePWA-generated Workbox service worker from
caching assets inside Electron, where caching is unhelpful and can mask stale builds.

## Development mode

Start the renderer and Electron in two terminals:

```sh
# Terminal 1
pnpm desktop:dev:renderer

# Terminal 2
pnpm desktop:dev:main
```

`TC_DESKTOP_DEV_URL=http://127.0.0.1:4173` is set by the `desktop:dev:main` script and
bypasses the loopback server — Electron loads the Vite dev server directly for HMR.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Electron binary missing after `pnpm install` | Electron's postinstall downloads the binary. Ensure `electron` is in `onlyBuiltDependencies` in `.npmrc` and `pnpm-workspace.yaml`. |
| Blank window / module load error | Run `pnpm build` first. The loopback server requires `dist/` to exist. |
| Port conflict | The server tries ports starting at 4174. Check for stale processes on that port. |
| `window.threatcaddy` read-only error | The preload exposes `window.threatcaddyCalendar` (calendar bridge) and the renderer writes `window.threatcaddy` (agent bridge). They must use separate names. |
