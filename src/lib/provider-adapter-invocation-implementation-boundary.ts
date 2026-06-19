import { hasConnectorSecretMaterial } from './connector-credential-boundary';
import type { ProviderAdapterExecutionBoundaryDecision } from './provider-adapter-execution-boundary';
import {
  createRuntimeTrustedContractObject,
  isRuntimeTrustedContractObject,
  type RuntimeTrustedContractEntry,
  type RuntimeTrustedContractObject,
} from './runtime-trusted-contract-object';

export type ProviderAdapterInvocationImplementationStatus = 'ready' | 'blocked';

export type ProviderAdapterInvocationImplementationReason =
  | 'provider_adapter_invocation_implementation_ready'
  | 'raw_secret_material'
  | 'input_shape_forbidden'
  | 'unsafe_input_field'
  | 'prompt_or_payload_echo_forbidden'
  | 'execution_boundary_missing'
  | 'execution_boundary_blocked'
  | 'execution_boundary_invalid'
  | 'execution_boundary_shape_forbidden'
  | 'adapter_fact_missing'
  | 'adapter_fact_invalid'
  | 'adapter_fact_executable'
  | 'adapter_fact_owner_mismatch'
  | 'invocation_plan_missing'
  | 'invocation_plan_invalid'
  | 'invocation_plan_executable'
  | 'invocation_plan_owner_mismatch'
  | 'executable_adapter_contract_missing'
  | 'executable_adapter_contract_invalid'
  | 'executable_adapter_contract_unsafe_field'
  | 'executable_adapter_contract_executable'
  | 'executable_adapter_contract_owner_mismatch'
  | 'adapter_result_forbidden'
  | 'adapter_result_live_claim'
  | 'identifier_unsafe';

export type ProviderAdapterInvocationAction = 'auth.preview' | 'mail.sync.preview' | 'mail.send.preview';

export interface ProviderAdapterInvocationImplementationAdapterFact {
  schemaVersion: 1;
  factKind: 'future-provider-adapter-invocation-fact';
  runtimeOwner: 'provider-adapter-invocation-implementation-boundary';
  providerId: string;
  connectorId: string;
  accountId?: string;
  actionId: string;
  adapterId: string;
  adapterVersion: string;
  supportedInvocationActions: readonly ProviderAdapterInvocationAction[];
  implementationBoundary: 'plan-only-no-provider-sdk-no-fetch-no-socket-no-storage-no-oauth-no-window-no-credential-resolution-no-adapter-call';
  executable: false;
  importsProviderSdk: false;
  willFetch: false;
  willOpenSocket: false;
  willMutateStorage: false;
  willResolveCredential: false;
  willOpenWindow: false;
  willInvokeAdapter: false;
}

export interface ProviderAdapterInvocationImplementationPlan {
  schemaVersion: 1;
  planKind: 'future-provider-adapter-invocation-plan';
  runtimeOwner: 'provider-adapter-invocation-implementation-boundary';
  providerId: string;
  connectorId: string;
  accountId?: string;
  actionId: string;
  adapterId: string;
  adapterVersion: string;
  credentialReferenceId: string;
  consentGrantId: string;
  invocationAction: ProviderAdapterInvocationAction;
  reviewed: true;
  acknowledgedNoProviderSdk: true;
  acknowledgedNoNetwork: true;
  acknowledgedNoStorage: true;
  acknowledgedNoCredentialResolution: true;
  acknowledgedNoOAuthWindow: true;
  acknowledgedNoAdapterInvocation: true;
}

export interface ProviderAdapterInvocationImplementationExecutableAdapterContract {
  schemaVersion: 1;
  contractKind: 'reviewed-injected-provider-adapter-executable-contract';
  runtimeOwner: 'provider-adapter-invocation-implementation-boundary';
  providerId: string;
  connectorId: string;
  accountId?: string;
  actionId: string;
  adapterId: string;
  adapterVersion: string;
  credentialReferenceId: string;
  consentGrantId: string;
  invocationAction: ProviderAdapterInvocationAction;
  adapterInterface: 'injected-adapter-metadata-only';
  reviewed: true;
  acknowledgedExecutionBoundary: true;
  acknowledgedNoProviderSdk: true;
  acknowledgedNoNetwork: true;
  acknowledgedNoStorage: true;
  acknowledgedNoCredentialResolution: true;
  acknowledgedNoOAuthWindow: true;
  acknowledgedNoAdapterInvocation: true;
  executable: false;
  willCallProvider: false;
  willFetch: false;
  willOpenSocket: false;
  willMutateStorage: false;
  willResolveCredential: false;
  willOpenWindow: false;
  willInvokeAdapter: false;
  adapterCalled: false;
  sideEffects: 'none';
  contractBoundary: 'reviewed-injected-provider-adapter-executable-contract-metadata-only-no-provider-sdk-no-fetch-no-socket-no-storage-no-oauth-no-window-no-secret-resolution-no-adapter-call';
}

export interface ProviderAdapterInvocationImplementationInput {
  executionBoundary?: unknown;
  adapterFact?: unknown;
  invocationPlan?: unknown;
  executableAdapterContract?: unknown;
  adapterResult?: unknown;
}

