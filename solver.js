'use strict';
/**
 * igc-xc-score Solver
 * scoring library for paragliding flights
 * 
 * @module igc-xc-score
 * @author Momtchil Momtchev <momtchil@momtchev.com>
 */
const WorkerThreads = require('worker_threads');
const Worker = WorkerThreads.Worker;
const worker = require('./worker');
const Solution = require('./solution').Solution;
const { Range, Point, Box } = require('./foundation');

const NWORKERS = require('os').cpus().length;
const MINQ = 20;


function dequeueSolutions(msgs) {
/* This is the ugly part of JS */
    for (let msg of msgs) {
        msg.__proto__ = Solution.prototype;
        for (let r of msg.ranges)
            r.__proto__ = Range.prototype;
        for (let b of msg.boxes)
            b.__proto__ = Box.prototype;
        if (msg.scoreInfo && msg.scoreInfo.tp)
            for (let p of msg.scoreInfo.tp)
                p.__proto__ = Point.prototype;
        if (msg.scoreInfo && msg.scoreInfo.cp)
            for (let p of Object.keys(msg.scoreInfo.cp))
                msg.scoreInfo.cp[p].__proto__ = Point.prototype;
    }
    this.results = this.results.concat(msgs);
    this.qlen--;
    if (this.qlen < MINQ) {
        const willResolve = this.resolve;
        if (this.qlen > 0)
            this.q = new Promise((res) => {
                this.resolve = res;
            });
        else
            this.q = undefined;
        willResolve(this);
    }
}

/**
 * This the solver
 * @param {IGCFile} flight flight track data in the igc_parser format
 * @param {object[]} [scoringTypes=undefined] undefined for FFVL or one of the elements of scoringRules
 * @param {object=} config optional config parameters
 * @param {number=} config.maxcycle maximum execution time of the solver in ms, each sucessive call will return a better solution, default undefined for unlimited
 * @param {boolean=} config.noflight do not include the flight track data in the output GeoJSON, default false
 * @param {boolean=} config.invalid include invalid GPS fixes when evaluating the flight, default false
 * @param {boolean=} config.hp use high-precision distance calculation (Vincenty's), much slower for slightly higher precision, default false
 * @param {boolean=} config.trim automatically detect launch and landing and trim the flight track, default false
 */
async function* solver(flight, _scoringRules, _config) {
    const rules = _scoringRules || 'FFVL';
    const config = _config || {};
    config.flight = flight;
    config.rules = rules;
    worker.prepare(config);

    //delete flight.errors;
    flight.errors = new Error('err');
    let workers;
    if (config.env && config.env.WorkerThreads) {
        workers = new Array(NWORKERS).fill(undefined);
        for (let w in workers) {
            workers[w] = new Worker('./worker.js', { workerData: { flight: config.flight, rules: config.rules, hp: config.hp } });
            workers[w].on('message', dequeueSolutions.bind(workers[w]));
            workers[w].qlen = 0;
            workers[w].results = [];
        }
    }
    yield null;
}

module.exports = solver;
