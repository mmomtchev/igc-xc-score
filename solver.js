'use strict';
const WorkerThreads = require('worker_threads');
const Worker = WorkerThreads.Worker;
const SortedSet = require('collections/sorted-set');
const SharedMap = require('sharedmap');
const worker = require('./worker');
const solution = require('./solution');
const Solution = solution.Solution;
const foundation = require('./foundation');
const Box = foundation.Box;
const Point = foundation.Point;
const Range = foundation.Range;
const scoringRules = require('./scoring-rules.config');

const NWORKERS = require('os').cpus().length;
const MAXQ = 40;
const MINQ = 20;

function enqueueSolution(s) {
    this.postMessage(s);
    this.qlen++;
    if (this.q === undefined) {
        this.q = new Promise((res, rej) => {
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
    }
    this.results = this.results.concat(msgs);
    this.qlen--;
    if (this.qlen < MINQ) {
        const willResolve = this.resolve;
        if (this.qlen > 0)
            this.q = new Promise((res, rej) => {
                this.resolve = res;
            });
        else
            this.q = undefined;
        willResolve(this);
    }
}

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

    let tcum = 0;
    do {
        const tstart = Date.now();
        while (solutionQueue.length > 0 || workers.filter(x => x.q).length > 0) {
            if (processed % 100 === 0) {
                if (process && process.memoryUsage) {
                    const mem = process.memoryUsage();
                    if (mem.heapUsed / mem.heapTotal > 0.98)
                        break;
                }
            }

            if (solutionQueue.length > 0 && workers.filter(x => x.q).length < NWORKERS) {
                let current = solutionQueue.pop();
                if (current.scoring(config).rounding(current.bound) <= best.scoring(config).rounding(best.score)) {
                    solutionQueue.clear();
                    continue;
                }
                const w = workers.find(x => x.qlen < MAXQ);
                current.trace('enqueue', config);
                enqueueSolution.call(w, current);
                processed++;
            }

            if (workers.filter(x => x.q).length == NWORKERS || solutionQueue.length == 0) {
                const w = await Promise.race(workers.filter(x => x.q).map(x => x.q));
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
        if (solutionQueue.length == 0)
            best.optimal = true;
        else
            best.optimal = false;

        if (best.optimal) {
            best.score = best.scoring().rounding(best.score);
            if (best.scoreInfo) {
                best.scoreInfo.distance = best.scoring().rounding(best.scoreInfo.distance);
                if (best.scoreInfo.cp.d)
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