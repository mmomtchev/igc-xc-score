'use strict';

import { Box, Point } from './foundation.js';
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
    if (maxDistance < (opt.scoring.minDistance || 0))
        return 0;
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
    const score = distance >= (opt.scoring.minDistance || 0) ? distance * opt.scoring.multiplier : 0;
    return { distance, score, tp: tp, ep: { start: pin, finish: pout } };
}

// Upper limit for a FAI triangle with vertices somewhere in boxes,
// maxTriDistance is the upper limit of the flat triangle
function maxFAIDistance(maxTriDistance, boxes, opt) {
    // smallest triangle with we could possibly have for these boxes
    const minTriDistance = geom.minDistance3Rectangles(boxes, (i, j, k) => {
        return i.distanceEarth(j) + j.distanceEarth(k) + k.distanceEarth(i);
    });

    if (maxTriDistance < minTriDistance)
        return 0;

    // biggest possible leg for each side
    const maxAB = geom.maxDistance2Rectangles([boxes[0], boxes[1]]);
    const maxBC = geom.maxDistance2Rectangles([boxes[1], boxes[2]]);
    const maxCA = geom.maxDistance2Rectangles([boxes[2], boxes[0]]);

    // our FAI triangle is limited to maxDistance
    const maxDistance = Math.min(maxAB, maxBC, maxCA) / opt.scoring.minSide;

    // Is the maximum FAI triangle smaller than the minimum possible triangle?
    if (maxDistance < minTriDistance)
        return 0;

    return Math.min(maxDistance, maxTriDistance);
}

