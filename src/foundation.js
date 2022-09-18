'use strict';

import * as util from './util.js';
import * as vincentys from './vincentys.js';

export class Point {
    constructor(x, y) {
        if (Array.isArray(x)) {
            this.x = +x[y].longitude;
            this.y = +x[y].latitude;
            this.r = +y;
        } else {
            this.x = x;
            this.y = y;
        }
    }

    geojson(id, properties) {
        const feature = {
            type: 'Feature',
            id,
            properties: properties || {},
            geometry: {
                type: 'Point',
                coordinates: [this.x, this.y]
            }
        };
        return feature;
    }

    /* c8 ignore next 3 */
    toString() {
        return JSON.stringify(this.geojson());
    }

    intersects(other) {
        if (other instanceof Point)
            return (this.x == other.x && this.y == other.y);
        if (other instanceof Box)
            return other.intersects(this);
        throw new TypeError('other must be either Point or Box');
    }

    distanceEarth(p) {
        return this.distanceEarthFCC(p);
    }

    distanceEarthFCC(p) {
        const df = (p.y - this.y);
        const dg = (p.x - this.x);
        const fm = util.radians((this.y + p.y) / 2);
        // Speed up cos computation using:
        // - cos(2x) = 2 * cos(x)^2 - 1
        // - cos(a+b) = 2 * cos(a)cos(b) - cos(a-b)
        const cosfm = Math.cos(fm);
        const cos2fm = 2 * cosfm * cosfm - 1;
        const cos3fm = cosfm * ( 2 * cos2fm - 1);
        const cos4fm = 2 * cos2fm * cos2fm - 1;  
        const cos5fm = 2 * cos2fm * cos3fm - cosfm;
        const k1 = 111.13209 - 0.566605 * cos2fm + 0.00120 * cos4fm;
        const k2 = 111.41513 * cosfm - 0.09455 * cos3fm + 0.00012 * cos5fm;
        const d = Math.sqrt((k1 * df) * (k1 * df) + (k2 * dg) * (k2 * dg));
        return d;
    }


    /* c8 ignore next 5 */
    distanceEarthRev(dx, dy) {
        const lon = this.x + util.degrees((dx / util.REarth) / Math.cos(util.radians(this.y)));
        const lat = this.y + util.degrees(dy / util.REarth);
        return new Point(lon, lat);
    }

    distanceEarthVincentys(p) {
        return vincentys.inverse(this, p).distance;
    }
}

export class Range {
    constructor(start, end) {
        this.start = start;
        this.end = end;
        if (end < start)
            throw new Error('start should be before end');
    }

    count() {
        return this.end - this.start + 1;
    }

    center() {
        return this.start + Math.floor((this.end - this.start) / 2);
    }

    left() {
        return new Range(this.start, this.center());
    }

    right() {
        return new Range(this.start + Math.ceil((this.end - this.start) / 2), this.end);
    }

    contains(p) {
        return this.start <= p && p <= this.end;
    }

    /* c8 ignore next 3 */
    toString() {
        return `${this.start}:${this.end}`;
    }
}

export class Box {
    constructor(a, b, c, d) {
        if (a instanceof Range) {
            this.x1 = Infinity;
            this.y1 = Infinity;
            this.x2 = -Infinity;
            this.y2 = -Infinity;
            
            for (let i = a.start; i <= a.end; i++) {
                this.x1 = Math.min(b.flightPoints[i].x, this.x1);
                this.y1 = Math.min(b.flightPoints[i].y, this.y1);
                this.x2 = Math.max(b.flightPoints[i].x, this.x2);
                this.y2 = Math.max(b.flightPoints[i].y, this.y2);
            }
        } else {
            this.x1 = a;
            this.y1 = b;
            this.x2 = c;
            this.y2 = d;
        }
    }

    vertices() {
        return [
            new Point(this.x1, this.y1),
            new Point(this.x2, this.y1),
            new Point(this.x2, this.y2),
            new Point(this.x1, this.y2)
        ];
    }

    intersects(other) {
        if (other instanceof Point)
            return (this.x1 <= other.x && this.y1 <= other.y && this.x2 >= other.x && this.y2 >= other.y);
        if (this.x1 > other.x2 || this.x2 < other.x1 || this.y1 > other.y2 || this.y2 < other.y1)
            return false;
        return true;
    }

    area() {
        return Math.abs((this.x2 - this.x1) * (this.y2 - this.y1));
    }

    /* c8 ignore next 25 */
    distance(other) {
        if (this.intersects(other))
            return 0;
        let x1 = this.x1;
        let x2 = this.x1;
        let y1 = this.y1;
        let y2 = this.y1;
        if (this.x1 > other.x2) {
            x2 = other.x2;
        } else if (this.x2 < other.x1) {
            x1 = this.x2;
            x2 = other.x1;
        }
        if (this.y1 < other.y2) {
            y2 = other.y2;
        } else if (this.y2 > other.y1) {
            y1 = this.y2;
            y2 = other.y1;
        }
        return new Point(x1, y1).distanceEarth(new Point(x2, y2));
    }

    /* These are debugging aids */
    /* c8 ignore start */
    geojson(id, properties) {
        const feature = {
            type: 'Feature',
            id,
            properties: properties || {},
            geometry: {
                type: 'Polygon',
                coordinates: [[
                    [this.x1, this.y1],
                    [this.x1, this.y2],
                    [this.x2, this.y2],
                    [this.x2, this.y1],
                    [this.x1, this.y1],
                ]]
            }
        };
        return feature;
    }

    geojson_collection(boxes) {
        let features = [];
        for (let i = 0; i < boxes.length; i++) {
            features.push(boxes[i].geojson(i, { id: i }));
        }
        let collection = {
            type: 'FeatureCollection',
            features
        };
        return collection;
    }

    toString() {
        return JSON.stringify(this.geojson());
    }
    /* c8 ignore stop */
}
