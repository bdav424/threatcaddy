import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Lock, Eye, EyeOff, X } from 'lucide-react';

interface SyncPassphrasePromptProps {
  onSubmit(passphrase: string): Promise<void>;
  onDismiss(): void;
}

export function SyncPassphrasePrompt({ onSubmit, onDismiss }: SyncPassphrasePromptProps) {
  const { t } = useTranslation('sync');
  const [passphrase, setPassphrase] = useState('');
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passphrase.trim()) return;
    setLoading(true);
    setError('');
    try {
      await onSubmit(passphrase);
    } catch {
      setError(t('passphraseError', 'Failed to set sync passphrase. Please try again.'));
    } finally {
      setLoading(false);
    }
  }, [passphrase, onSubmit, t]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl shadow-2xl w-full max-w-md mx-4 p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <Lock className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <h2 className="font-semibold text-[var(--color-text-primary)] text-sm">
                {t('passphraseTitle', 'Enable Encrypted Sync')}
              </h2>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                {t('passphraseSubtitle', 'Enter your sync passphrase to encrypt data before it reaches the server')}
              </p>
            </div>
          </div>
          <button
            onClick={onDismiss}
            className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors p-1 rounded"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-[var(--color-text-muted)] mb-4 leading-relaxed">
          {t('passphraseHint', 'You signed in with a passkey. Enter the sync passphrase you set on your first device. If this is your first device, choose any passphrase — you\'ll need it on future devices.')}
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="relative">
            <input
              type={showPassphrase ? 'text' : 'password'}
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              placeholder={t('passphrasePlaceholder', 'Sync passphrase')}
              className="w-full bg-[var(--color-input-bg)] border border-[var(--color-border)] rounded-lg px-3 py-2 pr-10 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              autoFocus
              disabled={loading}
            />
            <button
              type="button"
              onClick={() => setShowPassphrase((v) => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
              tabIndex={-1}
            >
              {showPassphrase ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {error && (
            <p className="text-xs text-red-500">{error}</p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={loading || !passphrase.trim()}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors"
            >
              {loading ? t('passphraseApplying', 'Applying…') : t('passphraseSubmit', 'Enable encryption')}
            </button>
            <button
              type="button"
              onClick={onDismiss}
              className="px-4 py-2 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] border border-[var(--color-border)] rounded-lg transition-colors"
            >
              {t('passphraseLater', 'Later')}
            </button>
          </div>
        </form>

        <p className="text-xs text-[var(--color-text-muted)] mt-3 leading-relaxed">
          {t('passphrasePrivacy', 'The passphrase never leaves your device. Your data is encrypted locally before syncing.')}
        </p>
      </div>
    </div>
  );
}
