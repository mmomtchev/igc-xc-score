'use strict';

import * as util from './util.js';

import { Box, Point } from './foundation.js';

import Flatbush from 'flatbush';
import Map from 'collections/map.js';
import RBush from 'rbush';

/* Paragliding Competition Tracklog Optimization, Ondřej Palkovský
 * http://www.penguin.cz/~ondrap/algorithm.pdf
 * Refer for a proof that the maximum path between rectangles always
 * passes through their vertices
 * 
 * My addition :
 * With 3 rectanges, for each rectangle, the maximum path between them always includes:
 * a) only the vertices that lie on the vertices of the minimum bounding box if there are such vertices
 * b) if there are no such vertices, any vertices that lie on the edges of the bounding box
 * c) or potentially any vertice if no vertices lie on the edges of the bounding box
 */
export function maxDistance3Rectangles(boxes, distance_fn) {
    const minx = Math.min(boxes[0].x1, boxes[1].x1, boxes[2].x1);
    const miny = Math.min(boxes[0].y1, boxes[1].y1, boxes[2].y1);
    const maxx = Math.max(boxes[0].x2, boxes[1].x2, boxes[2].x2);
    const maxy = Math.max(boxes[0].y2, boxes[1].y2, boxes[2].y2);

    let intersecting = false;
    for (let i = 0; i < 3; i++)
        if (boxes[i].intersects(boxes[(i + 1) % 3])) {
            intersecting = true;
            break;
        }

    const path = [[], [], []];
    for (let i = 0; i < 3; i++) {
        const vertices = boxes[i].vertices();
        for (let v of vertices)
            if ((v.x == minx || v.x == maxx) && (v.y == miny || v.y == maxy))
                path[i].push(v);
        if (path[i].length == 0)
            for (let v of vertices)
                if (v.x == minx || v.x == maxx || v.y == miny || v.y == maxy)
                    path[i].push(v);
        if (path[i].length == 0 || intersecting)
            path[i] = vertices;
    }

    let distanceMax = 0;
    for (let i of path[0])
        for (let j of path[1])
            for (let k of path[2]) {
                const distance = distance_fn(i, j, k);
                distanceMax = Math.max(distanceMax, distance);
            }

    return distanceMax;
}

// Minimum possible distance between 3 rectangles
// The proof can be deduced from Ondřej Palkovský's paper
export function minDistance3Rectangles(boxes, distance_fn) {
    const v0 = boxes[0].vertices();
    const v1 = boxes[1].vertices();
    const v2 = boxes[2].vertices();

    let distanceMin = Infinity;
    for (let i of v0)
        for (let j of v1)
            for (let k of v2) {
                const distance = distance_fn(i, j, k);
                distanceMin = Math.min(distanceMin, distance);
            }

    return distanceMin;
}

// Minimum possible distance between 2 rectangles
// The proof can be deduced from Ondřej Palkovský's paper
export function minDistance2Rectangles(boxes) {
    const v0 = boxes[0].vertices();
    const v1 = boxes[1].vertices();

    let distanceMin = Infinity;
    for (let i of v0)
        for (let j of v1) {
            const distance = i.distanceEarth(j);
            distanceMin = Math.min(distanceMin, distance);
        }

    return distanceMin;
}

// Maximum possible distance between 2 rectangles
// See Ondřej Palkovský's paper for the mathematical proof
export function maxDistance2Rectangles(boxes) {
    const v0 = boxes[0].vertices();
    const v1 = boxes[1].vertices();

    let distanceMax = 0;
    for (let i of v0)
        for (let j of v1) {
            const distance = i.distanceEarth(j);
            distanceMax = Math.max(distanceMax, distance);
        }

    return distanceMax;
}

// Max distance across the path defined by path
// path is an array of arrays of vertices, each distinct path must choose one of these vertices
// This is a time-critical function, pathStart is an optimizatation that avoids copying the array
// O(n^m) where m is the cardinality of the solution
export function maxDistancePath(origin, path, pathStart) {
    let distanceMax = 0;
    for (let i of path[pathStart]) {
        const distance1 = origin !== undefined ? i.distanceEarth(origin) : 0;
        const distance2 = path.length > pathStart + 1 ? maxDistancePath(i, path, pathStart + 1) : 0;
        distanceMax = Math.max(distanceMax, distance1 + distance2);
    }
    return distanceMax;
}

