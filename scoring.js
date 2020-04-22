const solution = require('./solution');
const Solution = solution.Solution;
const util = require('./util');
const Box = util.Box;
const Point = util.Point;
const Range = util.Range;
const geom = require('./geom');

/*
These are the default scoring types
*/
const scoringFFVL = [
    {
        name: 'Flat Triangle',
        bound: boundFlatTriangle,
        score: scoreFlatTriangle,
        closingDistance: isClosedTriangle,
        rounding: round2,
        cardinality: 3
    },
    {
        name: 'FAI Triangle',
        bound: boundFAITriangle,
        score: scoreFAITriangle,
        closingDistance: isClosedTriangle,
        rounding: round2,
        cardinality: 3
    },
    {
        name: '3 TP Distance',
        bound: boundDistance3Points,
        score: scoreDistance3Points,
        rounding: round2,
        cardinality: 3
    }
];

function boundFlatTriangle(ranges, opt) {        
    let boxes = [];
    for (let r of [0, 1, 2])
        boxes[r] = new Box(ranges[r], opt.flight);

    const maxDistance = geom.maxDistance3Rectangles(boxes, (i, j, k) => {
        return i.distanceEarth(j) + j.distanceEarth(k) + k.distanceEarth(i);
    });
    
    let cp = { d: 0 };
    if (ranges[0].b < ranges[2].a) {
        cp = geom.isTriangleClosed(ranges[0].b, ranges[2].a, maxDistance, opt);
        if (!cp)
            return 0;
        return (maxDistance * 1.2) - (cp.d > 3 ? cp.d : 0);
    }

    return maxDistance * 1.2;
}

function scoreFlatTriangle(tp, opt) {    
    const distance = tp[0].distanceEarth(tp[1]) + tp[1].distanceEarth(tp[2]) + tp[2].distanceEarth(tp[0]);

    let cp = geom.isTriangleClosed(tp[0].r, tp[2].r, distance, opt);
    if (!cp)
        return { score: 0 };

    let score = distance * 1.2 - (cp.d > 3 ? cp.d : 0);

    return { distance, score, tp, cp };
}

function isClosedTriangle(distance) {
    return Math.max(3, distance * 0.05);
}

function boundDistance3Points(ranges, opt) {
    let boxes = [];
    for (let r of [0, 1, 2])
        boxes[r] = new Box(ranges[r], opt.flight);
    const pin = geom.findFurthestPointInSegment(0, ranges[0].a, boxes[0], opt);
    const pout = geom.findFurthestPointInSegment(ranges[2].b, opt.flight.fixes.length - 1, boxes[2], opt);
    const maxDistance = geom.maxDistanceNRectangles([pin, boxes[0], boxes[1], boxes[2], pout]);
    return maxDistance;
}

function scoreDistance3Points(tp, opt) {
    let distance = 0;
    const pin = geom.findFurthestPointInSegment(0, tp[0].r, tp[0], opt);
    const pout = geom.findFurthestPointInSegment(tp[2].r, opt.flight.fixes.length - 1, tp[2], opt);
    const all = [pin, tp[0], tp[1], tp[2], pout];
    for (let i of [0, 1, 2, 3])
        distance += all[i].distanceEarth(all[i + 1]);
    return { distance, score: distance, tp: tp, cp: { in: pin, out: pout, d: 0 } };
}

const MINSIDE = 0.28
function boundFAITriangle(ranges, opt) {
    let boxes = [];
    for (let r of [0, 1, 2])
        boxes[r] = new Box(ranges[r], opt.flight);

    const maxTriDistance = geom.maxDistance3Rectangles(boxes, (i, j, k) => {
        return i.distanceEarth(j) + j.distanceEarth(k) + k.distanceEarth(i);
    });
    const minTriDistance = geom.minDistance3Rectangles(boxes, (i, j, k) => {
        return i.distanceEarth(j) + j.distanceEarth(k) + k.distanceEarth(i);
    });

    const maxAB = geom.maxDistance2Rectangles([boxes[0], boxes[1]]);
    const maxBC = geom.maxDistance2Rectangles([boxes[1], boxes[2]]);
    const maxCA = geom.maxDistance2Rectangles([boxes[2], boxes[0]]);
    const maxDistance = Math.min(maxAB / MINSIDE, maxBC / MINSIDE, maxCA / MINSIDE, maxTriDistance);
    if (maxDistance < minTriDistance)
        return 0;

    let cp = { d: 0 };
    if (ranges[0].b < ranges[2].a) {
        cp = geom.isTriangleClosed(ranges[0].b, ranges[2].a, maxDistance, opt);
        if (!cp)
            return 0;
        return (maxDistance * 1.4) - (cp.d > 3 ? cp.d : 0);
    }

    return maxDistance * 1.4;
}

function scoreFAITriangle(tp, opt) {
    const d0 = tp[0].distanceEarth(tp[1]);
    const d1 = tp[1].distanceEarth(tp[2]);
    const d2 = tp[2].distanceEarth(tp[0]);
    const distance = d0 + d1 + d2;
    let score = 0;
    if (d0 > 0.28 * distance && d1 > 0.28 * distance && d2 > 0.28 * distance)
        score = distance * 1.4;

    let cp = geom.isTriangleClosed(tp[0].r, tp[2].r, distance, opt);
    if (!cp)
        return { score: 0 };

    score = score - (cp.d > 3 ? cp.d : 0);

    return { distance, score, tp, cp };
}

function round2(score) {
    return score.toFixed(2);
}

module.exports = {
    defaultScoringTypes: scoringFFVL,
    scoringFFVL,
    isClosedTriangle,
    boundFlatTriangle,
    scoreFlatTriangle,
    boundDistance3Points,
    scoreDistance3Points,
    boundFAITriangle,
    scoreFAITriangle,
}