export interface ProviderAdapterInvocationImplementationDecision {
  status: ProviderAdapterInvocationImplementationStatus;
  ready: boolean;
  reason: ProviderAdapterInvocationImplementationReason;
  blockers: readonly ProviderAdapterInvocationImplementationReason[];
  implementationContract: 'provider-adapter-invocation-implementation-boundary-v1';
  adapter?: {
    id: string;
    version: string;
  };
  owner?: {
    providerId: string;
    connectorId: string;
    actionId: string;
    accountId?: string;
  };
  credentialReference?: {
    id: string;
  };
  consentGrantId?: string;
  invocationAction?: ProviderAdapterInvocationAction;
  executableAdapterContract?: {
    id: string;
    version: string;
    invocationAction: ProviderAdapterInvocationAction;
  };
  implementationBoundaryReady: boolean;
  canPrepareFutureProviderAdapterInvocation: boolean;
  requiresReviewedExecutableAdapterContract: true;
  executableAdapterContractAccepted: boolean;
  mayInvokeInjectedAdapterNow: false;
  requestRedaction: 'request-omitted';
  bodyRedaction: 'body-omitted';
  headersRedaction: 'headers-omitted';
  adapterResultRedaction: 'adapter-result-omitted';
  executable: false;
  importsProviderSdk: false;
  willFetch: false;
  willOpenSocket: false;
  willMutateStorage: false;
  willResolveCredential: false;
  willOpenWindow: false;
  willInvokeAdapter: false;
  adapterCalled: false;
  sideEffectBoundary: 'provider-adapter-invocation-implementation-boundary-plan-only-no-provider-sdk-no-fetch-no-socket-no-storage-no-oauth-no-window-no-credential-resolution-no-adapter-call';
}

const IMPLEMENTATION_BOUNDARY =
  'plan-only-no-provider-sdk-no-fetch-no-socket-no-storage-no-oauth-no-window-no-credential-resolution-no-adapter-call' as const;

const DECISION_BOUNDARY =
  'provider-adapter-invocation-implementation-boundary-plan-only-no-provider-sdk-no-fetch-no-socket-no-storage-no-oauth-no-window-no-credential-resolution-no-adapter-call' as const;

const EXECUTION_BOUNDARY =
  'provider-adapter-execution-boundary-decision-only-no-fetch-no-socket-no-storage-no-provider-sdk-no-oauth-no-window-no-secret-resolution-no-adapter-call' as const;

const EXECUTABLE_ADAPTER_CONTRACT_BOUNDARY =
  'reviewed-injected-provider-adapter-executable-contract-metadata-only-no-provider-sdk-no-fetch-no-socket-no-storage-no-oauth-no-window-no-secret-resolution-no-adapter-call' as const;

const SAFE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:@/+~-]{1,179}$/;
const TOKEN_OR_URL_PATTERN =
  /(?:https?:\/\/|wss?:\/\/|(?:^|[/:@])hooks\.slack(?:-gov)?\.com\/services\/|(?:^|[/:@])(?:api|auth|oauth|login|graph|mail|smtp|imap|accounts|webhook|hooks)\.[a-z0-9.-]+\.[a-z]{2,}\/|xox[abprs]-|bearer\s+[a-z0-9._~+/=-]{8,}|(?:api|app|bot|client|refresh|access)[_-]?(?:key|token|secret)[=:]\s*\S+|-----BEGIN (?:RSA |EC |OPENSSH |)PRIVATE KEY-----)/i;
