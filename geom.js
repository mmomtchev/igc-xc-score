const Flatbush = require('flatbush');
const RBush = require('rbush');
const util = require('./util');
const Box = util.Box;
const Point = util.Point;
const Range = util.Range;


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

    let path = [[], [], []];
    for (let i of [0, 1, 2]) {
        for (let v of vertices[i])
            if ((v.x == minx || v.x == maxx) && (v.y == miny || v.y == maxy))
                path[i].push(v);
        if (path[i].length == 0)
            for (let v of vertices[i])
                if (v.x == minx || v.x == maxx || v.y == miny || v.y == maxy)
                    path[i].push(v);
        if (path[i].length == 0 || (i > 1 && boxes[i-1].intersects(boxes[i])))
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
        /*for (let v of vertices[i])
            if (!(v.x == minx || v.x == maxx || v.y == miny || v.y == maxy))
                path[i].push(v);
        if (path[i].length == 0)
            for (let v of vertices[i])
                if (!(v.x == minx || v.x == maxx) || !(v.y == miny || v.y == maxy))
                    path[i].push(v);
        if (path[i].length == 0)*/
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
        /*for (let v of vertices[i])
            if ((v.x == minx || v.x == maxx) && (v.y == miny || v.y == maxy))
                path[i].push(v);
        if (path[i].length == 0)
            for (let v of vertices[i])
                if (v.x == minx || v.x == maxx || v.y == miny || v.y == maxy)
                    path[i].push(v);
        if (i > 1 && boxes[i - 1].intersects(boxes[i]))*/
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

function maxDistancePath(p, path) {
    let distanceMax = 0;
    for (let i of path[0]) {
        const distance = i.distanceEarth(p) + (path.length > 1 ? maxDistancePath(i, path.slice(1)) : 0);
        distanceMax = Math.max(distanceMax, distance);
    }
    return distanceMax;
}

function maxDistanceNRectangles(boxes) {
    let vertices = [];
    let minx, miny, maxx, maxy;
    let path = [];
    for (let r in boxes) {
        vertices[r] = boxes[r].vertices();
        minx = Math.min(minx || Infinity, boxes[r].x1);
        miny = Math.min(miny || Infinity, boxes[r].y1);
        maxx = Math.max(maxx || -Infinity, boxes[r].x2);
        maxy = Math.max(maxy || -Infinity, boxes[r].y2);
        path[r] = [];
    }

    for (let i in boxes) {
        /*for (let v of vertices[i])
            if ((v.x == minx || v.x == maxx) && (v.y == miny || v.y == maxy))
                path[i].push(v);
        if (path[i].length == 0)
            for (let v of vertices[i])
                if (v.x == minx || v.x == maxx || v.y == miny || v.y == maxy)
                    path[i].push(v);
        if (path[i].length == 0 || (i > 1 && boxes[i - 1].intersects(boxes[i])))*/
            path[i] = vertices[i];
    }

    let distanceMax = 0;
    for (let i of path[0]) {
        const distance = maxDistancePath(i, path.slice(1));
        distanceMax = Math.max(distanceMax, distance);
    }

    return distanceMax;
}

const closestPairs = new RBush();
function findClosestPairIn2Segments(p1, p2, opt) {
    const precomputed = closestPairs.search({ minX: p1, minY: p2, maxX: p1, maxY: p2 })[0];
    if (precomputed !== undefined)
        return precomputed.o;

    const rtree = new Flatbush(p1 + 1);
    for (let i = 0; i <= p1; i++) {
        let r = opt.flight.fixes[i];
        rtree.add(r.longitude, r.latitude, r.longitude, r.latitude);
    }
    rtree.finish();

    let min = { d: Infinity };
    for (let i = p2; i < opt.flight.fixes.length; i++) {
        const pout = new Point(opt.flight, i);
        const n = rtree.neighbors(pout.x, pout.y, 1)[0];
        if (n !== undefined) {
            const pin = new Point(opt.flight, n);
            const d = pout.distanceEarth(pin);
            if (d < min.d) {
                min.d = d;
                min.out = pout;
                min.in = pin;
            }
        }
    }

    closestPairs.insert({ minX: p1, minY: p2, maxX: p1, maxY: p2, o: min });
    return min;
}

function findFurthestPoint(p, startend, opt) {
    const inc = startend == 'start' ? 1 : -1;
    let i = startend == 'start' ? 0 : opt.flight.fixes.length - 1;
    
    let maxDistance = -Infinity;
    let furthestPointA = undefined;
    let furthestPointB = undefined;
    let end;
    let origin;
    if (p instanceof Range) {
        origin = (new Box(p, opt.flight)).vertices();
        end = startend == 'start' ? p.a : p.b;
    } else {
        origin = [new Point(opt.flight, p)];
        end = p;
    }
    for (; startend == 'start' ? i <= end : i >= end; i += inc) {
        const p2 = new Point(opt.flight, i);
        for (let p1 of origin) {
            let d = p1.distanceEarth(p2);
            if (d > maxDistance) {
                maxDistance = d;
                furthestPointA = p1.r;
                furthestPointB = i;
            }
        }
    }

    return { d: maxDistance, in: Math.min(furthestPointA, furthestPointB), out: Math.max(furthestPointA, furthestPointB) };
}

function isTriangleClosed(p1, p2, distance, opt) {
    const fastCandidates = closestPairs.search({ minX: 0, minY: p2, maxX: p1, maxY: opt.flight.fixes.length });
    for (let f of fastCandidates)
        if (f.o.d < opt.scoring.closingDistance(0))
            return f.o;
    
    const min = findClosestPairIn2Segments(p1, p2, opt);

    if (min.d <= opt.scoring.closingDistance(distance))
        return min;
    return false;
}

module.exports = {
    maxDistance3Rectangles,
    maxDistance2Rectangles,
    minDistance3Rectangles,
    maxDistanceNRectangles,
    findFurthestPoint,
    isTriangleClosed,
}