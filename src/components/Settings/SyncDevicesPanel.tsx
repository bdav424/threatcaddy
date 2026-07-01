import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Monitor, Smartphone, Trash2, QrCode, Copy, Check, RefreshCw, Loader2, Pencil, X } from 'lucide-react';
import { useSyncDevices } from '../../hooks/useSyncDevices';
import { useAuth } from '../../contexts/AuthContext';
import type { SyncDevice } from '../../types';

function deviceIcon(name: string) {
  const n = name.toLowerCase();
  if (/iphone|android|mobile|phone/.test(n)) return <Smartphone size={16} />;
  return <Monitor size={16} />;
}

function timeAgo(iso: string | null | undefined): string {
  if (!iso) return 'Never';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 2) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

interface PairingDialogProps {
  onClose: () => void;
  onSuccess: () => void;
}

function PairingDialog({ onClose, onSuccess }: PairingDialogProps) {
  const { t } = useTranslation('sync');
  const { startPairing, redeemPairingCode } = useSyncDevices();
  const [mode, setMode] = useState<'choose' | 'show' | 'enter'>('choose');
  const [pairingCode, setPairingCode] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [inputCode, setInputCode] = useState('');
  const [generating, setGenerating] = useState(false);
  const [redeeming, setRedeeming] = useState(false);
  const [redeemError, setRedeemError] = useState('');
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const result = await startPairing();
      setPairingCode(result.pairingCode);
      setQrDataUrl(result.qrDataUrl);
      setExpiresAt(result.expiresAt);
      setMode('show');
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(pairingCode).catch(() => {});
    setCopied(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopied(false), 2000);
  };

  const handleRedeem = async () => {
    const code = inputCode.trim().toUpperCase();
    if (code.length < 6) { setRedeemError(t('pairing.enterCodeHint')); return; }
    setRedeeming(true);
    setRedeemError('');
    try {
      const result = await redeemPairingCode(code);
      if (result.enrolled) { onSuccess(); onClose(); }
    } catch (err) {
      setRedeemError(err instanceof Error ? err.message : t('pairing.invalidCode'));
    } finally {
      setRedeeming(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg shadow-xl w-full max-w-md p-6 mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-[var(--color-text)]">{t('pairing.title')}</h3>
          <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]"><X size={18} /></button>
        </div>

        {mode === 'choose' && (
          <div className="space-y-3">
            <p className="text-sm text-[var(--color-text-muted)]">{t('pairing.chooseModeHint')}</p>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="w-full flex items-center gap-3 p-3 rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] text-left"
            >
              {generating ? <Loader2 size={18} className="animate-spin" /> : <QrCode size={18} />}
              <div>
                <div className="text-sm font-medium text-[var(--color-text)]">{t('pairing.showCode')}</div>
                <div className="text-xs text-[var(--color-text-muted)]">{t('pairing.showCodeDesc')}</div>
              </div>
            </button>
            <button
              onClick={() => setMode('enter')}
              className="w-full flex items-center gap-3 p-3 rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] text-left"
            >
              <Monitor size={18} />
              <div>
                <div className="text-sm font-medium text-[var(--color-text)]">{t('pairing.enterCode')}</div>
                <div className="text-xs text-[var(--color-text-muted)]">{t('pairing.enterCodeDesc')}</div>
              </div>
            </button>
          </div>
        )}

        {mode === 'show' && (
          <div className="space-y-4">
            <p className="text-sm text-[var(--color-text-muted)]">{t('pairing.showCodeHint')}</p>
            {qrDataUrl && (
              <div className="flex justify-center">
                <img src={qrDataUrl} alt={t('pairing.qrAlt')} className="rounded border border-[var(--color-border)]" style={{ width: 200, height: 200 }} />
              </div>
            )}
            <div className="flex items-center gap-2 bg-[var(--color-surface-alt)] rounded-lg p-3">
              <span className="flex-1 text-center font-mono text-xl tracking-widest text-[var(--color-text)]">{pairingCode}</span>
              <button onClick={handleCopy} className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
                {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
              </button>
            </div>
            <p className="text-xs text-[var(--color-text-muted)] text-center">
              {t('pairing.expires', { time: new Date(expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) })}
            </p>
          </div>
        )}

        {mode === 'enter' && (
          <div className="space-y-4">
            <p className="text-sm text-[var(--color-text-muted)]">{t('pairing.enterCodeHint')}</p>
            <input
              type="text"
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value.toUpperCase())}
              placeholder="XXXXXXXX"
              maxLength={12}
              className="w-full text-center font-mono text-xl tracking-widest bg-[var(--color-surface-alt)] border border-[var(--color-border)] rounded-lg px-4 py-3 text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
              onKeyDown={(e) => e.key === 'Enter' && handleRedeem()}
              autoFocus
            />
            {redeemError && <p className="text-xs text-red-500">{redeemError}</p>}
            <button
              onClick={handleRedeem}
              disabled={redeeming || inputCode.trim().length < 6}
              className="w-full py-2.5 bg-[var(--color-accent)] text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {redeeming && <Loader2 size={14} className="animate-spin" />}
              {t('pairing.confirm')}
            </button>
            <button onClick={() => setMode('choose')} className="w-full text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
              ← {t('pairing.back')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

interface DeviceRowProps {
  device: SyncDevice;
  isCurrentDevice: boolean;
  onRevoke: (id: string) => void;
  onRename: (id: string, name: string) => void;
}

function DeviceRow({ device, isCurrentDevice, onRevoke, onRename }: DeviceRowProps) {
  const { t } = useTranslation('sync');
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(device.deviceName);
  const [confirming, setConfirming] = useState(false);

  const handleSave = async () => {
    if (name.trim() && name.trim() !== device.deviceName) {
      await onRename(device.id, name.trim());
    }
    setEditing(false);
  };

  const statusColor = {
    approved: 'text-green-500',
    pending: 'text-amber-500',
    revoked: 'text-[var(--color-text-muted)] line-through opacity-50',
  }[device.status];

  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg border border-[var(--color-border)] ${device.status === 'revoked' ? 'opacity-60' : ''}`}>
      <div className="text-[var(--color-text-muted)] shrink-0">{deviceIcon(device.deviceName)}</div>
      <div className="flex-1 min-w-0">
        {editing ? (
          <div className="flex items-center gap-2">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false); }}
              className="flex-1 text-sm bg-[var(--color-surface-alt)] border border-[var(--color-border)] rounded px-2 py-1 text-[var(--color-text)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
            />
            <button onClick={handleSave} className="text-green-500 hover:text-green-400"><Check size={14} /></button>
            <button onClick={() => { setEditing(false); setName(device.deviceName); }} className="text-[var(--color-text-muted)]"><X size={14} /></button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <span className={`text-sm font-medium truncate ${statusColor}`}>{device.deviceName}</span>
            {isCurrentDevice && (
              <span className="text-[10px] bg-[var(--color-accent)]/20 text-[var(--color-accent)] px-1.5 py-0.5 rounded-full shrink-0">{t('devices.thisDevice')}</span>
            )}
            {device.status !== 'revoked' && (
              <button onClick={() => setEditing(true)} className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] shrink-0 ml-1">
                <Pencil size={12} />
              </button>
            )}
          </div>
        )}
        <div className="text-xs text-[var(--color-text-muted)]">
          {device.status === 'pending' ? t('devices.pendingApproval') : device.status === 'revoked' ? t('devices.revoked') : t('devices.lastSeen', { time: timeAgo(device.lastSeenAt) })}
        </div>
      </div>
      {device.status !== 'revoked' && !isCurrentDevice && (
        confirming ? (
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={() => { onRevoke(device.id); setConfirming(false); }} className="text-xs text-red-500 hover:text-red-400 font-medium">{t('devices.confirmRevoke')}</button>
            <button onClick={() => setConfirming(false)} className="text-[var(--color-text-muted)]"><X size={14} /></button>
          </div>
        ) : (
          <button onClick={() => setConfirming(true)} title={t('devices.revoke')} className="text-[var(--color-text-muted)] hover:text-red-500 shrink-0">
            <Trash2 size={14} />
          </button>
        )
      )}
    </div>
  );
}

export function SyncDevicesPanel() {
  const { t } = useTranslation('sync');
  const { connected } = useAuth();
  const { devices, loading, error, load, revoke, rename } = useSyncDevices();
  const [showPairing, setShowPairing] = useState(false);

  useEffect(() => {
    if (connected) load();
  }, [connected, load]);

  if (!connected) {
    return (
      <div className="text-sm text-[var(--color-text-muted)] py-2">{t('devices.notConnected')}</div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <button onClick={load} disabled={loading} className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] disabled:opacity-50">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
        <button
          onClick={() => setShowPairing(true)}
          className="text-xs px-3 py-1.5 bg-[var(--color-accent)] text-white rounded-lg font-medium hover:opacity-90"
        >
          {t('devices.addDevice')}
        </button>
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      {loading && devices.length === 0 ? (
        <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
          <Loader2 size={14} className="animate-spin" /> {t('devices.loading')}
        </div>
      ) : devices.length === 0 ? (
        <p className="text-sm text-[var(--color-text-muted)]">{t('devices.empty')}</p>
      ) : (
        <div className="space-y-2">
          {devices.map((device) => (
            <DeviceRow
              key={device.id}
              device={device}
              isCurrentDevice={false /* fingerprint not exposed to client; server marks isCurrent in future */}
              onRevoke={revoke}
              onRename={rename}
            />
          ))}
        </div>
      )}

      {showPairing && (
        <PairingDialog
          onClose={() => setShowPairing(false)}
          onSuccess={load}
        />
      )}
    </div>
  );
}
