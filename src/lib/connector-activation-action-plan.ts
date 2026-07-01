import {
  resolveConnectorActivationGate,
  type ConnectorActivationDecision,
  type ConnectorActivationGateInput,
} from './connector-activation-gate';
import {
  resolveIntegrationNextActionPlan,
  type IntegrationNextActionPlan,
} from './integration-next-actions';
import type { IntegrationCatalogProviderNextActionSurface } from '../types/integration-types';

export type ConnectorActivationActionPlanKind =
  | 'disabled-descriptor'
  | 'route-descriptor'
  | 'test-plan-descriptor';

export type ConnectorActivationActionPlanStatus =
  | 'blocked'
  | 'disabled'
  | 'gated'
  | 'test-plan-ready';

export interface ConnectorActivationActionPlanBlocker {
  code: string;
  detail: string;
  field?: string;
}

export interface ConnectorActivationActionPlan {
  providerId: string;
  providerName: string;
  actionKind: ConnectorActivationActionPlanKind;
  status: ConnectorActivationActionPlanStatus;
  label: string;
  targetSurface: IntegrationCatalogProviderNextActionSurface | 'unknown';
  targetId: string;
  enabled: boolean;
  executable: false;
  sideEffects: 'none';
  route?: {
    surface: 'assistantcaddy-route';
    id: string;
    label: string;
  };
  testPlan?: {
    connectorId: string;
    providerId: string;
    targetSurface: IntegrationCatalogProviderNextActionSurface | 'unknown';
    targetId: string;
    label: string;
  };
  disabledReason?: string;
  gatedReason?: string;
  blockers: readonly ConnectorActivationActionPlanBlocker[];
}

export interface ConnectorActivationActionPlanDecisionInput {
  nextActionPlan: IntegrationNextActionPlan;
  activationDecision: ConnectorActivationDecision;
}

const BLOCKED_BY_ACTIVATION_GATE =
  'Connector activation gate blocked this action plan. Catalog metadata alone is not executable readiness.';
const BLOCKED_BY_OWNERSHIP_MISMATCH =
  'Connector activation action plan ownership mismatch. nextActionPlan and activationDecision must describe the same provider and target before readiness can be accepted.';

function freezeBlockers(
  blockers: readonly ConnectorActivationActionPlanBlocker[],
): readonly ConnectorActivationActionPlanBlocker[] {
  return Object.freeze(blockers.map((blocker) => Object.freeze({ ...blocker })));
}

function activationGateBlockers(
  activationDecision: ConnectorActivationDecision,
): ConnectorActivationActionPlanBlocker[] {
  return activationDecision.blockers.map((blocker) => ({
    code: blocker.code,
    detail: blocker.detail,
    field: blocker.field,
  }));
}

function ownershipMismatchBlockers(
  nextActionPlan: IntegrationNextActionPlan,
  activationDecision: ConnectorActivationDecision,
): ConnectorActivationActionPlanBlocker[] {
  const blockers: ConnectorActivationActionPlanBlocker[] = [];

  if (nextActionPlan.providerId !== activationDecision.providerId) {
    blockers.push({
      code: 'action_plan_ownership_mismatch',
      detail: `nextActionPlan provider ${nextActionPlan.providerId} does not match activationDecision provider ${activationDecision.providerId}.`,
      field: 'providerId',
    });
  }

  if (nextActionPlan.targetSurface !== activationDecision.targetSurface) {
    blockers.push({
      code: 'action_plan_ownership_mismatch',
      detail: `nextActionPlan target surface ${nextActionPlan.targetSurface} does not match activationDecision target surface ${activationDecision.targetSurface}.`,
      field: 'targetSurface',
    });
  }

  if (nextActionPlan.targetId !== activationDecision.targetId) {
    blockers.push({
      code: 'action_plan_ownership_mismatch',
      detail: `nextActionPlan target ${nextActionPlan.targetId} does not match activationDecision target ${activationDecision.targetId}.`,
      field: 'targetId',
    });
  }

  return blockers;
}

function disabledReasonFor(
  nextActionPlan: IntegrationNextActionPlan,
  activationDecision: ConnectorActivationDecision,
  hasOwnershipMismatch: boolean,
): string | undefined {
  if (hasOwnershipMismatch) return BLOCKED_BY_OWNERSHIP_MISMATCH;
  if (activationDecision.status === 'blocked') return BLOCKED_BY_ACTIVATION_GATE;
  return nextActionPlan.disabledReason ?? nextActionPlan.rejectedReason;
}

