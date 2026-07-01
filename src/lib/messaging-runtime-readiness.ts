import {
  hasConnectorSecretMaterial,
  validateConnectorCredentialReference,
  type ConnectorCredentialReference,
  type ConnectorCredentialReferenceRejectReason,
} from './connector-credential-boundary';
import {
  hasMessagingSecretMaterial,
  sanitizeMessagingConnectorSafetyPolicy,
  type MessagingConnectorEventClass,
  type MessagingConnectorKind,
  type MessagingConnectorSafetyPolicy,
  type MessagingCredentialReference,
} from './messaging-connector-policy';

export type MessagingRuntimeReadinessStatus =
  | 'blocked'
  | 'explicit-user-test-ready'
  | 'no-auto-post-safe'
  | 'unavailable';

export type MessagingRuntimeReadinessReason =
  | 'explicit_user_test_ready'
  | 'no_auto_post_safe'
  | 'connector_unavailable'
  | 'unsupported_connector_kind'
  | 'raw_secret_material'
  | 'missing_explicit_user_consent'
  | 'unsupported_consent_scope'
  | 'posting_or_webhook_execution_enabled'
  | 'missing_credential_reference'
  | 'invalid_connector_credential_reference'
  | 'invalid_messaging_credential_reference'
  | 'missing_event_scope'
  | 'ambiguous_event_scope'
  | 'unsupported_event_scope'
  | 'event_scope_not_allowed'
  | 'channel_follow_up_policy_overbroad';

export interface MessagingRuntimeReadinessInput {
  connectorAvailable?: boolean;
  connectorKind?: MessagingConnectorKind;
  policy?: unknown;
  credentialReference?: unknown;
  eventScope?: MessagingConnectorEventClass | MessagingConnectorEventClass[] | null;
  explicitUserTestRequested?: boolean;
}

export interface MessagingRuntimeReadinessDecision {
  status: MessagingRuntimeReadinessStatus;
  readyForExplicitUserTest: boolean;
  reason: MessagingRuntimeReadinessReason;
  connectorKind: MessagingConnectorKind;
  eventScope?: MessagingConnectorEventClass;
  credentialReference?: ConnectorCredentialReference | MessagingCredentialReference;
  connectorCredentialRejectReason?: ConnectorCredentialReferenceRejectReason;
  noAutoPost: true;
  sideEffectBoundary: 'pure-local-no-fetch-no-webhook-no-slack-api-no-storage-no-send';
}

const EVENT_CLASSES: readonly MessagingConnectorEventClass[] = [
  'direct-mention',
  'one-to-one-dm',
  'group-dm',
  'thread-reply-after-user-post',
  'channel-follow-up',
  'webhook-alert',
];

