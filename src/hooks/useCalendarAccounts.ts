import { useCallback } from 'react';
import { useSettings } from './useSettings';
import {
  createCalendarAccountConfig,
  sanitizeCalendarAccounts,
  type CalendarAccountConfig,
  type CalendarProvider,
} from '../lib/calendar-accounts';

export function useCalendarAccounts() {
  const { settings, updateSettings } = useSettings();
  const accounts = sanitizeCalendarAccounts(settings.calendarAccounts);

  const saveAccounts = useCallback((next: CalendarAccountConfig[]) => {
    updateSettings({ calendarAccounts: sanitizeCalendarAccounts(next) });
  }, [updateSettings]);

  const addAccount = useCallback((input: {
    id: string;
    provider: CalendarProvider;
    label: string;
    email?: string;
    credRefId: string;
    now?: number;
  }) => {
    const account = createCalendarAccountConfig(input);
    saveAccounts([...accounts.filter((a) => a.id !== account.id), account]);
    return account;
  }, [accounts, saveAccounts]);

  const updateAccount = useCallback((id: string, updates: Partial<CalendarAccountConfig>) => {
    const now = Date.now();
    saveAccounts(accounts.map((a) => a.id === id ? { ...a, ...updates, updatedAt: updates.updatedAt ?? now } : a));
  }, [accounts, saveAccounts]);

  const removeAccount = useCallback((id: string) => {
    saveAccounts(accounts.filter((a) => a.id !== id));
  }, [accounts, saveAccounts]);

  return { accounts, addAccount, updateAccount, removeAccount };
}
