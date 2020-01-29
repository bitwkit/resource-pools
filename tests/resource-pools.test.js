
const {ResourcePool, isSym, readyEventSym, errorEventSym, closeMethodSym} = require('../src/resource-pools.js');
const EventEmitter = require('events');


// Mock class

const mockFn = jest.fn( cb => cb() );

class TestResource extends EventEmitter {
    constructor(cb, ...args) {
        super(...args);
        setImmediate(() => mockFn(() => cb.call(this)));
    };
};

const testConfig = {
    constructor: TestResource,
    arguments: [function() {this.emit(readyEventSym)}],
    maxCount: 1
};


// complete tests


// incomplete tests

test('on new request and no resources available, pool size below max: calls a resource constructor with args from config', () => {
    const pool = new ResourcePool(testConfig);
    return pool.allocate().then( () => {
        expect(mockFn).toHaveBeenCalledTimes(1);
        //expect(mockFn.calls[0]).toEqual([testArgs]);
    });
});


// tests to make
/*
test('passes arguments to the resource constructor when calling it', () => {
    expect(true).toBe(false);
});

test('on new request and no resources available, pool size is at max: puts the request to a queue', () => {
    expect(true).toBe(false);
});

test('on new request and no resources available, pool size is at max: does not create a new resource', () => {
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
*/