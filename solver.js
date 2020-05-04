'use strict';
const SortedSet = require('collections/sorted-set');
const solution = require('./solution');
const Solution = solution.Solution;
const foundation = require('./foundation');
const Range = foundation.Range;
const Point = foundation.Point;
const geom = require('./geom');
const scoringRules = require('./scoring-rules.config');

function* solver(flight, _scoringTypes, _config) {
    let reset;

    while (true) {
        const scoringTypes = _scoringTypes || scoringRules.FFVL;
        const config = _config || {};
        flight.fixes = flight.fixes.filter(x => x.valid);
        let solutionRoots = [];
        geom.init({ flight });
        for (let scoringType of scoringTypes) {
            const opt = {
                flight,
                scoring: scoringType,
                config
            };
            let solutionRoot = new Solution([
                new Range(0, flight.fixes.length - 1),
                new Range(0, flight.fixes.length - 1),
                new Range(0, flight.fixes.length - 1)
            ], opt);
            solutionRoot.do_bound();
            solutionRoot.do_score();
            solutionRoots.push(solutionRoot);
        }

        let best = solutionRoots[0];
        let solutionQueue = new SortedSet(solutionRoots, Solution.prototype.contentEquals, Solution.prototype.contentCompare);
        let processed = 0;

        let tcum = 0;
        do {
            const tstart = Date.now();
            while (solutionQueue.length > 0) {
                let current = solutionQueue.pop();

                if (current.opt.scoring.rounding(current.bound) <= best.opt.scoring.rounding(best.score)) {
                    solutionQueue.clear();
                    break;
                }
                let children = current.do_branch();
                for (let s of children) {
                    s.do_bound();
                    if (s.bound <= best.score)
                        continue;
                    s.do_score();
                    processed++;
                    if (s.score >= best.score && s.score > 0) {
                        best = s;
                        if (solutionQueue.length > 10000 && solutionQueue.findLeast().value.bound <= best.score) {
                            const garbageBest = solutionQueue.findGreatestLessThanOrEqual({ bound: best.score });
                            if (garbageBest !== undefined) {
                                const cutoff = solutionQueue.indexOf(garbageBest.value);
                                solutionQueue.splice(0, cutoff + 1).length;
                            }
                        }
                    }
                    solutionQueue.push(s);
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
                best.do_score(Point.prototype.distanceEarthHP);
                best.score = best.opt.scoring.rounding(best.score);
                if (best.scoreInfo) {
                    best.scoreInfo.distance = best.opt.scoring.rounding(best.scoreInfo.distance);
                    if (best.scoreInfo.cp.d)
                        best.scoreInfo.cp.d = best.opt.scoring.rounding(best.scoreInfo.cp.d);
                }
                reset = true;
                return best;
            } else
                reset = yield best;
        } while (!reset);
    }
}

module.exports = solver;