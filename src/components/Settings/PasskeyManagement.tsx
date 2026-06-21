import { useState, useEffect, useCallback } from 'react';
import { KeyRound, Trash2, Plus, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import {
  browserSupportsWebAuthn,
  registerPasskey,
  listPasskeys,
  deletePasskey,
  type PasskeyInfo,
} from '../../lib/passkey-client';

export function PasskeyManagement() {
  const { t } = useTranslation('settings');
  const { serverUrl, getAccessToken, connected } = useAuth();
  const { addToast } = useToast();

  const [keys, setKeys] = useState<PasskeyInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [keyName, setKeyName] = useState('');

  const supported = browserSupportsWebAuthn();

  const fetchKeys = useCallback(async () => {
    if (!serverUrl || !connected) return;
    const token = await getAccessToken();
    if (!token) return;
    try {
      setLoading(true);
      setKeys(await listPasskeys(serverUrl, token));
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [serverUrl, connected, getAccessToken]);

  useEffect(() => { fetchKeys(); }, [fetchKeys]);

  const handleRegister = async () => {
    setError('');
    setRegistering(true);
    try {
      const token = await getAccessToken();
      if (!token || !serverUrl) throw new Error('Not connected');
      const result = await registerPasskey(serverUrl, token, keyName.trim() || undefined);
      setKeyName('');
      addToast('success', t('passkeys.registeredToast', { name: result.name }));
      await fetchKeys();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRegistering(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const token = await getAccessToken();
      if (!token || !serverUrl) throw new Error('Not connected');
      await deletePasskey(serverUrl, token, id);
      addToast('success', t('passkeys.deletedToast'));
      setKeys((prev) => prev.filter((k) => k.id !== id));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDeletingId(null);
    }
  };

  if (!connected || !serverUrl || !supported) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-300">{t('passkeys.title')}</h3>

      <div className="border border-[var(--border)] rounded-lg p-4 bg-[var(--bg-secondary)] space-y-3">
        {error && <p className="text-xs text-red-400">{error}</p>}

        {/* Existing passkeys */}
        {loading ? (
          <div className="flex items-center gap-2 text-xs text-[var(--text-tertiary)]">
            <Loader2 size={12} className="animate-spin" />
            {t('passkeys.loading')}
          </div>
        ) : keys.length === 0 ? (
          <p className="text-xs text-[var(--text-tertiary)]">{t('passkeys.none')}</p>
        ) : (
          <ul className="space-y-2">
            {keys.map((k) => (
              <li key={k.id} className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <KeyRound size={12} className="text-blue-400 shrink-0" />
                  <span className="text-xs text-[var(--text-primary)] truncate">{k.name}</span>
                  <span className="text-[10px] text-[var(--text-tertiary)] shrink-0">
                    {new Date(k.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <button
                  onClick={() => handleDelete(k.id)}
                  disabled={deletingId === k.id}
                  className="text-[var(--text-tertiary)] hover:text-red-400 disabled:opacity-50 shrink-0"
                  title={t('passkeys.delete')}
                >
                  {deletingId === k.id ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Trash2 size={12} />
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* Register new passkey */}
        <div className="flex gap-2 pt-1">
          <input
            type="text"
            value={keyName}
            onChange={(e) => setKeyName(e.target.value)}
            placeholder={t('passkeys.namePlaceholder')}
            className="flex-1 px-2 py-1.5 bg-[var(--bg-primary)] border border-[var(--border)] rounded text-xs"
            onKeyDown={(e) => { if (e.key === 'Enter') handleRegister(); }}
          />
          <button
            onClick={handleRegister}
            disabled={registering}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg disabled:opacity-50"
          >
            {registering ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Plus size={12} />
            )}
            {registering ? t('passkeys.registering') : t('passkeys.register')}
          </button>
        </div>
        <p className="text-[10px] text-[var(--text-tertiary)]">{t('passkeys.desc')}</p>
      </div>
    </div>
  );
}
