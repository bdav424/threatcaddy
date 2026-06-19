import { useCallback } from 'react';
import { useSettings } from './useSettings';
import {
  applyConnectionTestResult,
  createEmailAccountConfig,
  markEmailAccountPending,
  markEmailAccountRevoked,
  sanitizeEmailAccounts,
  testEmailAccountConnection,
  type EmailAccountConfig,
  type EmailConnectionTestOptions,
  type EmailProviderId,
} from '../lib/email-onboarding';

export function useEmailAccounts() {
  const { settings, updateSettings } = useSettings();
  const accounts = sanitizeEmailAccounts(settings.emailAccounts);

  const saveAccounts = useCallback((nextAccounts: EmailAccountConfig[]) => {
    updateSettings({ emailAccounts: sanitizeEmailAccounts(nextAccounts) });
  }, [updateSettings]);

  const addAccount = useCallback((input: {
    id: string;
    providerId: EmailProviderId;
    label?: string;
    address?: string;
    now?: number;
  }) => {
    const account = createEmailAccountConfig(input);
    saveAccounts([...accounts.filter((existing) => existing.id !== account.id), account]);
    return account;
  }, [accounts, saveAccounts]);

  const updateAccount = useCallback((id: string, updates: Partial<EmailAccountConfig>) => {
    const now = Date.now();
    const next = accounts.map((account) => account.id === id
      ? { ...account, ...updates, updatedAt: updates.updatedAt ?? now }
      : account);
    saveAccounts(next);
  }, [accounts, saveAccounts]);

  const revokeAccount = useCallback((id: string, now = Date.now()) => {
    const next = accounts.map((account) => account.id === id ? markEmailAccountRevoked(account, now) : account);
    saveAccounts(next);
  }, [accounts, saveAccounts]);

  const markPending = useCallback((id: string, now = Date.now()) => {
    const next = accounts.map((account) => account.id === id ? markEmailAccountPending(account, now) : account);
    saveAccounts(next);
  }, [accounts, saveAccounts]);

  const testConnection = useCallback(async (id: string, options?: EmailConnectionTestOptions) => {
    const account = accounts.find((candidate) => candidate.id === id);
    if (!account) throw new Error(`Email account not found: ${id}`);
    const result = await testEmailAccountConnection(account, options);
    const next = accounts.map((candidate) =>
      candidate.id === id ? applyConnectionTestResult(candidate, result) : candidate,
    );
    saveAccounts(next);
    return result;
  }, [accounts, saveAccounts]);

  return {
    accounts,
    addAccount,
    updateAccount,
    revokeAccount,
    markPending,
    testConnection,
  };
}