// Upper limit for a flat triangle /w maxSide with vertices somewhere in boxes,
// maxTriDistance is the upper limit of the unconstrained flat triangle
function maxTRIDistance(maxTriDistance, boxes, opt) {
    // smallest possible leg for each side
    const minAB = geom.minDistance2Rectangles([boxes[0], boxes[1]]);
    const minBC = geom.minDistance2Rectangles([boxes[1], boxes[2]]);
    const minCA = geom.minDistance2Rectangles([boxes[2], boxes[0]]);

    // our constrained triangle cannot be smaller then minDistance
    const minDistance = Math.max(minAB, minBC, minCA) / opt.scoring.maxSide;

    // Is the minimum constrained triangle bigger than the maximum possible triangle?
    if (minDistance > maxTriDistance)
        return 0;

    return maxTriDistance;
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
    if (maxTriDistance < (opt.scoring.minDistance || 0))
        return 0;
    if (opt.scoring.minSide !== undefined) {
        if (maxFAIDistance(maxTriDistance, boxes, opt) === 0)
            return 0;
    }
    if (opt.scoring.maxSide !== undefined) {
        if (maxTRIDistance(maxTriDistance, boxes, opt) === 0)
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

    if (triDistance < (opt.scoring.minDistance || 0))
        return { score: 0 };

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

    if (maxTriDistance < (opt.scoring.minDistance || 0))
        return 0;
    let maxDistance = maxTriDistance;
    if (opt.scoring.minSide !== undefined)
        maxDistance = maxFAIDistance(maxDistance, boxes, opt);
    if (opt.scoring.maxSide !== undefined)
        maxDistance = maxTRIDistance(maxDistance, boxes, opt);

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

    if (distance < (opt.scoring.minDistance || 0))
        return { score: 0 };

    if (opt.scoring.minSide !== undefined) {
        const minSide = opt.scoring.minSide * distance;
        if (d0 < minSide || d1 < minSide || d2 < minSide)
            return { score: 0 };
    }

    if (opt.scoring.maxSide !== undefined) {
        const maxSide = opt.scoring.maxSide * distance;
        if (d0 > maxSide || d1 > maxSide || d2 > maxSide)
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

    if (maxDistance < (opt.scoring.minDistance || 0))
        return 0;

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

    if (distance < (opt.scoring.minDistance || 0))
        return { score: 0 };

    let cp = geom.isTriangleClosed(tp[0].r, tp[1].r, distance, opt);
    if (!cp)
        return { score: 0 };

    let score = (distance - closingPenalty(cp.d, opt)) * opt.scoring.multiplier;

    return { distance, score, tp, cp };
}

// Upper limit for an out-and-return with 1 TP (FAI) with a TP somewhere in boxes
export function boundOutAndReturn1(ranges, boxes, opt) {
    const maxDistance = Math.max(geom.maxDistance2Rectangles([boxes[1], boxes[0]]),
        geom.maxDistance2Rectangles([boxes[1], boxes[2]]));

    if (maxDistance < (opt.scoring.minDistance || 0))
        return 0;

    if (ranges[0].end < ranges[2].start) {
        // Ranges do not overlap
        const cp = geom.isOutAndReturnClosed(ranges[0], ranges[2], maxDistance, opt);

        if (!cp)
            return 0;

        // The final closing point has to be somewhere in this box
        const box2 = new Box(
            (boxes[0].x1 + boxes[2].x1) / 2,
            (boxes[0].y1 + boxes[2].y1) / 2,
            (boxes[0].x2 + boxes[2].x2) / 2,
            (boxes[0].y2 + boxes[2].y2) / 2
        );
        const realDistance = geom.maxDistance2Rectangles([boxes[1], box2]);
        return (realDistance - closingPenalty(cp.d, opt)) * 2 * opt.scoring.multiplier;
    }

    // Ranges overlap - bounding is impossible at this stage
    return maxDistance * 2 * opt.scoring.multiplier;
}

// Score an out-and-return with 1 TPs once the point has been selected
export function scoreOutAndReturn1(tp, opt) {
    const distance = Math.max(tp[0].distanceEarth(tp[1]), tp[1].distanceEarth(tp[2]));

    if (distance < (opt.scoring.minDistance || 0))
        return { score: 0 };

    const d = tp[0].distanceEarth(tp[2]);
    if (d > opt.scoring.closingDistance(distance, opt))
        return { score: 0 };

    // Create the second turn point on the middle of the closing line
    const tp2 = new Point((tp[0].x + tp[2].x) / 2, (tp[0].y + tp[2].y) / 2);
    const realDistance = tp[1].distanceEarth(tp2);

    let score = (realDistance - closingPenalty(d, opt)) * 2 * opt.scoring.multiplier;

    return { distance: realDistance, score, tp: [tp[1], tp2], cp: { d, in: tp[0], out: tp[2] } };
}

// This implements the FAI Sporting Code, Section 7D, Paragraph 5.2.5
// https://www.fai.org/sites/default/files/civl/documents/sporting_code_s7_d_-_records_and_badges_2022.pdf
// In igc-xc-score all TPs are lying on the track
// They are to be transformed to the best possible cylinders
export function adjustFAICylinders(score, opt) {
    // Find the centroid of the turnpoints
    // https://www.mathopenref.com/coordcentroid.html
    let x = score.tp.reduce((a, t) => a + t.x, 0) / 3;
    let y = score.tp.reduce((a, t) => a + t.y, 0) / 3;
    const centroid = new Point(x, y);

    // Move away each TP by 'cylinders' (400m)
    // https://math.stackexchange.com/questions/175896/finding-a-point-along-a-line-a-certain-distance-away-from-another-point
    // We can safely assume that the Earth is flat for a distance of 400m
    // (ie unless we are very near the poles, the curvature will be much less than the 10m declared accuracy)
    for (const i in score.tp) {
        const d0 = score.tp[i].distanceEarth(centroid);
        const t = (d0 + opt.scoring.cylinders) / d0;
        const xt = (1 - t) * x + t * score.tp[i].x;
        const yt = (1 - t) * y + t * score.tp[i].y;
        score.tp[i].x = xt;
        score.tp[i].y = yt;
        score.tp[i].r = undefined;
    }

    switch (opt.scoring.code) {
    case 'tri':
    case 'fai':
        {
            const d0 = score.tp[0].distanceEarth(score.tp[1]);
            const d1 = score.tp[1].distanceEarth(score.tp[2]);
            const d2 = score.tp[2].distanceEarth(score.tp[0]);
            score.distance = d0 + d1 + d2 - opt.scoring.cylinders * 2 * 3;
            score.score = (score.distance - closingPenalty(score.cp.d, opt))
                * opt.scoring.multiplier;
        }
        break;
    }
}
