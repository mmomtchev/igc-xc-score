'use strict';
/**
 * igc-xc-score Solver
 * scoring library for paragliding flights
 * 
 * @module igc-xc-score
 * @author Momtchil Momtchev <momtchil@momtchev.com>
 */
import SortedSet from 'collections/sorted-set.js';
import { Solution } from './solution.js';
import { Range, Point } from './foundation.js';
import * as geom from './geom.js';
import * as Flight from './flight.js';
import scoringRules from '../scoring-rules.config.js';

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
export default function* solver(flight, _scoringTypes, _config) {
    let reset;

    const scoringTypes = _scoringTypes || scoringRules.FFVL;
    const config = _config || {};
    Flight.analyze(flight, config);
    geom.init({ flight });
    if (config.hp)
        Point.prototype.distanceEarth = Point.prototype.distanceEarthVincentys;
    else
        Point.prototype.distanceEarth = Point.prototype.distanceEarthFCC;
    let solutionRoots = [];
    for (let scoringType of scoringTypes) {
        for (let l of flight.ll) {
            const opt = {
                flight,
                launch: l.launch,
                landing: l.landing,
                scoring: scoringType,
                config
            };
            let solutionRoot = new Solution([
                new Range(l.launch, l.landing),
                new Range(l.launch, l.landing),
                new Range(l.launch, l.landing)
            ], opt);
            solutionRoot.do_bound();
            solutionRoot.do_score();
            solutionRoots.push(solutionRoot);
        }
    }

    let best = solutionRoots[0];
    let solutionQueue = new SortedSet(solutionRoots, Solution.prototype.contentEquals, Solution.prototype.contentCompare);
    let processed = 0;

    let tcum = 0;
    do {
        const tstart = Date.now();
        while (solutionQueue.length > 0) {
            if (processed % 100 === 0) {
                if (typeof process !== 'undefined' && process.memoryUsage) {
                    const mem = process.memoryUsage();
                    if (mem.heapUsed / mem.heapTotal > 0.98)
                        break;
                }
            }

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
                if (config.debug)
                    best.last = s;
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
            if (best.opt.scoring.post) {
                best.opt.scoring.post(best.scoreInfo, best.opt);
            }
            best.score = best.opt.scoring.rounding(best.score);
            if (best.scoreInfo) {
                best.scoreInfo.distance = best.opt.scoring.rounding(best.scoreInfo.distance);
                if (best.scoreInfo.cp)
                    best.scoreInfo.cp.d = best.opt.scoring.rounding(best.scoreInfo.cp.d);
            }
            reset = true;
            return best;
        } else
            reset = yield best;
    } while (!reset);
}
