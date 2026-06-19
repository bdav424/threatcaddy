import { describe, it, expect, beforeEach } from 'vitest';
import {
  computeStepStatuses,
  isAiConfigured,
  isEmailConfigured,
  isOnboardingComplete,
  loadOnboardingState,
  saveOnboardingState,
  type OnboardingState,
} from '../lib/assistant-onboarding';
import type { Settings } from '../types';
import type { EmailAccountConfig } from '../lib/email-onboarding';

const NO_PROVIDERS: Partial<Settings> = {};
const WITH_ANTHROPIC: Partial<Settings> = { llmAnthropicApiKey: 'sk-test' };
const WITH_LOCAL: Partial<Settings> = { llmLocalEndpoint: 'http://localhost:11434', llmLocalModelName: 'llama3' };
const STUB_ACCOUNT: EmailAccountConfig = {
  schemaVersion: 1,
  id: 'acc-1',
  providerId: 'google-gmail',
  label: 'Test',
  status: 'connected',
  sendPolicy: 'manual_confirm',
  createdAt: 0,
  updatedAt: 0,
};
const WITH_EMAIL: Partial<Settings> = { emailAccounts: [STUB_ACCOUNT] };

const EMPTY_STATE: OnboardingState = { dismissed: false, skippedSteps: [] };

describe('assistant-onboarding state machine', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('isAiConfigured', () => {
    it('returns false when no keys are set', () => {
      expect(isAiConfigured(NO_PROVIDERS as Settings)).toBe(false);
    });
    it('returns true when Anthropic key is set', () => {
      expect(isAiConfigured(WITH_ANTHROPIC as Settings)).toBe(true);
    });
    it('returns true when local endpoint + model name are set', () => {
      expect(isAiConfigured(WITH_LOCAL as Settings)).toBe(true);
    });
  });

  describe('isEmailConfigured', () => {
    it('returns false when no accounts', () => {
      expect(isEmailConfigured({} as Settings)).toBe(false);
    });
    it('returns true when at least one account exists', () => {
      expect(isEmailConfigured(WITH_EMAIL as Settings)).toBe(true);
    });
  });

  describe('computeStepStatuses', () => {
    it('marks configure-ai as active when nothing is set', () => {
      const statuses = computeStepStatuses(NO_PROVIDERS as Settings, EMPTY_STATE, 0);
      expect(statuses['configure-ai']).toBe('active');
      expect(statuses['connect-email']).toBe('pending');
      expect(statuses['enable-integration']).toBe('pending');
    });

    it('marks configure-ai complete and connect-email active after AI is configured', () => {
      const statuses = computeStepStatuses(WITH_ANTHROPIC as Settings, EMPTY_STATE, 0);
      expect(statuses['configure-ai']).toBe('complete');
      expect(statuses['connect-email']).toBe('active');
    });

    it('marks configure-ai + connect-email complete when both are set', () => {
      const settings = { ...WITH_ANTHROPIC, ...WITH_EMAIL } as Settings;
      const statuses = computeStepStatuses(settings, EMPTY_STATE, 0);
      expect(statuses['configure-ai']).toBe('complete');
      expect(statuses['connect-email']).toBe('complete');
      expect(statuses['enable-integration']).toBe('active');
    });

    it('marks enable-integration complete when integrations are installed', () => {
      const settings = { ...WITH_ANTHROPIC, ...WITH_EMAIL } as Settings;
      const statuses = computeStepStatuses(settings, EMPTY_STATE, 2);
      expect(statuses['enable-integration']).toBe('complete');
    });

    it('marks skipped steps as skipped', () => {
      const state: OnboardingState = { dismissed: false, skippedSteps: ['configure-ai'] };
      const statuses = computeStepStatuses(NO_PROVIDERS as Settings, state, 0);
      expect(statuses['configure-ai']).toBe('skipped');
    });
  });

  describe('isOnboardingComplete', () => {
    it('returns false when required steps are not done', () => {
      const statuses = computeStepStatuses(NO_PROVIDERS as Settings, EMPTY_STATE, 0);
      expect(isOnboardingComplete(statuses)).toBe(false);
    });

    it('returns true when all non-optional steps are complete', () => {
      const settings = { ...WITH_ANTHROPIC, ...WITH_EMAIL } as Settings;
      const statuses = computeStepStatuses(settings, EMPTY_STATE, 0);
      expect(isOnboardingComplete(statuses)).toBe(true);
    });

    it('returns true when required steps are skipped', () => {
      const state: OnboardingState = { dismissed: false, skippedSteps: ['configure-ai', 'connect-email'] };
      const statuses = computeStepStatuses(NO_PROVIDERS as Settings, state, 0);
      expect(isOnboardingComplete(statuses)).toBe(true);
    });
  });

  describe('persistence', () => {
    it('loads default state when localStorage is empty', () => {
      const state = loadOnboardingState();
      expect(state.dismissed).toBe(false);
      expect(state.skippedSteps).toEqual([]);
    });

    it('round-trips state through localStorage', () => {
      const state: OnboardingState = { dismissed: false, skippedSteps: ['enable-integration'] };
      saveOnboardingState(state);
      expect(loadOnboardingState()).toEqual(state);
    });

    it('loads dismissed state correctly', () => {
      saveOnboardingState({ dismissed: true, skippedSteps: [] });
      expect(loadOnboardingState().dismissed).toBe(true);
    });
  });
});