const SUPPORTED_CONNECTOR_KINDS: readonly MessagingConnectorKind[] = ['slack', 'generic-webhook'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function ownValue(source: Record<string, unknown>, key: string): unknown {
  return Object.prototype.hasOwnProperty.call(source, key) ? source[key] : undefined;
}

function rawPolicyEnablesPostingOrWebhookExecution(policyInput: unknown): boolean {
  if (!isRecord(policyInput)) return false;
  const consent = ownValue(policyInput, 'consent');
  if (!isRecord(consent)) return false;
  return ownValue(consent, 'canPostMessages') === true || ownValue(consent, 'canExecuteWebhooks') === true;
}

function decision(
  status: MessagingRuntimeReadinessStatus,
  reason: MessagingRuntimeReadinessReason,
  policy: MessagingConnectorSafetyPolicy,
  extra: Partial<MessagingRuntimeReadinessDecision> = {},
): MessagingRuntimeReadinessDecision {
  return {
    status,
    readyForExplicitUserTest: status === 'explicit-user-test-ready',
    reason,
    connectorKind: policy.connectorKind,
    noAutoPost: true,
    sideEffectBoundary: 'pure-local-no-fetch-no-webhook-no-slack-api-no-storage-no-send',
    ...extra,
  };
}

function normalizeEventScope(eventScope: MessagingRuntimeReadinessInput['eventScope']):
  | { ok: true; eventScope: MessagingConnectorEventClass }
  | { ok: false; reason: Extract<MessagingRuntimeReadinessReason, 'missing_event_scope' | 'ambiguous_event_scope' | 'unsupported_event_scope'> } {
  if (eventScope === undefined || eventScope === null) return { ok: false, reason: 'missing_event_scope' };
  const scopes = Array.isArray(eventScope) ? eventScope : [eventScope];
  if (scopes.length !== 1) return { ok: false, reason: 'ambiguous_event_scope' };
  const [scope] = scopes;
  if (!EVENT_CLASSES.includes(scope)) return { ok: false, reason: 'unsupported_event_scope' };
  return { ok: true, eventScope: scope };
}

function getCredentialReference(
  input: MessagingRuntimeReadinessInput,
  policy: MessagingConnectorSafetyPolicy,
):
  | { ok: true; reference: ConnectorCredentialReference | MessagingCredentialReference }
  | { ok: false; reason: Extract<MessagingRuntimeReadinessReason, 'missing_credential_reference' | 'invalid_connector_credential_reference' | 'invalid_messaging_credential_reference'>; connectorCredentialRejectReason?: ConnectorCredentialReferenceRejectReason } {
  if (input.credentialReference !== undefined) {
    const validation = validateConnectorCredentialReference(input.credentialReference);
    if (!validation.ok) {
      return {
        ok: false,
        reason: 'invalid_connector_credential_reference',
        connectorCredentialRejectReason: validation.reason,
      };
    }
    return { ok: true, reference: validation.reference };
  }

  if (!policy.webhook.credentialRef) return { ok: false, reason: 'missing_credential_reference' };
  if (!policy.webhook.credentialRef.id || !policy.webhook.credentialRef.kind) {
    return { ok: false, reason: 'invalid_messaging_credential_reference' };
  }
  return { ok: true, reference: policy.webhook.credentialRef };
}

function channelFollowUpPolicyIsConstrained(policy: MessagingConnectorSafetyPolicy): boolean {
  const controls = policy.slackNotificationPolicy.noiseControls;
  return (
    policy.slackNotificationPolicy.channelFollowUps === true
    && controls.quietHoursEnabled === true
    && controls.batchChannelFollowUps === true
    && controls.suppressDuplicateThreadReplies === true
    && controls.requireExplicitCaseMentionForChannels === true
    && controls.maxChannelFollowUpsPerHour <= 3
  );
}

export function evaluateMessagingRuntimeReadiness(
  input: MessagingRuntimeReadinessInput = {},
): MessagingRuntimeReadinessDecision {
  const policy = sanitizeMessagingConnectorSafetyPolicy(input.policy);

  if (input.connectorAvailable === false) return decision('unavailable', 'connector_unavailable', policy);
  if (input.connectorKind && !SUPPORTED_CONNECTOR_KINDS.includes(input.connectorKind)) {
    return decision('unavailable', 'unsupported_connector_kind', policy);
  }
  if (input.connectorKind && input.connectorKind !== policy.connectorKind) {
    return decision('unavailable', 'unsupported_connector_kind', policy);
  }
  if (
    hasMessagingSecretMaterial(input)
    || hasMessagingSecretMaterial(input.policy)
    || hasConnectorSecretMaterial(input.credentialReference)
  ) {
    return decision('blocked', 'raw_secret_material', policy);
  }
  if (!policy.consent.explicitUserConsent) return decision('blocked', 'missing_explicit_user_consent', policy);
  if (policy.consent.consentScope !== 'notifications-only') {
    return decision('blocked', 'unsupported_consent_scope', policy);
  }
  if (
    policy.consent.canPostMessages !== false
    || policy.consent.canExecuteWebhooks !== false
    || rawPolicyEnablesPostingOrWebhookExecution(input.policy)
  ) {
    return decision('blocked', 'posting_or_webhook_execution_enabled', policy);
  }

  const credential = getCredentialReference(input, policy);
  if (!credential.ok) {
    return decision('blocked', credential.reason, policy, {
      connectorCredentialRejectReason: credential.connectorCredentialRejectReason,
    });
  }

  const eventScope = normalizeEventScope(input.eventScope);
  if (!eventScope.ok) return decision('blocked', eventScope.reason, policy);

  const eventPolicy = policy.eventClasses[eventScope.eventScope];
  if (!eventPolicy?.supported) return decision('unavailable', 'unsupported_event_scope', policy, { eventScope: eventScope.eventScope });
  if (!eventPolicy.allowed) return decision('blocked', 'event_scope_not_allowed', policy, { eventScope: eventScope.eventScope });
  if (eventScope.eventScope === 'channel-follow-up' && !channelFollowUpPolicyIsConstrained(policy)) {
    return decision('blocked', 'channel_follow_up_policy_overbroad', policy, { eventScope: eventScope.eventScope });
  }

  if (input.explicitUserTestRequested === true) {
    return decision('explicit-user-test-ready', 'explicit_user_test_ready', policy, {
      eventScope: eventScope.eventScope,
      credentialReference: credential.reference,
    });
  }

  return decision('no-auto-post-safe', 'no_auto_post_safe', policy, {
    eventScope: eventScope.eventScope,
    credentialReference: credential.reference,
  });
}
