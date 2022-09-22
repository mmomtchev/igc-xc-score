'use strict';
import * as fs from 'fs';
import IGCParser from 'igc-parser';
import solver from './solver.js';
import { Solution } from './solution.js';
import * as util from './util.js';
import scoringRules from '../scoring-rules.config.js';

function displayPoint(p) {
    return `${(p.r || '').toString().padStart(4, ' ')} : ${p.x.toFixed(5)}°:${p.y.toFixed(5)}°`;
}

let config = {};
for (let arg of process.argv.slice(2)) {
    if (!arg.includes('='))
        config.in = arg;
    else {
        const kv = arg.split('=');
        if (!isNaN(kv[1]))
            config[kv[0]] = parseInt(kv[1]);
        else if (kv[1] === 'true')
            config[kv[0]] = true;
        else if (kv[1] === 'false')
            config[kv[0]] = false;
        else
            config[kv[0]] = kv[1];
    }
}

if (Object.keys(config).length && !config.quiet)
    console.log(config);

if (config.scoring && !scoringRules[config.scoring]) {
    console.log(`No scoring rules named ${config.scoring}`);
    process.exit(2);
}

let inf = config.in, outf = config.out;
if (config.pipe) {
    inf = 0;
    outf = 1;
} else {
    if (inf == undefined) {
        // eslint-disable-next-line no-undef
        console.log(`igc-xc-score ${typeof _version !== 'undefined' ? _version : 'from source'}`);
        // eslint-disable-next-line no-undef
        console.log(`Momtchil Momtchev (velivole.fr/meteo.guru) & contributors, © 2020-${typeof _year !== 'undefined' ? _year : 'present'}, LGPL 3.0`);
        console.log('Usage:');
        console.log('igc-xc-score [in=]<flight.igc> [out=flight.json] [maxtime=<n>] [scoring=FFVL|XContest|FAI|XCLeague] [quiet=true] [pipe=true] [progress=<n>] ...');
        console.log('flight.igc                           is the flight track log');
        console.log('out=flight.json                      save the optimal solution in GeoJSON format');
        console.log('maxtime=n                            limit the execution time to n seconds');
        console.log('scoring=FFVL|XContest|FAI|XCLeague   select the scoring rules');
        console.log('quiet=true                           suppress all output');
        console.log('pipe=true                            read flight data from stdin and write optimal solutions to stdout, works best with quiet');
        console.log('progress=<n>                         output an intermediate solution every n milliseconds, works best with pipe');
        console.log('hp=true                              enable High Precision mode (twice slower, precision goes from 10m-20m to 0.6m)');
        console.log('trim=true                            auto-trim the flight log to its launch and landing points');
        process.exit(1);
    }
}
try {
    const flight = IGCParser.parse(fs.readFileSync(inf, 'utf8'), { lenient: true });
    config.env = { fs };

    let best;
    const tend = Date.now() + config.maxtime * 1000;
    config.maxcycle = config.progress || 100;
    const it = solver(flight, scoringRules[config.scoring] || scoringRules.FFVL, config);
    /* 
     * BEWARE!
     * In JS generators a for..of loop will ignore the closing return value of the generator
     * This is the only type of loop that works
     */
    let newbest;
    do {
        newbest = it.next();
        if (config.progress)
            process.stdout.write(JSON.stringify(newbest.value.geojson()));
        if (best === undefined || !Solution.prototype.contentEquals(newbest.value, best)) {
            best = newbest.value;
            if (!config.quiet)
                process.stdout.write('best so far is ' + best + '                                                               \n');
        }
        if (!config.quiet)
            process.stdout.write(
                `processing solutions, current upper bound is ${best.currentUpperBound.toFixed(4)}             \r`);
        if (config.maxtime !== undefined && Date.now() > tend) {
            if (!config.quiet)
                process.stdout.write('max execution time reached, no optimal solution found                                         \r');
            break;
        }
        const mem = process.memoryUsage();
        if (mem.heapUsed / mem.heapTotal > 0.98) {
            console.error('max memory usage reached, allocate more heap memory (--max-old-space-size)                  ');
            break;
        }
    } while (!newbest.done);
    process.stdout.write('                                                                                                      \r');

    if (outf !== undefined)
        fs.writeFileSync(outf, JSON.stringify(best.geojson()));

    if (!config.quiet) {
        for (let l of flight.ll) {
            console.log(`Launch at fix ${l.launch}, ${flight.filtered[l.launch].time}`);
            console.log(`Landing at fix n-${flight.filtered.length - l.landing - 1} ` +
                `${flight.filtered[l.landing].time}`);
        }
        if (best.scoreInfo !== undefined) {
            for (const leg of best.scoreInfo.legs) {
                console.log(`${leg.name.padStart(12, ' ')} : ${leg.d.toFixed(2).padStart(8, ' ')}km (${leg.start.distanceEarth(leg.finish).toFixed(3)}km)`);
            }

            if (config.debug) {
                if (best.scoreInfo.ep)
                    console.log(`str : ${displayPoint(best.scoreInfo.ep['start'])}`);
                for (const i in best.scoreInfo.tp)
                    console.log(`tp${(i)} : ${displayPoint(best.scoreInfo.tp[i])}`);
                if (best.scoreInfo.ep)
                    console.log(`fin : ${displayPoint(best.scoreInfo.ep['finish'])}`);
                console.log(`Processed ${(best.processed)/1000}K solutions for ${best.time/1000}s` +
                    ` (${(best.processed/best.time).toFixed(3)}Ks/s)`);
            }
            
            console.log('Best solution is'
				+ ` ${(best.optimal ? util.consoleColors.fg.green + 'optimal' : util.consoleColors.fg.red + 'not optimal')
                    + util.consoleColors.reset}`
				+ ` ${util.consoleColors.fg.yellow}${best.opt.scoring.name}`
				+ ` ${util.consoleColors.fg.green}${best.score} points,`
				+ ` ${util.consoleColors.fg.yellow}${best.scoreInfo.distance}km,`
				+ ` multiplier is ${best.opt.scoring.multiplier}`
				+ (best.opt.scoring.closingDistance ? ` [ closing distance is ${best.scoreInfo.cp.d}km ]` : '')
				+ (best.scoreInfo.penalty ? ` [ penalty is ${best.scoreInfo.penalty}km ]` : '')
				+ (best.optimal ? '' : ` potential maximum score could be up to ${best.bound.toFixed(2)} points`)
				+ util.consoleColors.reset);
        } else
            console.log('no solution found, try increasing maximum running time,' +
                `potential maximum score could be up to ${best.bound.toFixed(2)} points`);
    }
} catch (e) {
    console.error(e.message);
    if (config && config.debug)
        console.error(e.stack);
    process.exit(1);
}
