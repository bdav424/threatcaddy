import { describe, expect, it, vi } from 'vitest';
import { createLocalBridgeDiscoveryPlan } from '../lib/local-bridge-discovery';

describe('local bridge discovery planning contract', () => {
  it('normalizes local and private endpoints into blocked-by-default probe plans', () => {
    const plan = createLocalBridgeDiscoveryPlan({
      bridgeKind: 'mail',
      candidates: [
        '127.0.0.1:11434/v1',
        'http://localhost:8766',
        'https://192.168.1.20:9443/bridge/',
        'http://[::1]:8766',
        'http://mail-bridge.local:8080',
      ],
      defaultProbePath: '/health',
    });

    expect(plan).toMatchObject({
      bridgeKind: 'mail',
      allowed: false,
      consentGranted: false,
      consentRequired: true,
      status: 'blocked_consent_required',
      acceptedCount: 5,
      rejectedCount: 0,
      sideEffectBoundary: 'plan-only-no-fetch-no-socket-no-storage',
    });
    expect(plan.candidates.map((candidate) => candidate.normalizedEndpoint)).toEqual([
      'http://127.0.0.1:11434/v1',
      'http://localhost:8766/',
      'https://192.168.1.20:9443/bridge/',
      'http://[::1]:8766/',
      'http://mail-bridge.local:8080/',
    ]);
    expect(plan.candidates.every((candidate) => candidate.probe?.allowed === false)).toBe(true);
    expect(plan.candidates.every((candidate) => candidate.probe?.consentRequired === true)).toBe(true);
    expect(plan.candidates.map((candidate) => candidate.probe?.url)).toEqual([
      'http://127.0.0.1:11434/health',
      'http://localhost:8766/health',
      'https://192.168.1.20:9443/health',
      'http://[::1]:8766/health',
      'http://mail-bridge.local:8080/health',
    ]);
  });

  it('allows probe plans only after explicit consent', () => {
    const plan = createLocalBridgeDiscoveryPlan({
      candidates: ['10.1.2.3:8080', 'https://[fd00::1]'],
      consentGranted: true,
      defaultProbePath: 'ready',
      timeoutMs: 1234.9,
    });

    expect(plan).toMatchObject({
      allowed: true,
      consentGranted: true,
      consentRequired: false,
      status: 'ready',
      acceptedCount: 2,
      rejectedCount: 0,
    });
    expect(plan.candidates).toEqual([
      expect.objectContaining({
        normalizedEndpoint: 'http://10.1.2.3:8080/',
        scope: 'private-ipv4',
        probe: expect.objectContaining({
          allowed: true,
          consentRequired: false,
          timeoutMs: 1234,
          url: 'http://10.1.2.3:8080/ready',
          sideEffectBoundary: 'plan-only-no-fetch-no-socket',
        }),
      }),
      expect.objectContaining({
        normalizedEndpoint: 'https://[fd00::1]/',
        scope: 'unique-local-ipv6',
        probe: expect.objectContaining({
          allowed: true,
          url: 'https://[fd00::1]/ready',
        }),
      }),
    ]);
  });

  it('rejects external and public hosts without creating probe plans', () => {
    const plan = createLocalBridgeDiscoveryPlan({
      candidates: [
        'https://example.com',
        'http://8.8.8.8:8080',
        'https://1.1.1.1',
        'http://public.test.localhost.evil.example',
      ],
      consentGranted: true,
    });

    expect(plan.allowed).toBe(false);
    expect(plan.status).toBe('blocked_no_valid_candidates');
    expect(plan.acceptedCount).toBe(0);
    expect(plan.rejectedCount).toBe(4);
    expect(plan.candidates.every((candidate) => candidate.accepted === false)).toBe(true);
    expect(plan.candidates.every((candidate) => candidate.probe === null)).toBe(true);
    expect(plan.candidates.every((candidate) => candidate.rejectionReasons.includes('external_or_public_host'))).toBe(true);
  });

  it('rejects secret-bearing URLs and credentials in authority', () => {
    const plan = createLocalBridgeDiscoveryPlan({
      candidates: [
        'http://user:pass@127.0.0.1:8766',
        'http://127.0.0.1:8766/health?api_key=abc',
        'http://localhost:8766/health?refresh_token=abc',
        'http://localhost:8766/health#access_token=abc',
      ],
      consentGranted: true,
    });

    expect(plan.allowed).toBe(false);
    expect(plan.status).toBe('blocked_no_valid_candidates');
    expect(plan.candidates).toEqual([
      expect.objectContaining({
        accepted: false,
        normalizedEndpoint: undefined,
        probe: null,
        rejectionReasons: ['authority_credentials'],
      }),
      expect.objectContaining({
        accepted: false,
        probe: null,
        rejectionReasons: ['secret_query_param'],
      }),
      expect.objectContaining({
        accepted: false,
        probe: null,
        rejectionReasons: ['secret_query_param'],
      }),
      expect.objectContaining({
        accepted: false,
        probe: null,
        rejectionReasons: ['url_fragment'],
      }),
    ]);
  });

  it('rejects and redacts secret-looking query values under benign names', () => {
    const plan = createLocalBridgeDiscoveryPlan({
      candidates: [
        'http://localhost:8766/health?state=setup-preview',
        'http://localhost:8766/health?state=Bearer%20synthetic-secret',
        'http://127.0.0.1:8766/health?next=api-key:synthetic-test-key',
        'http://127.0.0.1:8766/health?mode=eyJsynthetic1.synthetic2.synthetic3',
      ],
      consentGranted: true,
    });

    expect(plan.allowed).toBe(true);
    expect(plan.acceptedCount).toBe(1);
    expect(plan.rejectedCount).toBe(3);
    expect(plan.candidates[0]).toMatchObject({
      input: 'http://localhost:8766/health?state=setup-preview',
      accepted: true,
      normalizedEndpoint: 'http://localhost:8766/health',
      probe: expect.objectContaining({
        url: 'http://localhost:8766/',
      }),
      rejectionReasons: [],
    });
    expect(plan.candidates.slice(1)).toEqual([
      expect.objectContaining({
        input: 'http://localhost:8766/health',
        accepted: false,
        normalizedEndpoint: undefined,
        probe: null,
        rejectionReasons: ['secret_query_param'],
      }),
      expect.objectContaining({
        input: 'http://127.0.0.1:8766/health',
        accepted: false,
        probe: null,
        rejectionReasons: ['secret_query_param'],
      }),
      expect.objectContaining({
        input: 'http://127.0.0.1:8766/health',
        accepted: false,
        probe: null,
        rejectionReasons: ['secret_query_param'],
      }),
    ]);
    expect(JSON.stringify(plan)).not.toContain('synthetic-secret');
    expect(JSON.stringify(plan)).not.toContain('synthetic-test-key');
    expect(JSON.stringify(plan)).not.toContain('eyJsynthetic1');
  });

  it('redacts secret-looking values when candidate-limit rejection skips parsing into a plan', () => {
    const plan = createLocalBridgeDiscoveryPlan({
      candidates: [
        '127.0.0.1:1',
        'http://localhost:8766/health?state=Bearer%20synthetic-secret',
      ],
      maxCandidates: 1,
      consentGranted: true,
    });

    expect(plan.candidates).toEqual([
      expect.objectContaining({ accepted: true, normalizedEndpoint: 'http://127.0.0.1:1/' }),
      expect.objectContaining({
        input: 'http://localhost:8766/health',
        accepted: false,
        probe: null,
        rejectionReasons: ['candidate_limit_exceeded'],
      }),
    ]);
    expect(JSON.stringify(plan)).not.toContain('synthetic-secret');
  });

  it('redacts malformed raw secret-looking values when candidate-limit rejection skips URL parsing', () => {
    const plan = createLocalBridgeDiscoveryPlan({
      candidates: [
        '127.0.0.1:1',
        'http://[::1?state=Bearer synthetic-secret',
        'not a url api-key:synthetic-test-key',
      ],
      maxCandidates: 1,
      consentGranted: true,
    });

    expect(plan.candidates).toEqual([
      expect.objectContaining({ accepted: true, normalizedEndpoint: 'http://127.0.0.1:1/' }),
      expect.objectContaining({
        input: 'http://[::1?[redacted]',
        accepted: false,
        probe: null,
        rejectionReasons: ['candidate_limit_exceeded'],
      }),
      expect.objectContaining({
        input: '[redacted-url]',
        accepted: false,
        probe: null,
        rejectionReasons: ['candidate_limit_exceeded'],
      }),
    ]);
    expect(JSON.stringify(plan)).not.toContain('synthetic-secret');
    expect(JSON.stringify(plan)).not.toContain('synthetic-test-key');
  });

  it('rejects unsupported schemes, empty candidates, malformed URLs, and excess entries', () => {
    const plan = createLocalBridgeDiscoveryPlan({
      candidates: [
        '',
        'ftp://127.0.0.1/service',
        'http://[::1',
        '127.0.0.1:1',
        '127.0.0.1:2',
      ],
      maxCandidates: 4,
      consentGranted: true,
    });

    expect(plan.candidates).toEqual([
      expect.objectContaining({ accepted: false, rejectionReasons: ['empty_candidate'] }),
      expect.objectContaining({ accepted: false, rejectionReasons: ['unsupported_scheme'] }),
      expect.objectContaining({ accepted: false, rejectionReasons: ['invalid_url'] }),
      expect.objectContaining({ accepted: true, normalizedEndpoint: 'http://127.0.0.1:1/' }),
      expect.objectContaining({ accepted: false, rejectionReasons: ['candidate_limit_exceeded'] }),
    ]);
    expect(plan.allowed).toBe(true);
    expect(plan.acceptedCount).toBe(1);
    expect(plan.rejectedCount).toBe(4);
  });

  it('does not fetch, write browser storage, or create executable connector state', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const storageSetSpy = vi.spyOn(Storage.prototype, 'setItem');
    const storageGetSpy = vi.spyOn(Storage.prototype, 'getItem');

    const plan = createLocalBridgeDiscoveryPlan({
      candidates: ['127.0.0.1:8766', 'https://example.com?token=secret'],
      consentGranted: true,
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(storageSetSpy).not.toHaveBeenCalled();
    expect(storageGetSpy).not.toHaveBeenCalled();
    expect(JSON.stringify(plan)).not.toContain('token=secret');
    expect(plan.candidates[0].probe).toMatchObject({
      method: 'GET',
      allowed: true,
      sideEffectBoundary: 'plan-only-no-fetch-no-socket',
    });
    expect(plan.candidates[1]).toMatchObject({
      accepted: false,
      probe: null,
      rejectionReasons: expect.arrayContaining(['external_or_public_host', 'secret_query_param']),
    });
  });
});
