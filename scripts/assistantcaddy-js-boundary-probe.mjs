#!/usr/bin/env node

const formatTraps = (traps) => traps.length === 0 ? 'none' : traps.join(',');

const runProbe = (name, makeValue, action) => {
  const traps = [];
  let outcome = 'ok';

  try {
    action(makeValue(traps));
  } catch (error) {
    outcome = error?.name || 'error';
  }

  return `${name}: ${outcome}; traps=${formatTraps(traps)}`;
};

const makeProxy = (traps) => new Proxy({ a: 1 }, {
  get(target, prop, receiver) {
    traps.push(`get:${String(prop)}`);
    return Reflect.get(target, prop, receiver);
  },
  ownKeys(target) {
    traps.push('ownKeys');
    return Reflect.ownKeys(target);
  },
  getOwnPropertyDescriptor(target, prop) {
    traps.push(`getOwnPropertyDescriptor:${String(prop)}`);
    return Reflect.getOwnPropertyDescriptor(target, prop);
  },
  getPrototypeOf(target) {
    traps.push('getPrototypeOf');
    return Reflect.getPrototypeOf(target);
  },
});

const makeAccessorObject = (traps) => ({
  get a() {
    traps.push('get:a');
    return 1;
  },
});

const results = [
  runProbe('Object.getOwnPropertyDescriptors(proxy)', makeProxy, Object.getOwnPropertyDescriptors),
  runProbe('Object.getPrototypeOf(proxy)', makeProxy, Object.getPrototypeOf),
  runProbe('Object.keys(proxy)', makeProxy, Object.keys),
  runProbe('structuredClone(proxy)', makeProxy, structuredClone),
  runProbe('Object.getOwnPropertyDescriptors(accessor)', makeAccessorObject, Object.getOwnPropertyDescriptors),
  runProbe('Object.entries(accessor)', makeAccessorObject, Object.entries),
  runProbe('structuredClone(accessor)', makeAccessorObject, structuredClone),
];

console.log('AssistantCaddy JS boundary probe');
for (const result of results) {
  console.log(result);
}
console.log('Conclusion: descriptor/prototype traversal is not Proxy-trap-free; structuredClone is not getter-free for ordinary accessors.');
