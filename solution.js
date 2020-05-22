'use strict';
let id = 0;
const foundation = require('./foundation');
const Box = foundation.Box;
const Point = foundation.Point;
const Range = foundation.Range;
const scoringRules = require('./scoring-rules.config');

class Solution {
    constructor(ranges, opt, config, parent) {
        this.opt = opt;
        this.rules = config.rules;
        const scoring = this.scoring();
        if (ranges.length > scoring.cardinality)
            this.ranges = ranges.slice(0, scoring.cardinality);
        else
            this.ranges = ranges;
        for (let _r in this.ranges) {
            const r = parseInt(_r);
            if (r > 0)
                if (this.ranges[r - 1].a > this.ranges[r].a)
                    this.ranges[r] = new Range(Math.max(this.ranges[r - 1].a, this.ranges[r].a), this.ranges[r].b);
            if (r < this.ranges.length - 1)
                if (this.ranges[r].b > this.ranges[r + 1].b)
                    this.ranges[r] = new Range(this.ranges[r].a, Math.min(this.ranges[r + 1].b, this.ranges[r].b));
            if (this.ranges[r].a > this.ranges[r].b) {
                console.log(this.ranges, parent.ranges);
                throw 'error';
            }
        }
        this.boxes = [];
        for (let r in this.ranges)
            this.boxes[r] = new Box(this.ranges[r], config.flight);
        this.score = undefined;
        this.bound = undefined;
        this.id = (config.threadId || '') + '_' + id++;
        if (config && config.debug) {
            this.parent = parent;
            this.trace('new', config);
        }
    }
    
    scoring() {
        return scoringRules[this.rules][this.opt.scoringType];
    }

    do_branch(config) {
        let div = 0;
        for (let r in this.ranges)
            if (this.ranges[r].count() > this.ranges[div].count())
                div = parseInt(r);
        for (let r in this.ranges)
            if (this.ranges[r].count() > 1 && this.boxes[r].area() > this.boxes[div].area() * 8)
                div = parseInt(r);
        
        if (this.ranges[div].count() == 1)
            return [];
        
        let subsolutions = [];
        for (let i of [this.ranges[div].left(), this.ranges[div].right()]) {
            let subranges = [];
            for (let r in this.ranges)
                if (r != div)
                    subranges[r] = this.ranges[r];
                else
                    subranges[r] = i;
            subsolutions.push(new Solution(subranges, this.opt, config, this));
        }
        return subsolutions;
    }

    do_bound(config) {
        this.bound = this.scoring().bound(this.ranges, this.boxes, this.opt, config, this.scoring());
        this.trace('bound', config);
    }

    do_score(config) {
        for (let r in this.ranges)
            if (r < this.ranges.length - 1 && this.ranges[r].center() >= this.ranges[parseInt(r) + 1].center()) {
                this.score = 0;
                return;
            }
    
        let tp = [];
        for (let r in this.ranges)
            tp[r] = new Point(config.flight.filtered, this.ranges[r].center());
        
        this.scoreInfo = this.scoring().score(tp, this.opt, config, this.scoring());
        this.score = this.scoreInfo.score;
        this.trace('score', config);
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

    /*eslint no-empty: ["off"]*/
    geojson(flight, config) {
        let features = [];
        const scoring = this.scoring();
        if (config && config.debug) {
            for (let r in this.ranges)
                features.push((new Box(this.ranges[r], flight))
                    .geojson('box' + r, {
                        id: 'box' + r,
                        area: (new Box(this.ranges[r], flight)).area(),
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
                        timestamp: flight.filtered[tp[r].r].timestamp
                    }));
                if (r < 2 || scoring.closingDistance)
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
                            timestamp: flight.filtered[cp[r].r].timestamp
                        }));
                if (scoring.closingDistance)
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
        }
        for (let li in flight.ll) {
            const l = flight.ll[li];
            features.push(flight.flightPoints[l.launch]
                .geojson('launch' + li, {
                    id: 'launch' + li,
                    r: l.launch,
                    timestamp: flight.filtered[l.launch].timestamp
                }));
            features.push(flight.flightPoints[l.landing]
                .geojson('land' + li, {
                    id: 'land' + li,
                    r: l.landing,
                    timestamp: flight.filtered[l.landing].timestamp
                }));
        }
        if (!config || !config.noflight) {
            let flightData = [];
            for (let r of flight.filtered) {
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
                type: this.scoring().name
            },
            features
        };
        return collection;
    }

    toString(config) {
        const scoring = this.scoring();
        let s = `${scoring.name}`;
        if (this.score)
            s += ` ${scoring.rounding(this.score)} points`;
        if (this.scoreInfo)
            s += ` ${scoring.rounding(this.scoreInfo.distance)}km`;
        s += ` ( <${this.bound.toFixed(4)} )`;
        if (config && config.debug) {
            s += ` { id: ${this.id} `;
            for (let r of this.ranges)
                s += ' ' + r.toString();
            s += ' } ';
        }
        return s;
    }

    trace(msg, config) {
        if (!config.trace || !process.stdout)
            return false;
        const trace = config.trace.split(',');
        if (trace[0] < 0) {
            if (parseInt(this.id) % parseInt(trace[1]) !== 0)
                return false;
        } else {
            if (this.opt.scoringType != trace[0])
                return false;
            for (let i in this.ranges)
                if (!this.ranges[i].contains(trace[parseInt(i) + 1]))
                    return false;
        }
        let r = `${msg ? msg : ''} solution tracing: ${this.id} ${this.scoring().name} `;
        for (let i in this.ranges)
            r += this.ranges[i] + ' ';
        if (this.bound)
            r += `bound: ${this.bound} `;
        if (this.score)
            r += `score: ${this.score} `;
        process.stdout.write('\n' + r + '\n');
        config.env.fs.writeFileSync(`debug-${this.id}.json`, JSON.stringify(this.geojson(config.flight, { debug: true })));
        return this.id;
    }
}

module.exports = {
    Solution
};