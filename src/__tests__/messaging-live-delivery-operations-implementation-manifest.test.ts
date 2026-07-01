import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConnectorCredentialReference } from '../lib/connector-credential-boundary';
import type {
  MessagingConnectorEventClass,
  MessagingConnectorKind,
} from '../lib/messaging-connector-policy';
import type {
  MessagingExecutionAction,
  MessagingExecutionGateDecision,
} from '../lib/messaging-execution-gate';
import type { MessagingRuntimeReadinessDecision } from '../lib/messaging-runtime-readiness';
import {
  createRuntimeTrustedContractObject,
  isRuntimeTrustedContractObject,
  type RuntimeTrustedContractObject,
  type RuntimeTrustedContractValue,
} from '../lib/runtime-trusted-contract-object';
import {
  MESSAGING_LIVE_DELIVERY_OPERATIONS_IMPLEMENTATION_MANIFEST_BLOCKED_PATH_CLASSES,
  MESSAGING_LIVE_DELIVERY_OPERATIONS_IMPLEMENTATION_MANIFEST_EXACT_WRITE_SET,
  MESSAGING_LIVE_DELIVERY_OPERATIONS_IMPLEMENTATION_MANIFEST_OPERATION_ORDER,
  evaluateMessagingLiveDeliveryOperationsImplementationManifest,
  type MessagingLiveDeliveryOperation,
  type MessagingLiveDeliveryOperationPlan,
  type MessagingLiveDeliveryOperationsImplementationManifestInput,
} from '../lib/messaging-live-delivery-operations-implementation-manifest';

const SLACK_CONNECTOR_KIND = 'slack' as const;
const WEBHOOK_CONNECTOR_KIND = 'generic-webhook' as const;
const SLACK_EVENT_SCOPE = 'direct-mention' as const;
const WEBHOOK_EVENT_SCOPE = 'webhook-alert' as const;
const WORKSPACE_ID = 'workspace-1';

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function trustedValue(value: unknown): RuntimeTrustedContractValue {
  if (
    value === null
    || value === undefined
    || typeof value === 'string'
    || typeof value === 'number'
    || typeof value === 'boolean'
  ) {
    return value;
  }
  if (Array.isArray(value)) return value.map((entry) => trustedValue(entry));
  if (isRuntimeTrustedContractObject(value)) return value;
  if (isPlainRecord(value)) return trusted(value);
  throw new TypeError('Test fixture contains an unsupported trusted contract value.');
}

function trusted<T extends Record<string, unknown>>(value: T): RuntimeTrustedContractObject & T {
  return createRuntimeTrustedContractObject(
    Object.entries(value).map(([key, nested]) => [key, trustedValue(nested)] as const),
  ) as RuntimeTrustedContractObject & T;
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
});

function credentialReference(
  overrides: Partial<ConnectorCredentialReference> = {},
): ConnectorCredentialReference {
  const providerId = overrides.providerId ?? SLACK_CONNECTOR_KIND;
  return {
    schemaVersion: 1,
    kind: 'external-secret-store',
    id: `vault:messaging/${providerId}/case-alerts`,
    storageOwner: 'external-secret-store',
    providerId,
    connectorId: 'messaging',
    accountId: WORKSPACE_ID,
    displayName: 'Messaging case alert credential reference',
    createdAt: 1_700_000_000_000,
    ...overrides,
  };
}

function runtimeReadiness(
  overrides: Partial<MessagingRuntimeReadinessDecision> = {},
): MessagingRuntimeReadinessDecision {
  const connectorKind = overrides.connectorKind ?? SLACK_CONNECTOR_KIND;
  const eventScope = overrides.eventScope ?? SLACK_EVENT_SCOPE;
  const status = overrides.status ?? 'explicit-user-test-ready';
  return {
    status,
    readyForExplicitUserTest: status === 'explicit-user-test-ready',
    reason: status === 'no-auto-post-safe' ? 'no_auto_post_safe' : 'explicit_user_test_ready',
    connectorKind,
    eventScope,
    credentialReference: overrides.credentialReference ?? credentialReference({ providerId: connectorKind }),
    noAutoPost: true,
    sideEffectBoundary: 'pure-local-no-fetch-no-webhook-no-slack-api-no-storage-no-send',
    ...overrides,
  };
}

function actionForOperation(operation: MessagingLiveDeliveryOperation): MessagingExecutionAction {
  switch (operation) {
    case 'dry_run_notification':
      return 'dry-run-notification';
    case 'post_message':
      return 'post-message';
    case 'post_thread_reply':
      return 'post-thread-reply';
    case 'webhook_delivery':
      return 'webhook-delivery';
  }
}

