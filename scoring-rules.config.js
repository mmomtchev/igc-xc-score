'use strict';
import * as scoring from './src/scoring.js';

/**
 * These are the scoring types
 * @enum {object[][]} scoringRules
 *
 * The differences are mostly in the mutipliers and the way the closing distances of the triangles are calculated
 * 
 * These are the tools that are already implemented in scoring.js/geom.js:
 * @param {function} closingDistance is the triangle closing type, you choose between two types:
 *      closingWithLimit - closing distance is limited
 *      closingWithPenalty - closing distance is unlimited but incurs a penalty
 * @param {number} closingDistanceFixed is the fixed closing distance that is always accepted
 * @param {number} closingDistanceFree is the closing distance that does not incur any scoring penalty
 * @param {number} closingDistanceRelative is the closing distance that is relative to the full triangle length but incurs a penalty
 */
const scoringRules = {
    /**
     * @constant {object[]}
     */
    'FFVL': [
        {
            name: 'Distance 3 points',
            multiplier: 1,
            bound: scoring.boundDistance3Points,
            score: scoring.scoreDistance3Points,
            rounding: round2,
            cardinality: 3,
            code: 'od'
        },
        {
            name: 'Triangle plat',
            multiplier: 1.2,
            bound: scoring.boundTriangle,
            score: scoring.scoreTriangle,
            closingDistance: scoring.closingWithLimit,
            closingDistanceFixed: 3,
            closingDistanceFree: 3,
            closingDistanceRelative: 0.05,
            rounding: round2,
            cardinality: 3,
            code: 'tri'
        },
        {
            name: 'Triangle FAI',
            multiplier: 1.4,
            bound: scoring.boundTriangle,
            score: scoring.scoreTriangle,
            minSide: 0.28,
            closingDistance: scoring.closingWithLimit,
            closingDistanceFixed: 3,
            closingDistanceFree: 3,
            closingDistanceRelative: 0.05,
            rounding: round2,
            cardinality: 3,
            code: 'fai'
        }
    ],
    /**
     * @constant {object[]}
     */
    'XContest': [
        {
            name: 'Free Flight',
            multiplier: 1,
            bound: scoring.boundDistance3Points,
            score: scoring.scoreDistance3Points,
            rounding: round2,
            cardinality: 3,
            code: 'od'
        },
        {
            name: 'Free Triangle',
            multiplier: 1.2,
            bound: scoring.boundTriangle,
            score: scoring.scoreTriangle,
            closingDistance: scoring.closingWithLimit,
            closingDistanceRelative: 0.2,
            rounding: round2,
            cardinality: 3,
            code: 'tri'
        },
        {
            name: 'FAI Triangle',
            multiplier: 1.4,
            bound: scoring.boundTriangle,
            score: scoring.scoreTriangle,
            minSide: 0.28,
            closingDistance: scoring.closingWithLimit,
            closingDistanceRelative: 0.2,
            rounding: round2,
            cardinality: 3,
            code: 'fai'
        },
        {
            name: 'Closed Free Triangle',
            multiplier: 1.4,
            bound: scoring.boundTriangle,
            score: scoring.scoreTriangle,
            closingDistance: scoring.closingWithLimit,
            closingDistanceFixed: 0,
            closingDistanceFree: 0,
            closingDistanceRelative: 0.05,
            rounding: round2,
            cardinality: 3,
            code: 'tri'
        },
        {
            name: 'Closed FAI Triangle',
            multiplier: 1.6,
            bound: scoring.boundTriangle,
            score: scoring.scoreTriangle,
            minSide: 0.28,
            closingDistance: scoring.closingWithLimit,
            closingDistanceFixed: 0,
            closingDistanceFree: 0,
            closingDistanceRelative: 0.05,
            rounding: round2,
            cardinality: 3,
            code: 'fai'
        }
    ],
    /**
     * @constant {object[]}
     */
    'FAI': [
        {
            name: 'Open Distance',
            multiplier: 1,
            bound: scoring.boundDistance3Points,
            score: scoring.scoreDistance3Points,
            rounding: round2,
            cardinality: 3,
            code: 'od'
        },
        {
            name: 'Free Triangle',
            multiplier: 1.2,
            bound: scoring.boundTriangle,
            score: scoring.scoreTriangle,
            closingDistance: scoring.closingWithLimit,
            closingDistanceFree: 0.8,
            closingDistanceFixed: 0.8,
            rounding: round2,
            cardinality: 3,
            code: 'tri'
        },
        {
            name: 'FAI Triangle',
            multiplier: 1.4,
            bound: scoring.boundTriangle,
            score: scoring.scoreTriangle,
            minSide: 0.28,
            closingDistance: scoring.closingWithLimit,
            closingDistanceFree: 0.8,
            closingDistanceFixed: 0.8,
            rounding: round2,
            cardinality: 3,
            code: 'fai'
        },
    ],
    /**
     * @constant {object[]}
     * This is a special type of flight that does not have proper scoring
     * It is used only for Out-and-Return Distance to one turnpoint records
     */
    'FAI-OAR': [
        {
            name: 'Out-and-Return Distance',
            multiplier: 1,
            bound: scoring.boundOutAndReturn1,
            score: scoring.scoreOutAndReturn1,
            closingDistance: scoring.closingWithLimit,
            closingDistanceFree: 0.8,
            closingDistanceFixed: 0.8,
            rounding: round2,
            cardinality: 3,
            code: 'oar'
        }
    ],
    /**
     * @constant {object[]}
     */
    'XCLeague': [
        {
            /**
             * This the XCLeague definition of Out-and-Return Distance
             * between 2 turnpoints
             */
            name: 'Out-and-Return Distance',
            multiplier: 2,
            bound: scoring.boundOutAndReturn2,
            score: scoring.scoreOutAndReturn2,
            closingDistance: scoring.closingWithLimit,
            closingDistanceFixed: 0.8,
            rounding: round2,
            cardinality: 2,
            code: 'oar'
        },
        {
            name: 'Turnpoint Flight',
            multiplier: 1,
            bound: scoring.boundDistance3Points,
            score: scoring.scoreDistance3Points,
            rounding: round2,
            cardinality: 3,
            code: 'od'
        },
        {
            name: 'Flat Triangle',
            multiplier: 2.0,
            bound: scoring.boundTriangle,
            score: scoring.scoreTriangle,
            minSide: 0.15,
            maxSide: 0.45,
            closingDistance: scoring.closingWithLimit,
            closingDistanceFixed: 0.8,
            rounding: round2,
            cardinality: 3,
            code: 'tri'
        },
        {
            name: 'FAI Triangle',
            multiplier: 2.3,
            bound: scoring.boundTriangle,
            score: scoring.scoreTriangle,
            minSide: 0.28,
            closingDistance: scoring.closingWithLimit,
            closingDistanceFixed: 0.8,
            rounding: round2,
            cardinality: 3,
            code: 'tri'
        }
    ]
};

function round2(score) {
    return parseFloat(parseFloat(score).toFixed(2));
}

export default scoringRules;