const VAULT_CREDENTIAL_REFERENCE_PATTERN = /^vault:[A-Za-z0-9][A-Za-z0-9._:@/+~-]{1,179}$/;
const URL_LIKE_IDENTIFIER_PATTERNS = [
  /^[a-z][a-z0-9+.-]*:/i,
  /^\/\//,
  /^(?:localhost|(?:\d{1,3}\.){3}\d{1,3}|\[?::1\]?)(?::\d+)?\//i,
  /^[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+(?::\d+)?\/\S+/,
] as const;
const PROMPT_OR_PAYLOAD_ECHO_TEXT_PATTERN =
  /\b(?:prompt|body|headers?|payload|request|response|message|messages|content)\s*[:=]/i;

const INVOCATION_ACTIONS = new Set<ProviderAdapterInvocationAction>([
  'auth.preview',
  'mail.sync.preview',
  'mail.send.preview',
]);

const INPUT_KEYS = new Set([
  'executionBoundary',
  'adapterFact',
  'invocationPlan',
  'executableAdapterContract',
  'adapterResult',
]);

const EXECUTION_BOUNDARY_KEYS = new Set([
  'status',
  'allowed',
  'reason',
  'blockReasons',
  'dryRunId',
  'adapter',
  'owner',
  'credentialReference',
  'authAction',
  'consentGrantId',
  'mayInvokeInjectedAdapter',
  'adapterCalled',
  'executable',
  'willCallProvider',
  'willResolveCredential',
  'willOpenWindow',
  'sideEffects',
  'sideEffectBoundary',
]);

const EXECUTION_ADAPTER_KEYS = new Set(['id', 'version']);
const EXECUTION_OWNER_KEYS = new Set([
  'surface',
  'targetSurface',
  'providerId',
  'connectorId',
  'actionId',
  'accountId',
]);
const EXECUTION_CREDENTIAL_REFERENCE_KEYS = new Set([
  'id',
  'kind',
  'storageOwner',
  'providerId',
  'connectorId',
  'accountId',
]);

const ADAPTER_FACT_KEYS = new Set([
  'schemaVersion',
  'factKind',
  'runtimeOwner',
  'providerId',
  'connectorId',
  'accountId',
  'actionId',
  'adapterId',
  'adapterVersion',
  'supportedInvocationActions',
  'implementationBoundary',
  'executable',
  'importsProviderSdk',
  'willFetch',
  'willOpenSocket',
  'willMutateStorage',
  'willResolveCredential',
  'willOpenWindow',
  'willInvokeAdapter',
]);

const PLAN_KEYS = new Set([
  'schemaVersion',
  'planKind',
  'runtimeOwner',
  'providerId',
  'connectorId',
  'accountId',
  'actionId',
  'adapterId',
  'adapterVersion',
  'credentialReferenceId',
  'consentGrantId',
  'invocationAction',
  'reviewed',
  'acknowledgedNoProviderSdk',
  'acknowledgedNoNetwork',
  'acknowledgedNoStorage',
  'acknowledgedNoCredentialResolution',
  'acknowledgedNoOAuthWindow',
  'acknowledgedNoAdapterInvocation',
]);

const EXECUTABLE_ADAPTER_CONTRACT_KEYS = new Set([
  'schemaVersion',
  'contractKind',
  'runtimeOwner',
  'providerId',
  'connectorId',
  'accountId',
  'actionId',
  'adapterId',
  'adapterVersion',
  'credentialReferenceId',
  'consentGrantId',
  'invocationAction',
  'adapterInterface',
  'reviewed',
  'acknowledgedExecutionBoundary',
  'acknowledgedNoProviderSdk',
  'acknowledgedNoNetwork',
  'acknowledgedNoStorage',
  'acknowledgedNoCredentialResolution',
  'acknowledgedNoOAuthWindow',
  'acknowledgedNoAdapterInvocation',
  'executable',
  'willCallProvider',
  'willFetch',
  'willOpenSocket',
  'willMutateStorage',
  'willResolveCredential',
  'willOpenWindow',
  'willInvokeAdapter',
  'adapterCalled',
  'sideEffects',
  'contractBoundary',
]);

const UNSAFE_INPUT_FIELD_PATTERNS = [
  /adapter/i,
  /body/i,
  /callback/i,
  /content/i,
  /execute/i,
  /executable/i,
  /fetch/i,
  /headers?/i,
  /httpclient/i,
  /indexeddb/i,
  /invoke/i,
  /liveaction/i,
  /liveexecution/i,
  /localstorage/i,
  /oauth/i,
  /onresult/i,
  /prompt/i,
  /provider/i,
  /providerresult/i,
  /request/i,
  /requester/i,
  /response/i,
  /send/i,
  /socket/i,
  /storage/i,
  /sync/i,
  /transport/i,
  /websocket/i,
  /xhr/i,
] as const;

const PAYLOAD_ECHO_KEYS = new Set([
  'authorization',
  'body',
  'content',
  'headers',
  'message',
  'messages',
  'payload',
  'prompt',
  'providerrequest',
  'providerresponse',
  'rawbody',
  'rawheaders',
  'rawpayload',
  'request',
  'requestbody',
  'requestheaders',
  'response',
  'responsebody',
  'responseheaders',
  'systemprompt',
]);

function trustedContractObject<T>(
  entries: readonly (readonly [key: string, value: unknown])[],
): RuntimeTrustedContractObject & Readonly<T> {
  return createRuntimeTrustedContractObject(
    entries as readonly RuntimeTrustedContractEntry[],
  ) as RuntimeTrustedContractObject & Readonly<T>;
}

function isTrustedRecord(value: unknown): value is Record<string, unknown> {
  return isRuntimeTrustedContractObject(value);
}

function safeIdentifier(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!SAFE_ID_PATTERN.test(trimmed) || TOKEN_OR_URL_PATTERN.test(trimmed)) return undefined;
  if (!VAULT_CREDENTIAL_REFERENCE_PATTERN.test(trimmed) && URL_LIKE_IDENTIFIER_PATTERNS.some((pattern) => pattern.test(trimmed))) {
    return undefined;
  }
  return trimmed;
}

function unsafeIdentifier(value: unknown): boolean {
  return value !== undefined && safeIdentifier(value) === undefined;
}

function hasOnlyKeys(value: Record<string, unknown>, allowedKeys: ReadonlySet<string>): boolean {
  return Object.keys(value).every((key) => allowedKeys.has(key));
}

function objectHasUnsafeInputField(value: Record<string, unknown>, allowedKeys: ReadonlySet<string>): boolean {
  return Object.keys(value).some((key) => (
    !allowedKeys.has(key)
    && UNSAFE_INPUT_FIELD_PATTERNS.some((pattern) => pattern.test(key))
  ));
}

