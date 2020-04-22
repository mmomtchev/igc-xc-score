const SortedSet = require('collections/sorted-set');
const solution = require('./solution');
const Solution = solution.Solution;
const util = require('./util');
const Range = util.Range;
const geom = require('./geom');
const scoring = require('./scoring');

const terminalAvailable = process && process.stdout && process.stdout.write;

function solver(flight, scoringTypes = scoring.defaultScoringTypes, config = {}) {
    flight.fixes = flight.fixes.filter(x => x.valid);
    let solutionRoots = [];
    geom.init({ flight });
    for (let scoringType of scoringTypes) {
        const opt = {
            flight,
            scoring: scoringType
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
    const tstart = Date.now();
    outer:
    while (solutionQueue.length > 0) {
        let current = solutionQueue.pop();
        if (!config.quiet && terminalAvailable)
            process.stdout.write(`${solutionQueue.length} elements in queue, processing ${current.id}`
                + ` ( <${current.bound.toFixed(4)} ~${best.opt.scoring.rounding(current.score)} ) best=${best.opt.scoring.rounding(best.score)} (${best.opt.scoring.name})`
                + (config.debug ? (
                ` ${current.ranges[0].count()} ${current.ranges[1].count()} ${current.ranges[2].count()}` 
                + ` ${current.ranges[0].a}:${current.ranges[0].b} ${current.ranges[1].a}:${current.ranges[1].b} ${current.ranges[2].a}:${current.ranges[2].b}\r`) : '\r'));

        if (current.bound <= best.score) {
            if (!config.quiet && terminalAvailable)
                process.stdout.write('only shit left in queue                                                                                                                  \n');
            break;
        }
        let children = current.do_branch();
        for (let s of children) {
            s.do_bound();
            if (s.bound <= best.score)
                continue;
            s.do_score();
            processed++;
            if (processed > config.maxloop || (Date.now() - tstart) / 1000 > config.maxtime) {
                best.optimal = false;
                process.stderr.write('max limit reached                    \n');
                break outer;
            }
            if (s.score >= best.score && s.score > 0) {
                best = s;
                if (!config.quiet && terminalAvailable)
                    process.stdout.write(`best so far : ${s.opt.scoring.name}, ${s.score.toFixed(5)} points, id:${s.id}`
                        + (config.debug ? (` ${s.ranges[0].a}:${s.ranges[0].b} ${s.ranges[1].a}:${s.ranges[1].b} ${s.ranges[2].a}:${s.ranges[2].b} ${s.parent}`) : '')
                        + '                                                                        \n');
                
                if (solutionQueue.length > 10000 && solutionQueue.findLeast().value.bound <= best.score) {
                    const garbageBest = solutionQueue.findGreatestLessThanOrEqual({ bound: best.score });
                    if (garbageBest !== undefined) {
                        const cutoff = solutionQueue.indexOf(garbageBest.value);
                        const garbageSize = solutionQueue.splice(0, cutoff + 1).length;
                        if (!config.quiet && terminalAvailable)
                            process.stdout.write(`throwing out the shit....  ${garbageSize} solutions zapped                                \n`);
                    }
                }
            }
            solutionQueue.push(s);
        }
    }
    if (!config.quiet && terminalAvailable)
        process.stdout.write(`processed ${processed} candidates                                                           \n`);

    best.processed = processed;
    best.time = Date.now() - tstart;
    if (best.optimal === undefined)
        best.optimal = true;
    best.score = best.opt.scoring.rounding(best.score);
    if (best.scoreInfo) {
        best.scoreInfo.distance = best.opt.scoring.rounding(best.scoreInfo.distance);
        if (best.scoreInfo.cp.d)
            best.scoreInfo.cp.d = best.opt.scoring.rounding(best.scoreInfo.cp.d);
    }
    return best;
}

module.exports = solver;