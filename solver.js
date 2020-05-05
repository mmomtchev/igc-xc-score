'use strict';
const SortedSet = require('collections/sorted-set');
const solution = require('./solution');
const Solution = solution.Solution;
const foundation = require('./foundation');
const Range = foundation.Range;
const Point = foundation.Point;
const geom = require('./geom');
const Flight = require('./flight');
const scoringRules = require('./scoring-rules.config');

function analyze(flight, config) {
    const oldlen = flight.fixes.length;
    if (!config.invalid)
        flight.fixes = flight.fixes.filter(x => x.valid);
    if (config.detectLaunch || config.detectLanding) {
        Flight.analyze({ flight });

        if (config.detectLaunch) {
            const launch = Flight.detectLaunch({ flight });
            if (launch !== undefined) {
                if (!config.quiet)
                    console.log(`Launch detected at fix ${launch}, ${flight.fixes[0].time}`);
                flight.fixes.splice(0, launch);
                flight.flightPoints.splice(0, launch);
            }
        }

        if (config.detectLanding) {
            const landing = Flight.detectLanding({ flight });
            if (landing !== undefined) {
                if (!config.quiet)
                    console.log(`Landing detected at fix n-${flight.fixes.length - landing - 1}, ${flight.fixes[flight.fixes.length - 1].time}`);
                flight.fixes.splice(landing);
                flight.flightPoints.splice(landing);
            }
        }  
    }
    if (flight.fixes.length < 5)
        throw new Error(`Flight must contain at least 5 valid GPS fixes, ${flight.fixes.length} valid fixes found (out of ${oldlen})`);
}

function* solver(flight, _scoringTypes, _config) {
    let reset;

    const scoringTypes = _scoringTypes || scoringRules.FFVL;
    const config = _config || {};
    geom.init({ flight });
    analyze(flight, config);
    geom.init({ flight });
    if (config.hp)
        Point.prototype.distanceEarth = Point.prototype.distanceEarthVincentys;
    else
        Point.prototype.distanceEarth = Point.prototype.distanceEarthFCC;
    let solutionRoots = [];
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

module.exports = solver;