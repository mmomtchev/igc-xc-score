'use strict';
const fs = require('fs');
const IGCParser = require('igc-parser');
const Solution = require('../solution').Solution;
const util = require('../util');
const Range = util.Range;
const geom = require('../geom');
const scoringRules = require('../scoring-rules.config');

const flight = IGCParser.parse(fs.readFileSync(process.argv[2], 'utf8'));

for (let r of Object.keys(scoringRules))
    for (let s of scoringRules[r]) {
        const opt = {
            flight,
            scoring: s,
            config: {},
        };
        let solution = new Solution([
            new Range(parseInt(process.argv[3]), parseInt(process.argv[3])),
            new Range(parseInt(process.argv[4]), parseInt(process.argv[4])),
            new Range(parseInt(process.argv[5]), parseInt(process.argv[5])),
        ], opt);
        geom.init(opt);
        solution.do_bound();
        solution.do_score();
        console.log(r, solution.toString());
    }