'use strict';
const fs = require('fs');
const IGCParser = require('./igc-parser');
const scoring = require('./scoring');
const solver = require('./solver');
const Solution = require('./solution').Solution;
const util = require('./util');

let config = { };
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

let inf, outf;
if (config.pipe) {
    inf = 0;
    outf = 1;
} else {
    if (!process.argv[2]) {
        console.log('please specify an IGC file');
        process.exit(1);
    }
    inf = process.argv[2];
    outf = config.out;
}
const flight = IGCParser.parse(fs.readFileSync(inf, 'utf8'));
config.env = { fs };

let best;
const tend = Date.now() + config.maxtime * 1000;
config.maxcycle = config.progress || 100;
const it = solver(flight, scoring.defaultScoringTypes, config);
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
        process.stdout.write(`processing solutions, current upper bound is ${best.currentUpperBound.toFixed(4)}             \r`);
    if (config.maxtime !== undefined && Date.now() > tend) {
        process.stdout.write('max execution time reached, no optimal solution found                                         \r');
        break;
    }
} while (!newbest.done);
process.stdout.write('                                                                                                      \r');

if (outf !== undefined)
    fs.writeFileSync(outf, JSON.stringify(best.geojson()));

if (!config.quiet) {
    if (best.scoreInfo !== undefined) {
        console.log(`best solution is ${(best.optimal ? util.consoleColors.fg.green + 'optimal' : util.consoleColors.fg.red + 'not optimal') + util.consoleColors.reset}`
            + ` ${util.consoleColors.fg.yellow}${best.opt.scoring.name}`
            + ` ${util.consoleColors.fg.green}${best.score} points,`
            + ` ${util.consoleColors.fg.yellow}${best.scoreInfo.distance}km`
            + (best.opt.scoring.closingDistance ? ` [ closing distance is ${best.scoreInfo.cp.d}km ]` : '')
            + (best.optimal ? '' : ` potential maximum score could be up to ${best.bound.toFixed(2)} points`)
            + util.consoleColors.reset);
    } else
        console.log(`no solution found, try increasing maximum running time, potential maximum score could be up to ${best.bound.toFixed(2)} points`);
}