'use strict';
const solver = require('./solver');
const parser = require('./igc-parser');
const scoring = require('./scoring-rules.config');
const IGCParser = require('./igc-parser');			/* Obsolete, to be deleted in 1.6 */

module.exports = {
    solver,
    parser,											/* Obsolete, to be deleted in 1.6 */
    scoring,
    IGCParser										/* Obsolete, to be deleted in 1.6 */
};