import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  evaluateProviderAdapterExecutionBoundary,
  type ProviderAdapterExecutionAdapterClaim,
  type ProviderAdapterExecutionBoundaryInput,
  type ProviderAdapterExecutionCallerFacts,
} from '../lib/provider-adapter-execution-boundary';
import type { ProviderAdapterDryRunHarnessMetadata } from '../lib/provider-adapter-dry-run-harness';
import {
  evaluateProviderAdapterInvocationImplementationBoundary,
  type ProviderAdapterInvocationAction,
  type ProviderAdapterInvocationImplementationAdapterFact,
  type ProviderAdapterInvocationImplementationExecutableAdapterContract,
  type ProviderAdapterInvocationImplementationInput,
  type ProviderAdapterInvocationImplementationPlan,
} from '../lib/provider-adapter-invocation-implementation-boundary';
import {
  createRuntimeTrustedContractObject,
  type RuntimeTrustedContractEntry,
  type RuntimeTrustedContractObject,
  type RuntimeTrustedContractValue,
} from '../lib/runtime-trusted-contract-object';

beforeEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function trusted<T>(entries: RuntimeTrustedContractEntry[]): RuntimeTrustedContractObject & T {
  return createRuntimeTrustedContractObject(entries) as RuntimeTrustedContractObject & T;
}

function entry(key: string, value: unknown): RuntimeTrustedContractEntry {
  return [key, value as RuntimeTrustedContractValue];
}

function valueOrDefault(overrides: Record<string, unknown>, key: string, fallback: unknown): unknown {
  return Object.prototype.hasOwnProperty.call(overrides, key) ? overrides[key] : fallback;
}

function trustedWithReplacements<T>(source: object, replacements: RuntimeTrustedContractEntry[]): T {
  const replaced = new Set(replacements.map(([key]) => key));
  return trusted<T>([
    ...Object.entries(source as Record<string, unknown>)
      .filter(([key]) => !replaced.has(key))
      .map(([key, value]) => entry(key, value)),
    ...replacements,
  ]);
}

function owner(
  overrides: Record<string, unknown> = {},
): NonNullable<ProviderAdapterDryRunHarnessMetadata['owner']> {
  return trusted<NonNullable<ProviderAdapterDryRunHarnessMetadata['owner']>>([
    entry('surface', valueOrDefault(overrides, 'surface', 'email')),
    entry('targetSurface', valueOrDefault(overrides, 'targetSurface', 'email')),
    entry('providerId', valueOrDefault(overrides, 'providerId', 'generic-mail')),
    entry('connectorId', valueOrDefault(overrides, 'connectorId', 'email-runtime')),
    entry('actionId', valueOrDefault(overrides, 'actionId', 'mail.sync')),
    entry('accountId', valueOrDefault(overrides, 'accountId', 'analyst@example.test')),
  ]);
}

function adapter(
  overrides: Record<string, unknown> = {},
): NonNullable<ProviderAdapterDryRunHarnessMetadata['adapter']> {
  return trusted<NonNullable<ProviderAdapterDryRunHarnessMetadata['adapter']>>([
    entry('id', overrides.id ?? 'generic-mail-adapter'),
    entry('version', overrides.version ?? '1.0.0'),
  ]);
}

function credentialReference(
  overrides: Record<string, unknown> = {},
): NonNullable<ProviderAdapterDryRunHarnessMetadata['credentialReference']> {
  return trusted<NonNullable<ProviderAdapterDryRunHarnessMetadata['credentialReference']>>([
    entry('id', valueOrDefault(overrides, 'id', 'vault:provider/generic-mail/analyst')),
    entry('kind', valueOrDefault(overrides, 'kind', 'external-secret-store')),
    entry('storageOwner', valueOrDefault(overrides, 'storageOwner', 'external-secret-store')),
    entry('providerId', valueOrDefault(overrides, 'providerId', 'generic-mail')),
    entry('connectorId', valueOrDefault(overrides, 'connectorId', 'email-runtime')),
    entry('accountId', valueOrDefault(overrides, 'accountId', 'analyst@example.test')),
  ]);
}

function dryRun(overrides: Partial<ProviderAdapterDryRunHarnessMetadata> = {}): ProviderAdapterDryRunHarnessMetadata {
  return trusted<ProviderAdapterDryRunHarnessMetadata>([
    entry('status', overrides.status ?? 'accepted'),
    entry('accepted', overrides.accepted ?? true),
    entry('reason', overrides.reason ?? 'dry_run_harness_accepted'),
    entry('dryRunId', overrides.dryRunId ?? 'provider-adapter-dry-run-1'),
    entry('adapter', overrides.adapter ?? adapter()),
    entry('owner', overrides.owner ?? owner()),
    entry('credentialReference', overrides.credentialReference ?? credentialReference()),
    entry('authAction', overrides.authAction ?? 'test_provider_auth'),
    entry('consentGrantId', overrides.consentGrantId ?? 'consent-generic-mail-sync'),
    entry('executable', overrides.executable ?? false),
    entry('willCallProvider', overrides.willCallProvider ?? false),
    entry('willResolveCredential', overrides.willResolveCredential ?? false),
    entry('willOpenWindow', overrides.willOpenWindow ?? false),
    entry('sideEffects', overrides.sideEffects ?? 'none'),
    entry(
      'sideEffectBoundary',
      overrides.sideEffectBoundary
        ?? 'provider-adapter-dry-run-harness-no-fetch-no-socket-no-storage-no-provider-sdk-no-oauth-no-window-no-secret-resolution',
    ),
  ]);
}

