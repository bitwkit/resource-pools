
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


// Tests pt 1

describe('successful scenatios', () => {
    
    mockFnCreate.mockClear();
    mockFnDo.mockClear();
    mockFnClose.mockClear();
    
    const config = {
        constructor: TestResource,
        arguments: [emitReady],
        maxCount: 2,
        log: (function() { })
    };
    const pool = new ResourcePool(config);

    let res1, res2;
    test('creates a new resource when there\'re no idle ones and the pool size is below max', async () => {
        res1 = await pool.allocate();
        expect(mockFnCreate).toHaveBeenCalledTimes(1);
        res2 = await pool.allocate();
        expect(mockFnCreate).toHaveBeenCalledTimes(2);
    });
    // res1 - busy, res2 - busy

    
    let res3prom;
    test('doesn\'t create new resource when the pool size is at max', async () => {
        expect.assertions(1);
        res3prom = pool.allocate();
        await new Promise((resolve, reject) => { // wait for the next cycle
            setTimeout( () => resolve(), 0 );
        });
        expect(mockFnCreate).toHaveBeenCalledTimes(2); // still only two objects created
    });
    // res1 - busy, res2 - busy
    
    let res3;
    test('allocates a free existing resource after it becomes idle', async () => {
        res1.do(emitReady);
        res3 = await res3prom;
        expect(res1).toBe(res3); // the same object is returned
    });
    // res1 - busy, res2 - busy, res3 = res1
    
});


// Tests pt 2

describe('faulty scenarios', () => {
    
    mockFnCreate.mockClear();
    mockFnDo.mockClear();
    mockFnClose.mockClear();
    
    const config = {
        constructor: TestResource,
        arguments: [emitError],
        maxCount: 2,
        log: (function() {})
    };
    const pool = new ResourcePool(config);
    
    let res1prom, res1;
    test('rejects allocation in case of error on creating a new resource', async () => {
        res1prom = pool.allocate();
        res1 = await res1prom;
        expect(mockFnCreate).toHaveBeenCalledTimes(1);
        // expect(mockFnClose).toHaveBeenCalledTimes(1); // not sure if it really needs to call close method on initial phase
        expect(res1prom).rejects.toBe();
    });
    
    config.arguments = [emitReady];
    let res2;
    test('runs a closing method for resource when it emits an error', async () => {
        res2 = await pool.allocate();
        expect(mockFnCreate).toHaveBeenCalledTimes(2);
        res2.do(emitError);
        await new Promise((resolve, reject) => {
            setTimeout(() => resolve(), 0 );
        });
        expect(mockFnDo).toHaveBeenCallesTimes(1);
        expect(mockFnClose).toHaveBeenCalledTimes(1);
    });
    // res1 - rejected (closed), res2 - closed

    let res3;
    test('doesn\'t allocate a previously closed resource', async () => {
        res3 = await pool.allocate();
        expect(mockFnCreate).toHaveBeenCalledTimes(3);
        expect(res3).not.toBe(res1);
        expect(res3).not.toBe(res2);
    });
    // res1 - rejected (closed), res2 - closed, res3 - busy

    let res4;
    test('doesn\'t allocate a previously closed resource even if it then emits a Ready event', async () => {
        res1.do(emitReady);
        res2.do(emitReady);
        await new Promise((resolve, reject) => {
            setTimeout(() => resolve(), 0);
        });
        expect(mockFnDo).toHaveBeenCalledTimes(3);
        res4 = await pool.allocate();
        expect(res4).not.toBe(res1);
        expect(res4).not.toBe(res2);
    });
    // res1 - rejected (closed), res2 - closed, res3 - busy, res4 - busy
    
});
