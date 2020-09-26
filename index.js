'use strict';
const fs = require('fs');
const WorkerThreads = require('worker_threads');
const IGCParser = require('igc-parser');
const solver = require('./solver');
const Solution = require('./solution').Solution;
const util = require('./util');
const scoringRules = require('./scoring-rules.config');

function displayDistance(labela, labelb, a, b) {
    console.log(labela.padStart(6, ' '), labelb.padStart(6, ' '),
        ''.padStart(4, ' '), a.distanceEarth(b).toFixed(2) + 'km');
}

let config = {};
for (let arg of process.argv.slice(3)) {
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

if (Object.keys(config).length && !config.quiet)
    console.log(config);

if (config.scoring && !scoringRules[config.scoring]) {
    console.log(`No scoring rules named ${config.scoring}`);
    process.exit(2);
}

let inf, outf;
if (config.pipe) {
    inf = 0;
    outf = 1;
} else {
    if (!process.argv[2]) {
        console.log(`igc-xc-score ${require('./package.json').version}`);
        console.log('Momtchil Momtchev, velivole.fr/meteo.guru, 2020/COVID19');
        console.log('Usage:');
        console.log('igc-xc-score <flight.igc> [out=flight.json] [maxtime=<n>] [scoring=FFVL|XContest] [quiet=true] [pipe=true] [progress=<n>] ...');
        console.log('flight.igc             is the flight track log');
        console.log('out=flight.json        save the optimal solution in GeoJSON format');
        console.log('maxtime=n              limit the execution time to n seconds');
        console.log('scoring=FFVL|XContest  select the scoring rules');
        console.log('quiet=true             suppress all output');
        console.log('pipe=true              read flight data from stdin and write optimal solutions to stdout, works best with quiet');
        console.log('progress=<n>           output an intermediate solution every n milliseconds, works best with pipe');
        console.log('hp=true                enable High Precision mode (twice slower, precision goes from 10m-20m to 0.6m)');
        console.log('trim=true              auto-trim the flight log to its launch and landing points');
        process.exit(1);
    }
    inf = process.argv[2];
    outf = config.out;
}
(async () => {
    const flight = IGCParser.parse(fs.readFileSync(inf, 'utf8'), { lenient: true });
    config.maxcycle = config.progress || 100;

    config.env = { fs, WorkerThreads };

    let best;
    const tend = Date.now() + config.maxtime * 1000;
    const it = solver(flight, config.scoring || 'FFVL', config);
    /* 
     * BEWARE!
     * In JS generators a for..of loop will ignore the closing return value of the generator
     * This is the only type of loop that works
     */
    let newbest;
    do {
        newbest = await it.next();
        if (config.progress)
            process.stdout.write(JSON.stringify(newbest.value.geojson(flight)));
        if (best === undefined || !Solution.prototype.contentEquals(newbest.value, best)) {
            best = newbest.value;
            if (!config.quiet)
                process.stdout.write('best so far is ' + best + '                                                               \n');
        }
        if (!config.quiet)
            process.stdout.write(`processing solutions, current upper bound is ${best.currentUpperBound.toFixed(4)}             \r`);
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
        fs.writeFileSync(outf, JSON.stringify(best.geojson(flight)));

    if (!config.quiet) {
        for (let l of flight.ll) {
            console.log(`Launch at fix ${l.launch}, ${flight.filtered[l.launch].time}`);
            console.log(`Landing at fix n-${flight.filtered.length - l.landing - 1}, ${flight.filtered[l.landing].time}`);
        }
        if (best.scoreInfo !== undefined) {
            if (best.scoreInfo.ep && best.scoreInfo.ep['start'])
                displayDistance('start', 'tp0', best.scoreInfo.ep['start'], best.scoreInfo.tp[0]);
            for (let i of [0, 1])
                displayDistance(`tp${i}`, `tp${i + 1}`, best.scoreInfo.tp[i], best.scoreInfo.tp[i + 1]);
            if (best.scoreInfo.ep && best.scoreInfo.ep['finish'])
                displayDistance('tp2', 'finish', best.scoreInfo.tp[2], best.scoreInfo.ep['finish']);
            else
                displayDistance('tp2', 'tp0', best.scoreInfo.tp[2], best.scoreInfo.tp[0]);
            console.log('Best solution is'
                + ` ${(best.optimal ? util.consoleColors.fg.green + 'optimal' : util.consoleColors.fg.red + 'not optimal') + util.consoleColors.reset}`
                + ` ${util.consoleColors.fg.yellow}${best.scoring().name}`
                + ` ${util.consoleColors.fg.green}${best.score} points,`
                + ` ${util.consoleColors.fg.yellow}${best.scoreInfo.distance}km`
                + (best.scoring().closingDistance ? ` [ closing distance is ${best.scoreInfo.cp.d}km ]` : '')
                + (best.optimal ? '' : ` potential maximum score could be up to ${best.bound.toFixed(2)} points`)
                + util.consoleColors.reset);
        } else
            console.log(`no solution found, try increasing maximum running time, potential maximum score could be up to ${best.bound.toFixed(2)} points`);
    }
    (function wait() {
        setTimeout(wait, 100000);
    })();
    process.exit(0);
})().catch(e => {
    console.error(e.message);
    if (config && config.debug)
        console.error(e.stack);
    process.exit(1);
});