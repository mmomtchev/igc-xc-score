const REarth = 6371;

function radians(degrees) {
    return degrees / (180 / Math.PI);
}

function degrees(radians) {
    return radians * (180 / Math.PI);
}

class Point {
    constructor(x, y) {
        if (x.fixes !== undefined)
            [this.x, this.y, this.r] = [x.fixes[y].longitude, x.fixes[y].latitude, y];
        else
            [this.x, this.y] = [x, y];
    }

    geojson(id, properties) {
        const feature = {
            type: 'Feature',
            id,
            properties: properties || {},
            geometry: {
                type: 'Point',
                coordinates: [ this.x, this.y ]
            }
        }
        return feature;
    }

    toString() {
        return JSON.stringify(this.geojson())
    }

    distanceEarth(p) {
        /*
        const f1 = radians(this.y);
        const f2 = radians(p.y);
        const df = radians(p.y - this.y);
        const dg = radians(p.x - this.x);
        const a = Math.sin(df / 2) * Math.sin(df / 2) + Math.cos(f1) * Math.cos(f2) * Math.sin(dg / 2) * Math.sin(dg / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const d = REarth * c;
        */
        const df = (p.y - this.y);
        const dg = (p.x - this.x);
        const fm = radians((this.y + p.y) / 2);
        const k1 = 111.13209 - 0.566605 * Math.cos(2 * fm) + 0.00120 * Math.cos(4 * fm);
        const k2 = 111.41513 * Math.cos(fm) - 0.09455 * Math.cos(3 * fm) + 0.00012 * Math.cos(5 * fm);
        const d = Math.sqrt((k1 * df) * (k1 * df) + (k2 * dg) * (k2 * dg));
        return d;
    }

    distanceEarthRev(dx, dy) {
        const lon = this.x + degrees((dx / REarth) / Math.cos(radians(this.y)));
        const lat = this.y + degrees(dy / REarth);
        return new Point(lon, lat);
    }
}

class Range {
    constructor(a, b) {     
        [this.a, this.b] = [a, b];
    }

    count() {
        return Math.abs(this.a - this.b) + 1;
    }

    center() {
        return Math.min(this.a, this.b) + Math.floor(Math.abs(this.a - this.b) / 2);
    }

    left() {
        return new Range(Math.min(this.a, this.b), Math.min(this.a, this.b) + Math.floor(Math.abs(this.a - this.b) / 2));
    }

    right() {
        return new Range(Math.min(this.a, this.b) + Math.ceil(Math.abs(this.a - this.b) / 2), Math.max(this.a, this.b));
    }

    contains(p) {
        return this.a <= p && p <= this.b;
    }
}

class Box {
    constructor(a, b, c, d) {
        if (a instanceof Range) {
            [this.x1, this.y1, this.x2, this.y2] = [Infinity, Infinity, -Infinity, -Infinity];
            for (let i = a.a; i <= a.b; i++) {
                this.x1 = Math.min(b.fixes[i].longitude, this.x1);
                this.y1 = Math.min(b.fixes[i].latitude, this.y1);
                this.x2 = Math.max(b.fixes[i].longitude, this.x2);
                this.y2 = Math.max(b.fixes[i].latitude, this.y2);
            }
        } else {
            [this.x1, this.y1, this.x2, this.y2] = [a, b, c, d];
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
        if (this.x1 > other.x2 || this.x2 < other.x1 || this.y1 > other.y2 || this.y2 < other.y1)
            return false;
        return true;    
    }

    distance(other) {
        if (this.intersects(other))
            return 0;
        let x1, y1, x2, y2;
        if (this.x1 > other.x2)
            x1 = this.x1;
        x2 = other.x2;
        if (this.x2 < other.x1)
            x1 = this.x2;
        x2 = other.x1;
        if (this.y1 < other.y2)
            y1 = this.y1;
        y2 = other.y2;
        if (this.y2 > other.y1)
            y1 = this.y2;
        y2 = other.y1;
        if (x1 === undefined) {
            x1 = this.x1;
            x2 = this.x1;
        }
        if (y1 === undefined) {
            y1 = this.y1;
            y2 = this.y1;
        }
        return distance_earth(new Point(x1, y1), new Point(x2, y2))       
    }

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
        let features;
        for (let b in boxes) {
            features.push(boxes[b].geojson(b, { id: b }));
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
}

const consoleColors = {
    reset: "\x1b[0m",
    bright: "\x1b[1m",
    dim: "\x1b[2m",
    underscore: "\x1b[4m",
    blink: "\x1b[5m",
    reverse: "\x1b[7m",
    hidden: "\x1b[8m",
    fg: {
        black: "\x1b[30m",
        red: "\x1b[31m",
        green: "\x1b[32m",
        yellow: "\x1b[33m",
        blue: "\x1b[34m",
        magenta: "\x1b[35m",
        cyan: "\x1b[36m",
        white: "\x1b[37m",
        crimson: "\x1b[38m"
    },
    bg: {
        black: "\x1b[40m",
        red: "\x1b[41m",
        green: "\x1b[42m",
        yellow: "\x1b[43m",
        blue: "\x1b[44m",
        magenta: "\x1b[45m",
        cyan: "\x1b[46m",
        white: "\x1b[47m",
        crimson: "\x1b[48m"
    }
};

module.exports = {
    Point,
    Range,
    Box,
    consoleColors
}