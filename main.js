'use strict';
const solver = require('./solver');
const parser = require('./igc-parser');
const scoring = require('./scoring-rules.config');
const IGCParser = require('./igc-parser');

module.exports = {
    solver,
    parser,
    scoring,
    IGCParser
};