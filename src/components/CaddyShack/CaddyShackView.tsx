import { Wifi, Cloud, Rocket, Server } from 'lucide-react';
import { ServerConnection } from '../Settings/ServerConnection';
import { LanSyncSettings } from '../Settings/LanSyncSettings';
import { SyncDevicesPanel } from '../Settings/SyncDevicesPanel';
import { MobileSyncSettings } from '../Settings/MobileSyncSettings';
import type { Settings } from '../../types';

interface CaddyShackViewProps {
  settings: Settings;
  onUpdateSettings: (updates: Partial<Settings>) => void;
}

export function CaddyShackView({ settings, onUpdateSettings }: CaddyShackViewProps) {
  return (
    <div className="flex-1 overflow-y-auto bg-bg-primary">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-5 py-6 lg:px-8">
        <section className="rounded-2xl border border-border-subtle bg-bg-raised/80 p-6 shadow-xl shadow-black/10">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-accent-blue/25 bg-accent-blue/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-accent-blue">
            <Server size={14} />
            Team hub
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">CaddyShack</h1>
          <p className="mt-3 text-sm leading-6 text-text-secondary sm:text-base">
            Sync investigations across your team — connect to a self-hosted server, pair devices over LAN, or keep mobile in sync. This is a local-first app: nothing leaves your machine until you connect one of these.
          </p>
        </section>

        <section className="grid gap-3 sm:grid-cols-3">
          <div className="flex gap-3 rounded-xl border border-border-subtle bg-bg-raised/60 p-4">
            <Cloud className="mt-0.5 shrink-0 text-accent-blue" size={18} />
            <div>
              <h3 className="text-sm font-semibold text-text-primary">Server connection</h3>
              <p className="mt-1 text-xs leading-5 text-text-muted">Connect to a self-hosted ThreatCaddy server to sync investigations with your team.</p>
            </div>
          </div>
          <div className="flex gap-3 rounded-xl border border-border-subtle bg-bg-raised/60 p-4">
            <Wifi className="mt-0.5 shrink-0 text-accent-green" size={18} />
            <div>
              <h3 className="text-sm font-semibold text-text-primary">LAN sync</h3>
              <p className="mt-1 text-xs leading-5 text-text-muted">Pair devices on the same network directly, without a server in between.</p>
            </div>
          </div>
          <div className="flex gap-3 rounded-xl border border-border-subtle bg-bg-raised/60 p-4">
            <Rocket className="mt-0.5 shrink-0 text-accent-amber" size={18} />
            <div>
              <h3 className="text-sm font-semibold text-text-primary">Cloud / SaaS</h3>
              <p className="mt-1 text-xs leading-5 text-text-muted">Hosted team sync so nobody has to run their own server. On the roadmap — not built yet.</p>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-border-subtle bg-bg-raised/70 p-5 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Server</h2>
          <ServerConnection settings={settings} onUpdateSettings={onUpdateSettings} />
        </section>

        <section className="rounded-2xl border border-border-subtle bg-bg-raised/70 p-5 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Synced devices</h2>
          <SyncDevicesPanel />
        </section>

        <section className="rounded-2xl border border-border-subtle bg-bg-raised/70 p-5 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">LAN sync</h2>
          <LanSyncSettings />
        </section>

        <section className="rounded-2xl border border-border-subtle bg-bg-raised/70 p-5 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Mobile sync</h2>
          <MobileSyncSettings />
        </section>
      </div>
    </div>
  );
}
