'use strict';

import { Box, Range } from './foundation.js';
import * as geom from './geom.js';

export function closingPenalty(cd, opt) {
    return (cd > (opt.scoring.closingDistanceFree || 0) ? cd : 0);
}

export function closingWithLimit(distance, opt) {
    return Math.max(opt.scoring.closingDistanceFixed || 0, distance * (opt.scoring.closingDistanceRelative || 0));
}

/*eslint no-unused-vars: ["error", { "args": "none" }]*/
export function closingWithPenalty(distance, opt) {
    /* c8 ignore next */
    return Infinity;
}

// Upper limit for a 3TP distance flight with 3 TPs in boxes
export function boundDistance3Points(ranges, boxes, opt) {
    const pin = geom.findFurthestPointInSegment(opt.launch, ranges[0].start, boxes[0], opt);
    const pout = geom.findFurthestPointInSegment(ranges[2].end, opt.landing, boxes[2], opt);
    const maxDistance = geom.maxDistanceNRectangles([pin, boxes[0], boxes[1], boxes[2], pout]);
    return maxDistance * opt.scoring.multiplier;
}

// Score of a 3TP distance flight with all 3 points selected
export function scoreDistance3Points(tp, opt) {
    let distance = 0;
    const pin = geom.findFurthestPointInSegment(opt.launch, tp[0].r, tp[0], opt);
    const pout = geom.findFurthestPointInSegment(tp[2].r, opt.landing, tp[2], opt);
    const all = [pin, tp[0], tp[1], tp[2], pout];
    for (let i = 0; i < all.length - 1; i++)
        distance += all[i].distanceEarth(all[i + 1]);
    const score = distance * opt.scoring.multiplier;
    return { distance, score, tp: tp, ep: { start: pin, finish: pout } };
}

// Upper limit for a FAI triangle with vertices somewhere in boxes,
// maxTriDistance is the upper limit of the flat triangle
function maxFAIDistance(maxTriDistance, boxes, opt) {
    const minTriDistance = geom.minDistance3Rectangles(boxes, (i, j, k) => {
        return i.distanceEarth(j) + j.distanceEarth(k) + k.distanceEarth(i);
    });

    if (maxTriDistance < minTriDistance)
        return 0;

    const maxAB = geom.maxDistance2Rectangles([boxes[0], boxes[1]]);
    const maxBC = geom.maxDistance2Rectangles([boxes[1], boxes[2]]);
    const maxCA = geom.maxDistance2Rectangles([boxes[2], boxes[0]]);

    const maxDistance = Math.min(maxAB, maxBC, maxCA) / opt.scoring.minSide;
    if (maxDistance < minTriDistance)
        return 0;

    return Math.min(maxDistance, maxTriDistance);
}

// These are not used by any scoring method at the moment
/* c8 ignore start */
export function boundOpenTriangle(ranges, boxes, opt) {
    const pin = geom.findFurthestPointInSegment(opt.launch, ranges[0].start, boxes[0], opt);
    const pout = geom.findFurthestPointInSegment(ranges[2].end, opt.landing, boxes[2], opt);
    const maxD3PDistance = geom.maxDistanceNRectangles([pin, boxes[0], boxes[1], boxes[2], pout]);
    const maxTriDistance = geom.maxDistance3Rectangles(boxes, (i, j, k) => {
        return i.distanceEarth(j) + j.distanceEarth(k) + k.distanceEarth(i);
    });
    if (opt.scoring.minSide !== undefined) {
        if (maxFAIDistance(maxTriDistance, boxes, opt) === 0)
            return 0;
    }

    let cp = { d: 0 };
    if (ranges[0].end < ranges[2].start) {
        cp = geom.isTriangleClosed(ranges[0].end, ranges[2].start, maxTriDistance, opt);
        if (!cp)
            return 0;
        return (maxD3PDistance - closingPenalty(cp.d, opt)) * opt.scoring.multiplier;
    }

    return maxD3PDistance * opt.scoring.multiplier;
}