function gateDecision(
  operation: MessagingLiveDeliveryOperation,
  eventScope: MessagingConnectorEventClass = SLACK_EVENT_SCOPE,
  overrides: Partial<MessagingExecutionGateDecision> = {},
): MessagingExecutionGateDecision {
  const liveDeliveryOperation = operation !== 'dry_run_notification';
  return {
    decision: liveDeliveryOperation ? 'block' : 'allow',
    action: actionForOperation(operation),
    reason: liveDeliveryOperation
      ? 'live_delivery_disabled_by_no_auto_post_contract'
      : 'dry_run_notification_allowed',
    inert: true,
    executesProviderCall: false,
    noAutoPost: true,
    runtimeStatus: 'explicit-user-test-ready',
    runtimeReason: 'explicit_user_test_ready',
    eventScope,
    sideEffectBoundary: 'pure-local-no-fetch-no-webhook-no-slack-api-no-storage-no-send',
    ...overrides,
  };
}

function operationPlan(
  eventScope: MessagingConnectorEventClass = SLACK_EVENT_SCOPE,
  overrides: Partial<MessagingLiveDeliveryOperationPlan> = {},
): MessagingLiveDeliveryOperationPlan[] {
  return MESSAGING_LIVE_DELIVERY_OPERATIONS_IMPLEMENTATION_MANIFEST_OPERATION_ORDER.map((operation) => ({
    operation,
    action: actionForOperation(operation),
    gateDecision: gateDecision(operation, eventScope),
    checkpointRequired: true,
    rollbackRequired: true,
    ...overrides,
  }));
}

function target(
  connectorKind: MessagingConnectorKind = SLACK_CONNECTOR_KIND,
  eventScope: MessagingConnectorEventClass = SLACK_EVENT_SCOPE,
) {
  return {
    kind: connectorKind === 'generic-webhook' ? 'webhook-reference' : 'slack-channel',
    id: connectorKind === 'generic-webhook' ? 'webhook-reference-case-alerts' : 'slack-channel-case-alerts',
    workspaceId: connectorKind === 'generic-webhook' ? undefined : WORKSPACE_ID,
    connectorKind,
    eventScope,
  };
}

function readyInput(
  overrides: Partial<MessagingLiveDeliveryOperationsImplementationManifestInput> = {},
): MessagingLiveDeliveryOperationsImplementationManifestInput {
  return trusted({
    connectorKind: SLACK_CONNECTOR_KIND,
    eventScope: SLACK_EVENT_SCOPE,
    credentialReference: credentialReference(),
    target: target(),
    runtimeReadiness: runtimeReadiness(),
    operationPlan: operationPlan(),
    futureWriteSet: MESSAGING_LIVE_DELIVERY_OPERATIONS_IMPLEMENTATION_MANIFEST_EXACT_WRITE_SET,
    ...overrides,
  } as Record<string, unknown>) as unknown as MessagingLiveDeliveryOperationsImplementationManifestInput;
}

