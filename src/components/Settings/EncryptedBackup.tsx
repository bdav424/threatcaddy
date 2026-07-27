import { useRef, useState } from 'react';
import { KeyRound, Lock, ShieldCheck, Upload } from 'lucide-react';
import { Modal } from '../Common/Modal';
import { downloadFile } from '../../lib/export';
import { buildFullBackupPayload } from '../../lib/backup-data';
import { encryptBackup, decryptBackup, type BackupPayload, type EncryptedBackupBlob } from '../../lib/backup-crypto';
import { restoreFullReplace, restoreMerge } from '../../lib/backup-restore';
import { applySettingsRestore, type SettingsRestoreMode } from '../../lib/backup-settings-merge';
import { API_KEY_LABELS } from '../../lib/backup-settings-merge';
import { API_KEY_FIELDS } from '../../lib/backup-settings';
import { useToast } from '../../contexts/ToastContext';
import { useLogActivity } from '../../hooks/ActivityLogContext';

/**
 * Local encrypted backup — the "move my whole setup to a new laptop" flow.
 * This is the ONLY surface that includes API keys, and only because it always
 * routes through password-based AES (encryptBackup); a key never touches disk
 * in cleartext. Cloud/team backups use the shared builder with keys off.
 */

function looksEncrypted(value: unknown): value is EncryptedBackupBlob {
  return Boolean(value && typeof value === 'object' &&
    'salt' in (value as object) && 'iv' in (value as object) && 'ct' in (value as object));
}

interface ExportImportBackupProps {
  onImportComplete: () => void;
}

