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
const SortedSet = require('collections/sorted-set');
const worker = require('./worker');
const Solution = require('./solution').Solution;
const { Range, Point, Box } = require('./foundation');
const scoringRules = require('./scoring-rules.config');

const NWORKERS = require('os').cpus().length * 2;
const MAXQ = 2;
const MINQ = Infinity;

function enqueueSolution(s) {
    this.postMessage(s);
    this.qlen++;
    if (this.q === undefined) {
        this.q = new Promise((res) => {
            this.resolve = res;
        });
    }
}

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
        if (msg.scoreInfo && msg.scoreInfo.ep)
            for (let p of Object.keys(msg.scoreInfo.ep))
                msg.scoreInfo.ep[p].__proto__ = Point.prototype;
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
    let reset;

    const rules = _scoringRules || 'FFVL';
    const config = _config || {};
    config.flight = flight;
    config.rules = rules;
    worker.prepare(config);
    let solutionRoots = [];
    for (let scoringType in scoringRules[rules]) {
        for (let l of flight.ll) {
            const opt = {
                launch: l.launch,
                landing: l.landing,
                scoringType: scoringType
            };
            let solutionRoot = new Solution([
                new Range(l.launch, l.landing),
                new Range(l.launch, l.landing),
                new Range(l.launch, l.landing)
            ], opt, config);
            solutionRoot.do_bound(config);
            solutionRoot.do_score(config);
            solutionRoots.push(solutionRoot);
        }
    }

    let best = solutionRoots[0];
    let solutionQueue = new SortedSet(solutionRoots, Solution.prototype.contentEquals, Solution.prototype.contentCompare);
    let processed = 0;

    if (flight.errors)
        delete flight.errors;
    let workers;
    if (config.env && config.env.WorkerThreads) {
        workers = new Array(NWORKERS).fill(undefined);
        const closestPairs = config.flight.closestPairs;
        for (let w in workers) {
            config.flight.closestPairs = closestPairs.clone();
            workers[w] = new Worker('./worker.js', {
                workerData: {
                    flight: config.flight,
                    rules: config.rules,
                    hp: config.hp
                },
                transferList: [config.flight.closestPairs.port]
            });
            workers[w].on('message', dequeueSolutions.bind(workers[w]));
            workers[w].on('messageerror', (e) => console.error('msgerr', e));
            workers[w].qlen = 0;
            workers[w].results = [];
        }
        config.flight.closestPairs = closestPairs;
    }

    let tcum = 0;
    mainloop:
    do {
        const tstart = Date.now();
        let pending = (workers) => {
            return (workers && workers.filter(x => x.q || x.results.length).length > 0);
        };
        while (solutionQueue.length > 0 || pending(workers)) {
            if (processed % 100 === 0) {
                if (typeof process !== 'undefined' && process.memoryUsage) {
                    const mem = process.memoryUsage();
                    if (mem.heapUsed / mem.heapTotal > 0.98)
                        break;
                }
            }

            if (workers) {
                while (workers.filter(x => x.results.length).length > 0) {
                    const w = workers.filter(x => x.results.length)[0];
                    for (let r of w.results) {
                        r.trace('dequeue', config);
                        if (r.score > best.score)
                            best = r;
                        if (r.bound <= best.score)
                            continue;
                        solutionQueue.push(r);
                    }
                    w.results = [];
                }

                let w;
                let current;
                while ((w = workers.reduce((a, x) => ((x.qlen < MAXQ && (a === undefined || a.qlen > x.qlen)) ? x : a), undefined)) !== undefined
                    && solutionQueue.length > 0
                    && (current = solutionQueue.pop()).scoring(config).rounding(current.bound) > best.scoring(config).rounding(best.score)) {

                    current.trace('enqueue', config);
                    enqueueSolution.call(w, current);
                    processed++;
                    current = undefined;
                }

                if (current)
                    solutionQueue.push(current);

                if (workers.filter(x => x.q).length) {
                    await Promise.race(workers.filter(x => x.q).map(x => x.q));
                } else {
                    solutionQueue.clear();
                    continue mainloop;
                }
            }

            if (!workers) {
                let current = solutionQueue.pop();
                if (current.scoring(config).rounding(current.bound) <= best.scoring(config).rounding(best.score)) {
                    solutionQueue.clear();
                    continue;
                }
                let children = current.do_branch(config);
                for (let c of children) {
                    c.do_bound(config);
                    c.do_score(config);
                    if (c.score > best.score)
                        best = c;
                    if (c.bound <= best.score)
                        continue;
                    solutionQueue.push(c);
                }
                await new Promise(res => { setTimeout(res, 1); });
            }

            if (solutionQueue.length > 10000 && solutionQueue.findLeast().value.bound <= best.score) {
                const garbageBest = solutionQueue.findGreatestLessThanOrEqual({ bound: best.score });
                if (garbageBest !== undefined) {
                    const cutoff = solutionQueue.indexOf(garbageBest.value);
                    solutionQueue.splice(0, cutoff + 1).length;
                }
            }

            if (processed > config.maxloop || (Date.now() - tstart) > config.maxcycle) {
                break;
            }
        }

        best.processed = processed;
        const currentUpperBound = solutionQueue.findGreatest();
        best.currentUpperBound = currentUpperBound ? currentUpperBound.value.bound : best.bound;
        tcum += Date.now() - tstart;
        best.time = tcum;
        if (solutionQueue.length == 0 && (!workers || workers.filter(x => x.q || x.results.length).length == 0))
            best.optimal = true;
        else
            best.optimal = false;

        if (best.optimal) {
            best.score = best.scoring().rounding(best.score);
            if (best.scoreInfo) {
                best.scoreInfo.distance = best.scoring().rounding(best.scoreInfo.distance);
                if (best.scoreInfo.cp)
                    best.scoreInfo.cp.d = best.scoring().rounding(best.scoreInfo.cp.d);
            }
            reset = true;
            if (config.env && config.env.WorkerThreads)
                for (let w of workers)
                    w.terminate();
            return best;
        } else
            reset = yield best;
    } while (!reset);
}

module.exports = solver;