function callerFacts(overrides: Partial<ProviderAdapterExecutionCallerFacts> = {}): ProviderAdapterExecutionCallerFacts {
  return trusted<ProviderAdapterExecutionCallerFacts>([
    entry('schemaVersion', overrides.schemaVersion ?? 1),
    entry('factKind', overrides.factKind ?? 'provider-adapter-execution-caller-facts'),
    entry('providerId', overrides.providerId ?? 'generic-mail'),
    entry('connectorId', overrides.connectorId ?? 'email-runtime'),
    entry('accountId', overrides.accountId ?? 'analyst@example.test'),
    entry('surface', overrides.surface ?? 'email'),
    entry('targetSurface', overrides.targetSurface ?? 'email'),
    entry('actionId', overrides.actionId ?? 'mail.sync'),
    entry('adapterId', overrides.adapterId ?? 'generic-mail-adapter'),
    entry('adapterVersion', overrides.adapterVersion ?? '1.0.0'),
    entry('credentialReferenceId', overrides.credentialReferenceId ?? 'vault:provider/generic-mail/analyst'),
    entry('consentGrantId', overrides.consentGrantId ?? 'consent-generic-mail-sync'),
    entry('dryRunId', overrides.dryRunId ?? 'provider-adapter-dry-run-1'),
    entry('authAction', overrides.authAction ?? 'test_provider_auth'),
    entry('credentialSessionStatus', overrides.credentialSessionStatus ?? 'session-ready'),
    entry('mayUseCredentialHandle', overrides.mayUseCredentialHandle ?? true),
    entry('explicitConsentStatus', overrides.explicitConsentStatus ?? 'allow'),
    entry('explicitConsentAllowed', overrides.explicitConsentAllowed ?? true),
    entry('reviewed', overrides.reviewed ?? true),
    entry('acknowledgedDryRunBoundary', overrides.acknowledgedDryRunBoundary ?? true),
    entry('acknowledgedNoCredentialResolution', overrides.acknowledgedNoCredentialResolution ?? true),
    entry('acknowledgedNoProviderCall', overrides.acknowledgedNoProviderCall ?? true),
  ]);
}

function adapterClaim(overrides: Partial<ProviderAdapterExecutionAdapterClaim> = {}): ProviderAdapterExecutionAdapterClaim {
  return trusted<ProviderAdapterExecutionAdapterClaim>([
    entry('schemaVersion', overrides.schemaVersion ?? 1),
    entry('claimKind', overrides.claimKind ?? 'injected-provider-adapter-execution-claim'),
    entry('runtimeOwner', overrides.runtimeOwner ?? 'provider-adapter-execution-boundary'),
    entry('adapterId', overrides.adapterId ?? 'generic-mail-adapter'),
    entry('adapterVersion', overrides.adapterVersion ?? '1.0.0'),
    entry('providerId', overrides.providerId ?? 'generic-mail'),
    entry('connectorId', overrides.connectorId ?? 'email-runtime'),
    entry('accountId', overrides.accountId ?? 'analyst@example.test'),
    entry('surface', overrides.surface ?? 'email'),
    entry('targetSurface', overrides.targetSurface ?? 'email'),
    entry('credentialReferenceId', overrides.credentialReferenceId ?? 'vault:provider/generic-mail/analyst'),
    entry('supportedActionIds', overrides.supportedActionIds ?? ['mail.sync']),
    entry('executable', overrides.executable ?? false),
    entry('willCallProvider', overrides.willCallProvider ?? false),
    entry('willResolveCredential', overrides.willResolveCredential ?? false),
    entry('willOpenWindow', overrides.willOpenWindow ?? false),
    entry('sideEffects', overrides.sideEffects ?? 'none'),
    entry(
      'sideEffectBoundary',
      overrides.sideEffectBoundary
        ?? 'injected-provider-adapter-claim-no-fetch-no-storage-no-provider-sdk-no-oauth-no-window-no-secret-resolution',
    ),
  ]);
}

function executionBoundary(callerOverrides: Partial<ProviderAdapterExecutionCallerFacts> = {}) {
  return evaluateProviderAdapterExecutionBoundary(trusted<ProviderAdapterExecutionBoundaryInput>([
    entry('dryRun', dryRun()),
    entry('callerFacts', callerFacts(callerOverrides)),
    entry('adapterClaim', adapterClaim()),
    entry('payload', undefined),
  ]));
}