function valueHasPromptOrPayloadEcho(
  value: unknown,
  seen = new WeakSet<object>(),
  currentKey?: string,
): boolean {
  if (currentKey) {
    const normalizedKey = currentKey.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (PAYLOAD_ECHO_KEYS.has(normalizedKey)) return true;
  }
  if (typeof value === 'string') return PROMPT_OR_PAYLOAD_ECHO_TEXT_PATTERN.test(value);
  if (value === null || value === undefined) return false;
  if (typeof value === 'function') return false;
  if (typeof value !== 'object') return false;
  if (seen.has(value)) return false;
  seen.add(value);

  if (Array.isArray(value)) return value.some((item) => valueHasPromptOrPayloadEcho(item, seen));
  if (value instanceof Map) {
    for (const [key, nestedValue] of value.entries()) {
      if (valueHasPromptOrPayloadEcho(nestedValue, seen, typeof key === 'string' ? key : undefined)) {
        return true;
      }
    }
    return false;
  }
  if (value instanceof Set) {
    for (const nestedValue of value.values()) {
      if (valueHasPromptOrPayloadEcho(nestedValue, seen)) return true;
    }
    return false;
  }

  return Object.entries(value).some(([key, nestedValue]) => (
    valueHasPromptOrPayloadEcho(nestedValue, seen, key)
  ));
}

function safeInvocationAction(value: unknown): ProviderAdapterInvocationAction | undefined {
  return typeof value === 'string' && INVOCATION_ACTIONS.has(value as ProviderAdapterInvocationAction)
    ? value as ProviderAdapterInvocationAction
    : undefined;
}

function parseAdapterFact(value: unknown): ProviderAdapterInvocationImplementationAdapterFact | undefined {
  if (!isTrustedRecord(value) || !hasOnlyKeys(value, ADAPTER_FACT_KEYS)) return undefined;
  const providerId = safeIdentifier(value.providerId);
  const connectorId = safeIdentifier(value.connectorId);
  const accountId = safeIdentifier(value.accountId);
  const actionId = safeIdentifier(value.actionId);
  const adapterId = safeIdentifier(value.adapterId);
  const adapterVersion = safeIdentifier(value.adapterVersion);
  const supportedInvocationActions = Array.isArray(value.supportedInvocationActions)
    ? value.supportedInvocationActions.map(safeInvocationAction)
    : [];

  if (
    value.schemaVersion !== 1
    || value.factKind !== 'future-provider-adapter-invocation-fact'
    || value.runtimeOwner !== 'provider-adapter-invocation-implementation-boundary'
    || !providerId
    || !connectorId
    || !actionId
    || !adapterId
    || !adapterVersion
    || supportedInvocationActions.length === 0
    || supportedInvocationActions.some((action) => !action)
    || value.implementationBoundary !== IMPLEMENTATION_BOUNDARY
  ) {
    return undefined;
  }
  if (value.accountId !== undefined && !accountId) return undefined;

  return trustedContractObject<ProviderAdapterInvocationImplementationAdapterFact>([
    ['schemaVersion', 1],
    ['factKind', 'future-provider-adapter-invocation-fact'],
    ['runtimeOwner', 'provider-adapter-invocation-implementation-boundary'],
    ['providerId', providerId],
    ['connectorId', connectorId],
    ['accountId', accountId],
    ['actionId', actionId],
    ['adapterId', adapterId],
    ['adapterVersion', adapterVersion],
    ['supportedInvocationActions', supportedInvocationActions as ProviderAdapterInvocationAction[]],
    ['implementationBoundary', IMPLEMENTATION_BOUNDARY],
    ['executable', value.executable],
    ['importsProviderSdk', value.importsProviderSdk],
    ['willFetch', value.willFetch],
    ['willOpenSocket', value.willOpenSocket],
    ['willMutateStorage', value.willMutateStorage],
    ['willResolveCredential', value.willResolveCredential],
    ['willOpenWindow', value.willOpenWindow],
    ['willInvokeAdapter', value.willInvokeAdapter],
  ]);
}

function parseInvocationPlan(value: unknown): ProviderAdapterInvocationImplementationPlan | undefined {
  if (!isTrustedRecord(value) || !hasOnlyKeys(value, PLAN_KEYS)) return undefined;
  const providerId = safeIdentifier(value.providerId);
  const connectorId = safeIdentifier(value.connectorId);
  const accountId = safeIdentifier(value.accountId);
  const actionId = safeIdentifier(value.actionId);
  const adapterId = safeIdentifier(value.adapterId);
  const adapterVersion = safeIdentifier(value.adapterVersion);
  const credentialReferenceId = safeIdentifier(value.credentialReferenceId);
  const consentGrantId = safeIdentifier(value.consentGrantId);
  const invocationAction = safeInvocationAction(value.invocationAction);

  if (
    value.schemaVersion !== 1
    || value.planKind !== 'future-provider-adapter-invocation-plan'
    || value.runtimeOwner !== 'provider-adapter-invocation-implementation-boundary'
    || !providerId
    || !connectorId
    || !actionId
    || !adapterId
    || !adapterVersion
    || !credentialReferenceId
    || !consentGrantId
    || !invocationAction
    || value.reviewed !== true
  ) {
    return undefined;
  }
  if (value.accountId !== undefined && !accountId) return undefined;

  return trustedContractObject<ProviderAdapterInvocationImplementationPlan>([
    ['schemaVersion', 1],
    ['planKind', 'future-provider-adapter-invocation-plan'],
    ['runtimeOwner', 'provider-adapter-invocation-implementation-boundary'],
    ['providerId', providerId],
    ['connectorId', connectorId],
    ['accountId', accountId],
    ['actionId', actionId],
    ['adapterId', adapterId],
    ['adapterVersion', adapterVersion],
    ['credentialReferenceId', credentialReferenceId],
    ['consentGrantId', consentGrantId],
    ['invocationAction', invocationAction],
    ['reviewed', true],
    ['acknowledgedNoProviderSdk', value.acknowledgedNoProviderSdk],
    ['acknowledgedNoNetwork', value.acknowledgedNoNetwork],
    ['acknowledgedNoStorage', value.acknowledgedNoStorage],
    ['acknowledgedNoCredentialResolution', value.acknowledgedNoCredentialResolution],
    ['acknowledgedNoOAuthWindow', value.acknowledgedNoOAuthWindow],
    ['acknowledgedNoAdapterInvocation', value.acknowledgedNoAdapterInvocation],
  ]);
}

