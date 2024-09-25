'use strict';

import { Box, Point } from './foundation.js';
import * as geom from './geom.js';

export function closingPenalty(cd, opt) {
    return opt.scoring.rounding(
        (cd > (opt.scoring.closingDistanceFree || 0) ? cd : 0));
}

export function closingWithLimit(distance, opt) {
    return opt.scoring.rounding(
        Math.max(opt.scoring.closingDistanceFixed || 0,
            distance * (opt.scoring.closingDistanceRelative || 0)));
}

/*eslint no-unused-vars: ["error", { "args": "none" }]*/
export function closingWithPenalty(distance, opt) {
    /* c8 ignore next */
    return Infinity;
}

export function finalRounding(v, opt) {
    if (opt.scoring.finalRounding)
        return opt.scoring.finalRounding(v);
    if (opt.scoring.rounding)
        return opt.scoring.rounding(v);
    return v;
}

// Upper limit for a 3TP distance flight with 3 TPs in boxes
export function boundDistance3Points(ranges, boxes, opt) {
    const pin = geom.findFurthestPointInSegment(opt.launch, ranges[0].start, boxes[0], opt);
    const pout = geom.findFurthestPointInSegment(ranges[2].end, opt.landing, boxes[2], opt);
    const maxDistance = opt.scoring.rounding(
        geom.maxDistanceNRectangles([pin, boxes[0], boxes[1], boxes[2], pout]));
    if (maxDistance < (opt.scoring.minDistance || 0))
        return 0;
    return finalRounding(maxDistance * opt.scoring.multiplier, opt);
}

// Score of a 3TP distance flight with all 3 points selected
export function scoreDistance3Points(tp, opt) {
    let distance = 0;
    const pin = geom.findFurthestPointInSegment(opt.launch, tp[0].r, tp[0], opt);
    const pout = geom.findFurthestPointInSegment(tp[2].r, opt.landing, tp[2], opt);
    const all = [pin, tp[0], tp[1], tp[2], pout];
    const legs = [
        {name: 'START : TP1'},
        {name: 'TP1 : TP2'},
        {name: 'TP2 : TP3'},
        {name: 'TP3 : FINISH'}
    ];
    for (let i = 0; i < all.length - 1; i++) {
        legs[i].d = opt.scoring.rounding(all[i].distanceEarth(all[i + 1]));
        distance += legs[i].d;
        legs[i].start = all[i];
        legs[i].finish = all[i+1];
    }
    distance = finalRounding(distance, opt);
    const score = distance >= (opt.scoring.minDistance || 0) ?
        finalRounding(distance * opt.scoring.multiplier, opt) :
        0;
    return { distance, score, tp: tp, ep: { start: pin, finish: pout }, legs };
}

// Upper limit for a FAI triangle with vertices somewhere in boxes,
// maxTriDistance is the upper limit of the flat triangle
function maxFAIDistance(maxTriDistance, boxes, opt) {
    // smallest triangle with we could possibly have for these boxes
    const minTriDistance = geom.minDistance3Rectangles(boxes, (i, j, k) => {
        return opt.scoring.rounding(i.distanceEarth(j)) +
            opt.scoring.rounding(j.distanceEarth(k)) +
            opt.scoring.rounding(k.distanceEarth(i));
    });

    if (maxTriDistance < minTriDistance)
        return 0;

    // biggest possible leg for each side
    const maxAB = opt.scoring.rounding(geom.maxDistance2Rectangles([boxes[0], boxes[1]]));
    const maxBC = opt.scoring.rounding(geom.maxDistance2Rectangles([boxes[1], boxes[2]]));
    const maxCA = opt.scoring.rounding(geom.maxDistance2Rectangles([boxes[2], boxes[0]]));

    // our FAI triangle is limited to maxDistance
    const maxDistance = opt.scoring.rounding(Math.min(maxAB, maxBC, maxCA) / opt.scoring.minSide);

    // Is the maximum FAI triangle smaller than the minimum possible triangle?
    if (maxDistance < minTriDistance)
        return 0;

    return Math.min(maxDistance, maxTriDistance);
}

