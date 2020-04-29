'use strict';
let id = 0;
const util = require('./util');
const Box = util.Box;
const Point = util.Point;

class Solution {
    constructor(ranges, opt, parent) {
        if (ranges.length > opt.scoring.cardinality)
            this.ranges = ranges.slice(0, opt.scoring.cardinality);
        else
            this.ranges = ranges;
        this.score = undefined;
        this.bound = undefined;
        this.id = id++;
        this.opt = opt;
        if (this.opt.config && this.opt.config.debug) {
            if (parent !== undefined)
                this.parent = parent + '-' + this.id;
            else
                this.parent = this.id;
            this.trace();
        }
    }

    do_branch() {
        let div = 0;
        for (let r in this.ranges)
            if (this.ranges[r].count() > this.ranges[div].count())
                div = parseInt(r);
        
        if (this.ranges[div].count() == 1)
            return [];
        
        let subsolutions = [];
        for (let i of [this.ranges[div].left(), this.ranges[div].right()]) {
            if (div > 0 && i.a < this.ranges[div - 1].a)
                continue;
            if (div > 0 && i.b < this.ranges[div - 1].b)
                continue;
            let subranges = [];
            for (let r in this.ranges)
                if (r != div)
                    subranges[r] = this.ranges[r];
                else
                    subranges[r] = i;
            subsolutions.push(new Solution(subranges, this.opt, this.parent));
        }
        return subsolutions;
    }

    do_bound() {
        this.bound = this.opt.scoring.bound(this.ranges, this.opt);
        this.trace();
    }

    do_score(distance_fn) {
        for (let r in this.ranges)
            if (r < this.ranges.length - 1 && this.ranges[r].center() >= this.ranges[parseInt(r) + 1].center()) {
                this.score = 0;
                return;
            }
    
        let tp = [];
        for (let r in this.ranges)
            tp[r] = new Point(this.opt.flight, this.ranges[r].center());
        
        this.scoreInfo = this.opt.scoring.score(tp, this.opt, distance_fn || Point.prototype.distanceEarth);
        this.score = this.scoreInfo.score;
        this.trace();
    }

    contentEquals(self, other) {
        return self.id === other.id;
    }

    contentCompare(self, other) {
        if (self.bound < other.bound)
            return -1;
        if (self.bound > other.bound)
            return 1;
        if (self.id < other.id)
            return -1;
        if (self.id > other.id)
            return 1;
        return 0;
    }

