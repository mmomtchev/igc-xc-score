const fs = require('fs');
const path = require('path');
const WorkerThreads = require('worker_threads');
const IGCParser = require('igc-parser');
const Worker = WorkerThreads.Worker;
const SharedMap = require('sharedmap');

const NWORKERS = require('os').cpus().length;

const defaultConfig = {
    quiet: true,
    trim: true,
    env: { fs, WorkerThreads }
};

const test = { file: 'bigflat.igc', score: 224.09 };

async function* solver(flight, _scoringRules, _config) {
    const config = _config || {};
    config.flight = flight;
    config.flight.furthestPoints = [new SharedMap(65536, 48, 16), new SharedMap(65536, 48, 16)];

    //delete flight.errors;
    flight.errors = new Error('err');
    let workers;
    if (config.env && config.env.WorkerThreads) {
        workers = new Array(NWORKERS).fill(undefined);
        for (let w in workers) {
            workers[w] = new Worker('./worker.js', { workerData: { flight } });
            workers[w].qlen = 0;
            workers[w].results = [];
        }
    }
    yield null;
}

(async () => {
    const flight = IGCParser.parse(fs.readFileSync(path.join('test', test.file), 'utf8'), { lenient: true });
    (await solver(flight, 'FFVL', defaultConfig).next()).value;
})();