
const {ResourcePool} = require('../src/resource-pools.js');

// complete tests

// incomplete tests

test('initial start', () => {
    expect(true).toBe(false);
});

test('on new request and no resources available, pool size below max: calls a resource constructor', () => {
    expect(true).toBe(false);
});

test('on new request and no resources available, pool size is at max: puts the request to a queue', () => {
    expect(true).toBe(false);
});

test('on resource release and request pool empty: puts the resource to idle queue', () => {
    expect(true).toBe(false);
});

test('on resource release and pooles requests present: assigns request to the released resource', () => {
    expect(true).toBe(false);
});

test('on allocated resource fail: calls resource close method', () => {
    expect(true).toBe(false);
});

test('on idle resource fail: deletes it from idle queue and calls resource close method', () => {
    expect(true).toBe(false);
});
