'use strict';
let id = 0;

import { Box, Point, Range } from './foundation.js';

export class Solution {
    constructor(ranges, opt, parent) {
        if (ranges.length > opt.scoring.cardinality)
            this.ranges = ranges.slice(0, opt.scoring.cardinality);
        else
            this.ranges = ranges;
        this.opt = opt;
        this.boxes = [];
        for (let r = 0; r < this.ranges.length; r++) {
            // This the left-first ordering of the branch-and-bound
            // The left-first ordering transforms the permutation into a combination
            // greatly reducing the number of distinct solutions
            if (r > 0)
                if (this.ranges[r - 1].start > this.ranges[r].start)
                    this.ranges[r] = new Range(this.ranges[r - 1].start, this.ranges[r].end);
            if (r < this.ranges.length - 1)
                if (this.ranges[r].end > this.ranges[r + 1].end)
                    this.ranges[r] = new Range(this.ranges[r].start, this.ranges[r + 1].end);

            this.boxes[r] = new Box(this.ranges[r], opt.flight);
        }        
        this.score = undefined;
        this.bound = undefined;
        this.id = id++;
        if (this.opt.config && this.opt.config.debug) {
            /* c8 ignore next 2 */
            this.parent = parent;
            this.trace();
        }
    }

    do_branch() {
        let div = 0;
        // This is the breadth-first ordering of the branch-and-bound
        // It allows for early cut-off of the huge and obviously impossible branches
        for (let r = 0; r < this.ranges.length; r++)
            if (this.ranges[r].count() > this.ranges[div].count())
                div = r;
        for (let r = 0; r < this.ranges.length; r++)
            if (this.ranges[r].count() > 1 && this.boxes[r].area() > this.boxes[div].area() * 8)
                div = r;

        if (this.ranges[div].count() == 1)
            return [];

        let subsolutions = [];
        for (let i of [this.ranges[div].left(), this.ranges[div].right()]) {
            let subranges = [];
            for (let r = 0; r < this.ranges.length; r++)
                if (r != div)
                    subranges[r] = this.ranges[r];
                else
                    subranges[r] = i;
            subsolutions.push(new Solution(subranges, this.opt, this));
        }
        return subsolutions;
    }

    do_bound() {
        this.bound = this.opt.scoring.bound(this.ranges, this.boxes, this.opt);
        this.trace();
    }

    do_score() {
        for (let r = 0; r < this.ranges.length; r++)
            if (r < this.ranges.length - 1 && this.ranges[r].center() >= this.ranges[r + 1].center()) {
                this.score = 0;
                return;
            }

        let tp = [];
        for (let r = 0; r < this.ranges.length; r++)
            tp[r] = new Point(this.opt.flight.filtered, this.ranges[r].center());

        this.scoreInfo = this.opt.scoring.score(tp, this.opt);
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

    /*eslint no-empty: ["off"]*/
    geojson() {
        let features = [];
        if (this.opt.config && this.opt.config.debug) {
            /* c8 ignore next 8 */
            for (let r = 0; r < this.ranges.length; r++)
                features.push((new Box(this.ranges[r], this.opt.flight))
                    .geojson('box' + r, {
                        id: 'box' + r,
                        area: (new Box(this.ranges[r], this.opt.flight)).area(),
                        a: this.ranges[r].start,
                        b: this.ranges[r].end
                    }));
        }
        try {
            const tp = this.scoreInfo.tp;
            for (let r of [0, 1, 2]) {
                features.push(tp[r]
                    .geojson('tp' + r, {
                        id: 'tp' + r,
                        r: tp[r].r,
                        timestamp: this.opt.flight.filtered[tp[r].r].timestamp
                    }));
                if (r < 2 || this.scoreInfo.cp)
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
            if (this.scoreInfo.ep !== undefined || this.scoreInfo.cp !== undefined) {
                const cp = this.scoreInfo.cp;
                const tp = this.scoreInfo.tp;
                const ep = this.scoreInfo.ep;
                if (cp && cp['in'] && cp['out']) {
                    for (let r of ['in', 'out'])
                        features.push(cp[r]
                            .geojson('cp_' + r, {
                                id: 'cp_' + r,
                                r: cp[r].r,
                                timestamp: this.opt.flight.filtered[cp[r].r].timestamp
                            }));
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
                }
                if (ep && ep['start'] && ep['finish']) {
                    for (let r of ['start', 'finish'])
                        features.push(ep[r]
                            .geojson('ep_' + r, {
                                id: 'ep_' + r,
                                r: ep[r].r,
                                timestamp: this.opt.flight.filtered[ep[r].r].timestamp
                            }));
                    features.push({
                        type: 'Feature',
                        id: 'seg_in',
                        properties: {
                            id: 'seg_in',
                            'stroke': 'gold',
                            'stroke-width': 3,
                            d: ep['start'].distanceEarth(tp[0])
                        },
                        geometry: {
                            type: 'LineString',
                            coordinates: [[ep['start'].x, ep['start'].y], [tp[0].x, tp[0].y]],
                            style: { 'stroke': 'green', 'stroke-width': 3 }
                        }
                    });
                    features.push({
                        type: 'Feature',
                        id: 'seg_out',
                        properties: {
                            id: 'seg_out',
                            'stroke': 'gold',
                            'stroke-width': 3,
                            d: ep['finish'].distanceEarth(tp[2])
                        },
                        geometry: {
                            type: 'LineString',
                            coordinates: [[tp[2].x, tp[2].y], [ep['finish'].x, ep['finish'].y]],
                            style: { 'stroke': 'green', 'stroke-width': 3 }
                        }
                    });
                }
            }
        } catch (e) {
        }
        for (let li = 0; li < this.opt.flight.ll.length; li++) {
            const l = this.opt.flight.ll[li];
            features.push(this.opt.flight.flightPoints[l.launch]
                .geojson('launch' + li, {
                    id: 'launch' + li,
                    r: l.launch,
                    timestamp: this.opt.flight.filtered[l.launch].timestamp
                }));
            features.push(this.opt.flight.flightPoints[l.landing]
                .geojson('land' + li, {
                    id: 'land' + li,
                    r: l.landing,
                    timestamp: this.opt.flight.filtered[l.landing].timestamp
                }));
        }
        if (!this.opt.config || !this.opt.config.noflight) {
            let flightData = [];
            for (let r of this.opt.flight.filtered) {
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
                type: this.opt.scoring.name,
                code: this.opt.scoring.code
            },
            features
        };
        return collection;
    }

    /* c8 ignore next 14 */
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

    /* c8 ignore next 21 */
    trace(msg) {
        if (!this.opt.config.trace || !process.stdout)
            return;
        const trace = this.opt.config.trace.split(',').map(str => parseInt(str, 10));
        if (trace[0] < 0) {
            if (this.id % trace[1] !== 0)
                return;
        } else {
            if (this.ranges.some((range, i) => !range.contains(trace[i])))
                return;            
        }
        let r = `${msg ? msg : ''} solution tracing: ${this.id} ${this.opt.scoring.name} `;
        for (const range of this.ranges)
            r += range + ' ';
        if (this.bound)
            r += `bound: ${this.bound} `;
        if (this.score)
            r += `score: ${this.score} `;
        process.stdout.write('\n' + r + '\n');
        this.opt.config.env.fs.writeFileSync(`debug-${this.id}.json`, JSON.stringify(this.geojson({ debug: true })));
    }
}
