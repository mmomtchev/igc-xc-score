const fs = require('fs');
const IGCParser = require('./igc-parser');
const scoring = require('./scoring');
const solver = require('./solver');
const util = require('./util');

if (!process.argv[2]) {
    console.log('please specify an IGC file');
    process.exit(1);
}

const flight = IGCParser.parse(fs.readFileSync(process.argv[2], 'utf8'));

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
const best = solver(flight, scoring.defaultScoringTypes, config);

if (config.out)
    fs.writeFileSync(config.out, JSON.stringify(best.geojson(config)));

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