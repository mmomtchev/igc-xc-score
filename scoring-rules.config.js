'use strict';
const scoring = require('./scoring');

/*
 * These are the scoring types
 *
 * The differences are mostly in the mutipliers and the way the closing distances of the triangles are calculated
 * 
 * These are the tools that are already implemented in scoring.js/geom.js:
 * closingDistance is the triangle closing type, you choose between two types:
 *      closingWithLimit - closing distance is limited
 *      closingWithPenalty - closing distance is unlimited but incurs a penalty
 * closingDistanceFixed is the fixed closing distance that is always accepted
 * closingDistanceFree is the closing distance that does not incur any scoring penalty
 * closingDistanceRelative is the closing distance that is relative to the full triangle length but incurs a penalty
*/
const rules = {
    'FFVL': [
        {
            name: 'Distance 3 points',
            multiplier: 1,
            bound: scoring.boundDistance3Points,
            score: scoring.scoreDistance3Points,
            rounding: round2,
            cardinality: 3
        },
        {
            name: 'Triangle plat',
            multiplier: 1.2,
            bound: scoring.boundFlatTriangle,
            score: scoring.scoreFlatTriangle,
            closingDistance: scoring.closingWithLimit,
            closingDistanceFixed: 3,
            closingDistanceFree: 3,
            closingDistanceRelative: 0.05,
            rounding: round2,
            cardinality: 3
        },
        {
            name: 'Triangle FAI',
            multiplier: 1.4,
            bound: scoring.boundFAITriangle,
            score: scoring.scoreFAITriangle,
            minSide: 0.28,
            closingDistance: scoring.closingWithLimit,
            closingDistanceFixed: 3,
            closingDistanceFree: 3,
            closingDistanceRelative: 0.05,
            rounding: round2,
            cardinality: 3
        }
    ],
    'XContest': [
        {
            name: 'Free flight',
            multiplier: 1,
            bound: scoring.boundDistance3Points,
            score: scoring.scoreDistance3Points,
            rounding: round2,
            cardinality: 3
        },
        {
            name: 'Free triangle',
            multiplier: 1.2,
            bound: scoring.boundFlatTriangle,
            score: scoring.scoreFlatTriangle,
            closingDistance: scoring.closingWithLimit,
            closingDistanceRelative: 0.2,
            rounding: round2,
            cardinality: 3
        },
        {
            name: 'FAI triangle',
            multiplier: 1.4,
            bound: scoring.boundFAITriangle,
            score: scoring.scoreFAITriangle,
            minSide: 0.28,
            closingDistance: scoring.closingWithLimit,
            closingDistanceRelative: 0.2,
            rounding: round2,
            cardinality: 3
        },
        {
            name: 'Closed free triangle',
            multiplier: 1.4,
            bound: scoring.boundFlatTriangle,
            score: scoring.scoreFlatTriangle,
            closingDistance: scoring.closingWithLimit,
            closingDistanceFixed: 0,
            closingDistanceFree: 0,
            closingDistanceRelative: 0.05,
            rounding: round2,
            cardinality: 3
        },
        {
            name: 'Closed FAI triangle',
            multiplier: 1.6,
            bound: scoring.boundFAITriangle,
            score: scoring.scoreFAITriangle,
            minSide: 0.28,
            closingDistance: scoring.closingWithLimit,
            closingDistanceFixed: 0,
            closingDistanceFree: 0,
            closingDistanceRelative: 0.05,
            rounding: round2,
            cardinality: 3
        }
    ]
};

function round2(score) {
    return parseFloat(parseFloat(score).toFixed(2));
}

module.exports = rules;