function adapterFact(
  overrides: Partial<ProviderAdapterInvocationImplementationAdapterFact> = {},
): ProviderAdapterInvocationImplementationAdapterFact {
  return trusted<ProviderAdapterInvocationImplementationAdapterFact>([
    entry('schemaVersion', overrides.schemaVersion ?? 1),
    entry('factKind', overrides.factKind ?? 'future-provider-adapter-invocation-fact'),
    entry('runtimeOwner', overrides.runtimeOwner ?? 'provider-adapter-invocation-implementation-boundary'),
    entry('providerId', overrides.providerId ?? 'generic-mail'),
    entry('connectorId', overrides.connectorId ?? 'email-runtime'),
    entry('accountId', overrides.accountId ?? 'analyst@example.test'),
    entry('actionId', overrides.actionId ?? 'mail.sync'),
    entry('adapterId', overrides.adapterId ?? 'generic-mail-adapter'),
    entry('adapterVersion', overrides.adapterVersion ?? '1.0.0'),
    entry(
      'supportedInvocationActions',
      overrides.supportedInvocationActions ?? [
        'auth.preview',
        'mail.sync.preview',
        'mail.send.preview',
      ] satisfies ProviderAdapterInvocationAction[],
    ),
    entry(
      'implementationBoundary',
      overrides.implementationBoundary
        ?? 'plan-only-no-provider-sdk-no-fetch-no-socket-no-storage-no-oauth-no-window-no-credential-resolution-no-adapter-call',
    ),
    entry('executable', overrides.executable ?? false),
    entry('importsProviderSdk', overrides.importsProviderSdk ?? false),
    entry('willFetch', overrides.willFetch ?? false),
    entry('willOpenSocket', overrides.willOpenSocket ?? false),
    entry('willMutateStorage', overrides.willMutateStorage ?? false),
    entry('willResolveCredential', overrides.willResolveCredential ?? false),
    entry('willOpenWindow', overrides.willOpenWindow ?? false),
    entry('willInvokeAdapter', overrides.willInvokeAdapter ?? false),
  ]);
}

function invocationPlan(
  overrides: Partial<ProviderAdapterInvocationImplementationPlan> = {},
  extraEntries: RuntimeTrustedContractEntry[] = [],
): ProviderAdapterInvocationImplementationPlan {
  return trusted<ProviderAdapterInvocationImplementationPlan>([
    entry('schemaVersion', overrides.schemaVersion ?? 1),
    entry('planKind', overrides.planKind ?? 'future-provider-adapter-invocation-plan'),
    entry('runtimeOwner', overrides.runtimeOwner ?? 'provider-adapter-invocation-implementation-boundary'),
    entry('providerId', overrides.providerId ?? 'generic-mail'),
    entry('connectorId', overrides.connectorId ?? 'email-runtime'),
    entry('accountId', overrides.accountId ?? 'analyst@example.test'),
    entry('actionId', overrides.actionId ?? 'mail.sync'),
    entry('adapterId', overrides.adapterId ?? 'generic-mail-adapter'),
    entry('adapterVersion', overrides.adapterVersion ?? '1.0.0'),
    entry('credentialReferenceId', overrides.credentialReferenceId ?? 'vault:provider/generic-mail/analyst'),
    entry('consentGrantId', overrides.consentGrantId ?? 'consent-generic-mail-sync'),
    entry('invocationAction', overrides.invocationAction ?? 'mail.sync.preview'),
    entry('reviewed', overrides.reviewed ?? true),
    entry('acknowledgedNoProviderSdk', overrides.acknowledgedNoProviderSdk ?? true),
    entry('acknowledgedNoNetwork', overrides.acknowledgedNoNetwork ?? true),
    entry('acknowledgedNoStorage', overrides.acknowledgedNoStorage ?? true),
    entry('acknowledgedNoCredentialResolution', overrides.acknowledgedNoCredentialResolution ?? true),
    entry('acknowledgedNoOAuthWindow', overrides.acknowledgedNoOAuthWindow ?? true),
    entry('acknowledgedNoAdapterInvocation', overrides.acknowledgedNoAdapterInvocation ?? true),
    ...extraEntries,
  ]);
}

