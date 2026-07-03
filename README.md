<p align="center">
  <img src="public/logo.svg" alt="ThreatCaddy" width="80" height="80" />
</p>

<h1 align="center">ThreatCaddy</h1>

<p align="center">
  <strong>Local-first threat investigation workspace for security analysts.</strong><br/>
  Notes, IOCs, timelines, graphs, CaddyAI, autonomous agents, and team collaboration — all in your browser.
</p>

<p align="center">
  <a href="https://github.com/bdav424/threatcaddy/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License: MIT" /></a>
  <img src="https://img.shields.io/badge/version-1.0.0-green.svg" alt="Version 1.0.0" />
  <img src="https://img.shields.io/badge/TypeScript-5.9-blue.svg?logo=typescript&logoColor=white" alt="TypeScript 5.9" />
  <img src="https://img.shields.io/badge/React-19-61dafb.svg?logo=react&logoColor=white" alt="React 19" />
  <img src="https://img.shields.io/badge/Vite-7-646cff.svg?logo=vite&logoColor=white" alt="Vite 7" />
  <img src="https://img.shields.io/badge/PWA-ready-5a0fc8.svg?logo=pwa&logoColor=white" alt="PWA Ready" />
  <img src="https://img.shields.io/badge/Desktop-Electron-47848f.svg?logo=electron&logoColor=white" alt="Electron Desktop" />
  <a href="https://chromewebstore.google.com/detail/threatcaddy-%E2%80%94-quick-captu/lakelgngpkkaeinfdlnmifookbeeffbh"><img src="https://img.shields.io/badge/Chrome_Web_Store-Extension-4285F4.svg?logo=googlechrome&logoColor=white" alt="Chrome Web Store" /></a>
</p>

<p align="center">
  <a href="https://threatcaddy.com">threatcaddy.com</a> &nbsp;|&nbsp;
  <a href="https://threatcaddy.com/?demo=1">Live Demo</a> &nbsp;|&nbsp;
  <a href="https://chromewebstore.google.com/detail/threatcaddy-%E2%80%94-quick-captu/lakelgngpkkaeinfdlnmifookbeeffbh">Chrome Extension</a>
</p>

---

## AI Reporter Entry Point

Future AI reporters producing INTEL-style intelligence notes must read
[`docs/intel-note-reporting-procedure.md`](docs/intel-note-reporting-procedure.md)
before drafting or rendering a report. That procedure is the standing source of
truth for Word template fidelity, source-note formatting, table geometry, and
visual QA.

## Why ThreatCaddy?

Most investigation tools lock your data in a cloud you don't control, cost per seat, and force you into rigid workflows. ThreatCaddy is different:

- **Local-first** — All data lives in your browser's IndexedDB. No accounts, no tracking, no cookies.
- **Zero setup** — Open the URL and start working. No install, no server required.
- **Optional team server** — When you need collaboration, spin up a Docker container. Per-investigation sync lets you choose what stays local and what gets shared.
- **Encryption at rest** — AES-256-GCM encryption with PBKDF2 key derivation protects your data even on shared machines.
- **Works offline** — Download a standalone HTML file that runs from `file://`.
- **AI that works for you** — From a conversational assistant to a full autonomous multi-agent security team, CaddyAI and AgentCaddy meet you where you are.

## Quick Start

