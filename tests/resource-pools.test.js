
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


// Global settings

jest.useFakeTimers();

afterEach(() => {
    jest.clearAllMocks();
});

const consoleLogger = (...args) => console.log(new Date().toISOString(), ...args);
const emptyLogger = () => { };

// Tests pt 1

describe('successful scenarios', () => {

    const config = {
        constructor: TestResource,
        arguments: [emitReady],
        maxCount: 2,
        log: emptyLogger
    };
    const pool = new ResourcePool(config);

    let res1prom, res2prom, res1, res2;
    test('creates a new resource when there\'re no idle ones and the pool size is below max', async () => {
        expect.assertions(5);

        res1prom = pool.allocate();
        res2prom = pool.allocate();
        expect(mockFnCreate).toHaveBeenCalledTimes(0);

        jest.runAllImmediates();
        expect(mockFnCreate).toHaveBeenCalledTimes(2);

        expect(res1prom).resolves.toBeInstanceOf(TestResource);
        expect(res2prom).resolves.toBeInstanceOf(TestResource);

        res1 = await res1prom;
        res2 = await res2prom;

        expect(res2).not.toBe(res1);
    });
    // res1 - busy, res2 - busy

    let res3prom;
    test('doesn\'t create new resource when the pool size is at max', async () => {
        expect.assertions(1);

        res3prom = pool.allocate();
        jest.runAllImmediates();
        expect(mockFnCreate).toHaveBeenCalledTimes(0); // still only two objects created
    });
    // res1 - busy, res2 - busy
    
    let res3;
    test('allocates a free existing resource after it becomes idle', async () => {
        expect.assertions(3);

        res1.do(emitReady);
        expect(mockFnDo).toHaveBeenCalledTimes(0);

        jest.runAllImmediates();
        expect(mockFnDo).toHaveBeenCalledTimes(1);

        res3 = await res3prom;
        expect(res1).toBe(res3); // the same object is returned
    });
    // res1 - busy, res2 - busy, res3 = res1

});


// Tests pt 2

describe('timeouts handling', () => {

    describe('busy timeout', () => {

        const config = {
            constructor: TestResource,
            arguments: [emitReady],
            busyTimeout: 100,
            maxCount: 2,
            log: emptyLogger
        };
        const pool = new ResourcePool(config);
    
        let res1prom, res1;
        test('closes resource on busy timeout', async () => {
            expect.assertions(6);
    
            res1prom = pool.allocate();
            jest.runAllImmediates();
            expect(res1prom).resolves.toBeInstanceOf(TestResource);
    
            res1 = await res1prom;
            res1.do(emitNothing);
            expect(mockFnDo).toHaveBeenCalledTimes(0);
            
            jest.runAllImmediates();
            expect(mockFnDo).toHaveBeenCalledTimes(1);
    
            expect(mockFnClose).toHaveBeenCalledTimes(0);
    
            jest.advanceTimersByTime(config.busyTimeout - 1); // to ensure it doesn't close the resource before timeout for any reason
            jest.runAllImmediates();
            expect(mockFnClose).toHaveBeenCalledTimes(0);
    
            jest.advanceTimersByTime(1);
            jest.runAllImmediates();
            expect(mockFnClose).toHaveBeenCalledTimes(1);
        });
    
        /* let res2prom;
        test('restarts busy timer after the resource becomes idle', async () => {
            expect.assertions(1);
    
            config.busyTimeout = 100;
    
            res2prom
    
            expect(true).toBe(false);
    
            delete config.busyTimeout;
        }); */

    });

    describe('reject timeout', () => {

        const config = {
            constructor: TestResource,
            arguments: [emitNothing],
            busyTimeout: 100,
            requestTimeout: 1000,
            maxCount: 2,
            log: emptyLogger
        };
        const pool = new ResourcePool(config);

        let res1prom;
        test('rejects request when no resources are ready within request timeout', async () => {
            expect.assertions(1);
    
            res1prom = pool.allocate();
            jest.advanceTimersByTime(config.requestTimeout);
            expect(res1prom).rejects.toBeUndefined();
        });
    
        let res2prom;
        test('retries allocation after resource failure until request timeout', async () => {
            expect.assertions(3);
    
            const expectedCreateCalls = config.requestTimeout / config.busyTimeout;
    
            res2prom = pool.allocate();
            jest.runAllImmediates();
    
            let createCalls = 1;
            while (createCalls < expectedCreateCalls * 2) { // double the cycles to ensure that retries stop after the request is rejected
                jest.advanceTimersByTime(config.busyTimeout);
                jest.runAllImmediates();
                createCalls++;
            };
    
            expect(mockFnCreate).toHaveBeenCalledTimes(expectedCreateCalls);
            expect(mockFnClose).toHaveBeenCalledTimes(expectedCreateCalls);
    
            expect(res2prom).rejects.toBeUndefined();
        });

    });

    describe('idle timeout', () => {

        const config = {
            constructor: TestResource,
            arguments: [emitReady],
            idleTimeout: 10000,
            maxCount: 2,
            log: emptyLogger
        };
        const pool = new ResourcePool(config);

        let res1prom;
        test('closes resource on idle timeout', async () => {
            expect.assertions(3);
    
            res1prom = pool.allocate();
    
            jest.runAllImmediates();
            expect(res1prom).resolves.toBeInstanceOf(TestResource);
    
            jest.advanceTimersByTime(config.idleTimeout - 1); // to ensure it doesn't close the resource before timeout for any reason
            jest.runAllImmediates();
            expect(mockFnClose).toHaveBeenCalledTimes(0);
    
            jest.advanceTimersByTime(1);
            jest.runAllImmediates();
            expect(mockFnClose).toHaveBeenCalledTimes(1);
        });
    
        /* test('restarts idle timer after the resource have been allocated', async () => {
            //
            expect(true).toBe(false);
        }); */

    });

});