// Maximum possible distance between N rectangles
// See Ondřej Palkovský's paper for the mathematical proof
export function maxDistanceNRectangles(boxes) {
    let vertices = [];
    let minx = Infinity;
    let miny = Infinity;
    let maxx = -Infinity;
    let maxy = -Infinity;
    let path = [];
    for (let r = 0; r < boxes.length; r++) {
        if (boxes[r] instanceof Box) {
            vertices[r] = boxes[r].vertices();
            minx = Math.min(minx, boxes[r].x1);
            miny = Math.min(miny, boxes[r].y1);
            maxx = Math.max(maxx, boxes[r].x2);
            maxy = Math.max(maxy, boxes[r].y2);
        } else if (boxes[r] instanceof Point) {
            vertices[r] = [boxes[r]];
            minx = Math.min(minx, boxes[r].x);
            miny = Math.min(miny, boxes[r].y);
            maxx = Math.max(maxx, boxes[r].x);
            maxy = Math.max(maxy, boxes[r].y);
        } else
            throw new TypeError('boxes must contain only Box or Point');
        path[r] = [];
    }

    for (let i = 1; i < boxes.length; i++) {
        const intersecting = boxes[i - 1].intersects(boxes[i]);
        if (intersecting) {
            boxes[i - 1].intersecting = true;
            boxes[i].intersecting = true;
        }
    }

    for (let i = 0; i < boxes.length; i++) {
        if (boxes[i].intersecting) {
            path[i] = vertices[i];
            continue;
        }
        for (let v of vertices[i])
            if ((v.x == minx || v.x == maxx) && (v.y == miny || v.y == maxy))
                path[i].push(v);
        if (path[i].length == 0)
            for (let v of vertices[i])
                if (v.x == minx || v.x == maxx || v.y == miny || v.y == maxy)
                    path[i].push(v);
        if (path[i].length == 0)
            path[i] = vertices[i];
    }

    let distanceMax = maxDistancePath(undefined, path, 0);
    return distanceMax;
}

// Find the closest pair of points such as the first is before p1 and the second is after p2
// Works by constructing a packed Hilbert R-tree of the points between the start and p1
//
// Searches are cached in a R-tree as they are defined by the pair (p1, p2)
// even if (p1, p2) are not 2D coordinates in the usual sense
//
// Also if x and y are the closest points for the segments [0..p1] and [p1..end]
// then this is also true for all segments such as p1 is in [x..p1] and p2 is in [p2..y]
//
// O(n log(n)) given by the packed Hilbert R-tree construction
export function findClosestPairIn2Segments(p1, p2, opt) {
    let precomputedAll = opt.flight.closestPairs.search({ minX: p1, minY: p2, maxX: p1, maxY: p2 });
    let precomputed = precomputedAll.reduce((a, x) => (!a || x.in > a.in) ? x : a, undefined);
    precomputed = precomputedAll.reduce((a, x) => (!a || x.out < a.out) ? x : a, precomputed);
    if (precomputed !== undefined)
        return precomputed.o;

    const rtree = new Flatbush(p1 + 1 - opt.launch, 8);
    const lc = Math.abs(Math.cos(util.radians(opt.flight.flightPoints[p1].y)));
    for (let i = opt.launch; i <= p1; i++) {
        const r = opt.flight.flightPoints[i];
        rtree.add(r.x * lc, r.y, r.x * lc, r.y);
    }
    rtree.finish();

    // When looking for a new solution, we know that we don't have to look past lastUnknown
    // lastUnknown is the point from which there is already a solution
    precomputedAll = opt.flight.closestPairs.search({ minX: p1, minY: p2, maxX: p1, maxY: opt.landing });
    const precomputedNext = precomputedAll.reduce((a, x) => (!a || x.out < a.out) ? x : a, undefined);
    const lastUnknown = precomputedNext !== undefined ? precomputedNext.maxY : opt.landing;
    let min = { d: Infinity };

    // In this loop we are searching for a better solution in [p2..lastUnknown]
    for (let i = p2; i <= lastUnknown; i++) {
        const pout = opt.flight.flightPoints[i];
        const n = rtree.neighbors(pout.x * lc, pout.y, 1)[0] + opt.launch;
        if (n !== undefined) {
            const pin = opt.flight.flightPoints[n];
            const d = opt.scoring.rounding(pout.distanceEarth(pin));
            if (d < min.d) {
                min.d = d;
                min.out = pout;
                min.in = pin;
            }
        }
    }

    // then we compare it to the one we already know for [lastUnknown..end]
    if (precomputedNext !== undefined) {
        // TODO
        // This part is not covered by the unit tests since the introduction of the rounding
        // Find a flight that triggers it
        const pout = precomputedNext.o.out;
        const pin = precomputedNext.o.in;
        const d = opt.scoring.rounding(pout.distanceEarth(pin));
        if (d < min.d) {
            min.d = d;
            min.out = pout;
            min.in = pin;
        }
    }

    opt.flight.closestPairs.insert({ minX: min.in.r, minY: p2, maxX: p1, maxY: min.out.r, o: min });
    return min;
}

// Verify if there is a closing between range_a and range_b
// TODO: Implement spatial caching
function findClosestPairIn2PartialSegments(range_a, range_b, opt) {
    const rtree = new Flatbush(range_a.end + 1 - range_a.start);
    const lc = Math.abs(Math.cos(util.radians(opt.flight.flightPoints[range_a.start].y)));
    for (let i = range_a.start; i <= range_a.end; i++) {
        const r = opt.flight.flightPoints[i];
        rtree.add(r.x * lc, r.y, r.x * lc, r.y);
    }
    rtree.finish();

    let min = { d: Infinity };
    for (let i = range_b.start; i <= range_b.end; i++) {
        const pout = opt.flight.flightPoints[i];
        const n = rtree.neighbors(pout.x * lc, pout.y, 1)[0] + range_a.start;
        if (n !== undefined) {
            const pin = opt.flight.flightPoints[n];
            const d = opt.scoring.rounding(pout.distanceEarth(pin));
            if (d < min.d) {
                min.d = d;
                min.out = pout;
                min.in = pin;
            }
        }
    }
    return min;
}

