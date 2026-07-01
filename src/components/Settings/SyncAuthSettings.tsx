import { useState, useEffect, useCallback } from 'react';
import { ShieldCheck, ShieldOff, Copy, KeyRound, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../contexts/ToastContext';
import { syncAuthBridge } from '../../lib/sync-auth-bridge';
import { generateTotpSecret, getTotpUri, verifyTotpCode } from '../../lib/totp';
import { passkeySupported, registerPasskey, verifyPasskey } from '../../lib/passkey';
import { db } from '../../db';

type ActiveMethod = 'none' | 'totp' | 'passkey';
type Phase = 'status' | 'totp-setup' | 'passkey-setup';

const PLACEHOLDER_USER_ID = 'local-desktop';

export function SyncAuthSettings() {
  const { t } = useTranslation('settings');
  const { addToast } = useToast();

  const [method, setMethod]     = useState<ActiveMethod>('none');
  const [phase, setPhase]       = useState<Phase>('status');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  // TOTP setup state
  const [totpSecret, setTotpSecret] = useState('');
  const [totpUri, setTotpUri]       = useState('');
  const [totpCode, setTotpCode]     = useState('');
  const [copied, setCopied]         = useState<'secret' | 'uri' | null>(null);

  // Whether the current environment supports passkeys
  const hasPasskeySupport = passkeySupported();

  // Probe saved method from bridge on mount
  const loadStatus = useCallback(async () => {
    if (!syncAuthBridge.isAvailable()) return;
    const [totp, passkey] = await Promise.all([
      syncAuthBridge.getTotpSecret(),
      syncAuthBridge.getPasskeyCredential(),
    ]);
    if (totp)    setMethod('totp');
    else if (passkey) setMethod('passkey');
    else         setMethod('none');
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  // Not shown in web/SPA mode — desktop bridge required
  if (!syncAuthBridge.isAvailable()) return null;

  // ── TOTP setup ─────────────────────────────────────────────────────────────

  const startTotpSetup = () => {
    const secret = generateTotpSecret();
    const uri    = getTotpUri(secret, 'local', 'ThreatCaddy Sync');
    setTotpSecret(secret);
    setTotpUri(uri);
    setTotpCode('');
    setError('');
    setPhase('totp-setup');
  };

  const confirmTotp = async () => {
    if (totpCode.length !== 6) return;
    setError('');
    if (!verifyTotpCode(totpSecret, totpCode)) {
      setError(t('syncAuth.totpBadCode'));
      return;
    }
    setLoading(true);
    try {
      await syncAuthBridge.saveTotpSecret(totpSecret);
      await db.syncAuthSettings.where('userId').equals(PLACEHOLDER_USER_ID).delete();
      await db.syncAuthSettings.add({
        userId: PLACEHOLDER_USER_ID,
        method: 'totp',
        totpSecret: 'ref:safeStorage', // actual secret is in safeStorage; store only a marker
        createdAt: Date.now(),
      });
      setMethod('totp');
      setPhase('status');
      addToast('success', t('syncAuth.totpEnabledToast'));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // ── Passkey setup ───────────────────────────────────────────────────────────

  const startPasskeySetup = async () => {
    setError('');
    setLoading(true);
    try {
      const { credentialId, publicKey } = await registerPasskey(PLACEHOLDER_USER_ID, 'ThreatCaddy Sync');
      await syncAuthBridge.savePasskeyCredential(credentialId, publicKey);
      await db.syncAuthSettings.where('userId').equals(PLACEHOLDER_USER_ID).delete();
      await db.syncAuthSettings.add({
        userId: PLACEHOLDER_USER_ID,
        method: 'passkey',
        passkeyCredentialId: credentialId,
        createdAt: Date.now(),
      });
      setMethod('passkey');
      setPhase('status');
      addToast('success', t('syncAuth.passkeyRegisteredToast'));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // ── Verify passkey (called from status view to confirm it still works) ──────

  const testPasskey = async () => {
    const cred = await syncAuthBridge.getPasskeyCredential();
    if (!cred) return;
    setLoading(true);
    try {
      const ok = await verifyPasskey(cred.credentialId);
      if (ok) addToast('success', t('syncAuth.passkeyVerifiedToast'));
      else addToast('error', t('syncAuth.passkeyVerifyFailed'));
    } catch (e) {
      addToast('error', (e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // ── Disable MFA ─────────────────────────────────────────────────────────────

  const disableMfa = async () => {
    setLoading(true);
    try {
      await syncAuthBridge.clearSyncAuth();
      await db.syncAuthSettings.where('userId').equals(PLACEHOLDER_USER_ID).delete();
      setMethod('none');
      addToast('success', t('syncAuth.disabledToast'));
    } catch (e) {
      addToast('error', (e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // ── Copy helper ─────────────────────────────────────────────────────────────

  const copyText = async (text: string, key: 'secret' | 'uri') => {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-300">{t('syncAuth.title')}</h3>

      {/* Status / selection view */}
      {phase === 'status' && (
        <div className="border border-[var(--border)] rounded-lg p-4 bg-[var(--bg-secondary)] space-y-3">
          {/* Current state indicator */}
          {method === 'none' ? (
            <div className="flex items-center gap-2 text-sm text-[var(--text-tertiary)]">
              <ShieldOff size={14} />
              <span>{t('syncAuth.noMfa')}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-green-400">
              <ShieldCheck size={14} />
              <span>
                {method === 'totp'
                  ? t('syncAuth.totpActive')
                  : t('syncAuth.passkeyActive')}
              </span>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            {method === 'none' && (
              <>
                <button
                  onClick={startTotpSetup}
                  disabled={loading}
                  className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg disabled:opacity-50"
                >
                  {t('syncAuth.setupTotp')}
                </button>
                {hasPasskeySupport && (
                  <button
                    onClick={startPasskeySetup}
                    disabled={loading}
                    className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg disabled:opacity-50"
                  >
                    {loading ? <Loader2 size={12} className="animate-spin" /> : <KeyRound size={12} />}
                    {t('syncAuth.registerPasskey')}
                  </button>
                )}
              </>
            )}

            {method === 'passkey' && hasPasskeySupport && (
              <button
                onClick={testPasskey}
                disabled={loading}
                className="px-3 py-1.5 bg-blue-600/20 border border-blue-500/30 text-blue-400 text-xs rounded-lg disabled:opacity-50"
              >
                {loading ? '...' : t('syncAuth.testPasskey')}
              </button>
            )}

            {method !== 'none' && (
              <button
                onClick={disableMfa}
                disabled={loading}
                className="px-3 py-1.5 text-xs text-red-400 hover:text-red-300 border border-red-500/20 rounded-lg disabled:opacity-50"
              >
                {loading ? '...' : t('syncAuth.disable')}
              </button>
            )}
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>
      )}

      {/* TOTP setup flow */}
      {phase === 'totp-setup' && (
        <div className="border border-[var(--border)] rounded-lg p-4 bg-[var(--bg-secondary)] space-y-3">
          <p className="text-xs font-medium text-[var(--text-primary)]">{t('syncAuth.totpSetupTitle')}</p>
          <p className="text-[10px] text-[var(--text-tertiary)]">{t('syncAuth.totpSetupDesc')}</p>

          {/* Secret display */}
          <div className="space-y-1">
            <p className="text-[10px] text-[var(--text-tertiary)]">{t('syncAuth.totpSecretLabel')}</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-[var(--bg-primary)] border border-[var(--border)] rounded px-2 py-1 text-xs font-mono tracking-widest text-green-300 break-all">
                {totpSecret}
              </code>
              <button
                onClick={() => copyText(totpSecret, 'secret')}
                className="shrink-0 p-1.5 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-tertiary)]"
                title={t('syncAuth.copy')}
              >
                {copied === 'secret' ? <ShieldCheck size={12} className="text-green-400" /> : <Copy size={12} />}
              </button>
            </div>
          </div>

          {/* URI copy */}
          <div className="space-y-1">
            <p className="text-[10px] text-[var(--text-tertiary)]">{t('syncAuth.totpUriLabel')}</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-[var(--bg-primary)] border border-[var(--border)] rounded px-2 py-1 text-[10px] font-mono text-[var(--text-secondary)] break-all">
                {totpUri}
              </code>
              <button
                onClick={() => copyText(totpUri, 'uri')}
                className="shrink-0 p-1.5 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-tertiary)]"
                title={t('syncAuth.copy')}
              >
                {copied === 'uri' ? <ShieldCheck size={12} className="text-green-400" /> : <Copy size={12} />}
              </button>
            </div>
          </div>

          {/* Verify code */}
          <p className="text-[10px] text-[var(--text-tertiary)]">{t('syncAuth.totpEnterCode')}</p>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <input
            type="text"
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            value={totpCode}
            onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
            placeholder="000000"
            autoFocus
            onKeyDown={(e) => { if (e.key === 'Enter') confirmTotp(); }}
            className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg text-sm tracking-widest font-mono"
          />

          <div className="flex gap-2">
            <button
              onClick={confirmTotp}
              disabled={loading || totpCode.length !== 6}
              className="flex-1 px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg disabled:opacity-50"
            >
              {loading ? t('syncAuth.verifying') : t('syncAuth.totpConfirm')}
            </button>
            <button
              onClick={() => { setPhase('status'); setTotpSecret(''); setTotpCode(''); setError(''); }}
              className="px-3 py-1.5 text-xs text-[var(--text-tertiary)] border border-[var(--border)] rounded-lg"
            >
              {t('syncAuth.cancel')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
