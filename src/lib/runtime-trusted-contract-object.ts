declare const runtimeTrustedContractObjectType: unique symbol;

export type RuntimeTrustedContractPrimitive = string | number | boolean | null | undefined;

export type RuntimeTrustedContractValue =
  | RuntimeTrustedContractPrimitive
  | RuntimeTrustedContractObject
  | readonly RuntimeTrustedContractValue[];

export type RuntimeTrustedContractObjectShape = {
  readonly [key: string]: RuntimeTrustedContractValue;
};

export type RuntimeTrustedContractObject<
  TShape extends RuntimeTrustedContractObjectShape = RuntimeTrustedContractObjectShape,
> = Readonly<TShape> & {
  readonly [runtimeTrustedContractObjectType]: 'runtime-trusted-contract-object';
};

export type RuntimeTrustedContractEntry<
  TValue extends RuntimeTrustedContractValue = RuntimeTrustedContractValue,
> = readonly [key: string, value: TValue];

const trustedContractObjects = new WeakSet<object>();
const FORBIDDEN_CONTRACT_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function assertTrustedContractKey(key: unknown): asserts key is string {
  if (typeof key !== 'string' || key.length === 0 || FORBIDDEN_CONTRACT_KEYS.has(key)) {
    throw new TypeError('Runtime trusted contract object entries require safe string keys.');
  }
}

function copyTrustedContractValue(value: RuntimeTrustedContractValue): RuntimeTrustedContractValue {
  if (
    value === null
    || value === undefined
    || typeof value === 'string'
    || typeof value === 'number'
    || typeof value === 'boolean'
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    const copy: RuntimeTrustedContractValue[] = [];
    for (let index = 0; index < value.length; index += 1) {
      copy[index] = copyTrustedContractValue(value[index]);
    }
    return Object.freeze(copy);
  }

  if (isRuntimeTrustedContractObject(value)) return value;

  throw new TypeError('Runtime trusted contract object values must be primitives, arrays, or trusted contract objects.');
}

export function isRuntimeTrustedContractObject(value: unknown): value is RuntimeTrustedContractObject {
  if (typeof value !== 'object' || value === null) return false;
  return trustedContractObjects.has(value);
}

export function assertRuntimeTrustedContractObject(
  value: unknown,
): asserts value is RuntimeTrustedContractObject {
  if (!isRuntimeTrustedContractObject(value)) {
    throw new TypeError('Expected a runtime trusted contract object.');
  }
}

export function createRuntimeTrustedContractObject(
  entries: readonly RuntimeTrustedContractEntry[],
): RuntimeTrustedContractObject {
  if (!Array.isArray(entries)) {
    throw new TypeError('Runtime trusted contract objects must be built from explicit entries.');
  }

  const seenKeys = new Set<string>();
  const record: Record<string, RuntimeTrustedContractValue> = Object.create(null);

  for (const entry of entries) {
    if (!Array.isArray(entry) || entry.length !== 2) {
      throw new TypeError('Runtime trusted contract object entries must be key/value tuples.');
    }

    const [key, value] = entry;
    assertTrustedContractKey(key);
    if (seenKeys.has(key)) {
      throw new TypeError('Runtime trusted contract object entries must not duplicate keys.');
    }
    seenKeys.add(key);

    Object.defineProperty(record, key, {
      configurable: false,
      enumerable: true,
      value: copyTrustedContractValue(value),
      writable: false,
    });
  }

  const trusted = Object.freeze(record) as RuntimeTrustedContractObject;
  trustedContractObjects.add(trusted);
  return trusted;
}
