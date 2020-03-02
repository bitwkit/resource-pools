
// Dependencies


// Auxilary declarations

function* idGenerator() {
    let id = 0;
    while (true) yield id++;
}

const idSym = Symbol('id'); // reference to resource 'id' property
const readyEventSym = Symbol('readyEventSym'); // reference to 'ready' event emitted by resource
const errorEventSym = Symbol('errorEventSym'); // reference to 'error' event emitted by resource
const closeMethodSym = Symbol('closeMethodSym'); // reference to resource method to be used to close/delete the resource

const DEFAULT_BUSY_TIMEOUT = 1000 * 60;
const DEFAULT_IDLE_TIMEOUT = 1000 * 60 * 60 * 24;
const DEFAULT_REQUEST_TIMEOUT = 1000 * 60;

// Main

class ResourcePool {
    constructor(config) {
        this.config = config;
        this.idleObjects = [ ]; // contains objects { obj, timeout }
        this.busyObjects = [ ]; // contains objects { obj, timeout }
        this.allocRequests = [ ]; // contains objects { resolve, rejectTimeout }
        this.idGen = idGenerator();
        this.processImmediate = undefined; // contains a reference to an immediate where the processRequests is scheduled
        this.log = (logLevel, ...args) => { this.config.log && this.config.log(logLevel, ...args) };
    }

    scheduleProcessing() {
        clearImmediate(this.processImmediate);
        this.processImmediate = setImmediate(() => this.processRequests());
    }

    addToBusy(obj) {
        this.log(2, 'add object', obj.constructor.name, ':', obj[idSym], 'to busy pool');
        const timeout = setTimeout(() => {
            this.log(3, 'busy timeout reached for object', obj.constructor.name, ':', obj[idSym]);
            this.errorCallback(obj);
            this.scheduleProcessing();
        }, this.config.busyTimeout || DEFAULT_BUSY_TIMEOUT);
        this.busyObjects.push({ obj, timeout });
    }

    addToIdle(obj) {
        this.log(2, 'add object', obj.constructor.name, ':', obj[idSym], 'to idle pool');
        const timeout = setTimeout(() => {
            this.log(3, 'idle timeout reached for object', obj.constructor.name, ':', obj[idSym]);
            this.errorCallback(obj);
            // this.scheduleProcessing(); // processing is likely not needed in this case
        }, this.config.idleTimeout || DEFAULT_IDLE_TIMEOUT);
        this.idleObjects.push({ obj, timeout });
    }

    deleteFromBusy(obj) {
        const index = this.busyObjects.findIndex(elem => elem.obj === obj);
        if (index >= 0) {
            this.log(2, 'delete object', obj.constructor.name, ':', obj[idSym], 'from busy pool');
            clearTimeout(this.busyObjects[index].timeout);
            this.busyObjects.splice(index, 1);
            return true;
        };
        return false;
    }

    deleteFromIdle(obj) {
        const index = this.idleObjects.findIndex(elem => elem.obj === obj);
        if (index >= 0) {
            this.log(2, 'delete object', obj.constructor.name, ':', obj[idSym], 'from idle pool');
            this.idleObjects.splice(index, 1);
            return true;
        };
        return false;
    }

    readyCallback(obj) {
        this.log(1, 'ready callback for object', obj.constructor.name, ':', obj[idSym]);
        this.deleteFromBusy(obj);
        this.addToIdle(obj);
    }

    errorCallback(obj) {
        this.log(0, 'error callback for object', obj.constructor.name, ':', obj[idSym]);
        try {
            obj[closeMethodSym]();
        }
        catch (err) {
            this.log(0, 'error calling resourse close method:', err);
        };

        this.deleteFromBusy(obj);
        this.deleteFromIdle(obj);
        
        obj.removeAllListeners(readyEventSym);
        obj.removeAllListeners(errorEventSym);
    }

    addObject() {
        const obj = new this.config.constructor(...this.config.arguments);
        obj[idSym] = this.idGen.next().value; // add id to the object
        this.log(1, 'new resource object', obj.constructor.name, ':', obj[idSym]);

        this.addToBusy(obj);

        obj.once(errorEventSym, (err) => {
            this.errorCallback(obj);
            this.scheduleProcessing();
        });

        obj.on(readyEventSym, () => {
            this.readyCallback(obj);
            this.scheduleProcessing();
        });
    }

    deleteRequest(request)  {
        const index = this.allocRequests.indexOf(request);
        if (index >= 0) {
            this.allocRequests.splice(index, 1);
            return true;
        };
        return false;
    };

    allocate() {
        this.log(2, 'allocating new resource request');
        return new Promise((resolve, reject) => {
            const request = { resolve };
            request.rejectTimeout = setTimeout(() => {
                // remove request from the array and reject it on timeout
                this.log(0, 'request rejected on timeout');
                this.deleteRequest(request);
                reject();
            }, this.config.requestTimeout || DEFAULT_REQUEST_TIMEOUT);
            this.allocRequests.push(request);
            this.scheduleProcessing();
        });
    }

    processRequests() {
        this.log(2, 'started request processing');

        // assign pending requests to idle resources if possible
        while ((this.allocRequests.length > 0) && (this.idleObjects.length > 0)) {
            const allocateRequest = this.allocRequests.shift();
            const obj = this.idleObjects[0].obj;
            this.deleteFromIdle(obj);
            this.addToBusy(obj);
            clearTimeout(allocateRequest.rejectTimeout);
            allocateRequest.resolve(obj);
            this.log(1, 'allocated request to idle resource', obj.constructor.name, ':', obj[idSym]);
        };

        // create new resources if possible for unprocessed requests
        let toAdd = Math.min(this.config.maxCount - this.busyObjects.length, this.allocRequests.length);
        while (toAdd > 0) {
            this.log(2, 'creating new object');
            this.addObject();
            toAdd--;
        };

        this.log(2, 'ended request processing');
    }
}


// Exports

exports.ResourcePool = ResourcePool;
exports.idSym = idSym;
exports.readyEventSym = readyEventSym;
exports.errorEventSym = errorEventSym;
exports.closeMethodSym = closeMethodSym;