**Try it now:** [threatcaddy.com/?demo=1](https://threatcaddy.com/?demo=1) loads a sample investigation with a guided walkthrough.

**Self-host the client:**

```bash
pnpm install
pnpm dev          # Dev server at localhost:5173
```

**Deploy a team server:**

```bash
cd server
cp .env.example .env   # Configure JWT keys and optional LLM API keys
docker compose up -d   # Starts Hono server + PostgreSQL
```

---

## Features

### Notes & Editor

- **Markdown editor** with live preview, split view, and syntax highlighting for 20+ languages
- **Wiki-links** — Type `[[note title]]` to link between notes with autocomplete and broken-link indicators
- **Slash commands** — `/` menu with formatting, threat intel templates (IOC tables, MITRE references, TLP headers), and quick inserts
- **Note sub-folders** — Organize notes into a hierarchy via drag-to-folder; folders are first-class notes with `isFolder` set
- **Note annotations** — Timestamped comments on any note
- **Defang/Refang toggle** — Preview network IOCs in defanged form (`hxxps://`, `example[.]com`)
- **Open markdown files** — Open `.md` or `.txt` files via `Ctrl+O` / `Cmd+O`, drag-and-drop, or the New menu. File name, size, and creation date are captured in the title. IOCs are auto-extracted on import
- **Quick capture** — Clip articles, bookmarks, code snippets, and meeting notes with 15+ built-in templates
- **Note templates** — 15 built-in templates (host details, malware analysis, phishing reports, threat actor profiles, and more). Create, edit, and save your own. Save any note as a reusable template.

### Investigation Playbooks

- **Built-in playbooks** — 6 pre-built playbooks: Incident Response, Phishing Investigation, Malware Analysis, Threat Hunt, Data Breach, and Vulnerability Assessment
- **Custom playbooks** — Create your own with ordered steps that auto-populate investigations with tasks and notes
- **One-click instantiation** — Start a new investigation from a playbook and get a complete workspace: folder, timeline, tasks with phases/priorities, and pre-filled notes from templates

### Task Management

- Priorities, due dates, and statuses with list and kanban views
- **3-level subtask hierarchy** — Tasks contain subtasks; each subtask can have sub-subtasks. All levels persist in IndexedDB without a schema migration
- **Drag-to-reorder** — HTML5 drag-and-drop reorders subtasks and sub-subtasks within their parent
- **Inline edit** — Double-click any subtask or sub-subtask to edit in-place with an auto-growing textarea (Enter saves, Shift+Enter inserts a newline, Escape cancels)
- Threaded comments on tasks

---

### CaddyAI

Human-driven conversational AI assistant with a deep toolset for threat investigation.

- **Multi-provider** — Anthropic (Claude Opus 4, Sonnet 4, Haiku 3.5), OpenAI (GPT-5.4, GPT-5.4 Pro, GPT-5.2, GPT-5 Mini, o3, o4-mini, GPT-4.1, GPT-4.1 Mini, GPT-4o), Google Gemini (2.5 Pro, 2.5 Flash), Mistral (Large, Small, Codestral), and local OpenAI-compatible models (Ollama / LM Studio / vLLM / Codex via `everybody_llmbo`)
- **66 tools** — 54 core tools to search, read, create, and update all investigation subpanels (notes, tasks, timeline, pivot graph, IOCs, evidence, product notes); 7 delegation tools for Lead Analyst coordination; 5 executive tools for CISO/Chief of Staff. Includes IOC extraction, URL fetching, report generation, product baseline rendering, CaddyShack push, pivot graph construction, and cross-investigation analysis
- **Slash commands** — `/fetch`, `/search`, `/note`, `/task`, `/iocs`, `/summary`, `/timeline`, `/report`, `/triage`, `/graph`, `/link`
- **Customizable system prompt** — Editable in Settings with CTI/IR tradecraft baked into the default (MITRE ATT&CK, Diamond Model, Kill Chain, Pyramid of Pain, estimative language, TLP/PAP)
- **Persistent threads** with auto-generated titles
- **Background continuity** — CaddyAI keeps streaming even when you switch to another panel. A live indicator in the header pulses purple while the model is thinking so you never lose context mid-response
- **Safe / YOLO mode** — Toggle between requiring confirmation for tool calls (Safe) and fully autonomous execution (YOLO). Mode persists across reloads via localStorage

---

### AgentCaddy — Autonomous Multi-Agent System

Deploy a team of AI analysts that run autonomously in the background, enriching data, building timelines, hunting threats, and briefing stakeholders — while you keep working.

#### The 17 Built-in Analyst Profiles

| Role | Profile | Focus |
|------|---------|-------|
| 🏛️ CISO | Executive | Strategic risk, business impact, resource decisions |
| 📋 Chief of Staff | Executive | Operational coordination, blocker identification, progress |
| 👑 Lead Analyst | Leadership | Case orchestration, task delegation, quality review |
| 🔍 IOC Enricher | Specialist | VirusTotal, AbuseIPDB, Shodan enrichment |
| 📅 Timeline Builder | Specialist | Date extraction, ATT&CK tactic mapping, narrative creation |
| 🧠 Hypothesis Writer | Specialist | Falsifiable working theories — claim, evidence (for/against), confidence, how-to-test |
| 🎯 Threat Hunter | Specialist | Hypothesis-driven hunting, behavioral pattern detection |
| 🦠 Malware Analyst | Specialist | Hash analysis, C2 extraction, family identification |
| 🌐 Network Forensics | Specialist | Network IOCs, C2 infrastructure, lateral movement |
| 🔬 Digital Forensics | Specialist | Artifacts, chain of custody, evidence integrity |
| 🛡️ Vulnerability Analyst | Specialist | CVE research, exploitability, patch prioritization |
| ⚖️ Legal Counsel | Observer | Breach notification, evidence admissibility, regulatory exposure |
| 📜 Compliance Officer | Observer | GDPR, HIPAA, PCI-DSS, SOX, NIST framework mapping |
| 📢 Communications Lead | Observer | Customer notification, press statements, PR messaging |
| 🏢 Business Continuity | Observer | Operational impact, RTO/RPO, recovery actions |
| 🔗 Pattern Hunter | Cross-case | Shared IOCs, TTPs, campaign connections across all investigations |
| 📝 Reporter | Cross-case | Structured report generation, IOC stats, timeline coverage |

**Executives** can spawn and dismiss other agents. **Observers** have read-only access to technical entities. **Cross-case** agents see across all investigations.

#### How It Works

- **Parallel execution** — Up to 5 deployments run concurrently via `Promise.allSettled`; falls back to serial for local LLMs. Each deployment has its own audit thread
- **Policy controls** — 5 action classes (read / enrich / fetch / create / modify) with per-class auto-approve toggles and per-agent allowed tool lists
- **Agent Meetings** — Trigger a round-robin discussion between deployed agents (`call_meeting`). Produces structured meeting minutes saved as a Note
- **Supervisor** — Global cross-investigation agent running on a timer. Identifies shared IOCs, stale cases, and emerging patterns; writes findings to a dedicated system investigation
- **Handoffs & Shift States** — Agents are either `active` or `resting`. Shift changes trigger a handoff call where the outgoing agent briefs the incoming one
- **Adaptive scheduling** — High success rates shorten cycle intervals; persistent errors throttle and flag for review
- **Agent Souls** — Executives can reflect on performance and accumulate persistent cross-investigation memory via `reflect_on_performance` and `read_soul`
- **War Bridges** — Emergency all-hands meetings triggered by critical findings (`declare_war_bridge`); escalates to CISO immediately
- **Agent Metrics** — Each deployment tracks cycles, tool calls, and token usage
- **Global tool-approval overlay** — When AgentCaddy needs a human decision, a full-screen portal overlay (z-index 9999) appears regardless of which panel is currently visible. You never miss an approval request even when the Chat panel is hidden

#### Agent Hosts — External Skills

Connect any REST API as an agent skill source:

- Configure endpoints in **Settings > AI > Agent Hosts** with a name, URL, and optional bearer token
- Agents discover available skills via `GET /skills` at startup
- Skills are executed via `POST /execute` and appear as `host:<name>:<skill>` tools in agent prompts
- Action class hints from the host API (`fetch`, `create`, `enrich`, `modify`) integrate with the policy system automatically

---

### Threat Intelligence & Analysis

- **IOC extraction** — Auto-extract IPv4, IPv6, domains, URLs, emails, hashes (MD5/SHA-1/SHA-256), CVEs, MITRE ATT&CK IDs, YARA rules, Sigma rules, and file paths
- **Standalone IOCs** — Manage IOCs with type, confidence, subtypes, analyst notes, attribution, and classification
- **IOC relationships** — Many-to-many links with typed, directional relationships (e.g. domain "resolves-to" IP, hash "exploits" CVE)
- **Entity graph** — Interactive force-directed graph of IOCs, notes, tasks, and timeline events with drag-to-link, filtering, and multiple layouts
- **IOC dashboard** — Aggregate stats: type/confidence distribution, top actors, timeline, frequency tables
- **TLP/PAP classification** — Traffic Light Protocol and Permissible Actions Protocol levels on entities and investigations. New entities automatically inherit the strictest TLP/PAP level from their parent investigation, removing the need to manually set classification on every IOC, note, and timeline event
- **Export** — JSON, CSV (grouped or flat), STIX 2.1 bundles; push to External Backup object storage

### Timeline & Whiteboard

- **Incident timeline** — Map events to MITRE ATT&CK tactics with timestamps, confidence, and linked IOCs
- **Multi-timeline support** — Per-investigation timelines with dedicated views
- **Timeline map** — Geolocated events on an interactive Leaflet map with clustered markers
- **Smart data import** — Paste CSV, TSV, JSON, or NDJSON from SIEMs and EDR tools; auto-detect format, auto-map columns (Splunk, CrowdStrike, Elastic)
- **Whiteboards** — Freeform drawing with Excalidraw integration
- **Activity log** — Track all actions across notes, tasks, timeline, and IOCs

### Organization

- **Investigations** — Color-coded folders with active/closed/archived lifecycle, closure resolutions, scoped entity counts, and bulk operations
- **Per-investigation sync** — Toggle cloud sync per investigation; mark sensitive cases as local-only
- **Entity cross-linking** — Link notes, tasks, and timeline events to each other
- **Tags** — Color-coded tags with rename and delete
- **Full-text search** — Instant search across all entity types with saved searches and investigation-scoped filtering
- **Unified trash & archive** — Manage deleted and archived items in one view with 30-day auto-delete

### Security & Backup

- **Encryption at rest** — Passphrase-based AES-256-GCM via PBKDF2 (600k iterations) with configurable session duration and recovery phrase
- **Cloud backup** — External Backup Object Storage, AWS S3, Azure Blob Storage, or Google External Backup via signed URLs
- **Export & import** — Full JSON backup/restore; per-investigation export; includes note templates and playbooks

### Team Server

- **Docker deployment** — `docker compose up` for Hono + Node.js server and PostgreSQL
- **Authentication** — Ed25519 JWT auth with user roles (admin, analyst, viewer)
- **Real-time sync** — Push/pull synchronization with version tracking, conflict detection, and WebSocket live updates
- **Presence** — See who's online and what they're viewing
- **Team feed** — Posts, reactions, threaded replies, mentions, and notifications
- **Investigation sharing** — Invite members with per-investigation roles (owner, editor, viewer)
- **Audit trail** — Server-side activity logging
- **Server-side LLM** — Proxy LLM requests through the server with shared API keys
- **File storage** — Upload and share files within investigations

---

### Browser Extension

Install from the [Chrome Web Store](https://chromewebstore.google.com/detail/threatcaddy-%E2%80%94-quick-captu/lakelgngpkkaeinfdlnmifookbeeffbh) or load the Firefox build manually — see [extension/README.md](extension/README.md).

The extension connects to any ThreatCaddy instance: the hosted app, a self-hosted server, a local dev build, or a standalone `file://` HTML file.

#### Quick Capture

- Right-click any selection → **Save to ThreatCaddy** — clips text, images, and source metadata
- `Ctrl+Shift+X` / `⌃+Shift+X` — clips the selection, or the full page if nothing is selected
- Quick-capture form in the popup for typed or pasted notes, with entity type (Note / Task / Timeline Event), investigation folder, and TLP classification

#### Clips Management

The full **Clips page** (`Review All Captures`) shows everything captured across all tabs:

- View capture stats: total, this week, unsent
- **Inline edit** per-capture fields: entity type, folder name, and TLP classification
- **Apply Defaults** — batch-set entity type, folder, and classification across all unsent captures
- **Send All** — dispatches all unsent captures to the configured ThreatCaddy target; marks them as sent
- Target URL supports `http://`, `https://`, and `file://` (for standalone builds)

#### Extension Permissions

Three optional permissions — each toggled from the popup:

| Permission | What it enables |
|------------|----------------|
| **Allow CaddyAI** | Grants the extension access to LLM provider APIs (Anthropic, OpenAI, Google, Mistral) so the browser can proxy AI requests from the app |
| **Allow URL fetching** | Enables the `/fetch` command and non-localhost local LLMs |
| **Allow file URL access** | Required to send clips to `file://` standalone builds. Managed in `chrome://extensions` → ThreatCaddy — the toggle in the popup shows the current state |

#### Standalone File Support

To send clips to an offline `file://` build, enable **"Allow access to file URLs"** on the ThreatCaddy extension in `chrome://extensions`. The extension detects this automatically and shows instructions if it's not yet enabled.

---

### Platform

- **Quick Links dashboard** — Configurable shortcut tiles for VirusTotal, Shodan, AbuseIPDB, and other threat intel tools
- **Dark & light mode** — Dark by default
- **21 languages** — UI fully translated into Arabic, Chinese (Simplified), Dutch, English, Farsi, French, German, Hebrew, Hindi, Indonesian, Italian, Japanese, Korean, Polish, Portuguese (Brazil), Russian, Spanish, Thai, Turkish, Ukrainian, and Vietnamese — including full RTL support
- **Guided tour** — Interactive onboarding walkthrough
- **Browser navigation** — Back/forward with persistent state across refresh
- **Standalone HTML** — Offline version (`pnpm build:single`) with the app and locale packs bundled for `file://` use. The standard standalone PR copy is `../threatcaddy-standalone.html`; run `pnpm standard:standalone` to refresh it from the current repo state
- **Keyboard shortcuts** — `Ctrl+N` (new note), `Ctrl+O` (open file), `Ctrl+K` (search), `Ctrl+S` (backup), `Ctrl+Shift+T` (new task), `Ctrl+E` (toggle editor mode), `` Ctrl+` `` (toggle preview), `Ctrl+1-4` (switch view), `Ctrl+/` (show shortcuts), `Ctrl+B/I` (bold/italic)
- **PWA** — Installable progressive web app with offline support via service worker; registers as an OS-level file handler for `.md` and `.txt` files
- **Accessible UI** — All icon-only buttons carry `title` attributes (and `aria-label` where needed) so screen readers and hover users always know what a control does

---

### Desktop App (Electron)

A native desktop build is available alongside the PWA via `electron-builder`.

```bash
pnpm desktop:dist:win   # → dist-desktop/ (NSIS installer + portable)
pnpm desktop:dist:mac   # → dist-desktop/ (DMG + zip)
pnpm desktop:dist:linux # → dist-desktop/ (AppImage + deb)
```

**Feature highlights unique to the desktop build:**

| Feature | Details |
|---------|---------|
| **Auto-update** | electron-updater polls GitHub Releases on startup (30 s delay). A green "Update ready" badge appears in the header when a new version has downloaded — click to restart and install |
| **OS keychain** | Mail, calendar, and Slack OAuth tokens are encrypted via Electron `safeStorage` (OS keychain) and never touch the renderer |
| **Glass / vibrancy** | macOS vibrancy and Windows Acrylic backgrounds via `win.setVibrancy` |
| **Network map** | ARP/ping subnet scanner — available only in the desktop app |
| **Virtual bridge** | Watch a VM-shared directory for files and ingest them automatically |
| **Native window controls** | Min/max, transparent titlebar, and platform-native window chrome |

**Dev workflow:**

```bash
# Terminal 1 — Vite renderer dev server
pnpm desktop:dev:renderer

# Terminal 2 — Electron main process (picks up renderer at 127.0.0.1:4173)
pnpm desktop:dev:main
```

Updates publish to `github.com/bdav424/threatcaddy` GitHub Releases. Set `GH_TOKEN` when building a release with `pnpm desktop:dist`.

---

## Tech Stack

### Client

| Library | Purpose |
|---------|---------|
| React 19 + TypeScript 5 | UI framework |
| Vite 7 | Build tooling |
| Tailwind CSS 4 | Styling |
| Dexie.js | IndexedDB persistence |
| Cytoscape.js | Entity graph visualization |
| Excalidraw | Whiteboards |
| Leaflet + react-leaflet | Timeline map |
| Papa Parse | CSV/TSV parsing |
| marked + highlight.js + DOMPurify | Markdown rendering |
| react-i18next | Internationalization |
| lucide-react | Icons |
| electron + electron-builder | Desktop app packaging |
| electron-updater | GitHub Releases auto-update |

### Server

| Library | Purpose |
|---------|---------|
| Hono | HTTP + WebSocket framework |
| drizzle-orm + PostgreSQL | Database |
| argon2 | Password hashing |
| jose | JWT signing/verification |
| Docker + Docker Compose | Deployment |

---

## Development

```bash
pnpm install
pnpm dev              # Dev server at localhost:5173
pnpm test:run         # Run test suite
pnpm test:coverage    # Tests with coverage report
pnpm lint             # ESLint
pnpm tsc -b           # Type check
```

## Build

```bash
pnpm build            # Production build → dist/
pnpm build:single     # Standalone bundle -> dist-single/
pnpm update:standalone # Refresh the standard sibling standalone copy + sidecars
pnpm standard:standalone # Alias for the standard standalone PR copy workflow
```

### Standard standalone PR copy

Treat `../threatcaddy-standalone.html` as the canonical file-tree standalone build for this repo. The workflow is:

```bash
pnpm standard:standalone
```

That command rebuilds `dist-single/` and refreshes the sibling workspace artifact plus its top-level standalone JS sidecars. If you are validating the file-tree version of ThreatCaddy or handing someone the standalone PR copy, use that sibling file rather than ad hoc exports or older copies.

### Local storage note

ThreatCaddy stores data in the browser bucket for the exact address that opened it. `http://127.0.0.1:5173`, `http://localhost:5173`, hosted HTTPS, and `file://` standalone files each have separate IndexedDB/localStorage. If notes appear in one address but not another, export from the address where they are visible and merge-import into the address you want to use going forward.

During development, `pnpm dev` serves the latest built standalone at `http://127.0.0.1:5173/threatcaddy-standalone.html` after `pnpm build:single`. That route uses the same `127.0.0.1:5173` storage bucket as the dev app. Opening the standard standalone PR copy at `../threatcaddy-standalone.html` from disk uses a separate `file://` bucket.

### Local CaddyAI bridge

For the current standalone AI helper setup, configure ThreatCaddy's Local LLM provider as:

| Field | Value |
|---|---|
| Endpoint | `http://127.0.0.1:11434/v1` |
| API key | `codex-local-dev` |
| Model | `gpt-5.4` |

That endpoint is served by `everybody_llmbo` as an OpenAI-compatible bridge to Codex. The CTI Agent Host is separate and stays at `http://127.0.0.1:8766` under **Settings > AI > Agent Hosts**.

Check both local AI services with:

```bash
pnpm check:caddyai-bridges
```

If CaddyAI says "The model completed its action, but did not return a written response," verify the bridge completion path before changing note/storage settings. If notes are missing after switching between the dev server and the loose standalone file, follow the local storage note above: it is usually an origin split, not an LLM issue. Detailed runbook: [docs/agent-hosts.md](docs/agent-hosts.md).

AI maintainers should read [AGENTS.md](AGENTS.md) before changing storage, build, sync, extension, CaddyAI, or standalone behavior, and append a short maintenance note there when those areas change.

## Browser Extension

Install from the [Chrome Web Store](https://chromewebstore.google.com/detail/threatcaddy-%E2%80%94-quick-captu/lakelgngpkkaeinfdlnmifookbeeffbh) or see [extension/README.md](extension/README.md) for Firefox and manual install instructions.

To build from source:

```bash
pnpm build:extension   # Builds Chrome + Firefox → extension/dist/
```

## Deploy

### Client (GitHub Pages)

Push to `main` — GitHub Actions builds and deploys to `threatcaddy.com`.

### Team Server (Docker)

```bash
cd server
cp .env.example .env   # Set JWT_PRIVATE_KEY, JWT_PUBLIC_KEY (Ed25519)
docker compose up -d   # Starts Hono server + PostgreSQL
```

Optionally add `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, or `MISTRAL_API_KEY` to `.env` for server-side LLM proxying.
For a local Codex bridge, run `everybody_llmbo` on loopback and set `LOCAL_LLM_ENDPOINT=http://127.0.0.1:11434`, `LOCAL_LLM_MODEL=gpt-5.4`, and `LOCAL_LLM_API_KEY=codex-local-dev` or the bridge token in use. ThreatCaddy treats it as the `local` OpenAI-compatible provider.

## Privacy

All data stays local by default. No accounts, no tracking, no cookies. API keys are stored in your browser and sent only to your chosen LLM provider. See the full [Privacy Policy](https://threatcaddy.com/privacy.html).

## License

MIT
