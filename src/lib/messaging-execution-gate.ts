import { hasConnectorSecretMaterial } from './connector-credential-boundary';
import {
  evaluateMessagingRuntimeReadiness,
  type MessagingRuntimeReadinessDecision,
  type MessagingRuntimeReadinessInput,
} from './messaging-runtime-readiness';
import {
  hasMessagingSecretMaterial,
  type MessagingConnectorEventClass,
} from './messaging-connector-policy';

export type MessagingExecutionAction =
  | 'dry-run-notification'
  | 'post-message'
  | 'post-thread-reply'
  | 'webhook-delivery'
  | 'disable-connector'
  | 'revoke-credential-reference';

export type MessagingExecutionGateReason =
  | 'dry_run_notification_allowed'
  | 'manual_control_allowed'
  | 'unsupported_action'
  | 'raw_secret_material'
  | 'missing_explicit_action_consent'
  | 'runtime_not_ready'
  | 'runtime_auto_post_not_disabled'
  | 'missing_event_scope'
  | 'missing_credential_reference'
  | 'missing_noise_limits'
  | 'noise_limit_overbroad'
  | 'live_delivery_disabled_by_no_auto_post_contract';

export interface MessagingExecutionNoiseLimits {
  maxActionsPerHour: number;
  maxRecipientsPerAction: number;
  suppressDuplicateThreadReplies: boolean;
  requireExplicitCaseMentionForChannels: boolean;
}

export interface MessagingExecutionGateInput {
  action?: MessagingExecutionAction;
  explicitActionConsent?: boolean;
  runtime?: MessagingRuntimeReadinessInput;
  noiseLimits?: Partial<MessagingExecutionNoiseLimits> | null;
  actionPayload?: unknown;
}

export interface MessagingExecutionGateDecision {
  decision: 'allow' | 'block';
  action: MessagingExecutionAction | 'unsupported';
  reason: MessagingExecutionGateReason;
  inert: true;
  executesProviderCall: false;
  noAutoPost: true;
  runtimeStatus?: MessagingRuntimeReadinessDecision['status'];
  runtimeReason?: MessagingRuntimeReadinessDecision['reason'];
  eventScope?: MessagingConnectorEventClass;
  sideEffectBoundary: 'pure-local-no-fetch-no-webhook-no-slack-api-no-storage-no-send';
}

const ACTIONS: readonly MessagingExecutionAction[] = [
  'dry-run-notification',
  'post-message',
  'post-thread-reply',
  'webhook-delivery',
  'disable-connector',
  'revoke-credential-reference',
];

const LIVE_DELIVERY_ACTIONS: readonly MessagingExecutionAction[] = [
  'post-message',
  'post-thread-reply',
  'webhook-delivery',
];

function isMessagingExecutionAction(action: unknown): action is MessagingExecutionAction {
  return typeof action === 'string' && ACTIONS.includes(action as MessagingExecutionAction);
}

function isRuntimeReady(decision: MessagingRuntimeReadinessDecision): boolean {
  return decision.status === 'explicit-user-test-ready' || decision.status === 'no-auto-post-safe';
}

function noiseLimitsAreConstrained(
  limits: Partial<MessagingExecutionNoiseLimits> | null | undefined,
  eventScope: MessagingConnectorEventClass,
): boolean {
  if (!limits) return false;
  const maxActionsPerHour = limits.maxActionsPerHour;
  const maxRecipientsPerAction = limits.maxRecipientsPerAction;

  if (
    typeof maxActionsPerHour !== 'number'
    || !Number.isSafeInteger(maxActionsPerHour)
    || maxActionsPerHour < 1
    || maxActionsPerHour > 3
  ) {
    return false;
  }
  if (
    typeof maxRecipientsPerAction !== 'number'
    || !Number.isSafeInteger(maxRecipientsPerAction)
    || maxRecipientsPerAction < 1
    || maxRecipientsPerAction > 5
  ) {
    return false;
  }
  if (limits.suppressDuplicateThreadReplies !== true) return false;
  if (eventScope === 'channel-follow-up' && limits.requireExplicitCaseMentionForChannels !== true) return false;
  return true;
}