describe('messaging live delivery operations implementation manifest', () => {
  it('creates a frozen head-chat-only manifest from inert messaging gate provenance and exact future write set', () => {
    const decision = evaluateMessagingLiveDeliveryOperationsImplementationManifest(readyInput());

    expect(decision).toMatchObject({
      status: 'implementation-manifest-ready',
      manifestReady: true,
      reason: 'implementation_manifest_ready',
      manifest: {
        schemaVersion: 1,
        contract: 'messaging-live-delivery-operations-implementation-manifest-v1',
        manifestOwner: 'assistantcaddy-head-chat-messaging-live-delivery',
        manifestId: 'assistantcaddy-head-chat-messaging-live-delivery-manifest',
        manifestVersion: '2026.06.12',
        integrationOwner: 'head-chat',
        integrationScope: 'messaging-live-delivery-implementation',
        connectorKind: SLACK_CONNECTOR_KIND,
        eventScope: SLACK_EVENT_SCOPE,
        credentialReference: {
          id: 'vault:messaging/slack/case-alerts',
          kind: 'external-secret-store',
          storageOwner: 'external-secret-store',
          providerId: SLACK_CONNECTOR_KIND,
          connectorId: 'messaging',
          accountId: WORKSPACE_ID,
        },
        target: {
          kind: 'slack-channel',
          id: 'slack-channel-case-alerts',
          workspaceId: WORKSPACE_ID,
          connectorKind: SLACK_CONNECTOR_KIND,
          eventScope: SLACK_EVENT_SCOPE,
        },
        operations: MESSAGING_LIVE_DELIVERY_OPERATIONS_IMPLEMENTATION_MANIFEST_OPERATION_ORDER,
        operationOrder: MESSAGING_LIVE_DELIVERY_OPERATIONS_IMPLEMENTATION_MANIFEST_OPERATION_ORDER,
        highRiskWriteSet: MESSAGING_LIVE_DELIVERY_OPERATIONS_IMPLEMENTATION_MANIFEST_EXACT_WRITE_SET,
        blockedPathClasses: MESSAGING_LIVE_DELIVERY_OPERATIONS_IMPLEMENTATION_MANIFEST_BLOCKED_PATH_CLASSES,
        checkpointRequired: true,
        rollbackRequired: true,
        headChatReviewRequired: true,
        readyForImplementation: false,
        implementationMode: 'manifest-only',
      },
      canPrepareHeadChatMessagingLiveDeliveryImplementation: true,
      readyForMessagingLiveDeliveryImplementation: false,
      mayImportSlackSdk: false,
      mayCallSlackApi: false,
      mayCallWebhook: false,
      mayFetch: false,
      mayOpenSocket: false,
      mayStoreCredential: false,
      mayPostMessage: false,
      mayPostThreadReply: false,
      mayDeliverWebhook: false,
      mayModifySchema: false,
      mayExportOrBackup: false,
      willPromoteStandalone: false,
      sideEffects: 'none',
      sideEffectBoundary:
        'messaging-live-delivery-implementation-manifest-no-slack-api-no-webhook-no-network-no-storage-no-send',
    });
    expect(Object.isFrozen(decision)).toBe(true);
    expect(Object.isFrozen(decision.manifest)).toBe(true);
    expect(Object.isFrozen(decision.manifest.credentialReference)).toBe(true);
    expect(Object.isFrozen(decision.manifest.target)).toBe(true);
    expect(Object.isFrozen(decision.manifest.operations)).toBe(true);
    expect(Object.isFrozen(decision.manifest.highRiskWriteSet)).toBe(true);
  });

  it('rejects raw proxy and accessor inputs before scanner or traversal execution', () => {
    const getter = vi.fn(() => 'slack');
    const accessorInput: Record<string, unknown> = {
      eventScope: SLACK_EVENT_SCOPE,
    };
    Object.defineProperty(accessorInput, 'connectorKind', {
      enumerable: true,
      get: getter,
    });
    const traps = {
      get: vi.fn((proxyTarget: Record<string, unknown>, property: string | symbol, receiver: unknown) => (
        Reflect.get(proxyTarget, property, receiver)
      )),
      ownKeys: vi.fn((proxyTarget: Record<string, unknown>) => Reflect.ownKeys(proxyTarget)),
      getOwnPropertyDescriptor: vi.fn((proxyTarget: Record<string, unknown>, property: string | symbol) => (
        Reflect.getOwnPropertyDescriptor(proxyTarget, property)
      )),
      getPrototypeOf: vi.fn((proxyTarget: Record<string, unknown>) => Reflect.getPrototypeOf(proxyTarget)),
    };
    const proxiedInput = new Proxy({
      connectorKind: SLACK_CONNECTOR_KIND,
      eventScope: SLACK_EVENT_SCOPE,
    }, traps);

    expect(evaluateMessagingLiveDeliveryOperationsImplementationManifest(
      accessorInput as MessagingLiveDeliveryOperationsImplementationManifestInput,
    )).toMatchObject({
      status: 'blocked',
      reason: 'input_untrusted',
      mayFetch: false,
      mayCallSlackApi: false,
      mayCallWebhook: false,
    });
    expect(evaluateMessagingLiveDeliveryOperationsImplementationManifest(
      proxiedInput as MessagingLiveDeliveryOperationsImplementationManifestInput,
    )).toMatchObject({
      status: 'blocked',
      reason: 'input_untrusted',
    });
    expect(getter).not.toHaveBeenCalled();
    expect(traps.get).not.toHaveBeenCalled();
    expect(traps.ownKeys).not.toHaveBeenCalled();
    expect(traps.getOwnPropertyDescriptor).not.toHaveBeenCalled();
    expect(traps.getPrototypeOf).not.toHaveBeenCalled();
  });

  it('fails closed for missing plans, reordered operations, live gate claims, and forged executable claims', () => {
    expect(evaluateMessagingLiveDeliveryOperationsImplementationManifest(readyInput({
      operationPlan: undefined,
    }))).toMatchObject({
      status: 'blocked',
      reason: 'operation_plan_missing',
      canPrepareHeadChatMessagingLiveDeliveryImplementation: false,
    });

    expect(evaluateMessagingLiveDeliveryOperationsImplementationManifest(readyInput({
      operationPlan: [...operationPlan()].reverse(),
    }))).toMatchObject({
      status: 'blocked',
      reason: 'operation_order_invalid',
      mayPostMessage: false,
      mayDeliverWebhook: false,
    });

    const liveGateAllowed = operationPlan().map((entry) => entry.operation === 'post_message'
      ? {
        ...entry,
        gateDecision: gateDecision('post_message', SLACK_EVENT_SCOPE, {
          decision: 'allow',
          reason: 'manual_control_allowed',
        }),
      }
      : entry);

    expect(evaluateMessagingLiveDeliveryOperationsImplementationManifest(readyInput({
      operationPlan: liveGateAllowed,
    }))).toMatchObject({
      status: 'blocked',
      reason: 'operation_plan_invalid',
    });

    expect(evaluateMessagingLiveDeliveryOperationsImplementationManifest(readyInput({
      operationPlan: [{
        ...operationPlan()[0],
        gateDecision: {
          ...operationPlan()[0].gateDecision,
          willCallWebhook: true,
        } as never,
      }],
    }))).toMatchObject({
      status: 'blocked',
      reason: 'forged_executable_claim',
      mayCallWebhook: false,
      mayPostMessage: false,
    });

    expect(evaluateMessagingLiveDeliveryOperationsImplementationManifest(readyInput({
      operationPlan: [{
        ...operationPlan()[0],
        gateDecision: {
          ...operationPlan()[0].gateDecision,
          willCallSlackApi: true,
        } as never,
      }],
    }))).toMatchObject({
      status: 'blocked',
      reason: 'forged_executable_claim',
    });

    expect(evaluateMessagingLiveDeliveryOperationsImplementationManifest(readyInput({
      target: {
        ...target(),
        content: 'message body must not enter this manifest',
      },
    }))).toMatchObject({
      status: 'blocked',
      reason: 'raw_secret_material',
    });
  });

  it('binds credential, target, and runtime provenance while blocking token-shaped target identifiers', () => {
    expect(evaluateMessagingLiveDeliveryOperationsImplementationManifest(readyInput({
      credentialReference: credentialReference({ providerId: WEBHOOK_CONNECTOR_KIND }),
    }))).toMatchObject({
      status: 'blocked',
      reason: 'credential_owner_invalid',
    });

    expect(evaluateMessagingLiveDeliveryOperationsImplementationManifest(readyInput({
      runtimeReadiness: runtimeReadiness({
        credentialReference: credentialReference({ accountId: 'other-workspace' }),
      }),
    }))).toMatchObject({
      status: 'blocked',
      reason: 'runtime_provenance_invalid',
    });

    expect(evaluateMessagingLiveDeliveryOperationsImplementationManifest(readyInput({
      target: {
        ...target(),
        kind: 'webhook-reference',
      },
    }))).toMatchObject({
      status: 'blocked',
      reason: 'target_provenance_invalid',
    });

    const tokenDecision = evaluateMessagingLiveDeliveryOperationsImplementationManifest(readyInput({
      target: {
        ...target(),
        id: 'xoxb-do-not-echo-this-manifest-token',
      },
    }));
    const serialized = JSON.stringify(tokenDecision);

    expect(tokenDecision).toMatchObject({
      status: 'blocked',
      reason: 'raw_secret_material',
    });
    expect(serialized).not.toContain('xoxb-do-not-echo-this-manifest-token');
    expect(serialized).not.toContain('slack-channel-case-alerts');
  });

  it('supports generic webhook provenance as a manifest-only no-auto-post plan', () => {
    const webhookCredential = credentialReference({ providerId: WEBHOOK_CONNECTOR_KIND });
    const decision = evaluateMessagingLiveDeliveryOperationsImplementationManifest(readyInput({
      connectorKind: WEBHOOK_CONNECTOR_KIND,
      eventScope: WEBHOOK_EVENT_SCOPE,
      credentialReference: webhookCredential,
      target: target(WEBHOOK_CONNECTOR_KIND, WEBHOOK_EVENT_SCOPE),
      runtimeReadiness: runtimeReadiness({
        status: 'no-auto-post-safe',
        readyForExplicitUserTest: false,
        connectorKind: WEBHOOK_CONNECTOR_KIND,
        eventScope: WEBHOOK_EVENT_SCOPE,
        credentialReference: webhookCredential,
      }),
      operationPlan: operationPlan(WEBHOOK_EVENT_SCOPE),
    }));

    expect(decision).toMatchObject({
      status: 'implementation-manifest-ready',
      reason: 'implementation_manifest_ready',
      manifest: {
        connectorKind: WEBHOOK_CONNECTOR_KIND,
        eventScope: WEBHOOK_EVENT_SCOPE,
        target: {
          kind: 'webhook-reference',
          id: 'webhook-reference-case-alerts',
          connectorKind: WEBHOOK_CONNECTOR_KIND,
          eventScope: WEBHOOK_EVENT_SCOPE,
        },
      },
      mayCallWebhook: false,
      mayFetch: false,
      mayDeliverWebhook: false,
      sideEffects: 'none',
    });
  });

  it('rejects mixed Slack/webhook provenance and extra payload metadata', () => {
    expect(evaluateMessagingLiveDeliveryOperationsImplementationManifest(readyInput({
      connectorKind: WEBHOOK_CONNECTOR_KIND,
      eventScope: WEBHOOK_EVENT_SCOPE,
      credentialReference: credentialReference({ providerId: WEBHOOK_CONNECTOR_KIND }),
      runtimeReadiness: runtimeReadiness({
        status: 'no-auto-post-safe',
        readyForExplicitUserTest: false,
        connectorKind: WEBHOOK_CONNECTOR_KIND,
        eventScope: WEBHOOK_EVENT_SCOPE,
        credentialReference: credentialReference({ providerId: WEBHOOK_CONNECTOR_KIND }),
      }),
      operationPlan: operationPlan(WEBHOOK_EVENT_SCOPE),
      target: {
        ...target(WEBHOOK_CONNECTOR_KIND, WEBHOOK_EVENT_SCOPE),
        connectorKind: SLACK_CONNECTOR_KIND,
      },
    } as never))).toMatchObject({
      status: 'blocked',
      reason: 'target_provenance_invalid',
    });

    expect(evaluateMessagingLiveDeliveryOperationsImplementationManifest(readyInput({
      operationPlan: [{
        ...operationPlan()[0],
        gateDecision: {
          ...operationPlan()[0].gateDecision,
          safeDetails: 'content: hidden message body',
        } as never,
      }],
    }))).toMatchObject({
      status: 'blocked',
      reason: 'raw_secret_material',
    });

    expect(evaluateMessagingLiveDeliveryOperationsImplementationManifest(readyInput({
      operationPlan: [{
        ...operationPlan()[0],
        willCallSlackApi: true,
      } as never],
    }))).toMatchObject({
      status: 'blocked',
      reason: 'forged_executable_claim',
    });
  });

  it('rejects forbidden write paths while preserving no-network/no-storage/no-send invariants', () => {
    const fetchSpy = vi.fn();
    const websocketSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    vi.stubGlobal('WebSocket', websocketSpy);
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem');
    const keySpy = vi.spyOn(Storage.prototype, 'key');
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    const removeItemSpy = vi.spyOn(Storage.prototype, 'removeItem');
    const clearSpy = vi.spyOn(Storage.prototype, 'clear');

    const decision = evaluateMessagingLiveDeliveryOperationsImplementationManifest(readyInput({
      futureWriteSet: Object.freeze([
        ...MESSAGING_LIVE_DELIVERY_OPERATIONS_IMPLEMENTATION_MANIFEST_EXACT_WRITE_SET,
        'src/components/CaddyAssistant/CadEmailWorkspace.tsx',
      ]),
    }));

    expect(decision).toMatchObject({
      status: 'blocked',
      reason: 'future_write_set_invalid',
      mayImportSlackSdk: false,
      mayCallSlackApi: false,
      mayCallWebhook: false,
      mayFetch: false,
      mayOpenSocket: false,
      mayStoreCredential: false,
      mayPostMessage: false,
      mayPostThreadReply: false,
      mayDeliverWebhook: false,
      mayModifySchema: false,
      mayExportOrBackup: false,
      willPromoteStandalone: false,
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(websocketSpy).not.toHaveBeenCalled();
    expect(getItemSpy).not.toHaveBeenCalled();
    expect(keySpy).not.toHaveBeenCalled();
    expect(setItemSpy).not.toHaveBeenCalled();
    expect(removeItemSpy).not.toHaveBeenCalled();
    expect(clearSpy).not.toHaveBeenCalled();
  });
});
