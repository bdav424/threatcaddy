import { useState, useRef } from 'react';
import { KeyRound, Download, Upload, CheckCircle2, AlertTriangle, Loader2, Copy, Check } from 'lucide-react';
import { credsBridge } from '../../lib/creds-bridge';

type Mode = 'idle' | 'export-password' | 'export-working' | 'export-done' | 'import-password' | 'import-working' | 'import-done';

export function CredentialVault() {
  const [mode, setMode] = useState<Mode>('idle');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [filePath, setFilePath] = useState<string | null>(null);
  const [base64Result, setBase64Result] = useState<string | null>(null);
  const [resultCount, setResultCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);

  if (!credsBridge.isAvailable()) return null;

  function reset() {
    setMode('idle');
    setPassword('');
    setConfirm('');
    setFilePath(null);
    setBase64Result(null);
    setResultCount(null);
    setError(null);
    setCopied(false);
  }

  async function pickImportFile() {
    const fp = await credsBridge.openCredentialFile();
    if (fp) {
      setFilePath(fp);
      setMode('import-password');
      setTimeout(() => passwordRef.current?.focus(), 50);
    }
  }

  async function runExport() {
    if (!password || password !== confirm) return;
    setMode('export-working');
    setError(null);
    const result = await credsBridge.exportCredentials(password);
    if (result.success) {
      setBase64Result(result.base64 ?? null);
      setResultCount(result.exportedCount ?? null);
      setMode('export-done');
    } else {
      setError(result.error ?? 'Export failed');
      setMode('export-password');
    }
  }

  async function runImport() {
    if (!password || !filePath) return;
    setMode('import-working');
    setError(null);
    const result = await credsBridge.importCredentials({ filePath, password });
    if (result.success) {
      setResultCount(result.count ?? 0);
      setMode('import-done');
    } else {
      setError(result.error ?? 'Import failed');
      setMode('import-password');
    }
  }

  async function copyBase64() {
    if (!base64Result) return;
    await navigator.clipboard.writeText(base64Result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const inputClass = 'w-full bg-gray-800/60 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-accent';
  const btnPrimary = 'flex items-center gap-2 px-3 py-1.5 rounded-lg bg-accent/15 text-accent hover:bg-accent/25 text-sm font-medium transition-colors disabled:opacity-40';
  const btnGhost = 'text-xs text-gray-500 hover:text-gray-300 transition-colors';

  return (
    <div className="rounded-xl border border-border-subtle/40 bg-bg-primary/40 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <KeyRound size={15} className="text-gray-400 shrink-0" />
        <div>
          <h3 className="text-sm font-semibold text-gray-200">Credential Vault</h3>
          <p className="text-xs text-gray-500 mt-0.5">Export or restore all desktop integration credentials as an encrypted .tckeys file.</p>
        </div>
      </div>

      {/* Idle state — two action buttons */}
      {mode === 'idle' && (
        <div className="flex gap-2 pt-1">
          <button
            onClick={() => { setMode('export-password'); setTimeout(() => passwordRef.current?.focus(), 50); }}
            className={btnPrimary}
          >
            <Download size={14} />
            Export credentials
          </button>
          <button
            onClick={pickImportFile}
            className={btnPrimary}
          >
            <Upload size={14} />
            Import credentials
          </button>
        </div>
      )}

      {/* Export — password prompt */}
      {(mode === 'export-password' || mode === 'export-working') && (
        <div className="space-y-2 pt-1">
          <p className="text-xs text-gray-400">Set a password to protect the exported file. You will need it to import.</p>
          <input
            ref={passwordRef}
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
            disabled={mode === 'export-working'}
            autoComplete="new-password"
          />
          <input
            type="password"
            placeholder="Confirm password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className={inputClass}
            disabled={mode === 'export-working'}
            autoComplete="new-password"
            onKeyDown={(e) => { if (e.key === 'Enter' && password && password === confirm) runExport(); }}
          />
          {password && confirm && password !== confirm && (
            <p className="text-xs text-red-400">Passwords do not match</p>
          )}
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex items-center gap-3 pt-0.5">
            <button
              onClick={runExport}
              disabled={!password || password !== confirm || mode === 'export-working'}
              className={btnPrimary}
            >
              {mode === 'export-working' ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
              {mode === 'export-working' ? 'Exporting…' : 'Save .tckeys file'}
            </button>
            <button onClick={reset} className={btnGhost}>Cancel</button>
          </div>
        </div>
      )}

      {/* Export — done */}
      {mode === 'export-done' && (
        <div className="space-y-2 pt-1">
          <div className="flex items-center gap-2 text-green-400">
            <CheckCircle2 size={14} />
            <span className="text-sm">
              {resultCount !== null ? `${resultCount} credential${resultCount !== 1 ? 's' : ''} exported` : 'Exported successfully'}
            </span>
          </div>
          {base64Result && (
            <div className="space-y-1">
              <p className="text-xs text-gray-500">Copy the bundle to share across devices:</p>
              <button onClick={copyBase64} className={`${btnPrimary} text-xs`}>
                {copied ? <Check size={13} /> : <Copy size={13} />}
                {copied ? 'Copied!' : 'Copy base64 bundle'}
              </button>
            </div>
          )}
          <button onClick={reset} className={btnGhost}>Done</button>
        </div>
      )}

      {/* Import — password prompt */}
      {(mode === 'import-password' || mode === 'import-working') && (
        <div className="space-y-2 pt-1">
          {filePath && (
            <p className="text-xs text-gray-500 truncate" title={filePath}>File: {filePath.split(/[/\\]/).pop()}</p>
          )}
          <input
            ref={passwordRef}
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
            disabled={mode === 'import-working'}
            autoComplete="current-password"
            onKeyDown={(e) => { if (e.key === 'Enter' && password && filePath) runImport(); }}
          />
          {error && (
            <div className="flex items-center gap-1.5 text-xs text-red-400">
              <AlertTriangle size={12} />
              {error}
            </div>
          )}
          <div className="flex items-center gap-3 pt-0.5">
            <button
              onClick={runImport}
              disabled={!password || !filePath || mode === 'import-working'}
              className={btnPrimary}
            >
              {mode === 'import-working' ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
              {mode === 'import-working' ? 'Importing…' : 'Restore credentials'}
            </button>
            <button onClick={reset} className={btnGhost}>Cancel</button>
          </div>
        </div>
      )}

      {/* Import — done */}
      {mode === 'import-done' && (
        <div className="space-y-1 pt-1">
          <div className="flex items-center gap-2 text-green-400">
            <CheckCircle2 size={14} />
            <span className="text-sm">
              {resultCount !== null ? `${resultCount} credential${resultCount !== 1 ? 's' : ''} restored` : 'Restored successfully'}
            </span>
          </div>
          <p className="text-xs text-gray-500">Restart the app or re-connect integrations to apply.</p>
          <button onClick={reset} className={btnGhost}>Done</button>
        </div>
      )}
    </div>
  );
}
