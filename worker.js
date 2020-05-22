const WorkerThreads = require('worker_threads');
const Worker = WorkerThreads.Worker;
const isMainThread = WorkerThreads.isMainThread;
const foundation = require('./foundation');
const Box = foundation.Box;
const Point = foundation.Point;
const Range = foundation.Range;
const solution = require('./solution');
const Solution = solution.Solution;
const geom = require('./geom');
const Flight = require('./flight');

function prepare(config) {
    Flight.analyze(config);
    geom.init(config);
    if (config.hp)
        Point.prototype.distanceEarth = Point.prototype.distanceEarthVincentys;
    else
        Point.prototype.distanceEarth = Point.prototype.distanceEarthFCC;
    if (!config.env)
        config.env = { fs: require('fs') };
}

if (!isMainThread) {
    const config = WorkerThreads.workerData;
    prepare(config);
    config.threadId = WorkerThreads.threadId.toString();
    WorkerThreads.parentPort.on('message', (msg) => {
        /* This is the ugly part of JS */
        msg.__proto__ = Solution.prototype;
        for (let r of msg.ranges)
            r.__proto__ = Range.prototype;
        for (let b of msg.boxes)
            b.__proto__ = Box.prototype;

        let subs = [];
        let children = msg.do_branch(config);
        for (let c of children) {
            c.do_bound(config);
            c.do_score(config);
            subs.push(c);
        }
        WorkerThreads.parentPort.postMessage(subs);
    });
}

module.exports = {
    prepare
};