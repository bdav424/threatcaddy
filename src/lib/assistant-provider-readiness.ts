import {
  hasConnectorSecretMaterial,
  validateConnectorCredentialReference,
  type ConnectorCredentialReference,
  type ConnectorCredentialReferenceRejectReason,
} from './connector-credential-boundary';
import {
  createLocalBridgeDiscoveryPlan,
  type LocalBridgeDiscoveryPlan,
} from './local-bridge-discovery';

export type AssistantProviderRoute = 'anthropic' | 'openai' | 'gemini' | 'mistral' | 'local';
export type AssistantProviderReadinessStatus =
  | 'configured'
  | 'blocked'
  | 'explicit-user-test-ready'
  | 'unavailable';

export type AssistantProviderBlockReason =
  | 'raw_secret_material'
  | 'missing_provider_route'
  | 'unsupported_provider_route'
  | 'missing_model'
  | 'missing_credential_reference'
  | 'invalid_credential_reference'
  | 'credential_provider_mismatch'
  | 'missing_local_endpoint'
  | 'invalid_local_endpoint'
  | 'missing_explicit_consent'
  | 'ambiguous_provider_state'
  | 'failed_explicit_user_test';

export interface AssistantProviderExplicitUserTestResult {
  status: 'passed' | 'failed';
  route: AssistantProviderRoute;
  model: string;
  credentialReferenceId: string;
  testedAt: number;
  localEndpoint?: string;
}

export interface AssistantProviderReadinessInput {
  provider?: string;
  model?: string;
  credentialReference?: unknown;
  explicitUserTestConsent?: boolean;
  explicitUserTestResult?: AssistantProviderExplicitUserTestResult;
  localEndpointCandidates?: readonly string[];
  caddyAiBaselineConfigured?: boolean;
}

export interface AssistantProviderReadiness {
  status: AssistantProviderReadinessStatus;
  provider?: AssistantProviderRoute;
  model?: string;
  credentialReference?: ConnectorCredentialReference;
  localBridgePlan?: LocalBridgeDiscoveryPlan;
  blockReasons: AssistantProviderBlockReason[];
  credentialRejectReason?: ConnectorCredentialReferenceRejectReason;
  caddyAiBaselineConfigured: boolean;
  sideEffectBoundary: 'metadata-only-no-fetch-no-socket-no-storage-no-llm';
}

const SUPPORTED_PROVIDER_ROUTES = new Set<AssistantProviderRoute>([
  'anthropic',
  'openai',
  'gemini',
  'mistral',
  'local',
]);

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeProvider(value: unknown): AssistantProviderRoute | null {
  const normalized = normalizeText(value).toLowerCase();
  return SUPPORTED_PROVIDER_ROUTES.has(normalized as AssistantProviderRoute)
    ? normalized as AssistantProviderRoute
    : null;
}

function routeOwnsCredential(
  provider: AssistantProviderRoute,
  credentialReference: ConnectorCredentialReference,
): boolean {
  return !credentialReference.providerId || credentialReference.providerId === provider;
}

function testResultMatchesRoute(
  result: AssistantProviderExplicitUserTestResult,
  provider: AssistantProviderRoute,
  model: string,
  credentialReference: ConnectorCredentialReference,
  localEndpoint?: string,
): boolean {
  if (result.route !== provider) return false;
  if (result.model !== model) return false;
  if (result.credentialReferenceId !== credentialReference.id) return false;
  if (provider === 'local' && result.localEndpoint !== localEndpoint) return false;
  return Number.isSafeInteger(result.testedAt) && result.testedAt > 0;
}

export function classifyAssistantProviderReadiness(
  input: AssistantProviderReadinessInput,
): AssistantProviderReadiness {
  const providerText = normalizeText(input.provider);
  const provider = normalizeProvider(providerText);
  const model = normalizeText(input.model);
  const caddyAiBaselineConfigured = input.caddyAiBaselineConfigured === true;
  const blockReasons: AssistantProviderBlockReason[] = [];
  let credentialRejectReason: ConnectorCredentialReferenceRejectReason | undefined;
  let credentialReference: ConnectorCredentialReference | undefined;
  let localBridgePlan: LocalBridgeDiscoveryPlan | undefined;

  if (!providerText && !model && input.credentialReference === undefined) {
    return {
      status: 'unavailable',
      blockReasons,
      caddyAiBaselineConfigured,
      sideEffectBoundary: 'metadata-only-no-fetch-no-socket-no-storage-no-llm',
    };
  }

  if (hasConnectorSecretMaterial(input)) blockReasons.push('raw_secret_material');
  if (!providerText) blockReasons.push('missing_provider_route');
  if (providerText && !provider) blockReasons.push('unsupported_provider_route');
  if (!model) blockReasons.push('missing_model');

  if (input.credentialReference === undefined || input.credentialReference === null) {
    blockReasons.push('missing_credential_reference');
  } else {
    const credentialValidation = validateConnectorCredentialReference(input.credentialReference);
    if (credentialValidation.ok) {
      credentialReference = credentialValidation.reference;
      if (provider && !routeOwnsCredential(provider, credentialReference)) {
        blockReasons.push('credential_provider_mismatch');
      }
    } else {
      credentialRejectReason = credentialValidation.reason;
      blockReasons.push('invalid_credential_reference');
    }
  }

  if (provider === 'local') {
    const candidates = input.localEndpointCandidates?.filter((candidate) => candidate.trim()) ?? [];
    if (candidates.length === 0) {
      blockReasons.push('missing_local_endpoint');
    } else {
      localBridgePlan = createLocalBridgeDiscoveryPlan({
        bridgeKind: 'llm',
        candidates,
        consentGranted: input.explicitUserTestConsent === true,
        defaultProbePath: '/health',
      });
      if (localBridgePlan.acceptedCount === 0) blockReasons.push('invalid_local_endpoint');
      if (localBridgePlan.consentRequired) blockReasons.push('missing_explicit_consent');
    }
  } else if (provider && input.explicitUserTestConsent !== true) {
    blockReasons.push('missing_explicit_consent');
  }

  const firstLocalEndpoint = localBridgePlan?.candidates.find((candidate) => candidate.accepted)?.normalizedEndpoint;
  const testResult = input.explicitUserTestResult;
  if (testResult && (!provider || !credentialReference || !model || !testResultMatchesRoute(
    testResult,
    provider,
    model,
    credentialReference,
    firstLocalEndpoint,
  ))) {
    blockReasons.push('ambiguous_provider_state');
  }
  if (testResult?.status === 'failed') blockReasons.push('failed_explicit_user_test');

  const uniqueBlockReasons = [...new Set(blockReasons)];
  const status: AssistantProviderReadinessStatus = uniqueBlockReasons.length > 0
    ? 'blocked'
    : testResult?.status === 'passed'
      ? 'configured'
      : 'explicit-user-test-ready';

  return {
    status,
    provider: provider ?? undefined,
    model: model || undefined,
    credentialReference,
    localBridgePlan,
    blockReasons: uniqueBlockReasons,
    credentialRejectReason,
    caddyAiBaselineConfigured,
    sideEffectBoundary: 'metadata-only-no-fetch-no-socket-no-storage-no-llm',
  };
}
