
const {ResourcePool, idSym, readyEventSym, errorEventSym, closeMethodSym} = require('../src/resource-pools.js');
const EventEmitter = require('events');


// Mock class setup

const mockFnCreate = jest.fn( cb => cb() );
const mockFnDo = jest.fn( cb => cb() );
const mockFnClose = jest.fn();

class TestResource extends EventEmitter {
    constructor(cb, ...args) {
        super(...args);
        setImmediate(() => mockFnCreate(() => cb.call(this)));
    };

    do(cb) {
        setImmediate(() => mockFnDo(() => cb.call(this)));
    };

    [closeMethodSym]() {
        setImmediate(() => mockFnClose());
    };
};

function emitReady() { this.emit(readyEventSym) };
function emitError() { this.emit(errorEventSym) };
function emitNothing() { };


// Tests pt 1

describe('successful scenarios', () => {

    const config = {
        constructor: TestResource,
        arguments: [emitReady],
        maxCount: 2,
        log: function() { }
    };
    const pool = new ResourcePool(config);

    let res1prom, res2prom, res1, res2;
    test('creates a new resource when there\'re no idle ones and the pool size is below max', async () => {
        expect.assertions(4);
        res1prom = pool.allocate();
        res2prom = pool.allocate();
        await expect(res1prom).resolves.toBeInstanceOf(TestResource);
        await expect(res2prom).resolves.toBeInstanceOf(TestResource);
        res1 = await res1prom;
        res2 = await res2prom;
        expect(mockFnCreate).toHaveBeenCalledTimes(2);
        expect(res2).not.toBe(res1);
    });
    // res1 - busy, res2 - busy

    let res3prom;
    test('doesn\'t create new resource when the pool size is at max', async () => {
        expect.assertions(1);
        res3prom = pool.allocate();
        await new Promise( resolve => setTimeout(resolve, 0) ); // wait for the next cycle
        expect(mockFnCreate).toHaveBeenCalledTimes(2); // still only two objects created
    });
    // res1 - busy, res2 - busy
    
    let res3;
    test('allocates a free existing resource after it becomes idle', async () => {
        res1.do(emitReady);
        res3 = await res3prom;
        expect(mockFnDo).toHaveBeenCalledTimes(1);
        expect(res1).toBe(res3); // the same object is returned
    });
    // res1 - busy, res2 - busy, res3 = res1

});


// Tests pt 2
/*
describe('faulty scenarios', () => {

    const config = {
        constructor: TestResource,
        arguments: [emitReady],
        maxCount: 2,
        log: function() { }
    };
    const pool = new ResourcePool(config);
    
    let res1prom;
    test('rejects allocation in case of error on creating a new resource', async () => {
        expect.assertions(3);

        config.arguments[0] = emitError;

        res1prom = pool.allocate();
        await expect(res1prom).rejects.toBeUndefined();
        await new Promise( resolve => setTimeout(resolve, 0) );
        expect(mockFnCreate).toHaveBeenCalledTimes(3);
        expect(mockFnClose).toHaveBeenCalledTimes(1);

        config.arguments[0] = emitReady;
    });

    let res2prom, res2;
    test('runs a closing method for resource when it emits an error', async () => {
        res2prom = pool.allocate();
        res2 = await res2prom;
        await expect(res2prom).resolves.toBeInstanceOf(TestResource);
        expect(mockFnCreate).toHaveBeenCalledTimes(4);
        res2.do(emitError);
        await new Promise( resolve => setTimeout(resolve, 1000) );
        expect(mockFnDo).toHaveBeenCalledTimes(2);
        expect(mockFnClose).toHaveBeenCalledTimes(2);
    });
    // res1 - rejected (closed), res2 - closed

    let res3;
    test('doesn\'t allocate a previously closed resource', async () => {
        res3 = await pool.allocate();
        expect(mockFnCreate).toHaveBeenCalledTimes(5);
        expect(res3).not.toBe(res2);
    });
    // res1 - rejected (closed), res2 - closed, res3 - busy

    let res4;
    test('doesn\'t allocate a previously closed resource even if it then emits a Ready event', async () => {
        res2.do(emitReady);
        await new Promise( resolve  => setTimeout(resolve, 0) );
        expect(mockFnDo).toHaveBeenCalledTimes(3);
        res4 = await pool.allocate();
        expect(res4).not.toBe(res2);
    });
    // res1 - rejected (closed), res2 - closed, res3 - busy, res4 - busy

});
*/


// Tests pt 3

describe('timeouts handling', () => {

    const config = {
        constructor: TestResource,
        arguments: [emitNothing],
        maxCount: 2,
        requestTimeout: 500,
        log: (...args) => console.log(new Date().toISOString(), ...args)
    };
    const pool = new ResourcePool(config);

    let res1prom;
    test('rejects request when no resources are ready within request timeout', async () => {
        jest.useFakeTimers();
        expect.assertions(1);
        res1prom = pool.allocate();
        jest.advanceTimersByTime(config.requestTimeout);
        expect(res1prom).rejects.toBeUndefined();
    });

});
