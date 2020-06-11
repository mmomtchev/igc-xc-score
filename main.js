'use strict';
const solver = require('./solver');
const parser = require('./igc-parser');
const scoring = require('./scoring-rules.config');

module.exports = {
    solver,
    parser,
    scoring
};