function baseDecision(
  input: {
    action: MessagingExecutionAction | 'unsupported';
    decision: 'allow' | 'block';
    reason: MessagingExecutionGateReason;
    runtime?: MessagingRuntimeReadinessDecision;
  },
): MessagingExecutionGateDecision {
  return {
    decision: input.decision,
    action: input.action,
    reason: input.reason,
    inert: true,
    executesProviderCall: false,
    noAutoPost: true,
    runtimeStatus: input.runtime?.status,
    runtimeReason: input.runtime?.reason,
    eventScope: input.runtime?.eventScope,
    sideEffectBoundary: 'pure-local-no-fetch-no-webhook-no-slack-api-no-storage-no-send',
  };
}

export function evaluateMessagingExecutionGate(
  input: MessagingExecutionGateInput = {},
): MessagingExecutionGateDecision {
  const action = isMessagingExecutionAction(input.action) ? input.action : undefined;
  if (!action) {
    return baseDecision({
      action: 'unsupported',
      decision: 'block',
      reason: 'unsupported_action',
    });
  }

  if (
    hasMessagingSecretMaterial(input.actionPayload)
    || hasConnectorSecretMaterial(input.actionPayload)
    || hasMessagingSecretMaterial(input.runtime)
    || hasConnectorSecretMaterial(input.runtime?.credentialReference)
  ) {
    return baseDecision({
      action,
      decision: 'block',
      reason: 'raw_secret_material',
    });
  }

  if (input.explicitActionConsent !== true) {
    return baseDecision({
      action,
      decision: 'block',
      reason: 'missing_explicit_action_consent',
    });
  }

  const runtime = evaluateMessagingRuntimeReadiness(input.runtime);
  if (!isRuntimeReady(runtime)) {
    if (runtime.reason === 'missing_event_scope') {
      return baseDecision({
        action,
        decision: 'block',
        reason: 'missing_event_scope',
        runtime,
      });
    }
    if (runtime.reason === 'missing_credential_reference' || runtime.reason === 'invalid_connector_credential_reference') {
      return baseDecision({
        action,
        decision: 'block',
        reason: 'missing_credential_reference',
        runtime,
      });
    }
    if (runtime.reason === 'channel_follow_up_policy_overbroad') {
      return baseDecision({
        action,
        decision: 'block',
        reason: 'noise_limit_overbroad',
        runtime,
      });
    }
    return baseDecision({
      action,
      decision: 'block',
      reason: 'runtime_not_ready',
      runtime,
    });
  }
  if (runtime.noAutoPost !== true) {
    return baseDecision({
      action,
      decision: 'block',
      reason: 'runtime_auto_post_not_disabled',
      runtime,
    });
  }
  if (!runtime.eventScope) {
    return baseDecision({
      action,
      decision: 'block',
      reason: 'missing_event_scope',
      runtime,
    });
  }
  if (!runtime.credentialReference) {
    return baseDecision({
      action,
      decision: 'block',
      reason: 'missing_credential_reference',
      runtime,
    });
  }
  if (!input.noiseLimits) {
    return baseDecision({
      action,
      decision: 'block',
      reason: 'missing_noise_limits',
      runtime,
    });
  }
  if (!noiseLimitsAreConstrained(input.noiseLimits, runtime.eventScope)) {
    return baseDecision({
      action,
      decision: 'block',
      reason: 'noise_limit_overbroad',
      runtime,
    });
  }

  if (LIVE_DELIVERY_ACTIONS.includes(action)) {
    return baseDecision({
      action,
      decision: 'block',
      reason: 'live_delivery_disabled_by_no_auto_post_contract',
      runtime,
    });
  }

  return baseDecision({
    action,
    decision: 'allow',
    reason: action === 'dry-run-notification' ? 'dry_run_notification_allowed' : 'manual_control_allowed',
    runtime,
  });
}