function executableAdapterContract(
  overrides: Partial<ProviderAdapterInvocationImplementationExecutableAdapterContract> = {},
  extraEntries: RuntimeTrustedContractEntry[] = [],
): ProviderAdapterInvocationImplementationExecutableAdapterContract {
  return trusted<ProviderAdapterInvocationImplementationExecutableAdapterContract>([
    entry('schemaVersion', overrides.schemaVersion ?? 1),
    entry('contractKind', overrides.contractKind ?? 'reviewed-injected-provider-adapter-executable-contract'),
    entry('runtimeOwner', overrides.runtimeOwner ?? 'provider-adapter-invocation-implementation-boundary'),
    entry('providerId', overrides.providerId ?? 'generic-mail'),
    entry('connectorId', overrides.connectorId ?? 'email-runtime'),
    entry('accountId', overrides.accountId ?? 'analyst@example.test'),
    entry('actionId', overrides.actionId ?? 'mail.sync'),
    entry('adapterId', overrides.adapterId ?? 'generic-mail-adapter'),
    entry('adapterVersion', overrides.adapterVersion ?? '1.0.0'),
    entry('credentialReferenceId', overrides.credentialReferenceId ?? 'vault:provider/generic-mail/analyst'),
    entry('consentGrantId', overrides.consentGrantId ?? 'consent-generic-mail-sync'),
    entry('invocationAction', overrides.invocationAction ?? 'mail.sync.preview'),
    entry('adapterInterface', overrides.adapterInterface ?? 'injected-adapter-metadata-only'),
    entry('reviewed', overrides.reviewed ?? true),
    entry('acknowledgedExecutionBoundary', overrides.acknowledgedExecutionBoundary ?? true),
    entry('acknowledgedNoProviderSdk', overrides.acknowledgedNoProviderSdk ?? true),
    entry('acknowledgedNoNetwork', overrides.acknowledgedNoNetwork ?? true),
    entry('acknowledgedNoStorage', overrides.acknowledgedNoStorage ?? true),
    entry('acknowledgedNoCredentialResolution', overrides.acknowledgedNoCredentialResolution ?? true),
    entry('acknowledgedNoOAuthWindow', overrides.acknowledgedNoOAuthWindow ?? true),
    entry('acknowledgedNoAdapterInvocation', overrides.acknowledgedNoAdapterInvocation ?? true),
    entry('executable', overrides.executable ?? false),
    entry('willCallProvider', overrides.willCallProvider ?? false),
    entry('willFetch', overrides.willFetch ?? false),
    entry('willOpenSocket', overrides.willOpenSocket ?? false),
    entry('willMutateStorage', overrides.willMutateStorage ?? false),
    entry('willResolveCredential', overrides.willResolveCredential ?? false),
    entry('willOpenWindow', overrides.willOpenWindow ?? false),
    entry('willInvokeAdapter', overrides.willInvokeAdapter ?? false),
    entry('adapterCalled', overrides.adapterCalled ?? false),
    entry('sideEffects', overrides.sideEffects ?? 'none'),
    entry(
      'contractBoundary',
      overrides.contractBoundary
        ?? 'reviewed-injected-provider-adapter-executable-contract-metadata-only-no-provider-sdk-no-fetch-no-socket-no-storage-no-oauth-no-window-no-secret-resolution-no-adapter-call',
    ),
    ...extraEntries,
  ]);
}

function input(overrides: Partial<ProviderAdapterInvocationImplementationInput> = {}) {
  return trusted<ProviderAdapterInvocationImplementationInput>([
    entry('executionBoundary', overrides.executionBoundary === undefined ? executionBoundary() : overrides.executionBoundary),
    entry('adapterFact', overrides.adapterFact === undefined ? adapterFact() : overrides.adapterFact),
    entry('invocationPlan', overrides.invocationPlan === undefined ? invocationPlan() : overrides.invocationPlan),
    entry(
      'executableAdapterContract',
      overrides.executableAdapterContract === undefined
        ? executableAdapterContract()
        : overrides.executableAdapterContract,
    ),
    entry('adapterResult', overrides.adapterResult),
  ]);
}

function trapProxy() {
  const traps: string[] = [];
  const proxy = new Proxy(Object.create(null), {
    get(target, property, receiver) {
      traps.push(`get:${String(property)}`);
      return Reflect.get(target, property, receiver);
    },
    ownKeys(target) {
      traps.push('ownKeys');
      return Reflect.ownKeys(target);
    },
    getOwnPropertyDescriptor(target, property) {
      traps.push(`getOwnPropertyDescriptor:${String(property)}`);
      return Reflect.getOwnPropertyDescriptor(target, property);
    },
    getPrototypeOf(target) {
      traps.push('getPrototypeOf');
      return Reflect.getPrototypeOf(target);
    },
  });
  return { proxy, traps };
}