function parseExecutableAdapterContract(
  value: unknown,
): ProviderAdapterInvocationImplementationExecutableAdapterContract | undefined {
  if (!isTrustedRecord(value) || !hasOnlyKeys(value, EXECUTABLE_ADAPTER_CONTRACT_KEYS)) return undefined;
  const providerId = safeIdentifier(value.providerId);
  const connectorId = safeIdentifier(value.connectorId);
  const accountId = safeIdentifier(value.accountId);
  const actionId = safeIdentifier(value.actionId);
  const adapterId = safeIdentifier(value.adapterId);
  const adapterVersion = safeIdentifier(value.adapterVersion);
  const credentialReferenceId = safeIdentifier(value.credentialReferenceId);
  const consentGrantId = safeIdentifier(value.consentGrantId);
  const invocationAction = safeInvocationAction(value.invocationAction);

  if (
    value.schemaVersion !== 1
    || value.contractKind !== 'reviewed-injected-provider-adapter-executable-contract'
    || value.runtimeOwner !== 'provider-adapter-invocation-implementation-boundary'
    || !providerId
    || !connectorId
    || !actionId
    || !adapterId
    || !adapterVersion
    || !credentialReferenceId
    || !consentGrantId
    || !invocationAction
    || value.adapterInterface !== 'injected-adapter-metadata-only'
    || value.contractBoundary !== EXECUTABLE_ADAPTER_CONTRACT_BOUNDARY
  ) {
    return undefined;
  }
  if (value.accountId !== undefined && !accountId) return undefined;

  return trustedContractObject<ProviderAdapterInvocationImplementationExecutableAdapterContract>([
    ['schemaVersion', 1],
    ['contractKind', 'reviewed-injected-provider-adapter-executable-contract'],
    ['runtimeOwner', 'provider-adapter-invocation-implementation-boundary'],
    ['providerId', providerId],
    ['connectorId', connectorId],
    ['accountId', accountId],
    ['actionId', actionId],
    ['adapterId', adapterId],
    ['adapterVersion', adapterVersion],
    ['credentialReferenceId', credentialReferenceId],
    ['consentGrantId', consentGrantId],
    ['invocationAction', invocationAction],
    ['adapterInterface', 'injected-adapter-metadata-only'],
    ['reviewed', value.reviewed],
    ['acknowledgedExecutionBoundary', value.acknowledgedExecutionBoundary],
    ['acknowledgedNoProviderSdk', value.acknowledgedNoProviderSdk],
    ['acknowledgedNoNetwork', value.acknowledgedNoNetwork],
    ['acknowledgedNoStorage', value.acknowledgedNoStorage],
    ['acknowledgedNoCredentialResolution', value.acknowledgedNoCredentialResolution],
    ['acknowledgedNoOAuthWindow', value.acknowledgedNoOAuthWindow],
    ['acknowledgedNoAdapterInvocation', value.acknowledgedNoAdapterInvocation],
    ['executable', value.executable],
    ['willCallProvider', value.willCallProvider],
    ['willFetch', value.willFetch],
    ['willOpenSocket', value.willOpenSocket],
    ['willMutateStorage', value.willMutateStorage],
    ['willResolveCredential', value.willResolveCredential],
    ['willOpenWindow', value.willOpenWindow],
    ['willInvokeAdapter', value.willInvokeAdapter],
    ['adapterCalled', value.adapterCalled],
    ['sideEffects', value.sideEffects],
    ['contractBoundary', EXECUTABLE_ADAPTER_CONTRACT_BOUNDARY],
  ]);
}

function executionBoundaryIsReady(decision: ProviderAdapterExecutionBoundaryDecision): boolean {
  return decision.status === 'allow'
    && decision.allowed === true
    && decision.reason === 'provider_adapter_execution_boundary_ready'
    && decision.mayInvokeInjectedAdapter === true
    && decision.blockReasons.length === 0
    && decision.executable === false
    && decision.adapterCalled === false
    && decision.willCallProvider === false
    && decision.willResolveCredential === false
    && decision.willOpenWindow === false
    && decision.sideEffects === 'none'
    && decision.sideEffectBoundary === EXECUTION_BOUNDARY
    && decision.adapter !== undefined
    && decision.owner !== undefined
    && decision.credentialReference !== undefined
    && decision.consentGrantId !== undefined;
}

