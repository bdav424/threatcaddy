import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as trustedObjectBoundary from '../lib/runtime-trusted-contract-object';
import {
  assertRuntimeTrustedContractObject,
  createRuntimeTrustedContractObject,
  isRuntimeTrustedContractObject,
} from '../lib/runtime-trusted-contract-object';

beforeEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('runtime trusted contract object boundary', () => {
  it('builds frozen null-prototype trusted records from explicit entries', () => {
    const nested = createRuntimeTrustedContractObject([
      ['contract', 'nested-contract-v1'],
    ]);
    const trusted = createRuntimeTrustedContractObject([
      ['contract', 'runtime-contract-v1'],
      ['count', 1],
      ['enabled', true],
      ['optional', undefined],
      ['nested', nested],
      ['items', ['alpha', 2, false, null, nested]],
    ]);

    expect(isRuntimeTrustedContractObject(trusted)).toBe(true);
    expect(() => assertRuntimeTrustedContractObject(trusted)).not.toThrow();
    expect(Object.getPrototypeOf(trusted)).toBeNull();
    expect(Object.isFrozen(trusted)).toBe(true);
    expect(trusted.contract).toBe('runtime-contract-v1');
    expect(trusted.nested).toBe(nested);
    expect(isRuntimeTrustedContractObject(trusted.nested)).toBe(true);
    expect(Array.isArray(trusted.items)).toBe(true);
    expect(Object.isFrozen(trusted.items as object)).toBe(true);
  });

  it('does not expose a spoofable runtime brand export', () => {
    expect(Object.keys(trustedObjectBoundary)).not.toContain('runtimeTrustedContractObjectType');
    expect(Object.keys(trustedObjectBoundary)).toEqual(expect.arrayContaining([
      'assertRuntimeTrustedContractObject',
      'createRuntimeTrustedContractObject',
      'isRuntimeTrustedContractObject',
    ]));
  });

  it('rejects arbitrary objects and arrays by identity', () => {
    const plainRecord = Object.freeze(Object.create(null));
    const ordinaryRecord = Object.freeze({ contract: 'runtime-contract-v1' });
    const arrayValue = Object.freeze(['runtime-contract-v1']);

    expect(isRuntimeTrustedContractObject(plainRecord)).toBe(false);
    expect(isRuntimeTrustedContractObject(ordinaryRecord)).toBe(false);
    expect(isRuntimeTrustedContractObject(arrayValue)).toBe(false);
    expect(() => assertRuntimeTrustedContractObject(ordinaryRecord)).toThrow(TypeError);
  });

  it('rejects proxy values without invoking traps', () => {
    const trusted = createRuntimeTrustedContractObject([
      ['contract', 'runtime-contract-v1'],
    ]);
    const traps: string[] = [];
    const proxy = new Proxy(trusted as object, {
      get(target, property, receiver) {
        traps.push(`get:${String(property)}`);
        return Reflect.get(target, property, receiver);
      },
      getOwnPropertyDescriptor(target, property) {
        traps.push(`getOwnPropertyDescriptor:${String(property)}`);
        return Reflect.getOwnPropertyDescriptor(target, property);
      },
      getPrototypeOf(target) {
        traps.push('getPrototypeOf');
        return Reflect.getPrototypeOf(target);
      },
      ownKeys(target) {
        traps.push('ownKeys');
        return Reflect.ownKeys(target);
      },
    });

    expect(isRuntimeTrustedContractObject(proxy)).toBe(false);
    expect(() => assertRuntimeTrustedContractObject(proxy)).toThrow(TypeError);
    expect(traps).toEqual([]);
  });

  it('rejects accessor-bearing objects without invoking getters', () => {
    const getter = vi.fn(() => 'runtime-contract-v1');
    const accessorObject: Record<string, unknown> = {};
    Object.defineProperty(accessorObject, 'contract', {
      enumerable: true,
      get: getter,
    });

    expect(isRuntimeTrustedContractObject(accessorObject)).toBe(false);
    expect(() => assertRuntimeTrustedContractObject(accessorObject)).toThrow(TypeError);
    expect(getter).not.toHaveBeenCalled();
  });

  it('rejects arbitrary source objects as nested values instead of sanitizing them', () => {
    const arbitraryNested = Object.freeze({ contract: 'nested-contract-v1' });

    expect(() => createRuntimeTrustedContractObject([
      ['contract', 'runtime-contract-v1'],
      ['nested', arbitraryNested as never],
    ])).toThrow(TypeError);
  });

  it('rejects ambiguous or prototype-like entry keys', () => {
    expect(() => createRuntimeTrustedContractObject([
      ['contract', 'runtime-contract-v1'],
      ['contract', 'duplicate-contract-v1'],
    ])).toThrow(TypeError);
    expect(() => createRuntimeTrustedContractObject([
      ['__proto__', 'runtime-contract-v1'],
    ])).toThrow(TypeError);
    expect(() => createRuntimeTrustedContractObject([
      ['constructor', 'runtime-contract-v1'],
    ])).toThrow(TypeError);
  });
});
