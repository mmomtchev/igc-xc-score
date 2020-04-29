'use strict';
const util = require('./util');
const Box = util.Box;
const geom = require('./geom');

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
        return (maxDistance * opt.scoring.multiplier) - closingPenalty(cp.d, opt);
    }

    return maxDistance * opt.scoring.multiplier;
}

function scoreFlatTriangle(tp, opt, distance_fn) {
    const d0 = distance_fn.call(tp[0], tp[1]);
    const d1 = distance_fn.call(tp[1], tp[2]);
    const d2 = distance_fn.call(tp[2], tp[0]);
    const distance = d0 + d1 + d2;

    let cp = geom.isTriangleClosed(tp[0].r, tp[2].r, distance, opt);
    if (!cp)
        return { score: 0 };

    let score = distance * opt.scoring.multiplier - closingPenalty(cp.d, opt);

    return { distance, score, tp, cp };
}

function closingPenalty(cd, opt) {
    return (cd > (opt.scoring.closingDistanceFree || 0) ? cd : 0);
}

function closingWithLimit(distance, opt) {
    return Math.max(opt.scoring.closingDistanceFixed || 0, distance * (opt.scoring.closingDistanceRelative || 0));
}

/*eslint no-unused-vars: ["error", { "args": "none" }]*/
function closingWithPenalty(distance, opt) {
    return Infinity;
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

function scoreDistance3Points(tp, opt, distance_fn) {
    let distance = 0;
    const pin = geom.findFurthestPointInSegment(0, tp[0].r, tp[0], opt);
    const pout = geom.findFurthestPointInSegment(tp[2].r, opt.flight.fixes.length - 1, tp[2], opt);
    const all = [pin, tp[0], tp[1], tp[2], pout];
    for (let i of [0, 1, 2, 3])
        distance += distance_fn.call(all[i], all[i + 1]);
    return { distance, score: distance, tp: tp, cp: { in: pin, out: pout, d: 0 } };
}

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
    const maxDistance = Math.min(maxAB / opt.scoring.minSide,
        maxBC / opt.scoring.minSide, maxCA / opt.scoring.minSide, maxTriDistance);
    if (maxDistance < minTriDistance)
        return 0;

    let cp = { d: 0 };
    if (ranges[0].b < ranges[2].a) {
        cp = geom.isTriangleClosed(ranges[0].b, ranges[2].a, maxDistance, opt);
        if (!cp)
            return 0;
        return (maxDistance * opt.scoring.multiplier) - closingPenalty(cp.d, opt);
    }

    return maxDistance * opt.scoring.multiplier;
}

function scoreFAITriangle(tp, opt, distance_fn) {
    const d0 = distance_fn.call(tp[0], tp[1]);
    const d1 = distance_fn.call(tp[1], tp[2]);
    const d2 = distance_fn.call(tp[2], tp[0]);
    const distance = d0 + d1 + d2;
    let score = 0;
    const minSide = opt.scoring.minSide * distance;
    if (d0 >= minSide && d1 >= minSide && d2 >= minSide)
        score = distance * opt.scoring.multiplier;

    let cp = geom.isTriangleClosed(tp[0].r, tp[2].r, distance, opt);
    if (!cp)
        return { score: 0 };

    score -= closingPenalty(cp.d, opt);

    return { distance, score, tp, cp };
}

module.exports = {
    closingWithLimit,
    closingWithPenalty,
    boundFlatTriangle,
    scoreFlatTriangle,
    boundDistance3Points,
    scoreDistance3Points,
    boundFAITriangle,
    scoreFAITriangle,
};