function actionPlanKindFor(
  nextActionPlan: IntegrationNextActionPlan,
  activationDecision: ConnectorActivationDecision,
  hasOwnershipMismatch: boolean,
): ConnectorActivationActionPlanKind {
  if (hasOwnershipMismatch) return 'disabled-descriptor';
  if (nextActionPlan.targetSurface === 'assistantcaddy-route') return 'route-descriptor';
  if (activationDecision.status === 'activation-ready' && nextActionPlan.targetSurface === 'provider-catalog') {
    return 'test-plan-descriptor';
  }
  return 'disabled-descriptor';
}

function actionPlanStatusFor(
  nextActionPlan: IntegrationNextActionPlan,
  activationDecision: ConnectorActivationDecision,
  hasOwnershipMismatch: boolean,
): ConnectorActivationActionPlanStatus {
  if (hasOwnershipMismatch) return 'blocked';
  if (nextActionPlan.status === 'rejected') return 'blocked';
  if (nextActionPlan.status === 'gated') return 'gated';
  if (nextActionPlan.status === 'disabled') return 'disabled';
  if (activationDecision.status === 'activation-ready') return 'test-plan-ready';
  return 'blocked';
}

export function mapConnectorActivationActionPlan({
  nextActionPlan,
  activationDecision,
}: ConnectorActivationActionPlanDecisionInput): ConnectorActivationActionPlan {
  const rawBlockers = [
    ...activationGateBlockers(activationDecision),
    ...ownershipMismatchBlockers(nextActionPlan, activationDecision),
  ];
  const hasOwnershipMismatch = rawBlockers.some((blocker) => blocker.code === 'action_plan_ownership_mismatch');
  const actionKind = actionPlanKindFor(nextActionPlan, activationDecision, hasOwnershipMismatch);
  const status = actionPlanStatusFor(nextActionPlan, activationDecision, hasOwnershipMismatch);
  const label = hasOwnershipMismatch
    ? activationDecision.providerName || nextActionPlan.providerName
    : nextActionPlan.label || activationDecision.providerName;
  const blockers = freezeBlockers(rawBlockers);
  const enabled = status === 'test-plan-ready';

  const plan: ConnectorActivationActionPlan = {
    providerId: activationDecision.providerId || nextActionPlan.providerId,
    providerName: activationDecision.providerName || nextActionPlan.providerName,
    actionKind,
    status,
    label,
    targetSurface: activationDecision.targetSurface,
    targetId: activationDecision.targetId,
    enabled,
    executable: false,
    sideEffects: 'none',
    disabledReason: disabledReasonFor(nextActionPlan, activationDecision, hasOwnershipMismatch),
    gatedReason: status === 'gated' ? nextActionPlan.gatedReason : undefined,
    blockers,
  };

  if (actionKind === 'route-descriptor' && nextActionPlan.targetSurface === 'assistantcaddy-route') {
    plan.route = Object.freeze({
      surface: 'assistantcaddy-route',
      id: nextActionPlan.targetId,
      label,
    });
  }

  if (actionKind === 'test-plan-descriptor') {
    plan.testPlan = Object.freeze({
      connectorId: activationDecision.credentialReference?.connectorId ?? '',
      providerId: plan.providerId,
      targetSurface: plan.targetSurface,
      targetId: plan.targetId,
      label,
    });
  }

  return Object.freeze(plan);
}

export function resolveConnectorActivationActionPlan(
  input: ConnectorActivationGateInput,
): ConnectorActivationActionPlan {
  const activationDecision = resolveConnectorActivationGate(input);
  const nextActionPlan = input.provider
    ? resolveIntegrationNextActionPlan(input.provider)
    : Object.freeze({
      providerId: '',
      providerName: '',
      actionKind: 'unknown' as const,
      label: '',
      targetSurface: 'unknown' as const,
      targetId: '',
      planKind: 'rejected' as const,
      status: 'rejected' as const,
      rejectedReason: 'Provider does not define nextAction metadata.',
      executable: false as const,
      sideEffects: 'none' as const,
    });

  return mapConnectorActivationActionPlan({
    nextActionPlan,
    activationDecision,
  });
}
