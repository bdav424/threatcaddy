import { sanitizeSlackNotificationPolicy } from './integration-catalog';
import type { SlackNotificationPolicy } from '../types/integration-types';

export type MessagingConnectorKind = 'slack' | 'generic-webhook';

export type MessagingConnectorEventClass =
  | 'direct-mention'
  | 'one-to-one-dm'
  | 'group-dm'
  | 'thread-reply-after-user-post'
  | 'channel-follow-up'
  | 'webhook-alert';

export type MessagingCredentialReferenceKind = 'external-secret-store' | 'local-bridge' | 'user-managed-vault';

export interface MessagingCredentialReference {
  id: string;
  kind: MessagingCredentialReferenceKind;
  displayName?: string;
}

export interface MessagingConnectorConsentPolicy {
  explicitUserConsent: boolean;
  consentScope: 'none' | 'notifications-only';
  canPostMessages: false;
  canExecuteWebhooks: false;
}

export interface MessagingConnectorEventClassPolicy {
  eventClass: MessagingConnectorEventClass;
  supported: boolean;
  allowed: boolean;
  autoPost: false;
  requiresExplicitConsent: true;
}

export interface MessagingConnectorWebhookPolicy {
  requiresCredentialReference: true;
  credentialRef?: MessagingCredentialReference;
  plaintextWebhookUrlAllowed: false;
  rejectedSecretFields: string[];
}

export interface MessagingConnectorSafetyPolicy {
  connectorKind: MessagingConnectorKind;
  consent: MessagingConnectorConsentPolicy;
  slackNotificationPolicy: SlackNotificationPolicy;
  eventClasses: Record<MessagingConnectorEventClass, MessagingConnectorEventClassPolicy>;
  webhook: MessagingConnectorWebhookPolicy;
}

const EVENT_CLASSES: MessagingConnectorEventClass[] = [
  'direct-mention',
  'one-to-one-dm',
  'group-dm',
  'thread-reply-after-user-post',
  'channel-follow-up',
  'webhook-alert',
];

const CREDENTIAL_REFERENCE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$/;
const MAX_SECRET_SCAN_DEPTH = 8;

const SECRET_FIELD_NAME_PATTERN =
  /(api[_-]?key|access[_-]?token|auth[_-]?token|bearer|client[_-]?secret|password|secret|token|webhook[_-]?url|webhookurl|url)/i;

const SECRET_VALUE_PATTERN =
  /(https?:\/\/|hooks\.slack(?:-gov)?\.com\/services\/|xox[abprs]-|Bearer\s+[A-Za-z0-9._~+/=-]+)/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function ownValue(source: Record<string, unknown>, key: string): unknown {
  return Object.prototype.hasOwnProperty.call(source, key) ? source[key] : undefined;
}

function ownRecord(source: Record<string, unknown>, key: string): Record<string, unknown> {
  const value = ownValue(source, key);
  return isRecord(value) ? value : {};
}

function ownBoolean(source: Record<string, unknown>, key: string): boolean {
  return ownValue(source, key) === true;
}

function sanitizeConnectorKind(value: unknown): MessagingConnectorKind {
  return value === 'generic-webhook' ? 'generic-webhook' : 'slack';
}

function sanitizeDisplayName(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > 80 || SECRET_VALUE_PATTERN.test(trimmed)) return undefined;
  return trimmed;
}

function sanitizeCredentialReference(input: unknown): MessagingCredentialReference | undefined {
  if (!isRecord(input) || hasMessagingSecretMaterial(input)) return undefined;

  const id = ownValue(input, 'id');
  const kind = ownValue(input, 'kind');
  if (typeof id !== 'string' || !CREDENTIAL_REFERENCE_ID_PATTERN.test(id)) return undefined;
  if (SECRET_VALUE_PATTERN.test(id)) return undefined;
  if (kind !== 'external-secret-store' && kind !== 'local-bridge' && kind !== 'user-managed-vault') return undefined;

  return {
    id,
    kind,
    displayName: sanitizeDisplayName(ownValue(input, 'displayName')),
  };
}