// Find the the furthest point between sega and segb from target
// Exhaustive search with cache (O(n) worst case, O(log(n)) average)
// The caching method works only when sega is the launch or segb is the landing
// This function is used to place the entrance and the exit of the 3TP flights
// It allows to reduce the cardinality of the solution space from 5 to 3
export function findFurthestPointInSegment(sega, segb, target, opt) {
    let points;
    if (target instanceof Box)
        points = target.vertices();
    else if (target instanceof Point)
        points = [target];
    else
        throw new TypeError('target must be either Point or Box');

    let pos;
    let zSearch;
    if (sega === opt.launch) {
        pos = 0;
        zSearch = +segb;
    } else if (segb === opt.landing) {
        pos = 1;
        zSearch = +sega;
    } else
        throw new RangeError('this function supports seeking only from the launch or the landing point');

    let distanceMax = -Infinity;
    let fpoint;
    // This loops once is the target is a point
    // Or four times for the four vertices of a box
    for (let v of points) {
        let distanceVMax = -Infinity;
        let fVpoint;

        let precomputed;
        // This is the cache, we are interested only in the points that are between sega and segb
        const precomputedAll = opt.flight.furthestPoints[pos].get(v.x + ':' + v.y);
        for (const p of precomputedAll || []) {
            if (zSearch >= p.min && zSearch <= p.max) {
                precomputed = p;
                break;
            }
        }

        if (precomputed)
            if (sega <= precomputed.o.r && precomputed.o.r <= segb) {
                distanceVMax = v.distanceEarth(precomputed.o);
                fVpoint = precomputed.o;
            } else
                throw new Error('furthestPoints cache inconsistency');

        if (fVpoint === undefined) {
            let intersecting = false;
            let canCache = false;

            // Some optimizations are not possible if the boxes are overlapping
            for (let p = sega; p <= segb; p++) {
                const f = opt.flight.flightPoints[p];
                if (target instanceof Box && target.intersects(f)) {
                    intersecting = true;
                    continue;
                }
                const d = v.distanceEarth(f);
                if (d > distanceVMax) {
                    distanceVMax = d;
                    fVpoint = f;
                    canCache = true;
                }
            }
            if (intersecting) {
                for (let p of points) {
                    const d = v.distanceEarth(p);
                    if (d > distanceVMax) {
                        distanceVMax = d;
                        fVpoint = target;
                        canCache = false;
                    }
                }
            }
            if (canCache) {
                let zCache;
                if (sega === opt.launch) {
                    zCache = { min: +fVpoint.r, max: +segb };
                } else if (segb === opt.landing) {
                    zCache = { min: +sega, max: +fVpoint.r };
                }

                let c = precomputedAll;
                if (!c) {
                    c = [];
                    opt.flight.furthestPoints[pos].set(v.x + ':' + v.y, c);
                }
                const existing = c.filter(x => x.o.r == fVpoint.r && !(zCache.max <= x.min || zCache.min >= x.max))[0];
                if (existing) {
                    existing.min = Math.min(zCache.min, existing.min);
                    existing.max = Math.max(zCache.max, existing.max);
                } else
                    c.push({ ...zCache, o: fVpoint });
            }
        }
        if (distanceVMax > distanceMax) {
            distanceMax = distanceVMax;
            fpoint = fVpoint;
        }
    }
    if (fpoint === undefined)
        fpoint = target;

    return fpoint;
}

// Verify if a triangle starting at point p1 and ending at point p2 can be closed
// if its total distance is distance
export function isTriangleClosed(p1, p2, distance, opt) {
    const fastCandidates = opt.flight.closestPairs.search({ minX: opt.launch, minY: p2, maxX: p1, maxY: opt.landing });
    for (let f of fastCandidates)
        if (f.o.d <= opt.scoring.closingDistanceFree)
            return f.o;

    const min = findClosestPairIn2Segments(p1, p2, opt);

    if (min.d <= opt.scoring.closingDistance(distance, opt))
        return min;
    return false;
}

// Verify if there is a closing between sega and segb
export function isOutAndReturnClosed(range_a, range_b, distance, opt) {
    const min = findClosestPairIn2PartialSegments(range_a, range_b, opt);

    if (min.d <= opt.scoring.closingDistance(distance, opt))
        return min;
    return false;
}

export function init(opt) {
    opt.flight.closestPairs = new RBush();
    opt.flight.furthestPoints = [new Map(), new Map()];
    opt.flight.flightPoints = new Array(opt.flight.filtered.length);
    for (let r in opt.flight.filtered)
        opt.flight.flightPoints[r] = new Point(opt.flight.filtered, r);
}
