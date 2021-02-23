const fs = require('fs');
const path = require('path');
const WorkerThreads = require('worker_threads');
const IGCParser = require('igc-parser');
const Worker = WorkerThreads.Worker;
//const SharedMap = require('sharedmap');

const NWORKERS = require('os').cpus().length;

const test = { file: 'bigflat.igc', score: 224.09 };
class SharedMap {
    constructor() {
        this.storage = new SharedArrayBuffer(8658984);
        this.meta = new Uint32Array(this.storage, 0, 4);
    }
}

async function* solver(flight) {
    const config = {};
    config.flight = flight;
    config.flight.furthestPoints = [new SharedMap(), new SharedMap()];

    //delete flight.errors;
    flight.errors = new Error('err');
    let workers;
    workers = new Array(NWORKERS).fill(undefined);
    for (let w in workers) {
        workers[w] = new Worker('./worker.js', { workerData: { flight } });
        workers[w].qlen = 0;
        workers[w].results = [];
    }
    yield null;
}

(async () => {
    const flight = IGCParser.parse(fs.readFileSync(path.join('test', test.file), 'utf8'), { lenient: true });
    (await solver(flight).next()).value;
})();