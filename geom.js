const Map = require('collections/map');
const _Flatbush = require('flatbush');
const Flatbush = _Flatbush.default ? _Flatbush.default : _Flatbush;
const RBush = require('rbush');
const util = require('./util');
const { Box, Point } = require('./foundation');

/* Paragliding Competition Tracklog Optimization, Ondˇrej Palkovsk´y
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
function maxDistance3Rectangles(boxes, distance_fn) {
    let vertices = [];
    let minx, miny, maxx, maxy;
    for (let r of [0, 1, 2]) {
        vertices[r] = boxes[r].vertices();
        minx = Math.min(minx || Infinity, boxes[r].x1);
        miny = Math.min(miny || Infinity, boxes[r].y1);
        maxx = Math.max(maxx || -Infinity, boxes[r].x2);
        maxy = Math.max(maxy || -Infinity, boxes[r].y2);
    }

    let intersecting = false;
    for (let i of [0, 1, 2])
        if (boxes[i].intersects(boxes[(i + 1) % 3])) {
            intersecting = true;
            break;
        }

    let path = [[], [], []];
    for (let i of [0, 1, 2]) {
        for (let v of vertices[i])
            if ((v.x == minx || v.x == maxx) && (v.y == miny || v.y == maxy))
                path[i].push(v);
        if (path[i].length == 0)
            for (let v of vertices[i])
                if (v.x == minx || v.x == maxx || v.y == miny || v.y == maxy)
                    path[i].push(v);
        if (path[i].length == 0 || intersecting)
            path[i] = vertices[i];
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

function minDistance3Rectangles(boxes, distance_fn) {
    let vertices = [];
    let minx, miny, maxx, maxy;
    for (let r of [0, 1, 2]) {
        vertices[r] = boxes[r].vertices();
        minx = Math.min(minx || Infinity, boxes[r].x1);
        miny = Math.min(miny || Infinity, boxes[r].y1);
        maxx = Math.max(maxx || -Infinity, boxes[r].x2);
        maxy = Math.max(maxy || -Infinity, boxes[r].y2);
    }

    let path = [[], [], []];
    for (let i of [0, 1, 2]) {
        path[i] = vertices[i];
    }

    let distanceMin = Infinity;
    for (let i of path[0])
        for (let j of path[1])
            for (let k of path[2]) {
                const distance = distance_fn(i, j, k);
                distanceMin = Math.min(distanceMin, distance);
            }

    return distanceMin;
}

function maxDistance2Rectangles(boxes) {
    let vertices = [];
    let minx, miny, maxx, maxy;
    for (let r of [0, 1]) {
        vertices[r] = boxes[r].vertices();
        minx = Math.min(minx || Infinity, boxes[r].x1);
        miny = Math.min(miny || Infinity, boxes[r].y1);
        maxx = Math.max(maxx || -Infinity, boxes[r].x2);
        maxy = Math.max(maxy || -Infinity, boxes[r].y2);
    }

    let path = [[], []];
    for (let i of [0, 1]) {
        path[i] = vertices[i];
    }

    let distanceMax = 0;
    for (let i of path[0])
        for (let j of path[1]) {
            const distance = i.distanceEarth(j);
            distanceMax = Math.max(distanceMax, distance);
        }

    return distanceMax;
}

function maxDistancePath(origin, path, pathStart) {
    let distanceMax = 0;
    for (let i of path[pathStart]) {
        const distance1 = origin !== undefined ? i.distanceEarth(origin) : 0;
        const distance2 = path.length > pathStart + 1 ? maxDistancePath(i, path, pathStart + 1) : 0;
        distanceMax = Math.max(distanceMax, distance1 + distance2);
    }
    return distanceMax;
}

function maxDistanceNRectangles(boxes) {
    let vertices = [];
    let minx, miny, maxx, maxy;
    let path = [];
    for (let r in boxes) {
        if (boxes[r] instanceof Box) {
            vertices[r] = boxes[r].vertices();
            minx = Math.min(minx || Infinity, boxes[r].x1);
            miny = Math.min(miny || Infinity, boxes[r].y1);
            maxx = Math.max(maxx || -Infinity, boxes[r].x2);
            maxy = Math.max(maxy || -Infinity, boxes[r].y2);
        } else if (boxes[r] instanceof Point) {
            vertices[r] = [boxes[r]];
            minx = Math.min(minx || Infinity, boxes[r].x);
            miny = Math.min(miny || Infinity, boxes[r].y);
            maxx = Math.max(maxx || -Infinity, boxes[r].x);
            maxy = Math.max(maxy || -Infinity, boxes[r].y);
        } else
            throw new TypeError('boxes must contain only Box or Point');
        path[r] = [];
    }

    for (let i in boxes)
        if (i > 0) {
            const intersecting = boxes[i - 1].intersects(boxes[i]);
            if (intersecting) {
                boxes[i - 1].intersecting = true;
                boxes[i].intersecting = true;
            }
        }

    for (let i in boxes) {
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

function findClosestPairIn2Segments(p1, p2, opt) {
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

    precomputedAll = opt.flight.closestPairs.search({ minX: p1, minY: p2, maxX: p1, maxY: opt.landing });
    const precomputedNext = precomputedAll.reduce((a, x) => (!a || x.out < a.out) ? x : a, undefined);
    const lastUnknown = precomputedNext !== undefined ? precomputedNext.maxY : opt.landing;
    let min = { d: Infinity };
    for (let i = p2; i <= lastUnknown; i++) {
        const pout = opt.flight.flightPoints[i];
        const n = rtree.neighbors(pout.x * lc, pout.y, 1)[0] + opt.launch;
        if (n !== undefined) {
            const pin = opt.flight.flightPoints[n];
            const d = pout.distanceEarth(pin);
            if (d < min.d) {
                min.d = d;
                min.out = pout;
                min.in = pin;
            }
        }
    }
    if (precomputedNext !== undefined) {
        const pout = precomputedNext.o.out;
        const pin = precomputedNext.o.in;
        const d = pout.distanceEarth(pin);
        if (d < min.d) {
            min.d = d;
            min.out = pout;
            min.in = pin;
        }
    }

    opt.flight.closestPairs.insert({ minX: min.in.r, minY: p2, maxX: p1, maxY: min.out.r, o: min });
    return min;
}

function findFurthestPointInSegment(sega, segb, target, opt) {
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
    for (let v of points) {
        let distanceVMax = -Infinity;
        let fVpoint;

        let precomputed;
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

function isTriangleClosed(p1, p2, distance, opt) {
    const fastCandidates = opt.flight.closestPairs.search({ minX: opt.launch, minY: p2, maxX: p1, maxY: opt.landing });
    for (let f of fastCandidates)
        if (f.o.d <= opt.scoring.closingDistanceFree)
            return f.o;

    const min = findClosestPairIn2Segments(p1, p2, opt);

    if (min.d <= opt.scoring.closingDistance(distance, opt))
        return min;
    return false;
}

function init(opt) {
    opt.flight.closestPairs = new RBush();
    opt.flight.furthestPoints = [new Map(), new Map()];
    opt.flight.flightPoints = new Array(opt.flight.filtered.length);
    for (let r in opt.flight.filtered)
        opt.flight.flightPoints[r] = new Point(opt.flight.filtered, r);
}

module.exports = {
    maxDistance3Rectangles,
    maxDistance2Rectangles,
    minDistance3Rectangles,
    maxDistanceNRectangles,
    findFurthestPointInSegment,
    isTriangleClosed,
    init
};