function executionBoundaryShapeIsExact(decision: unknown): decision is ProviderAdapterExecutionBoundaryDecision {
  if (!isTrustedRecord(decision) || !hasOnlyKeys(decision, EXECUTION_BOUNDARY_KEYS)) return false;
  const adapter = decision.adapter;
  const owner = decision.owner;
  const credentialReference = decision.credentialReference;
  return Array.isArray(decision.blockReasons)
    && (adapter === undefined || (isTrustedRecord(adapter) && hasOnlyKeys(adapter, EXECUTION_ADAPTER_KEYS)))
    && (owner === undefined || (isTrustedRecord(owner) && hasOnlyKeys(owner, EXECUTION_OWNER_KEYS)))
    && (
      credentialReference === undefined
      || (
        isTrustedRecord(credentialReference)
        && hasOnlyKeys(credentialReference, EXECUTION_CREDENTIAL_REFERENCE_KEYS)
      )
    );
}

function adapterFactIsInert(fact: ProviderAdapterInvocationImplementationAdapterFact): boolean {
  return fact.executable === false
    && fact.importsProviderSdk === false
    && fact.willFetch === false
    && fact.willOpenSocket === false
    && fact.willMutateStorage === false
    && fact.willResolveCredential === false
    && fact.willOpenWindow === false
    && fact.willInvokeAdapter === false;
}

function invocationPlanIsInert(plan: ProviderAdapterInvocationImplementationPlan): boolean {
  return plan.reviewed === true
    && plan.acknowledgedNoProviderSdk === true
    && plan.acknowledgedNoNetwork === true
    && plan.acknowledgedNoStorage === true
    && plan.acknowledgedNoCredentialResolution === true
    && plan.acknowledgedNoOAuthWindow === true
    && plan.acknowledgedNoAdapterInvocation === true;
}

function executableAdapterContractIsInert(
  contract: ProviderAdapterInvocationImplementationExecutableAdapterContract,
): boolean {
  return contract.reviewed === true
    && contract.acknowledgedExecutionBoundary === true
    && contract.acknowledgedNoProviderSdk === true
    && contract.acknowledgedNoNetwork === true
    && contract.acknowledgedNoStorage === true
    && contract.acknowledgedNoCredentialResolution === true
    && contract.acknowledgedNoOAuthWindow === true
    && contract.acknowledgedNoAdapterInvocation === true
    && contract.executable === false
    && contract.willCallProvider === false
    && contract.willFetch === false
    && contract.willOpenSocket === false
    && contract.willMutateStorage === false
    && contract.willResolveCredential === false
    && contract.willOpenWindow === false
    && contract.willInvokeAdapter === false
    && contract.adapterCalled === false
    && contract.sideEffects === 'none'
    && contract.contractBoundary === EXECUTABLE_ADAPTER_CONTRACT_BOUNDARY;
}

function matchesExecutionBoundary(
  execution: ProviderAdapterExecutionBoundaryDecision,
  fact: ProviderAdapterInvocationImplementationAdapterFact,
  plan: ProviderAdapterInvocationImplementationPlan,
): boolean {
  const owner = execution.owner;
  const adapter = execution.adapter;
  const credential = execution.credentialReference;
  if (!owner || !adapter || !credential || !execution.consentGrantId) return false;
  if (
    owner.accountId === undefined
    || credential.providerId === undefined
    || credential.connectorId === undefined
    || credential.accountId === undefined
  ) {
    return false;
  }
  const accountIdMatches = fact.accountId === owner.accountId && plan.accountId === owner.accountId;

  return fact.providerId === owner.providerId
    && fact.connectorId === owner.connectorId
    && fact.actionId === owner.actionId
    && fact.adapterId === adapter.id
    && fact.adapterVersion === adapter.version
    && fact.supportedInvocationActions.includes(plan.invocationAction)
    && plan.providerId === owner.providerId
    && plan.connectorId === owner.connectorId
    && plan.actionId === owner.actionId
    && plan.adapterId === adapter.id
    && plan.adapterVersion === adapter.version
    && plan.credentialReferenceId === credential.id
    && plan.consentGrantId === execution.consentGrantId
    && credential.providerId === owner.providerId
    && credential.connectorId === owner.connectorId
    && credential.accountId === owner.accountId
    && accountIdMatches;
}

function matchesExecutableAdapterContract(
  execution: ProviderAdapterExecutionBoundaryDecision,
  fact: ProviderAdapterInvocationImplementationAdapterFact,
  plan: ProviderAdapterInvocationImplementationPlan,
  contract: ProviderAdapterInvocationImplementationExecutableAdapterContract,
): boolean {
  const owner = execution.owner;
  const adapter = execution.adapter;
  const credential = execution.credentialReference;
  if (!owner || !adapter || !credential || !execution.consentGrantId) return false;
  if (
    owner.accountId === undefined
    || credential.providerId === undefined
    || credential.connectorId === undefined
    || credential.accountId === undefined
  ) {
    return false;
  }
  const accountIdMatches = contract.accountId === owner.accountId
    && contract.accountId === fact.accountId
    && contract.accountId === plan.accountId;

  return contract.providerId === owner.providerId
    && contract.providerId === fact.providerId
    && contract.providerId === plan.providerId
    && contract.connectorId === owner.connectorId
    && contract.connectorId === fact.connectorId
    && contract.connectorId === plan.connectorId
    && contract.actionId === owner.actionId
    && contract.actionId === fact.actionId
    && contract.actionId === plan.actionId
    && contract.adapterId === adapter.id
    && contract.adapterId === fact.adapterId
    && contract.adapterId === plan.adapterId
    && contract.adapterVersion === adapter.version
    && contract.adapterVersion === fact.adapterVersion
    && contract.adapterVersion === plan.adapterVersion
    && contract.credentialReferenceId === credential.id
    && contract.credentialReferenceId === plan.credentialReferenceId
    && contract.consentGrantId === execution.consentGrantId
    && contract.consentGrantId === plan.consentGrantId
    && contract.invocationAction === plan.invocationAction
    && fact.supportedInvocationActions.includes(contract.invocationAction)
    && accountIdMatches;
}

