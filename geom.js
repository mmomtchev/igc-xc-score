const Map = require('collections/map');
const _Flatbush = require('flatbush');
const Flatbush = _Flatbush.default ? _Flatbush.default : _Flatbush;
const RBush = require('rbush');
const util = require('./util');
const Box = util.Box;
const Point = util.Point;

let flightPoints;

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
            throw 'boxes must contain only Box or Point';
        path[r] = [];
    }

    let intersecting = false;
    for (let i in boxes)
        if (i > 0) {
            intersecting = boxes[i - 1].intersects(boxes[i]);
            if (intersecting)
                break;
        }

    for (let i in boxes) {
        if (intersecting) {
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

let closestPairs;
function findClosestPairIn2Segments(p1, p2, opt) {
    const precomputed = closestPairs.search({ minX: p1, minY: p2, maxX: p1, maxY: p2 })[0];
    if (precomputed !== undefined)
        return precomputed.o;

    const rtree = new Flatbush(p1 + 1);
    const lc = Math.abs(Math.cos(util.radians(opt.flight.fixes[p1].latitude)));
    for (let i = 0; i <= p1; i++) {
        const r = opt.flight.fixes[i];
        rtree.add(r.longitude * lc, r.latitude, r.longitude * lc, r.latitude);
    }
    rtree.finish();

    const precomputedNext = closestPairs.search({ minX: p1, minY: p2, maxX: p1, maxY: opt.flight.fixes.length })[0];
    const lastUnknown = precomputedNext !== undefined ? precomputedNext.maxY : opt.flight.fixes.length;
    let min = { d: Infinity };
    for (let i = p2; i < lastUnknown; i++) {
        const pout = flightPoints[i];
        const n = rtree.neighbors(pout.x * lc, pout.y, 1)[0];
        if (n !== undefined) {
            const pin = flightPoints[n];
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

    closestPairs.insert({ minX: p1, minY: p2, maxX: p1, maxY: p2, o: min });
    return min;
}

let furthestPoints;
function findFurthestPointInSegment(sega, segb, target) {
    let points;
    if (target instanceof Box)
        points = target.vertices();
    else if (target instanceof Point)
        points = [target];
    else
        throw 'target must be either Point or Box';
    
    let pos;
    if (sega === 0)
        pos = 0;
    else if (segb === flightPoints.length - 1)
        pos = 1;
    else
        throw 'this function supports seeking only from the launch or the landing point';

    let distanceMax = -Infinity;
    let fpoint;
    for (let v of points) {
        const precomputed = furthestPoints[pos].get(v.x + ':' + v.y, -Infinity);
        let distanceVMax = -Infinity;
        let fVpoint;
        if (sega <= precomputed && precomputed <= segb) {
            fVpoint = flightPoints[precomputed];
            distanceVMax = v.distanceEarth(fVpoint);
        }
        let intersecting = false;
        let canCache = false;
        if (fVpoint === undefined) {
            for (let p = sega; p <= segb; p++) {
                const f = flightPoints[p];
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
            if (canCache)
                furthestPoints[pos].set(v.x + ':' + v.y, fVpoint.r);
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
    const fastCandidates = closestPairs.search({ minX: 0, minY: p2, maxX: p1, maxY: opt.flight.fixes.length });
    for (let f of fastCandidates)
        if (f.o.d <= opt.scoring.closingDistanceFree)
            return f.o;

    const min = findClosestPairIn2Segments(p1, p2, opt);

    if (min.d <= opt.scoring.closingDistance(distance, opt))
        return min;
    return false;
}

function init(opt) {
    closestPairs = new RBush();
    furthestPoints = [new Map(), new Map()];
    flightPoints = [];
    for (let r in opt.flight.fixes)
        flightPoints[r] = new Point(opt.flight, r);
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