export function scoreOpenTriangle(tp, opt) {
    const d0 = tp[0].distanceEarth(tp[1]);
    const d1 = tp[1].distanceEarth(tp[2]);
    const d2 = tp[2].distanceEarth(tp[0]);
    const triDistance = d0 + d1 + d2;

    if (opt.scoring.minSide !== undefined) {
        const minSide = opt.scoring.minSide * triDistance;
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
    for (let i = 0; i < all.length - 1; i++)
        d3pDistance += all[i].distanceEarth(all[i + 1]);

    const distance = d3pDistance;
    const score = distance * opt.scoring.multiplier - closingPenalty(cp.d, opt);
    return { distance, score, tp: tp, ep: { start: pin, finish: pout }, cp };
}
/* c8 ignore stop */

// Upper limit for a flat triangle with vertices somewhere in boxes
export function boundTriangle(ranges, boxes, opt) {
    const maxTriDistance = geom.maxDistance3Rectangles(boxes, (i, j, k) => {
        return i.distanceEarth(j) + j.distanceEarth(k) + k.distanceEarth(i);
    });

    const maxDistance = (opt.scoring.minSide !== undefined)
        ? maxFAIDistance(maxTriDistance, boxes, opt)
        : maxTriDistance;

    if (maxDistance === 0)
        return 0;

    let cp = { d: 0 };
    if (ranges[0].end < ranges[2].start) {
        // Ranges do not overlap
        cp = geom.isTriangleClosed(ranges[0].end, ranges[2].start, maxDistance, opt);
        if (!cp)
            return 0;
        return (maxDistance - closingPenalty(cp.d, opt)) * opt.scoring.multiplier;
    }

    // Ranges overlap - bounding is impossible at this stage
    return maxDistance * opt.scoring.multiplier;
}

// Score a triangle once all 3 points have been selected
export function scoreTriangle(tp, opt) {
    const d0 = tp[0].distanceEarth(tp[1]);
    const d1 = tp[1].distanceEarth(tp[2]);
    const d2 = tp[2].distanceEarth(tp[0]);
    const distance = d0 + d1 + d2;

    if (opt.scoring.minSide !== undefined) {
        const minSide = opt.scoring.minSide * distance;
        if (d0 < minSide || d1 < minSide || d2 < minSide)
            return { score: 0 };
    }

    let cp = geom.isTriangleClosed(tp[0].r, tp[2].r, distance, opt);
    if (!cp)
        return { score: 0 };

    let score = (distance - closingPenalty(cp.d, opt)) * opt.scoring.multiplier;

    return { distance, score, tp, cp };
}

// Upper limit for an out-and-return with 2 TPs (XCLeague) with TPs somewhere in boxes
export function boundOutAndReturn2(ranges, boxes, opt) {
    const maxDistance = geom.maxDistance2Rectangles(boxes) * 2;

    if (ranges[0].end < ranges[1].start) {
        // Ranges do not overlap
        const cp = geom.isTriangleClosed(ranges[0].end, ranges[1].start, maxDistance, opt);
        if (!cp)
            return 0;
        return (maxDistance - closingPenalty(cp.d, opt)) * opt.scoring.multiplier;
    }

    // Ranges overlap - bounding is impossible at this stage
    return maxDistance * opt.scoring.multiplier;
}

// Score an out-and-return with 2 TPs once the 2 points have been selected
export function scoreOutAndReturn2(tp, opt) {
    const distance = tp[0].distanceEarth(tp[1]) * 2;

    let cp = geom.isTriangleClosed(tp[0].r, tp[1].r, distance, opt);
    if (!cp)
        return { score: 0 };

    let score = (distance - closingPenalty(cp.d, opt)) * opt.scoring.multiplier;

    return { distance, score, tp, cp };
}

// Upper limit for an out-and-return with 1 TP (FAI) with a TP somewhere in boxes
export function boundOutAndReturn1(ranges, boxes, opt) {
    if (!opt.flight.fullRange)
        opt.flight.fullRange = new Box(new Range(opt.launch, opt.landing), opt.flight);
    const maxDistance = geom.maxDistance2Rectangles([boxes[1], opt.flight.fullRange]);

    if (ranges[0].end < ranges[2].start) {
        // Ranges do not overlap
        const cp = geom.isTriangleClosed(ranges[0].end, ranges[2].start, maxDistance, opt);

        if (!cp)
            return 0;

        const realMax = geom.maxDistance2Rectangles([boxes[1],
            new Box(cp.in.x, cp.in.y, cp.out.x, cp.out.y)]);
        const maxClosingGain = Math.max((opt.scoring.closingDistanceFree || 0) - cp.d, 0);

        return (realMax + maxClosingGain - closingPenalty(cp.d, opt)) * 2 * opt.scoring.multiplier;
    }

    // Ranges overlap - bounding is impossible at this stage
    return maxDistance * 2 * opt.scoring.multiplier;
}

// Score an out-and-return with 1 TPs once the point has been selected
export function scoreOutAndReturn1(tp, opt) {
    const distance = Math.max(tp[0].distanceEarth(tp[1]), tp[1].distanceEarth(tp[2]));

    let cp = geom.isTriangleClosed(tp[0].r, tp[2].r, distance, opt);
    if (!cp)
        return { score: 0 };

    const realDistance = Math.max(tp[1].distanceEarth(cp.in), tp[1].distanceEarth(cp.out)) * 2;

    let score = (realDistance - closingPenalty(cp.d, opt)) * opt.scoring.multiplier;

    return { distance: realDistance, score, tp: [tp[1]], cp };
}