function collectRejectedSecretFields(input: unknown, prefix = '', seen = new WeakSet<object>(), depth = 0): string[] {
  if (depth > MAX_SECRET_SCAN_DEPTH || typeof input !== 'object' || input === null) return [];
  if (seen.has(input)) return [];
  seen.add(input);

  const rejected = new Set<string>();
  const note = (field: string): void => {
    rejected.add(field || 'secret-material');
  };

  const visitPair = (key: unknown, value: unknown): void => {
    const keyText = typeof key === 'string' ? key : '';
    const field = prefix && keyText ? `${prefix}.${keyText}` : keyText || prefix;
    if (SECRET_FIELD_NAME_PATTERN.test(keyText)) {
      note(field);
    }
    if (typeof value === 'string' && SECRET_VALUE_PATTERN.test(value)) {
      note(field);
    }
    for (const nested of collectRejectedSecretFields(value, field, seen, depth + 1)) {
      rejected.add(nested);
    }
  };

  if (input instanceof Map) {
    for (const [key, value] of input.entries()) visitPair(key, value);
    return [...rejected].sort();
  }

  if (input instanceof Set) {
    let index = 0;
    for (const value of input.values()) {
      visitPair(String(index), value);
      index += 1;
    }
    return [...rejected].sort();
  }

  if (Array.isArray(input)) {
    input.forEach((value, index) => visitPair(String(index), value));
    return [...rejected].sort();
  }

  for (const [key, value] of Object.entries(input)) visitPair(key, value);
  return [...rejected].sort();
}

function eventAllowedBySlackPolicy(eventClass: MessagingConnectorEventClass, slackPolicy: SlackNotificationPolicy): boolean {
  switch (eventClass) {
    case 'direct-mention':
      return slackPolicy.directMentions;
    case 'one-to-one-dm':
      return slackPolicy.oneToOneDms;
    case 'group-dm':
      return slackPolicy.groupDms;
    case 'thread-reply-after-user-post':
      return slackPolicy.threadRepliesAfterUserPosts;
    case 'channel-follow-up':
      return slackPolicy.channelFollowUps;
    case 'webhook-alert':
      return true;
  }
}

function buildEventClassPolicies(
  requestedEvents: Record<string, unknown>,
  slackPolicy: SlackNotificationPolicy,
  explicitUserConsent: boolean,
): Record<MessagingConnectorEventClass, MessagingConnectorEventClassPolicy> {
  return EVENT_CLASSES.reduce((policies, eventClass) => {
    const requested = ownValue(requestedEvents, eventClass) === true;
    policies[eventClass] = {
      eventClass,
      supported: true,
      allowed: explicitUserConsent && requested && eventAllowedBySlackPolicy(eventClass, slackPolicy),
      autoPost: false,
      requiresExplicitConsent: true,
    };
    return policies;
  }, {} as Record<MessagingConnectorEventClass, MessagingConnectorEventClassPolicy>);
}

export function hasMessagingSecretMaterial(input: unknown): boolean {
  return collectRejectedSecretFields(input).length > 0;
}

export function sanitizeMessagingConnectorSafetyPolicy(input?: unknown): MessagingConnectorSafetyPolicy {
  const source = isRecord(input) ? input : {};
  const consentInput = ownRecord(source, 'consent');
  const explicitUserConsent = ownBoolean(consentInput, 'explicitUserConsent');
  const slackPolicyInput = ownValue(source, 'slackNotificationPolicy') ?? ownValue(source, 'notificationPolicy');
  const slackNotificationPolicy = sanitizeSlackNotificationPolicy(slackPolicyInput);
  const requestedEvents = ownRecord(source, 'eventClasses');
  const webhookInput = ownRecord(source, 'webhook');
  const credentialRef = sanitizeCredentialReference(ownValue(webhookInput, 'credentialRef'));
  const rejectedSecretFields = [
    ...new Set([
      ...collectRejectedSecretFields(source),
      ...collectRejectedSecretFields(webhookInput),
      ...collectRejectedSecretFields(ownValue(webhookInput, 'credentialRef')),
    ]),
  ].sort();

  return {
    connectorKind: sanitizeConnectorKind(ownValue(source, 'connectorKind')),
    consent: {
      explicitUserConsent,
      consentScope: explicitUserConsent ? 'notifications-only' : 'none',
      canPostMessages: false,
      canExecuteWebhooks: false,
    },
    slackNotificationPolicy,
    eventClasses: buildEventClassPolicies(requestedEvents, slackNotificationPolicy, explicitUserConsent),
    webhook: {
      requiresCredentialReference: true,
      credentialRef,
      plaintextWebhookUrlAllowed: false,
      rejectedSecretFields,
    },
  };
}

export function getDefaultMessagingConnectorSafetyPolicy(): MessagingConnectorSafetyPolicy {
  return sanitizeMessagingConnectorSafetyPolicy();
}
