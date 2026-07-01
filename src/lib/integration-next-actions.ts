import type {
  IntegrationCatalogProvider,
  IntegrationCatalogProviderNextAction,
  IntegrationCatalogProviderNextActionKind,
  IntegrationCatalogProviderNextActionSurface,
} from '../types/integration-types';

type IntegrationNextActionPlanStatus = 'gated' | 'disabled' | 'rejected';
type IntegrationNextActionPlanKind =
  | 'assistantcaddy-route-reference'
  | 'integration-template-reference'
  | 'provider-catalog-reference';

export interface IntegrationNextActionPlan {
  providerId: string;
  providerName: string;
  actionKind: IntegrationCatalogProviderNextActionKind | 'unknown';
  label: string;
  targetSurface: IntegrationCatalogProviderNextActionSurface | 'unknown';
  targetId: string;
  planKind: IntegrationNextActionPlanKind | 'rejected';
  status: IntegrationNextActionPlanStatus;
  disabledReason?: string;
  gatedReason?: string;
  rejectedReason?: string;
  executable: false;
  sideEffects: 'none';
}

type NextActionTargetMap = Readonly<Record<IntegrationCatalogProviderNextActionSurface, ReadonlySet<string>>>;

const EXPECTED_SURFACE_BY_KIND: Readonly<Record<
  IntegrationCatalogProviderNextActionKind,
  IntegrationCatalogProviderNextActionSurface
>> = Object.freeze({
  'route-only': 'assistantcaddy-route',
  'builtin-template': 'integration-template',
  'future-connector': 'provider-catalog',
});

const PLAN_KIND_BY_ACTION_KIND: Readonly<Record<
  IntegrationCatalogProviderNextActionKind,
  IntegrationNextActionPlanKind
>> = Object.freeze({
  'route-only': 'assistantcaddy-route-reference',
  'builtin-template': 'integration-template-reference',
  'future-connector': 'provider-catalog-reference',
});

const KNOWN_TARGET_IDS_BY_SURFACE: NextActionTargetMap = Object.freeze({
  'assistantcaddy-route': new Set([
    'assistantcaddy-email-setup',
  ]),
  'integration-template': new Set([
    'abuseipdb',
    'alienvault-otx',
    'censys',
    'flashpoint',
    'greynoise',
    'shodan',
    'slack',
    'urlhaus-malwarebazaar',
    'urlscan',
    'virustotal',
  ]),
  'provider-catalog': new Set([
    'alienvault-otx',
    'anomali-threatstream',
    'any-run',
    'cape-cuckoo',
    'cortex-xsoar',
    'cyware',
    'discord',
    'elastic',
    'generic-taxii-stix',
    'generic-webhook',
    'google-secops-chronicle',
    'hybrid-analysis',
    'intezer',
    'joe-sandbox',
    'mattermost',
    'microsoft-sentinel',
    'microsoft-teams',
    'misp',
    'opencti',
    'qradar',
    'recorded-future',
    'servicenow-secops',
    'shuffle',
    'splunk',
    'team-cymru-pure-signal-scout',
    'thehive-cortex',
    'threatconnect',
    'threatquotient',
    'tines',
    'torq',
    'urlscan',
  ]),
});

function isKnownActionKind(value: string): value is IntegrationCatalogProviderNextActionKind {
  return Object.prototype.hasOwnProperty.call(EXPECTED_SURFACE_BY_KIND, value);
}

function isKnownSurface(value: string): value is IntegrationCatalogProviderNextActionSurface {
  return Object.prototype.hasOwnProperty.call(KNOWN_TARGET_IDS_BY_SURFACE, value);
}

function rejectPlan(
  provider: Pick<IntegrationCatalogProvider, 'id' | 'name'>,
  action: Partial<IntegrationCatalogProviderNextAction> | undefined,
  rejectedReason: string,
): IntegrationNextActionPlan {
  return Object.freeze({
    providerId: provider.id,
    providerName: provider.name,
    actionKind: typeof action?.kind === 'string' && isKnownActionKind(action.kind) ? action.kind : 'unknown',
    label: typeof action?.label === 'string' ? action.label : '',
    targetSurface: typeof action?.targetSurface === 'string' && isKnownSurface(action.targetSurface)
      ? action.targetSurface
      : 'unknown',
    targetId: typeof action?.targetId === 'string' ? action.targetId : '',
    planKind: 'rejected',
    status: 'rejected',
    disabledReason: typeof action?.disabledReason === 'string' ? action.disabledReason : undefined,
    gatedReason: typeof action?.gatedReason === 'string' ? action.gatedReason : undefined,
    rejectedReason,
    executable: false,
    sideEffects: 'none',
  });
}

export function isKnownIntegrationNextActionTarget(
  targetSurface: string,
  targetId: string,
): targetSurface is IntegrationCatalogProviderNextActionSurface {
  return isKnownSurface(targetSurface) && KNOWN_TARGET_IDS_BY_SURFACE[targetSurface].has(targetId);
}

export function resolveIntegrationNextActionPlan(
  provider: Pick<IntegrationCatalogProvider, 'id' | 'name' | 'nextAction'>,
): IntegrationNextActionPlan {
  const action = provider.nextAction;

  if (!action) {
    return rejectPlan(provider, undefined, 'Provider does not define nextAction metadata.');
  }

  if (!isKnownActionKind(action.kind)) {
    return rejectPlan(provider, action, `Unknown nextAction kind: ${String(action.kind)}.`);
  }

  if (!isKnownSurface(action.targetSurface)) {
    return rejectPlan(provider, action, `Unknown nextAction target surface: ${String(action.targetSurface)}.`);
  }

  const expectedSurface = EXPECTED_SURFACE_BY_KIND[action.kind];
  if (action.targetSurface !== expectedSurface) {
    return rejectPlan(
      provider,
      action,
      `nextAction kind ${action.kind} must target ${expectedSurface}, not ${action.targetSurface}.`,
    );
  }

  if (!KNOWN_TARGET_IDS_BY_SURFACE[action.targetSurface].has(action.targetId)) {
    return rejectPlan(
      provider,
      action,
      `Unknown nextAction target id for ${action.targetSurface}: ${action.targetId}.`,
    );
  }

  if (action.kind === 'route-only' && !action.gatedReason) {
    return rejectPlan(provider, action, 'Route-only nextAction metadata must include a gatedReason.');
  }

  if (action.kind !== 'route-only' && !action.disabledReason) {
    return rejectPlan(provider, action, `${action.kind} nextAction metadata must include a disabledReason.`);
  }

  return Object.freeze({
    providerId: provider.id,
    providerName: provider.name,
    actionKind: action.kind,
    label: action.label,
    targetSurface: action.targetSurface,
    targetId: action.targetId,
    planKind: PLAN_KIND_BY_ACTION_KIND[action.kind],
    status: action.disabledReason ? 'disabled' : 'gated',
    disabledReason: action.disabledReason,
    gatedReason: action.gatedReason,
    executable: false,
    sideEffects: 'none',
  });
}