describe('provider adapter invocation implementation boundary', () => {
  it('keeps source-generated provider adapter invocation fail-closed without calling an adapter', () => {
    const decision = evaluateProviderAdapterInvocationImplementationBoundary(input());

    expect(decision).toMatchObject({
      status: 'blocked',
      ready: false,
      reason: 'execution_boundary_blocked',
      blockers: ['execution_boundary_blocked'],
      adapter: { id: 'generic-mail-adapter', version: '1.0.0' },
      owner: {
        providerId: 'generic-mail',
        connectorId: 'email-runtime',
        actionId: 'mail.sync',
        accountId: 'analyst@example.test',
      },
      credentialReference: { id: 'vault:provider/generic-mail/analyst' },
      consentGrantId: 'consent-generic-mail-sync',
      invocationAction: undefined,
      executableAdapterContract: undefined,
      implementationBoundaryReady: false,
      canPrepareFutureProviderAdapterInvocation: false,
      requiresReviewedExecutableAdapterContract: true,
      executableAdapterContractAccepted: false,
      mayInvokeInjectedAdapterNow: false,
      requestRedaction: 'request-omitted',
      bodyRedaction: 'body-omitted',
      headersRedaction: 'headers-omitted',
      adapterResultRedaction: 'adapter-result-omitted',
      executable: false,
      importsProviderSdk: false,
      willFetch: false,
      willOpenSocket: false,
      willMutateStorage: false,
      willResolveCredential: false,
      willOpenWindow: false,
      willInvokeAdapter: false,
      adapterCalled: false,
    });
    expect(Object.isFrozen(decision)).toBe(true);
    expect(Object.isFrozen(decision.adapter)).toBe(true);
    expect(Object.isFrozen(decision.owner)).toBe(true);
    expect(Object.isFrozen(decision.credentialReference)).toBe(true);
  });

  it('rejects untrusted root and nested proxy/accessor shapes without executing traps or getters', () => {
    const rootProxy = trapProxy();
    expect(evaluateProviderAdapterInvocationImplementationBoundary(
      rootProxy.proxy as ProviderAdapterInvocationImplementationInput,
    )).toMatchObject({
      status: 'blocked',
      reason: 'input_shape_forbidden',
    });
    expect(rootProxy.traps).toEqual([]);

    const nestedProxy = trapProxy();
    expect(evaluateProviderAdapterInvocationImplementationBoundary({
      executionBoundary: nestedProxy.proxy,
      adapterFact: adapterFact(),
      invocationPlan: invocationPlan(),
      executableAdapterContract: executableAdapterContract(),
    })).toMatchObject({
      status: 'blocked',
      reason: 'input_shape_forbidden',
    });
    expect(nestedProxy.traps).toEqual([]);

    let getterCalls = 0;
    const accessorInput = {};
    Object.defineProperty(accessorInput, 'executionBoundary', {
      enumerable: true,
      get() {
        getterCalls += 1;
        return executionBoundary();
      },
    });
    expect(evaluateProviderAdapterInvocationImplementationBoundary(
      accessorInput as ProviderAdapterInvocationImplementationInput,
    )).toMatchObject({
      status: 'blocked',
      reason: 'input_shape_forbidden',
    });
    expect(getterCalls).toBe(0);
  });

  it('rejects malicious nested trusted-builder values without executing proxy traps or getters', () => {
    const nestedProxy = trapProxy();
    expect(() => trusted<ProviderAdapterInvocationImplementationInput>([
      entry('executionBoundary', nestedProxy.proxy),
    ])).toThrow(/Runtime trusted contract object values/);
    expect(nestedProxy.traps).toEqual([]);

    let getterCalls = 0;
    const accessorExecution = {};
    Object.defineProperty(accessorExecution, 'status', {
      enumerable: true,
      get() {
        getterCalls += 1;
        return 'allow';
      },
    });

    expect(() => trusted<ProviderAdapterInvocationImplementationInput>([
      entry('executionBoundary', accessorExecution),
    ])).toThrow(/Runtime trusted contract object values/);
    expect(getterCalls).toBe(0);
  });

  it('fails closed for missing, blocked, or forged execution boundaries', () => {
    expect(evaluateProviderAdapterInvocationImplementationBoundary(input({ executionBoundary: null })))
      .toMatchObject({ status: 'blocked', reason: 'execution_boundary_missing' });

    expect(evaluateProviderAdapterInvocationImplementationBoundary(input({
      executionBoundary: executionBoundary({ actionId: 'mail.send' }),
    }))).toMatchObject({ status: 'blocked', reason: 'execution_boundary_blocked', adapterCalled: false });

    expect(evaluateProviderAdapterInvocationImplementationBoundary(input({
      executionBoundary: trustedWithReplacements(executionBoundary(), [entry('executable', true)]),
    }))).toMatchObject({ status: 'blocked', reason: 'execution_boundary_blocked', executable: false });

    expect(evaluateProviderAdapterInvocationImplementationBoundary(input({
      executionBoundary: trustedWithReplacements(executionBoundary(), [
        entry('status', 'allow'),
        entry('allowed', true),
        entry('reason', 'provider_adapter_execution_boundary_ready'),
        entry('blockReasons', []),
        entry('mayInvokeInjectedAdapter', true),
      ]),
    }))).toMatchObject({ status: 'blocked', reason: 'execution_boundary_invalid', executable: false });

    expect(evaluateProviderAdapterInvocationImplementationBoundary(input({
      executionBoundary: trustedWithReplacements(executionBoundary(), [
        entry('adapter', trusted([
          entry('id', 'generic-mail-adapter'),
          entry('version', '1.0.0'),
          entry('fetch', 'blocked'),
        ])),
      ]),
    }))).toMatchObject({
      status: 'blocked',
      reason: 'execution_boundary_shape_forbidden',
      adapterCalled: false,
    });

    const callback = vi.fn();
    expect(evaluateProviderAdapterInvocationImplementationBoundary({
      executionBoundary: {
        ...executionBoundary(),
        adapter: {
          id: 'generic-mail-adapter',
          version: '1.0.0',
          callback,
        },
      },
      adapterFact: adapterFact(),
      invocationPlan: invocationPlan(),
      executableAdapterContract: executableAdapterContract(),
    })).toMatchObject({ status: 'blocked', reason: 'input_shape_forbidden' });
    expect(callback).not.toHaveBeenCalled();
  });

  it('rejects executable adapter facts, callbacks, and provider result payloads', () => {
    const execute = vi.fn();
    expect(evaluateProviderAdapterInvocationImplementationBoundary({
      executionBoundary: executionBoundary(),
      adapterFact: { ...adapterFact(), execute },
      invocationPlan: invocationPlan(),
      executableAdapterContract: executableAdapterContract(),
    })).toMatchObject({ status: 'blocked', reason: 'input_shape_forbidden' });
    expect(execute).not.toHaveBeenCalled();

    expect(evaluateProviderAdapterInvocationImplementationBoundary(input({
      adapterFact: adapterFact({ willFetch: true as false }),
    }))).toMatchObject({ status: 'blocked', reason: 'execution_boundary_blocked', willFetch: false });

    expect(evaluateProviderAdapterInvocationImplementationBoundary(input({
      adapterResult: trusted([entry('accessToken', 'Bearer do-not-echo-provider-token')]),
    }))).toMatchObject({ status: 'blocked', reason: 'raw_secret_material' });

    expect(evaluateProviderAdapterInvocationImplementationBoundary(input({
      adapterResult: trusted([entry('adapterRunId', 'future-provider-run-1')]),
    }))).toMatchObject({ status: 'blocked', reason: 'adapter_result_forbidden', adapterCalled: false });

    expect(evaluateProviderAdapterInvocationImplementationBoundary(input({
      adapterResult: trusted([entry('adapterCalled', true), entry('providerCalled', true)]),
    }))).toMatchObject({
      status: 'blocked',
      reason: 'adapter_result_live_claim',
      adapterCalled: false,
      willInvokeAdapter: false,
    });
  });

  it('rejects unreviewed/executable invocation plans and exact provenance mismatches', () => {
    expect(evaluateProviderAdapterInvocationImplementationBoundary(input({
      invocationPlan: invocationPlan({ acknowledgedNoNetwork: false as true }),
    }))).toMatchObject({ status: 'blocked', reason: 'execution_boundary_blocked' });

    expect(evaluateProviderAdapterInvocationImplementationBoundary(input({
      invocationPlan: invocationPlan({ credentialReferenceId: 'vault:provider/generic-mail/other' }),
    }))).toMatchObject({ status: 'blocked', reason: 'execution_boundary_blocked' });

    expect(evaluateProviderAdapterInvocationImplementationBoundary(input({
      adapterFact: adapterFact({ supportedInvocationActions: ['auth.preview'] }),
    }))).toMatchObject({ status: 'blocked', reason: 'execution_boundary_blocked' });

    const accountlessExecution = trustedWithReplacements(executionBoundary(), [
      entry('owner', owner({ accountId: undefined })),
    ]);
    expect(evaluateProviderAdapterInvocationImplementationBoundary(input({
      executionBoundary: accountlessExecution,
    }))).toMatchObject({ status: 'blocked', reason: 'execution_boundary_blocked' });

    for (const missingCredentialField of ['providerId', 'connectorId', 'accountId'] as const) {
      const executionWithMissingCredential = trustedWithReplacements(executionBoundary(), [
        entry('credentialReference', credentialReference({ [missingCredentialField]: undefined })),
      ]);
      expect(evaluateProviderAdapterInvocationImplementationBoundary(input({
        executionBoundary: executionWithMissingCredential,
      }))).toMatchObject({ status: 'blocked', reason: 'execution_boundary_blocked' });
    }
  });

  it('requires a reviewed metadata-only executable adapter contract before ready status', () => {
    expect(evaluateProviderAdapterInvocationImplementationBoundary(input({ executableAdapterContract: null })))
      .toMatchObject({
        status: 'blocked',
        reason: 'execution_boundary_blocked',
        executableAdapterContractAccepted: false,
        mayInvokeInjectedAdapterNow: false,
        adapterCalled: false,
      });

    expect(evaluateProviderAdapterInvocationImplementationBoundary(input({
      executableAdapterContract: executableAdapterContract({ willFetch: true as false }),
    }))).toMatchObject({
      status: 'blocked',
      reason: 'execution_boundary_blocked',
      executableAdapterContractAccepted: false,
      willFetch: false,
    });

    expect(evaluateProviderAdapterInvocationImplementationBoundary(input({
      executableAdapterContract: executableAdapterContract({
        credentialReferenceId: 'vault:provider/generic-mail/other',
      }),
    }))).toMatchObject({
      status: 'blocked',
      reason: 'execution_boundary_blocked',
      executableAdapterContractAccepted: false,
    });

    expect(evaluateProviderAdapterInvocationImplementationBoundary(input({
      adapterFact: adapterFact({
        adapterId: trusted([entry('nested', 'generic-mail-adapter')]) as unknown as string,
      }),
    }))).toMatchObject({
      status: 'blocked',
      reason: 'execution_boundary_blocked',
      adapterCalled: false,
    });
  });

  it('rejects executable adapter contract callback/requester/fetch/socket/storage fields and payload echoes', () => {
    const unsafeContract = executableAdapterContract({}, [
      entry('callback', 'blocked'),
      entry('requester', 'blocked'),
      entry('fetch', 'blocked'),
      entry('socket', trusted([entry('connect', 'blocked')])),
      entry('storage', trusted([entry('setItem', 'blocked')])),
      entry('liveAction', 'mail.sync.live'),
    ]);

    expect(evaluateProviderAdapterInvocationImplementationBoundary(input({
      executableAdapterContract: unsafeContract,
    }))).toMatchObject({
      status: 'blocked',
      reason: 'execution_boundary_blocked',
      executableAdapterContractAccepted: false,
      adapterCalled: false,
    });

    const payloadEchoDecision = evaluateProviderAdapterInvocationImplementationBoundary(input({
      executableAdapterContract: executableAdapterContract({}, [
        entry('headers', trusted([entry('x-provider-test', 'safe-looking-but-forbidden')])),
      ]),
    }));

    expect(payloadEchoDecision).toMatchObject({
      status: 'blocked',
      reason: 'prompt_or_payload_echo_forbidden',
      headersRedaction: 'headers-omitted',
    });
    expect(JSON.stringify(payloadEchoDecision)).not.toContain('safe-looking-but-forbidden');
  });

  it('redacts unsafe identifiers and never echoes URLs, bodies, headers, or secrets', () => {
    const unsafeExecution = trustedWithReplacements(executionBoundary(), [
      entry('adapter', adapter({ id: 'hooks.slack.com/services/T000/B000/do-not-echo' })),
    ]);
    const decision = evaluateProviderAdapterInvocationImplementationBoundary(input({
      executionBoundary: unsafeExecution,
    }));

    expect(decision).toMatchObject({
      status: 'blocked',
      reason: 'execution_boundary_blocked',
      adapter: { id: 'redacted-unsafe-adapter' },
    });
    expect(JSON.stringify(decision)).not.toContain('hooks.slack.com');
    expect(JSON.stringify(decision)).not.toContain('do-not-echo');

    const schemelessHostPathDecision = evaluateProviderAdapterInvocationImplementationBoundary(input({
      executionBoundary: trustedWithReplacements(executionBoundary(), [
        entry('credentialReference', credentialReference({ id: 'api.mailprovider.test/oauth/token/do-not-echo' })),
      ]),
    }));
    expect(schemelessHostPathDecision).toMatchObject({
      status: 'blocked',
      reason: 'execution_boundary_blocked',
      credentialReference: { id: 'redacted-unsafe-credential-reference' },
    });
    expect(JSON.stringify(schemelessHostPathDecision)).not.toContain('mailprovider.test');

    for (const unsafeIdentifier of [
      'ftp://example.invalid/path',
      'localhost:4000/path',
      '127.0.0.1:4000/path',
      'example.invalid/provider/path',
      'mailto:user@example.test',
      'urn:provider:opaque',
    ]) {
      const unsafeDecision = evaluateProviderAdapterInvocationImplementationBoundary(input({
        executionBoundary: trustedWithReplacements(executionBoundary(), [
          entry('adapter', adapter({ id: unsafeIdentifier })),
        ]),
      }));
      const serialized = JSON.stringify(unsafeDecision);

      expect(unsafeDecision).toMatchObject({
        status: 'blocked',
        reason: 'execution_boundary_blocked',
        adapter: { id: 'redacted-unsafe-adapter' },
      });
      expect(serialized).not.toContain(unsafeIdentifier);
      expect(serialized).not.toContain('example.invalid');
      expect(serialized).not.toContain('localhost');
      expect(serialized).not.toContain('urn:provider');
    }

    const tokenDecision = evaluateProviderAdapterInvocationImplementationBoundary(input({
      invocationPlan: invocationPlan({}, [entry('requestBody', 'access_token=do-not-echo')]),
    }));
    expect(tokenDecision).toMatchObject({ status: 'blocked', reason: 'raw_secret_material' });
    expect(JSON.stringify(tokenDecision)).not.toContain('do-not-echo');
  });

  it('rejects root-level unsafe executable fields and prompt/body/header echoes without calling callbacks', () => {
    const callback = vi.fn();
    expect(evaluateProviderAdapterInvocationImplementationBoundary({
      executionBoundary: executionBoundary(),
      adapterFact: adapterFact(),
      invocationPlan: invocationPlan(),
      callback,
      requester: callback,
      fetch: callback,
      socket: { connect: callback },
      storage: { setItem: callback },
      liveAction: 'provider_send',
    } as unknown as ProviderAdapterInvocationImplementationInput)).toMatchObject({
      status: 'blocked',
      reason: 'input_shape_forbidden',
      executable: false,
      mayInvokeInjectedAdapterNow: false,
      adapterCalled: false,
    });
    expect(callback).not.toHaveBeenCalled();

    expect(evaluateProviderAdapterInvocationImplementationBoundary(trusted([
      entry('executionBoundary', executionBoundary()),
      entry('adapterFact', adapterFact()),
      entry('invocationPlan', invocationPlan()),
      entry('executableAdapterContract', executableAdapterContract()),
      entry('callback', 'Bearer do-not-echo-root-callback-token'),
    ]))).toMatchObject({
      status: 'blocked',
      reason: 'unsafe_input_field',
      executable: false,
      mayInvokeInjectedAdapterNow: false,
      adapterCalled: false,
    });

    const extraSecret = evaluateProviderAdapterInvocationImplementationBoundary(trusted([
      entry('executionBoundary', executionBoundary()),
      entry('adapterFact', adapterFact()),
      entry('invocationPlan', invocationPlan()),
      entry('executableAdapterContract', executableAdapterContract()),
      entry('traceSecret', 'Bearer do-not-echo-root-extra-token'),
    ]));
    expect(extraSecret).toMatchObject({
      status: 'blocked',
      reason: 'input_shape_forbidden',
      executable: false,
      mayInvokeInjectedAdapterNow: false,
      adapterCalled: false,
    });
    expect(JSON.stringify(extraSecret)).not.toContain('do-not-echo');

    const providerTransportDecision = evaluateProviderAdapterInvocationImplementationBoundary(trusted([
      entry('executionBoundary', executionBoundary()),
      entry('adapterFact', adapterFact()),
      entry('invocationPlan', invocationPlan()),
      entry('executableAdapterContract', executableAdapterContract()),
      entry('providerTransport', 'provider-send-sync-disabled'),
      entry('oauthExchange', 'oauth-disabled'),
      entry('send', 'mail-send-disabled'),
      entry('sync', 'mail-sync-disabled'),
    ]));
    expect(providerTransportDecision).toMatchObject({
      status: 'blocked',
      reason: 'unsafe_input_field',
      executable: false,
      mayInvokeInjectedAdapterNow: false,
      adapterCalled: false,
    });
    expect(JSON.stringify(providerTransportDecision)).not.toContain('provider-send-sync-disabled');

    const requestEcho = evaluateProviderAdapterInvocationImplementationBoundary(trusted([
      entry('executionBoundary', executionBoundary()),
      entry('adapterFact', adapterFact()),
      entry('invocationPlan', invocationPlan()),
      entry('executableAdapterContract', executableAdapterContract()),
      entry('request', trusted([
        entry('headers', trusted([entry('x-provider-test', 'safe-but-still-forbidden')])),
        entry('body', 'mail.sync.preview request payload should not echo'),
      ])),
    ]));

    expect(requestEcho).toMatchObject({
      status: 'blocked',
      reason: 'unsafe_input_field',
      requestRedaction: 'request-omitted',
      bodyRedaction: 'body-omitted',
      headersRedaction: 'headers-omitted',
    });
    expect(JSON.stringify(requestEcho)).not.toContain('safe-but-still-forbidden');
    expect(JSON.stringify(requestEcho)).not.toContain('request payload');
  });

  it('does not invoke a structurally valid-looking caller-supplied adapter function', () => {
    const request = vi.fn();
    const decision = evaluateProviderAdapterInvocationImplementationBoundary({
      executionBoundary: executionBoundary(),
      adapterFact: adapterFact(),
      invocationPlan: invocationPlan(),
      executableAdapterContract: executableAdapterContract(),
      request,
    } as unknown as ProviderAdapterInvocationImplementationInput);

    expect(decision).toMatchObject({
      status: 'blocked',
      reason: 'input_shape_forbidden',
      executable: false,
      mayInvokeInjectedAdapterNow: false,
      willInvokeAdapter: false,
      adapterCalled: false,
    });
    expect(request).not.toHaveBeenCalled();
  });

  it('does not call fetch, sockets, storage, OAuth windows, providers, or adapter callbacks', () => {
    const fetchSpy = vi.fn();
    const webSocketSpy = vi.fn();
    const eventSourceSpy = vi.fn();
    const windowOpenSpy = vi.fn();
    const adapterCallback = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    vi.stubGlobal('WebSocket', webSocketSpy);
    vi.stubGlobal('EventSource', eventSourceSpy);
    vi.stubGlobal('open', windowOpenSpy);
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem');
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    const removeItemSpy = vi.spyOn(Storage.prototype, 'removeItem');
    const clearSpy = vi.spyOn(Storage.prototype, 'clear');
    const keySpy = vi.spyOn(Storage.prototype, 'key');

    evaluateProviderAdapterInvocationImplementationBoundary({
      executionBoundary: executionBoundary(),
      adapterFact: { ...adapterFact(), adapterCallback },
      invocationPlan: invocationPlan(),
      executableAdapterContract: executableAdapterContract(),
    });
    evaluateProviderAdapterInvocationImplementationBoundary(input());

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(webSocketSpy).not.toHaveBeenCalled();
    expect(eventSourceSpy).not.toHaveBeenCalled();
    expect(windowOpenSpy).not.toHaveBeenCalled();
    expect(getItemSpy).not.toHaveBeenCalled();
    expect(setItemSpy).not.toHaveBeenCalled();
    expect(removeItemSpy).not.toHaveBeenCalled();
    expect(clearSpy).not.toHaveBeenCalled();
    expect(keySpy).not.toHaveBeenCalled();
    expect(adapterCallback).not.toHaveBeenCalled();
  });
});
