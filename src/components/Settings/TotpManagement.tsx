import { useState, useEffect, useCallback } from 'react';
import { ShieldCheck, ShieldOff, ShieldAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';

type Phase = 'status' | 'setup' | 'backup-codes' | 'disable';

interface MfaStatus {
  totpEnabled: boolean;
  unusedBackupCodes: number;
}

interface SetupData {
  secret: string;
  qrDataUri: string;
}

export function TotpManagement() {
  const { t } = useTranslation('settings');
  const { serverUrl, getAccessToken, connected } = useAuth();
  const { addToast } = useToast();

  const [phase, setPhase] = useState<Phase>('status');
  const [status, setStatus] = useState<MfaStatus | null>(null);
  const [setupData, setSetupData] = useState<SetupData | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchStatus = useCallback(async () => {
    if (!serverUrl || !connected) return;
    const token = await getAccessToken();
    if (!token) return;
    try {
      const resp = await fetch(`${serverUrl}/api/mfa/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resp.ok) setStatus(await resp.json());
    } catch { /* ignore */ }
  }, [serverUrl, connected, getAccessToken]);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  const startSetup = async () => {
    setError('');
    setLoading(true);
    try {
      const token = await getAccessToken();
      const resp = await fetch(`${serverUrl}/api/mfa/totp/setup`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) throw new Error('Failed to start setup');
      const data = await resp.json();
      setSetupData({ secret: data.secret, qrDataUri: data.qrDataUri });
      setCode('');
      setPhase('setup');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const confirmEnable = async () => {
    if (!setupData || code.length !== 6) return;
    setError('');
    setLoading(true);
    try {
      const token = await getAccessToken();
      const resp = await fetch(`${serverUrl}/api/mfa/totp/enable`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ secret: setupData.secret, code }),
      });
      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.error || 'Failed to enable 2FA');
      }
      const data = await resp.json();
      setBackupCodes(data.backupCodes);
      setCode('');
      setSetupData(null);
      setPhase('backup-codes');
      addToast('success', t('security.totpEnabledToast'));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const confirmDisable = async () => {
    if (!code) return;
    setError('');
    setLoading(true);
    try {
      const token = await getAccessToken();
      const resp = await fetch(`${serverUrl}/api/mfa/totp/disable`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ code }),
      });
      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.error || 'Failed to disable 2FA');
      }
      setCode('');
      setPhase('status');
      await fetchStatus();
      addToast('success', t('security.totpDisabledToast'));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const doneWithBackupCodes = async () => {
    setBackupCodes([]);
    setPhase('status');
    await fetchStatus();
  };

  if (!connected || !serverUrl) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-300">{t('security.title')}</h3>

      {/* Status phase */}
      {phase === 'status' && (
        <div className="border border-[var(--border)] rounded-lg p-4 bg-[var(--bg-secondary)] space-y-3">
          {status === null ? (
            <div className="text-xs text-[var(--text-tertiary)]">Loading...</div>
          ) : status.totpEnabled ? (
            <>
              <div className="flex items-center gap-2 text-sm text-green-400">
                <ShieldCheck size={14} />
                <span>{t('security.totpEnabled')}</span>
              </div>
              {status.unusedBackupCodes > 0 && (
                <p className="text-xs text-[var(--text-tertiary)]">
                  {t('security.unusedBackupCodes', { count: status.unusedBackupCodes })}
                </p>
              )}
              <button
                onClick={() => { setPhase('disable'); setCode(''); setError(''); }}
                className="text-xs text-red-400 hover:text-red-300"
              >
                {t('security.disableTotp')}
              </button>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 text-sm text-[var(--text-tertiary)]">
                <ShieldOff size={14} />
                <span>{t('security.totpDisabled')}</span>
              </div>
              <button
                onClick={startSetup}
                disabled={loading}
                className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg disabled:opacity-50"
              >
                {loading ? '...' : t('security.enableTotp')}
              </button>
            </>
          )}
          {error && (
            <p className="text-xs text-red-400">{error}</p>
          )}
        </div>
      )}

      {/* Setup phase — QR scan + verification code */}
      {phase === 'setup' && setupData && (
        <div className="border border-[var(--border)] rounded-lg p-4 bg-[var(--bg-secondary)] space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
            <ShieldAlert size={14} className="text-blue-400" />
            {t('security.totpSetupTitle')}
          </div>
          <p className="text-xs text-[var(--text-tertiary)]">{t('security.totpSetupDesc')}</p>
          <div className="flex justify-center">
            <img src={setupData.qrDataUri} alt="QR code" className="w-40 h-40 rounded" />
          </div>
          <p className="text-xs text-[var(--text-tertiary)]">{t('security.totpEnterCode')}</p>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <input
            type="text"
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            placeholder="000000"
            className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg text-sm tracking-widest font-mono"
            autoFocus
            onKeyDown={(e) => { if (e.key === 'Enter') confirmEnable(); }}
          />
          <div className="flex gap-2">
            <button
              onClick={confirmEnable}
              disabled={loading || code.length !== 6}
              className="flex-1 px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg disabled:opacity-50"
            >
              {loading ? t('security.totpEnabling') : t('security.totpConfirmEnable')}
            </button>
            <button
              onClick={() => { setPhase('status'); setSetupData(null); setCode(''); setError(''); }}
              className="px-3 py-1.5 text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] border border-[var(--border)] rounded-lg"
            >
              {t('security.totpCancel')}
            </button>
          </div>
        </div>
      )}

      {/* Backup codes phase — shown once after enabling */}
      {phase === 'backup-codes' && backupCodes.length > 0 && (
        <div className="border border-[var(--border)] rounded-lg p-4 bg-[var(--bg-secondary)] space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
            <ShieldCheck size={14} className="text-green-400" />
            {t('security.backupCodesTitle')}
          </div>
          <p className="text-xs text-[var(--text-tertiary)]">{t('security.backupCodesDesc')}</p>
          <div className="bg-[var(--bg-primary)] rounded-lg p-3 font-mono text-xs grid grid-cols-2 gap-1">
            {backupCodes.map((c) => (
              <span key={c} className="text-green-300 tracking-wider">{c}</span>
            ))}
          </div>
          <button
            onClick={doneWithBackupCodes}
            className="w-full px-3 py-2 bg-blue-600 text-white text-xs rounded-lg"
          >
            {t('security.backupCodesDone')}
          </button>
        </div>
      )}

      {/* Disable phase */}
      {phase === 'disable' && (
        <div className="border border-[var(--border)] rounded-lg p-4 bg-[var(--bg-secondary)] space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
            <ShieldOff size={14} className="text-red-400" />
            {t('security.totpDisableTitle')}
          </div>
          <p className="text-xs text-[var(--text-tertiary)]">{t('security.totpDisableDesc')}</p>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <input
            type="text"
            inputMode="numeric"
            maxLength={10}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            placeholder="000000"
            className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg text-sm tracking-widest font-mono"
            autoFocus
            onKeyDown={(e) => { if (e.key === 'Enter') confirmDisable(); }}
          />
          <div className="flex gap-2">
            <button
              onClick={confirmDisable}
              disabled={loading || code.length < 6}
              className="flex-1 px-3 py-1.5 bg-red-600 text-white text-xs rounded-lg disabled:opacity-50"
            >
              {loading ? t('security.totpDisabling') : t('security.totpConfirmDisable')}
            </button>
            <button
              onClick={() => { setPhase('status'); setCode(''); setError(''); }}
              className="px-3 py-1.5 text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] border border-[var(--border)] rounded-lg"
            >
              {t('security.totpCancel')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