// Upper limit for a flat triangle /w maxSide with vertices somewhere in boxes,
// maxTriDistance is the upper limit of the unconstrained flat triangle
function maxTRIDistance(maxTriDistance, boxes, opt) {
    // smallest possible leg for each side
    const minAB = opt.scoring.rounding(geom.minDistance2Rectangles([boxes[0], boxes[1]]));
    const minBC = opt.scoring.rounding(geom.minDistance2Rectangles([boxes[1], boxes[2]]));
    const minCA = opt.scoring.rounding(geom.minDistance2Rectangles([boxes[2], boxes[0]]));

    // our constrained triangle cannot be smaller then minDistance
    const minDistance = opt.scoring.rounding(Math.max(minAB, minBC, minCA) / opt.scoring.maxSide);

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
    const maxD3PDistance = opt.scoring.rounding(geom.maxDistanceNRectangles([pin, boxes[0], boxes[1], boxes[2], pout]));
    const maxTriDistance = geom.maxDistance3Rectangles(boxes, (i, j, k) => {
        return opt.scoring.rounding(i.distanceEarth(j)) +
            opt.scoring.rounding(j.distanceEarth(k)) +
            opt.scoring.rounding(k.distanceEarth(i));
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
        return finalRounding((maxD3PDistance - closingPenalty(cp.d, opt)) * opt.scoring.multiplier, opt);
    }

    return finalRounding(maxD3PDistance * opt.scoring.multiplier, opt);
}

export function scoreOpenTriangle(tp, opt) {
    const d0 = opt.scoring.rounding(tp[0].distanceEarth(tp[1]));
    const d1 = opt.scoring.rounding(tp[1].distanceEarth(tp[2]));
    const d2 = opt.scoring.rounding(tp[2].distanceEarth(tp[0]));
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

    const pin = geom.findFurthestPointInSegment(opt.launch, tp[0].r, tp[0], opt);
    const pout = geom.findFurthestPointInSegment(tp[2].r, opt.landing, tp[2], opt);
    const all = [pin, tp[0], tp[1], tp[2], pout];
    const legs = [
        {name: 'START : TP1'},
        {name: 'TP1 : TP2'},
        {name: 'TP2 : TP3'},
        {name: 'TP3 : FINISH'}
    ];
    let distance = 0;
    for (let i = 0; i < all.length - 1; i++) {
        legs[i].d = opt.scoring.rounding(all[i].distanceEarth(all[i + 1]));
        distance += legs[i].d;
        legs[i].start = all[i];
        legs[i].finish = all[i+1];
    }
    distance = finalRounding(distance, opt);

    const score = finalRounding(distance * opt.scoring.multiplier, opt) - closingPenalty(cp.d, opt);
    return { distance, score, tp: tp, ep: { start: pin, finish: pout }, cp, legs };
}
/* c8 ignore stop */

// Upper limit for a flat triangle with vertices somewhere in boxes
export function boundTriangle(ranges, boxes, opt) {
    const maxTriDistance = geom.maxDistance3Rectangles(boxes, (i, j, k) => {
        return opt.scoring.rounding(i.distanceEarth(j)) +
            opt.scoring.rounding(j.distanceEarth(k)) +
            opt.scoring.rounding(k.distanceEarth(i));
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
        return finalRounding((maxDistance - closingPenalty(cp.d, opt)) * opt.scoring.multiplier, opt);
    }

    // Ranges overlap - bounding is impossible at this stage
    return finalRounding(maxDistance * opt.scoring.multiplier, opt);
}

// Score a triangle once all 3 points have been selected
export function scoreTriangle(tp, opt) {
    let distance = 0;
    const legs = [
        {name: 'TP1 : TP2'},
        {name: 'TP2 : TP3'},
        {name: 'TP3 : TP1'}
    ];
    for (let i = 0; i < tp.length; i++) {
        legs[i].d = opt.scoring.rounding(tp[i].distanceEarth(tp[(i + 1) % tp.length]));
        distance += legs[i].d;
        legs[i].start = tp[i];
        legs[i].finish = tp[(i + 1) % tp.length];
    }

    distance = finalRounding(distance, opt);
    if (distance < (opt.scoring.minDistance || 0))
        return { score: 0 };

    if (opt.scoring.minSide !== undefined) {
        const minSide = opt.scoring.minSide * distance;
        if (legs[0].d < minSide || legs[1].d < minSide || legs[2].d < minSide)
            return { score: 0 };
    }

    if (opt.scoring.maxSide !== undefined) {
        const maxSide = opt.scoring.maxSide * distance;
        if (legs[0].d > maxSide || legs[1].d > maxSide || legs[2].d > maxSide)
            return { score: 0 };
    }

    let cp = geom.isTriangleClosed(tp[0].r, tp[2].r, distance, opt);
    if (!cp)
        return { score: 0 };

    const penalty = closingPenalty(cp.d, opt);
    let score = finalRounding((distance - penalty) * opt.scoring.multiplier, opt);

    return { distance, score, tp, cp, legs, penalty };
}

// Upper limit for an out-and-return with 2 TPs (XCLeague) with TPs somewhere in boxes
export function boundOutAndReturn2(ranges, boxes, opt) {
    const maxDistance = opt.scoring.rounding(geom.maxDistance2Rectangles(boxes)) * 2;

    if (maxDistance < (opt.scoring.minDistance || 0))
        return 0;

    if (ranges[0].end < ranges[1].start) {
        // Ranges do not overlap
        const cp = geom.isTriangleClosed(ranges[0].end, ranges[1].start, maxDistance, opt);
        if (!cp)
            return 0;
        return finalRounding((maxDistance - closingPenalty(cp.d, opt)) * opt.scoring.multiplier, opt);
    }

    // Ranges overlap - bounding is impossible at this stage
    return finalRounding(maxDistance * opt.scoring.multiplier, opt);
}

// Score an out-and-return with 2 TPs once the 2 points have been selected
export function scoreOutAndReturn2(tp, opt) {
    const leg = opt.scoring.rounding(tp[0].distanceEarth(tp[1]));
    const distance = finalRounding(leg * 2, opt);

    if (distance < (opt.scoring.minDistance || 0))
        return { score: 0 };

    let cp = geom.isTriangleClosed(tp[0].r, tp[1].r, distance, opt);
    if (!cp)
        return { score: 0 };

    const penalty = closingPenalty(cp.d, opt);
    const score = finalRounding((distance - penalty) * opt.scoring.multiplier, opt);
    const legs = [
        {name: 'TP1 : TP2', start: tp[0], finish: tp[1], d: leg},
        {name: 'TP2 : TP1', start: tp[1], finish: tp[0], d: leg}
    ];

    return { distance, score, tp, cp, legs, penalty };
}

// Upper limit for an out-and-return with 1 TP (FAI) with a TP somewhere in boxes
export function boundOutAndReturn1(ranges, boxes, opt) {
    // Merge box[0] and box[2]
    const box2 = new Box(
        Math.min(boxes[0].x1, boxes[2].x1),
        Math.min(boxes[0].y1, boxes[2].y1),
        Math.max(boxes[0].x2, boxes[2].x2),
        Math.max(boxes[0].y2, boxes[2].y2),
    );
    const maxDistance = opt.scoring.rounding(geom.maxDistance2Rectangles([boxes[1], box2]));

    if (maxDistance < (opt.scoring.minDistance || 0))
        return 0;

    if (ranges[0].end < ranges[2].start) {
        // Ranges do not overlap
        const cp = geom.isOutAndReturnClosed(ranges[0], ranges[2], maxDistance, opt);

        if (!cp)
            return 0;

        // The final closing point has to be somewhere in this box
        // (this is the box containing all the medians of all lines
        // starting in box[0] and ending in box[2])
        const box2 = new Box(
            (boxes[0].x1 + boxes[2].x1) / 2,
            (boxes[0].y1 + boxes[2].y1) / 2,
            (boxes[0].x2 + boxes[2].x2) / 2,
            (boxes[0].y2 + boxes[2].y2) / 2
        );
        const realDistance = opt.scoring.rounding(geom.maxDistance2Rectangles([boxes[1], box2]));
        return finalRounding((realDistance - closingPenalty(cp.d, opt)) * 2 * opt.scoring.multiplier, opt);
    }

    // Ranges overlap - bounding is impossible at this stage
    return finalRounding(maxDistance * 2 * opt.scoring.multiplier, opt);
}

// Score an out-and-return with 1 TPs once the point has been selected
export function scoreOutAndReturn1(tp, opt) {
    // Create the second turn point on the middle of the closing line
    const tp2 = new Point((tp[0].x + tp[2].x) / 2, (tp[0].y + tp[2].y) / 2);
    const leg = opt.scoring.rounding(tp[1].distanceEarth(tp2));
    const distance = finalRounding(leg * 2, opt);

    if (distance < (opt.scoring.minDistance || 0))
        return { score: 0 };

    const closing = opt.scoring.rounding(tp[0].distanceEarth(tp[2]));
    if (closing > opt.scoring.closingDistance(distance, opt))
        return { score: 0 };

    const penalty = closingPenalty(closing, opt);
    const score = finalRounding((distance - penalty) * opt.scoring.multiplier, opt);
    const legs = [
        {name: 'TP1 : TP2', start: tp[1], finish: tp2, d: leg},
        {name: 'TP2 : TP1', start: tp2, finish: tp[1], d: leg}
    ];

    return { distance, score, tp: [tp[1], tp2], cp: { d: closing, in: tp[0], out: tp[2] }, legs };
}

// These implement the FAI Sporting Code, Section 7D, Paragraph 5.2.5
// https://www.fai.org/sites/default/files/civl/documents/sporting_code_s7_d_-_records_and_badges_2022.pdf
// In igc-xc-score all TPs are lying on the track
// They are to be transformed to the best possible cylinders
export function adjustFAICylinders(score, opt) {
    // Do not readjust incomplete solutions
    if (!score.tp || !score.legs || score.score == 0)
        return;

    // Move away each TP by 'cylinders' (400m)
    // https://math.stackexchange.com/questions/175896/finding-a-point-along-a-line-a-certain-distance-away-from-another-point
    // We can safely assume that the Earth is flat for a distance of 400m
    // (ie unless we are very near the poles, the curvature will be much less than the 10m declared accuracy)
    function moveAway(point, origin) {
        const d0 = point.distanceEarth(origin);
        const t = (d0 + opt.scoring.cylinders) / d0;
        const x = (1 - t) * origin.x + t * point.x;
        const y = (1 - t) * origin.y + t * point.y;
        return new Point(x, y);
    }

    // For each TP we have to determine a new location that lies on a line
    // determined by the middle of the line between the previous and the next TP
    // and the TP itself
    // (For a triangle, this would be the centroid of the triangle, but
    // for an open flight every TP is to be moved away from a different center)
    const newTP = [];
    for (const i in score.tp) {
        if (score.tp[i].r === undefined) {
            // The second TP of an Out-and-Return flight is not lying on the track
            // and it is already a cylinder TP
            continue;
        }

        let previous = +i - 1;
        if (previous < 0) {
            if (score.ep)
                // Open flight - the previous one is START
                previous = score.ep.start;
            else
                // Circuit flight - the previous one is the last TP
                previous = score.tp[score.tp.length - 1];
        } else
            previous = score.tp[previous];

        let next = +i + 1;
        if (next >= score.tp.length) {
            if (score.ep)
                // Open flight - the next one is FINISH
                next = score.ep.finish;
            else
                // Circuit flight - the next one is the first TP
                next = score.tp[0];
        } else
            next = score.tp[next];

        const centroid = new Point((previous.x + next.x) / 2, (previous.y + next.y) / 2);
        newTP[i] = moveAway(score.tp[i], centroid);
    }
    for (const i in score.tp)
        if (newTP[i])
            score.tp[i] = newTP[i];

    // If there are end-points (free distance flight), they are to be moved away
    // from their nearest respective TP
    if (score.ep && score.ep.start)
        score.ep.start = moveAway(score.ep.start, score.tp[0]);
    if (score.ep && score.ep.finish)
        score.ep.finish = moveAway(score.ep.finish, score.tp[2]);

    switch (opt.scoring.code) {
    case 'tri':
    case 'fai':
        {
            score.distance = 0;
            for (let i = 0; i < score.legs.length; i++) {
                score.legs[i].d = opt.scoring.rounding(score.tp[i].distanceEarth(score.tp[(i + 1) % score.tp.length]))
                    - opt.scoring.cylinders * 2;
                score.distance += score.legs[i].d;
            }
        }
        break;
    case 'oar':
        {
            const distance = opt.scoring.rounding(score.tp[0].distanceEarth(score.tp[1])) - opt.scoring.cylinders;
            score.legs[0].d = score.legs[1].d = distance;
            score.distance = distance * 2;
        }
        break;
    case 'od':
        {
            const all = [score.ep.start, score.tp[0], score.tp[1], score.tp[2], score.ep.finish];
            score.distance = 0;
            for (let i = 0; i < all.length - 1; i++) {
                score.legs[i].d = opt.scoring.rounding(all[i].distanceEarth(all[i + 1]));
                score.legs[i].d -= opt.scoring.cylinders * 2;
                score.distance += score.legs[i].d;
            }
        }
        break;
    }
    score.distance = finalRounding(score.distance, opt);
    score.score = score.distance >= (opt.scoring.minDistance || 0) ?
        finalRounding((score.distance - (score.penalty || 0)) * opt.scoring.multiplier, opt) : 0;
}