function identifiersAreSafe(
  execution?: ProviderAdapterExecutionBoundaryDecision,
  fact?: ProviderAdapterInvocationImplementationAdapterFact,
  plan?: ProviderAdapterInvocationImplementationPlan,
  executableContract?: ProviderAdapterInvocationImplementationExecutableAdapterContract,
): boolean {
  return ![
    execution?.adapter?.id,
    execution?.adapter?.version,
    execution?.owner?.surface,
    execution?.owner?.targetSurface,
    execution?.owner?.providerId,
    execution?.owner?.connectorId,
    execution?.owner?.actionId,
    execution?.owner?.accountId,
    execution?.credentialReference?.id,
    execution?.credentialReference?.kind,
    execution?.credentialReference?.storageOwner,
    execution?.credentialReference?.providerId,
    execution?.credentialReference?.connectorId,
    execution?.credentialReference?.accountId,
    execution?.consentGrantId,
    fact?.providerId,
    fact?.connectorId,
    fact?.accountId,
    fact?.actionId,
    fact?.adapterId,
    fact?.adapterVersion,
    plan?.providerId,
    plan?.connectorId,
    plan?.accountId,
    plan?.actionId,
    plan?.adapterId,
    plan?.adapterVersion,
    plan?.credentialReferenceId,
    plan?.consentGrantId,
    executableContract?.providerId,
    executableContract?.connectorId,
    executableContract?.accountId,
    executableContract?.actionId,
    executableContract?.adapterId,
    executableContract?.adapterVersion,
    executableContract?.credentialReferenceId,
    executableContract?.consentGrantId,
  ].some(unsafeIdentifier);
}

function adapterResultClaimsLiveExecution(value: unknown): boolean {
  if (!isTrustedRecord(value)) return false;
  return value.adapterCalled === true
    || value.calledProvider === true
    || value.dispatched === true
    || value.executed === true
    || value.fetchCalled === true
    || value.invokedAdapter === true
    || value.live === true
    || value.liveExecution === true
    || value.mutatedStorage === true
    || value.openedSocket === true
    || value.providerCalled === true
    || value.sent === true
    || value.socketOpened === true
    || value.stored === true
    || value.willCallProvider === true
    || value.willFetch === true
    || value.willInvokeAdapter === true
    || value.willMutateStorage === true
    || value.willOpenSocket === true
    || value.executable === true;
}

function buildDecision(
  reason: ProviderAdapterInvocationImplementationReason,
  execution?: ProviderAdapterExecutionBoundaryDecision,
  plan?: ProviderAdapterInvocationImplementationPlan,
  executableContract?: ProviderAdapterInvocationImplementationExecutableAdapterContract,
): Readonly<ProviderAdapterInvocationImplementationDecision> {
  const ready = reason === 'provider_adapter_invocation_implementation_ready';
  const adapter = execution?.adapter
    ? trustedContractObject<NonNullable<ProviderAdapterInvocationImplementationDecision['adapter']>>([
        ['id', safeIdentifier(execution.adapter.id) ?? 'redacted-unsafe-adapter'],
        ['version', safeIdentifier(execution.adapter.version) ?? 'redacted-unsafe-version'],
      ])
    : undefined;
  const owner = execution?.owner
    ? trustedContractObject<NonNullable<ProviderAdapterInvocationImplementationDecision['owner']>>([
        ['providerId', safeIdentifier(execution.owner.providerId) ?? 'redacted-unsafe-provider'],
        ['connectorId', safeIdentifier(execution.owner.connectorId) ?? 'redacted-unsafe-connector'],
        ['actionId', safeIdentifier(execution.owner.actionId) ?? 'redacted-unsafe-action'],
        ['accountId', safeIdentifier(execution.owner.accountId)],
      ])
    : undefined;
  const credentialReference = execution?.credentialReference
    ? trustedContractObject<NonNullable<ProviderAdapterInvocationImplementationDecision['credentialReference']>>([
        ['id', safeIdentifier(execution.credentialReference.id) ?? 'redacted-unsafe-credential-reference'],
      ])
    : undefined;
  const executableAdapterContract = executableContract
    ? trustedContractObject<NonNullable<ProviderAdapterInvocationImplementationDecision['executableAdapterContract']>>([
        ['id', safeIdentifier(executableContract.adapterId) ?? 'redacted-unsafe-adapter'],
        ['version', safeIdentifier(executableContract.adapterVersion) ?? 'redacted-unsafe-version'],
        ['invocationAction', executableContract.invocationAction],
      ])
    : undefined;

  return trustedContractObject<ProviderAdapterInvocationImplementationDecision>([
    ['status', ready ? 'ready' : 'blocked'],
    ['ready', ready],
    ['reason', reason],
    ['blockers', ready ? [] : [reason]],
    ['implementationContract', 'provider-adapter-invocation-implementation-boundary-v1'],
    ['adapter', adapter],
    ['owner', owner],
    ['credentialReference', credentialReference],
    ['consentGrantId', safeIdentifier(execution?.consentGrantId)],
    ['invocationAction', plan?.invocationAction],
    ['executableAdapterContract', executableAdapterContract],
    ['implementationBoundaryReady', ready],
    ['canPrepareFutureProviderAdapterInvocation', ready],
    ['requiresReviewedExecutableAdapterContract', true],
    ['executableAdapterContractAccepted', ready && executableContract !== undefined],
    ['mayInvokeInjectedAdapterNow', false],
    ['requestRedaction', 'request-omitted'],
    ['bodyRedaction', 'body-omitted'],
    ['headersRedaction', 'headers-omitted'],
    ['adapterResultRedaction', 'adapter-result-omitted'],
    ['executable', false],
    ['importsProviderSdk', false],
    ['willFetch', false],
    ['willOpenSocket', false],
    ['willMutateStorage', false],
    ['willResolveCredential', false],
    ['willOpenWindow', false],
    ['willInvokeAdapter', false],
    ['adapterCalled', false],
    ['sideEffectBoundary', DECISION_BOUNDARY],
  ]);
}