export function EncryptedBackup({ onImportComplete }: ExportImportBackupProps) {
  const { addToast } = useToast();
  const logActivity = useLogActivity();
  const fileRef = useRef<HTMLInputElement>(null);

  // Export modal
  const [exportOpen, setExportOpen] = useState(false);
  const [exportPassword, setExportPassword] = useState('');
  const [exportBusy, setExportBusy] = useState(false);

  // Import modal
  const [pendingBlob, setPendingBlob] = useState<EncryptedBackupBlob | null>(null);
  const [importPassword, setImportPassword] = useState('');
  const [dataMode, setDataMode] = useState<'merge' | 'replace'>('merge');
  const [settingsMode, setSettingsMode] = useState<SettingsRestoreMode>('merge');
  const [importBusy, setImportBusy] = useState(false);
  const [importError, setImportError] = useState('');

  const resetImport = () => {
    setPendingBlob(null);
    setImportPassword('');
    setDataMode('merge');
    setSettingsMode('merge');
    setImportError('');
  };

  const handleExport = async () => {
    if (!exportPassword) return;
    setExportBusy(true);
    try {
      const payload = await buildFullBackupPayload('all', undefined, { includeApiKeys: true });
      const blob = await encryptBackup(exportPassword, payload);
      downloadFile(
        JSON.stringify(blob),
        `threatcaddy-encrypted-backup-${new Date().toISOString().split('T')[0]}.json`,
        'application/json',
      );
      addToast('success', 'Encrypted backup saved (includes settings & API keys).');
      logActivity('data', 'export', 'Exported encrypted backup with settings and API keys');
      setExportOpen(false);
      setExportPassword('');
    } catch {
      addToast('error', 'Failed to create the encrypted backup.');
    } finally {
      setExportBusy(false);
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (fileRef.current) fileRef.current.value = '';
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      if (!looksEncrypted(parsed)) {
        addToast('error', 'That is not an encrypted ThreatCaddy backup. Use the JSON import for plaintext backups.');
        return;
      }
      setPendingBlob(parsed);
    } catch {
      addToast('error', 'Could not read that file as a backup.');
    }
  };

  const handleImport = async () => {
    if (!pendingBlob || !importPassword) return;
    setImportBusy(true);
    setImportError('');
    let payload: BackupPayload;
    try {
      payload = await decryptBackup(importPassword, pendingBlob);
    } catch {
      setImportError('Wrong password, or the file is corrupt. Nothing was changed.');
      setImportBusy(false);
      return;
    }

    try {
      // Data first.
      if (dataMode === 'replace') await restoreFullReplace(payload);
      else await restoreMerge(payload);

      // Then settings — gated behind the mode the user picked, so "Keep local"
      // never touches settings even transiently. Keys are applied only if the
      // block actually carries them; absence is never an instruction.
      if (payload.settings) {
        const providers = keyProvidersIn(payload);
        // Key restore is never silent: only apply keys if the user confirms here.
        const approveKeys = providers.length > 0
          ? window.confirm(`This backup contains API keys for: ${providers.join(', ')}.\n\nRestore these keys onto this machine?`)
          : false;
        const block = approveKeys ? payload.settings : { ...payload.settings, apiKeys: undefined };
        const result = applySettingsRestore(block, settingsMode, { apiKeys: approveKeys });
        const parts: string[] = [];
        if (result.appliedSections.length) parts.push(`${result.appliedSections.join(' + ')} settings`);
        if (result.addedThemes) parts.push(`${result.addedThemes} theme${result.addedThemes === 1 ? '' : 's'}`);
        if (result.appliedKeyProviders.length) parts.push(`keys: ${result.appliedKeyProviders.join(', ')}`);
        addToast('success', `Restored data${parts.length ? ` and ${parts.join(', ')}` : ''}.`);
      } else {
        addToast('success', 'Restored data from the encrypted backup.');
      }
      logActivity('data', 'import', `Restored encrypted backup (data: ${dataMode}, settings: ${settingsMode})`);
      resetImport();
      onImportComplete();
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Restore failed.');
    } finally {
      setImportBusy(false);
    }
  };

  const btn = 'flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors';

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        <button onClick={() => setExportOpen(true)} className={`${btn} bg-gray-700 hover:bg-gray-600 text-gray-200`}>
          <Lock size={16} />
          Encrypted backup (settings + keys)
        </button>
        <label className={`${btn} bg-gray-700 hover:bg-gray-600 text-gray-200 cursor-pointer`}>
          <Upload size={16} />
          Restore encrypted backup
          <input ref={fileRef} type="file" accept=".json" onChange={handleFileSelect} className="hidden" />
        </label>
      </div>
      <p className="flex items-center gap-1.5 text-xs text-gray-500">
        <ShieldCheck size={13} />
        API keys are written only to this password-encrypted file — never to a plaintext export, cloud, or team backup.
      </p>

      {/* Export password modal */}
      <Modal open={exportOpen} onClose={() => { setExportOpen(false); setExportPassword(''); }} title="Encrypted backup">
        <div className="space-y-3">
          <p className="text-sm text-text-secondary">
            This backup includes your data, settings, theme, AI config, and API keys — all encrypted with the password below. Keep the file and password safe; the keys can't be recovered without them.
          </p>
          <label className="grid gap-1 text-xs font-medium text-text-secondary">
            Encryption password
            <input
              type="password"
              value={exportPassword}
              onChange={(e) => setExportPassword(e.target.value)}
              className="rounded-lg border border-border-subtle bg-bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-accent-blue"
              placeholder="Choose a strong password"
            />
          </label>
          <div className="flex justify-end gap-2">
            <button onClick={() => { setExportOpen(false); setExportPassword(''); }} className="rounded-lg border border-border-subtle px-3 py-2 text-sm text-text-secondary hover:bg-bg-hover">Cancel</button>
            <button onClick={handleExport} disabled={!exportPassword || exportBusy} className="inline-flex items-center gap-1.5 rounded-lg bg-accent-blue px-4 py-2 text-sm font-semibold text-white hover:bg-accent-blue/90 disabled:cursor-not-allowed disabled:opacity-60">
              <KeyRound size={14} />
              {exportBusy ? 'Encrypting…' : 'Create backup'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Import / restore modal */}
      <Modal open={pendingBlob !== null} onClose={resetImport} title="Restore encrypted backup">
        <div className="space-y-4">
          <label className="grid gap-1 text-xs font-medium text-text-secondary">
            Backup password
            <input
              type="password"
              value={importPassword}
              onChange={(e) => setImportPassword(e.target.value)}
              className="rounded-lg border border-border-subtle bg-bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-accent-blue"
            />
          </label>

          <fieldset className="grid gap-1 text-xs text-text-secondary">
            <legend className="mb-1 font-medium">Investigation data</legend>
            <label className="flex items-center gap-2"><input type="radio" checked={dataMode === 'merge'} onChange={() => setDataMode('merge')} /> Merge into what's here (recommended)</label>
            <label className="flex items-center gap-2"><input type="radio" checked={dataMode === 'replace'} onChange={() => setDataMode('replace')} /> Replace all local data</label>
          </fieldset>

          <fieldset className="grid gap-1 text-xs text-text-secondary">
            <legend className="mb-1 font-medium">Settings &amp; AI config</legend>
            <label className="flex items-center gap-2"><input type="radio" checked={settingsMode === 'keep'} onChange={() => setSettingsMode('keep')} /> Keep all my current settings</label>
            <label className="flex items-center gap-2"><input type="radio" checked={settingsMode === 'merge'} onChange={() => setSettingsMode('merge')} /> Merge — fill blanks, keep mine on conflict (recommended)</label>
            <label className="flex items-center gap-2"><input type="radio" checked={settingsMode === 'replace'} onChange={() => setSettingsMode('replace')} /> Use the backup's settings</label>
            <p className="mt-1 text-[11px] text-text-muted">Your active theme is never changed; saved themes from the backup are added alongside yours. If the backup has API keys, you'll be asked before any are restored.</p>
          </fieldset>

          {importError && <p className="text-xs text-red-400">{importError}</p>}

          <div className="flex justify-end gap-2">
            <button onClick={resetImport} className="rounded-lg border border-border-subtle px-3 py-2 text-sm text-text-secondary hover:bg-bg-hover">Cancel</button>
            <button onClick={handleImport} disabled={!importPassword || importBusy} className="inline-flex items-center gap-1.5 rounded-lg bg-accent-blue px-4 py-2 text-sm font-semibold text-white hover:bg-accent-blue/90 disabled:cursor-not-allowed disabled:opacity-60">
              {importBusy ? 'Restoring…' : 'Restore'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function keyProvidersIn(payload: BackupPayload): string[] {
  const keys = payload.settings?.apiKeys;
  if (!keys) return [];
  const out: string[] = [];
  for (const field of API_KEY_FIELDS) {
    const value = keys[field as string];
    if (typeof value === 'string' && value.trim() !== '') out.push(API_KEY_LABELS[field as string] || (field as string));
  }
  return out;
}
