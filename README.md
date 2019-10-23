# resource-pools

## Purpose

This Javascript module introduces a ResourcePool class as an abstraction to manage objects that can be pooled and allocated on demand.

## Usage

A config object should be passed to the pool constructor:

```javascript
const config = {
    constructor: /* reference to the constructor of pooled objects */,
    arguments: /* arguments for the pooled objects constructor */,
    maxCount: /* maximum number of objects in the pool */,
    log: /* function to which the resource pool object will pass log messages (optional) */
}
const resources = new ResourcePool(config);
```

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

Using the resource the is simple as that:

```javascript
resources.allocate().then( obj => /* call for an obj action here */)
```

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