export function evaluateProviderAdapterInvocationImplementationBoundary(
  input: ProviderAdapterInvocationImplementationInput = {},
): Readonly<ProviderAdapterInvocationImplementationDecision> {
  if (!isTrustedRecord(input)) return buildDecision('input_shape_forbidden');
  if (objectHasUnsafeInputField(input, INPUT_KEYS)) return buildDecision('unsafe_input_field');
  if (!hasOnlyKeys(input, INPUT_KEYS)) return buildDecision('input_shape_forbidden');
  if (hasConnectorSecretMaterial(input)) return buildDecision('raw_secret_material');
  if (valueHasPromptOrPayloadEcho(input)) return buildDecision('prompt_or_payload_echo_forbidden');

  const execution = input.executionBoundary as ProviderAdapterExecutionBoundaryDecision | undefined;
  if (input.adapterResult !== undefined) {
    return buildDecision(
      adapterResultClaimsLiveExecution(input.adapterResult) ? 'adapter_result_live_claim' : 'adapter_result_forbidden',
    );
  }
  if (!execution) return buildDecision('execution_boundary_missing');
  if (!isTrustedRecord(execution)) return buildDecision('execution_boundary_invalid');
  if (!executionBoundaryShapeIsExact(execution)) return buildDecision('execution_boundary_shape_forbidden');
  if (execution.reason === 'provider_adapter_execution_boundary_ready') {
    return buildDecision('execution_boundary_invalid', execution);
  }
  if (execution.status !== 'allow' || execution.allowed !== true) {
    return buildDecision('execution_boundary_blocked', execution);
  }
  if (!executionBoundaryIsReady(execution)) return buildDecision('execution_boundary_invalid', execution);

  if (!input.adapterFact) return buildDecision('adapter_fact_missing', execution);
  const adapterFact = parseAdapterFact(input.adapterFact);
  if (!adapterFact) return buildDecision('adapter_fact_invalid', execution);
  if (!adapterFactIsInert(adapterFact)) return buildDecision('adapter_fact_executable', execution);

  if (!input.invocationPlan) return buildDecision('invocation_plan_missing', execution);
  const invocationPlan = parseInvocationPlan(input.invocationPlan);
  if (!invocationPlan) return buildDecision('invocation_plan_invalid', execution);
  if (!invocationPlanIsInert(invocationPlan)) {
    return buildDecision('invocation_plan_executable', execution, invocationPlan);
  }

  if (!identifiersAreSafe(execution, adapterFact, invocationPlan)) {
    return buildDecision('identifier_unsafe', execution);
  }
  if (!matchesExecutionBoundary(execution, adapterFact, invocationPlan)) {
    return buildDecision('adapter_fact_owner_mismatch', execution, invocationPlan);
  }

  if (!input.executableAdapterContract) {
    return buildDecision('executable_adapter_contract_missing', execution, invocationPlan);
  }
  if (isTrustedRecord(input.executableAdapterContract)
    && objectHasUnsafeInputField(input.executableAdapterContract, EXECUTABLE_ADAPTER_CONTRACT_KEYS)
  ) {
    return buildDecision('executable_adapter_contract_unsafe_field', execution, invocationPlan);
  }
  const executableContract = parseExecutableAdapterContract(input.executableAdapterContract);
  if (!executableContract) return buildDecision('executable_adapter_contract_invalid', execution, invocationPlan);
  if (!executableAdapterContractIsInert(executableContract)) {
    return buildDecision('executable_adapter_contract_executable', execution, invocationPlan);
  }
  if (!identifiersAreSafe(execution, adapterFact, invocationPlan, executableContract)) {
    return buildDecision('identifier_unsafe', execution, invocationPlan);
  }
  if (!matchesExecutableAdapterContract(execution, adapterFact, invocationPlan, executableContract)) {
    return buildDecision(
      'executable_adapter_contract_owner_mismatch',
      execution,
      invocationPlan,
      executableContract,
    );
  }

  return buildDecision(
    'provider_adapter_invocation_implementation_ready',
    execution,
    invocationPlan,
    executableContract,
  );
}