    geojson() {
        let features = [];
        if (this.opt.config && this.opt.config.debug) {
            for (let r in this.ranges)
                features.push((new Box(this.ranges[r], this.opt.flight))
                    .geojson('box' + r, {
                        id: 'box' + r,
                        a: this.ranges[r].a,
                        b: this.ranges[r].b
                    }));
        }
        try {
            const tp = this.scoreInfo.tp;
            for (let r of [0, 1, 2]) {
                features.push(tp[r]
                    .geojson('tp' + r, {
                        id: 'tp' + r,
                        r: tp[r].r,
                        timestamp: this.opt.flight.fixes[tp[r].r].timestamp
                    }));
                if (r < 2 || this.opt.scoring.closingDistance)
                    features.push({
                        type: 'Feature',
                        id: 'seg' + r,
                        properties: {
                            id: 'seg' + r,
                            'stroke': 'yellow',
                            'stroke-width': 4,
                            d: tp[r].distanceEarth(tp[(r + 1) % 3])
                        },
                        geometry: {
                            type: 'LineString',
                            coordinates: [[tp[r].x, tp[r].y], [tp[(r + 1) % 3].x, tp[(r + 1) % 3].y]],
                            style: { 'stroke': 'yellow', 'stroke-width': 4 }
                        }
                    });
            }
        } catch (e) {
            console.error('no turnpoints');
        }
        try {
            if (this.scoreInfo.cp !== undefined) {
                const cp = this.scoreInfo.cp;
                const tp = this.scoreInfo.tp;
                for (let r of ['in', 'out'])
                    features.push(cp[r]
                        .geojson('cp_' + r, {
                            id: 'cp_' + r,
                            r: cp[r].r,
                            timestamp: this.opt.flight.fixes[cp[r].r].timestamp
                        }));
                if (this.opt.scoring.closingDistance)
                    features.push({
                        type: 'Feature',
                        id: 'closing',
                        properties: {
                            id: 'closing',
                            'stroke': 'green',
                            'stroke-width': 3,
                            d: cp['in'].distanceEarth(cp['out'])
                        },
                        geometry: {
                            type: 'LineString',
                            coordinates: [[cp['in'].x, cp['in'].y], [cp['out'].x, cp['out'].y]],
                            style: { 'stroke': 'green', 'stroke-width': 3 }
                        }
                    });
                else {
                    features.push({
                        type: 'Feature',
                        id: 'seg_in',
                        properties: {
                            id: 'seg_in',
                            'stroke': 'green',
                            'stroke-width': 3,
                            d: cp['in'].distanceEarth(tp[0])
                        },
                        geometry: {
                            type: 'LineString',
                            coordinates: [[cp['in'].x, cp['in'].y], [tp[0].x, tp[0].y]],
                            style: { 'stroke': 'green', 'stroke-width': 3 }
                        }
                    });
                    features.push({
                        type: 'Feature',
                        id: 'seg_out',
                        properties: {
                            id: 'seg_out',
                            'stroke': 'green',
                            'stroke-width': 3,
                            d: cp['out'].distanceEarth(tp[2])
                        },
                        geometry: {
                            type: 'LineString',
                            coordinates: [[cp['out'].x, cp['out'].y], [tp[2].x, tp[2].y]],
                            style: { 'stroke': 'green', 'stroke-width': 3 }
                        }
                    });
                }
            }
        } catch (e) {
            console.error('no closing points');
        }
        features.push(new Point(this.opt.flight, 0)
            .geojson('launch', {
                id: 'launch',
                r: 0,
                timestamp: this.opt.flight.fixes[0].timestamp
            }));
        features.push(new Point(this.opt.flight, this.opt.flight.fixes.length - 1)
            .geojson('land', {
                id: 'land',
                r: this.opt.flight.fixes.length - 1,
                timestamp: this.opt.flight.fixes[this.opt.flight.fixes.length - 1].timestamp
            }));
        if (!this.opt.config || !this.opt.config.noflight) {
            let flightData = [];
            for (let r of this.opt.flight.fixes) {
                flightData.push([r.longitude, r.latitude]);
            }
            features.push({
                type: 'Feature',
                id: 'flight',
                properties: { id: 'flight' },
                geometry: {
                    type: 'LineString',
                    coordinates: flightData
                }
            });
        }
        let collection = {
            type: 'FeatureCollection',
            properties: {
                name: 'EPSG:3857',
                id: this.id,
                score: this.score !== undefined ? this.score : undefined,
                bound: this.currentUpperBound !== undefined ? this.currentUpperBound : this.bound,
                optimal: this.optimal,
                processedTime: this.time / 1000,
                processedSolutions: this.processed,
                type: this.opt.scoring.name
            },
            features
        };
        return collection;
    }

    toString() {
        let s = `${this.opt.scoring.name}`;
        if (this.score)
            s += ` ${this.opt.scoring.rounding(this.score)} points`;
        if (this.scoreInfo)
            s += ` ${this.opt.scoring.rounding(this.scoreInfo.distance)}km`;
        s += ` ( <${this.bound.toFixed(4)} )`;
        if (this.opt.config && this.opt.config.debug) {
            s += ` { id: ${this.id} `;
            for (let r of this.ranges)
                s += ' ' + r.toString();
            s += ' } ';
        }
        return s;
    }

    trace() {
        if (!this.opt.config.trace || !process.stdout)
            return;
        const trace = this.opt.config.trace.split(',');
        for (let i in this.ranges)
            if (!this.ranges[i].contains(trace[i]))
                return;
        let r = `solution tracing: ${this.id} ${this.opt.scoring.name} `;
        for (let i in this.ranges)
            r += this.ranges[i] + ' ';
        if (this.bound)
            r += `bound: ${this.bound} `;
        if (this.score)
            r += `score: ${this.score} `;
        process.stdout.write('\n' + r + '\n');
        this.opt.config.env.fs.writeFileSync(`debug-${this.id}.json`, JSON.stringify(this.geojson({debug: true})));
    }
}

module.exports = {
    Solution
};