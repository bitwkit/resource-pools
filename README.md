# resource-pools

## Purpose

This Javascript module introduces a ResourcePool class as an abstraction to manage objects that can be pooled and allocated on demand.


## Usage

Once your resource class is compatible with the pool interface (see the **Pooled resources** paragraph below) you provide a new pool with some basic settings:

```javascript
const resources = new ResourcePool(config); // create the pool object
```

...and simply request the pool to allocate a resource wherever it is needed (you always get a promise in return):

```javascript
resources.allocate().then( obj => /* call for an obj action here */);
// or
obj = await resources.allocate();
```


### Config parameters

A config object has some required and optional parameters:

```javascript
const config = {
    // required parameters:
    constructor: /* reference to the constructor of pooled objects */,
    arguments: /* arguments for the pooled objects constructor */,
    maxCount: /* maximum number of objects in the pool */,

    // optional:
    log: /* function to which the resource pool object will pass log messages */,
    requestTimeout: /* the request will be rejected if no resource is available within this period, ms */,
    busyTimeout: /* if the resource is stuck in busy state for longer than this, it is deleted from the pool and its close method is being called, ms */,
    idleTimeout: /* the resource is released from the pool and closed if it is not used for longer than this, ms */
}
```


### Log function

The arguments of log function are **logLevel** and the **message**. Logging levels are:

* 0: errors
* 1: resource assign / release messages
* 2: internal pool events


Example log function

```javascript
log: (logLevel, ...args) => {
    /* errors & logs to console */
    if(logLevel < 1) {
        console.error(...args);
    }
    else{
        console.log(...args);
    }
}
```


### Timeouts

If any of the timeouts is not set explicitly, its internal default value is used:

* requestTimeout: 1 minute
* busyTimeout: 1 minute
* idleTimeout: 24 hours

**NB**: *busyTimeout* should be greater than it takes a new resource to get ready for being allocated, otherwise new resources will be continuously created and closed until the allocation request timeout is reached and the request id finally rejected.


### Pooled resources

Pooled objects must implement the following interface:

* emit a specific event when it is ready to be allocated for the next task (referenced by a readyEventSym symbol);
* emit a specific event on error, when the resource is no longer capable of operating and should be deleted from the pool (referenced by an errorEventSym symbol);
* have a method to properly be shutdown by the pool object (referenced by a closeMethodSym symbol).


## Example 1, declaration of a pooled 'tedious' connection:

This implementation is available as a [**resource-pools-connection** package](https://www.npmjs.com/package/resource-pools-connection)

```javascript
const {Connection} = require('tedious');
const {readyEventSym, errorEventSym, closeMethodSym} = require('resource-pools');

class ConnectionResource extends Connection {
    constructor(...args) {
        super(...args);
        this.once('connect', err => this.emit(err ? errorEventSym : readyEventSym, err) );
        this.once('error', err => this.emit(errorEventSym, err) );
        this.once('errorMessage', err => this.emit(errorEventSym, err) );
    }

    execSql(...[request, rest]) {
        super.execSql(...[request, rest]);
        request.once('requestCompleted', () => this.emit(readyEventSym));
    }
}
ConnectionResource.prototype[closeMethodSym] = function(...args) { this.close(...args) };
```

## Example 2, declaration of a pooled worker:

This implementation is available as a [**resource-pools-worker** package](https://www.npmjs.com/package/resource-pools-worker)

```javascript
const {Worker} = require('worker_threads');
const {readyEventSym, errorEventSym, closeMethodSym} = require('resource-pools');

class WorkerResource extends Worker {
    constructor(...args) {
        super(...args);
        this.once('online', () => this.emit(readyEventSym) );
        this.once('error', () => this.emit(errorEventSym) );
        this.on('message', () => this.emit(readyEventSym) );
    }
}
WorkerResource.prototype[closeMethodSym] = function(...args) { this.terminate(...args) };
```
