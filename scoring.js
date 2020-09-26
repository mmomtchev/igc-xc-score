'use strict';
const geom = require('./geom');

function closingPenalty(cd, opt, config, scoring) {
    return (cd > (scoring.closingDistanceFree || 0) ? cd : 0);
}

function closingWithLimit(distance, opt, config, scoring) {
    return Math.max(scoring.closingDistanceFixed || 0, distance * (scoring.closingDistanceRelative || 0));
}

/*eslint no-unused-vars: ["error", { "args": "none" }]*/
function closingWithPenalty(distance, opt) {
    return Infinity;
}

function boundDistance3Points(ranges, boxes, opt, config, scoring) {
    const pin = geom.findFurthestPointInSegment(opt.launch, ranges[0].a, boxes[0], opt, config, scoring);
    const pout = geom.findFurthestPointInSegment(ranges[2].b, opt.landing, boxes[2], opt, config, scoring);
    const maxDistance = geom.maxDistanceNRectangles([pin, boxes[0], boxes[1], boxes[2], pout]);
    return maxDistance * scoring.multiplier;
}

function scoreDistance3Points(tp, opt, config, scoring) {
    let distance = 0;
    const pin = geom.findFurthestPointInSegment(opt.launch, tp[0].r, tp[0], opt, config, scoring);
    const pout = geom.findFurthestPointInSegment(tp[2].r, opt.landing, tp[2], opt, config, scoring);
    const all = [pin, tp[0], tp[1], tp[2], pout];
    for (let i of [0, 1, 2, 3])
        distance += all[i].distanceEarth(all[i + 1]);
    const score = distance * scoring.multiplier;
    return { distance, score, tp: tp, ep: { start: pin, finish: pout } };
}

function maxFAIDistance(maxTriDistance, boxes, opt, config, scoring) {
    const minTriDistance = geom.minDistance3Rectangles(boxes, (i, j, k) => {
        return i.distanceEarth(j) + j.distanceEarth(k) + k.distanceEarth(i);
    });

    const maxAB = geom.maxDistance2Rectangles([boxes[0], boxes[1]]);
    const maxBC = geom.maxDistance2Rectangles([boxes[1], boxes[2]]);
    const maxCA = geom.maxDistance2Rectangles([boxes[2], boxes[0]]);
    const maxDistance = Math.min(maxAB / scoring.minSide,
        maxBC / scoring.minSide, maxCA / scoring.minSide, maxTriDistance);
    if (maxDistance < minTriDistance)
        return 0;
    return maxDistance;
}

function boundOpenTriangle(ranges, boxes, opt, config, scoring) {
    const pin = geom.findFurthestPointInSegment(opt.launch, ranges[0].a, boxes[0], opt);
    const pout = geom.findFurthestPointInSegment(ranges[2].b, opt.landing, boxes[2], opt);
    const maxD3PDistance = geom.maxDistanceNRectangles([pin, boxes[0], boxes[1], boxes[2], pout]);
    const maxTriDistance = geom.maxDistance3Rectangles(boxes, (i, j, k) => {
        return i.distanceEarth(j) + j.distanceEarth(k) + k.distanceEarth(i);
    });
    if (scoring.minSide !== undefined) {
        if (maxFAIDistance(maxTriDistance, boxes, opt) === 0)
            return 0;
    }

    let cp = { d: 0 };
    if (ranges[0].b < ranges[2].a) {
        cp = geom.isTriangleClosed(ranges[0].b, ranges[2].a, maxTriDistance, opt);
        if (!cp)
            return 0;
        return (maxD3PDistance - closingPenalty(cp.d, opt, config, scoring)) * scoring.multiplier;
    }

    return maxD3PDistance * scoring.multiplier;
}

function scoreOpenTriangle(tp, opt, config, scoring) {
    const d0 = tp[0].distanceEarth(tp[1]);
    const d1 = tp[1].distanceEarth(tp[2]);
    const d2 = tp[2].distanceEarth(tp[0]);
    const triDistance = d0 + d1 + d2;

    if (scoring.minSide !== undefined) {
        const minSide = scoring.minSide * triDistance;
        if (d0 < minSide || d1 < minSide || d2 < minSide)
            return { score: 0 };
    }

    let cp = geom.isTriangleClosed(tp[0].r, tp[2].r, triDistance, opt);
    if (!cp)
        return { score: 0 };

    let d3pDistance = 0;
    const pin = geom.findFurthestPointInSegment(opt.launch, tp[0].r, tp[0], opt);
    const pout = geom.findFurthestPointInSegment(tp[2].r, opt.landing, tp[2], opt);
    const all = [pin, tp[0], tp[1], tp[2], pout];
    for (let i of [0, 1, 2, 3])
        d3pDistance += all[i].distanceEarth(all[i + 1]);
    
    const distance = d3pDistance;
    const score = distance * scoring.multiplier - closingPenalty(cp.d, opt);
    return { distance, score, tp: tp, ep: { start: pin, finish: pout }, cp };
}

function boundTriangle(ranges, boxes, opt, config, scoring) {
    const maxTriDistance = geom.maxDistance3Rectangles(boxes, (i, j, k) => {
        return i.distanceEarth(j) + j.distanceEarth(k) + k.distanceEarth(i);
    });

    const maxDistance = (scoring.minSide !== undefined)
        ? maxFAIDistance(maxTriDistance, boxes, opt, config, scoring)
        : maxTriDistance;
    
    if (maxDistance === 0)
        return 0;

    let cp = { d: 0 };
    if (ranges[0].b < ranges[2].a) {
        cp = geom.isTriangleClosed(ranges[0].b, ranges[2].a, maxDistance, opt, config, scoring);
        if (!cp)
            return 0;
        return (maxDistance - closingPenalty(cp.d, opt, config, scoring)) * scoring.multiplier;
    }

    return maxDistance * scoring.multiplier;
}

function scoreTriangle(tp, opt, config, scoring) {
    const d0 = tp[0].distanceEarth(tp[1]);
    const d1 = tp[1].distanceEarth(tp[2]);
    const d2 = tp[2].distanceEarth(tp[0]);
    const distance = d0 + d1 + d2;
    
    if (scoring.minSide !== undefined) {
        const minSide = scoring.minSide * distance;
        if (d0 < minSide || d1 < minSide || d2 < minSide)
            return { score: 0 };
    }

    let cp = geom.isTriangleClosed(tp[0].r, tp[2].r, distance, opt, config, scoring);
    if (!cp)
        return { score: 0 };

    let score = (distance - closingPenalty(cp.d, opt, config, scoring)) * scoring.multiplier;

    return { distance, score, tp, cp };
}

module.exports = {
    closingWithLimit,
    closingWithPenalty,
    boundTriangle,
    scoreTriangle,
    boundDistance3Points,
    scoreDistance3Points,
    boundOpenTriangle,
    scoreOpenTriangle
};