/* Launch and landing detection can affect the score,
 * and must be as precise as possible
 * 
 * Launch and landing are detected on a n-second moving average
 * of the horizontal and vertical speed
 * 
 * maPeriod is the number of seconds for the moving average
 * 
 * t is the number of seconds that the conditions must be true
 * (the event is still assigned to the start of the period)
 * 
 * x is the horizontal speed in m/s
 * 
 * z is the absolute value of the vertical speed in m/s
 * 
 * Launch/landing is detected when both of the moving averages
 * cross the detection threshold for t seconds
 */
const maPeriod = 10;
const definitionFlight = {
    t: 60,
    x0: 1.5,
    xt: 5,
    z0: 0.05,
    zt: 0.9
};

const definitionGround = {
    t: 20,
    xmax: 2.5,
    zmax: 0.1
};

const Point = require('./foundation').Point;

function prepare(fixes) {
    for (let i in fixes) {
        if (fixes[i].pressureAltitude === null || fixes[i].pressureAltitude === undefined || fixes[i].pressureAltitude < -1000)
            fixes[i].pressureAltitude = fixes[i].gpsAltitude;
        if (fixes[i].pressureAltitude === null)
            fixes[i].gpsAltitude = undefined;

        if (i > 0) {
            if (fixes[i].timestamp !== fixes[i - 1].timestamp) {
                fixes[i].hspeed = (new Point(fixes, i - 1).distanceEarth(new Point(fixes, i))) * 1000 /
                    (fixes[i].timestamp - fixes[i - 1].timestamp) * 1000;
                fixes[i].vspeed = (fixes[i].pressureAltitude - fixes[i - 1].pressureAltitude) /
                    (fixes[i].timestamp - fixes[i - 1].timestamp) * 1000;
            } else {
                fixes[i].hspeed = fixes[i - 1].hspeed;
                fixes[i].vspeed = fixes[i - 1].vspeed;
            }
        } else {
            fixes[i].hspeed = 0;
            fixes[i].vspeed = 0;
        }
    }

    for (let _i in fixes) {
        const i = parseInt(_i);
        const now = fixes[i].timestamp;
        let start, end;
        for (start = i; start > 0 && fixes[start].timestamp > now - Math.round(maPeriod * 1000 / 2); start--);
        for (end = i; end < fixes.length - 1 && fixes[end].timestamp < now + Math.round(maPeriod * 1000 / 2); end++);
        const maSegment = fixes.slice(start, end + 1);
        fixes[i].hma = maSegment.reduce((sum, x) => (sum + x.hspeed), 0) / maSegment.length;
        fixes[i].vma = maSegment.reduce((sum, x) => (sum + Math.abs(x.vspeed)), 0) / maSegment.length;
    }
}

function detectFlight(fixes) {
    let start;
    for (let i = 0; i < fixes.length - 1; i++) {
        if (start === undefined && fixes[i].hma > definitionFlight.xt && fixes[i].vma > definitionFlight.zt)
            start = i;
        if (start !== undefined)
            if (fixes[i].hma > definitionFlight.x0 && fixes[i].vma > definitionFlight.z0) {
                if (fixes[i].timestamp > fixes[start].timestamp + definitionFlight.t * 1000)
                    for (let j = start; j <= i; j++)
                        fixes[i].stateFlight = true;
            } else {
                start = undefined;
            }
    }
}

function detectGround(fixes) {
    let start;
    for (let i = 0; i < fixes.length - 1; i++) {
        if (start === undefined && fixes[i].hma < definitionGround.xmax && fixes[i].vma < definitionGround.zmax)
            start = i;
        if (start !== undefined)
            if (fixes[i].hma < definitionGround.xmax && fixes[i].vma < definitionGround.zmax) {
                if (fixes[i].timestamp > fixes[start].timestamp + definitionGround.t * 1000)
                    for (let j = start; j <= i; j++)
                        fixes[i].stateGround = true;
            } else {
                start = undefined;
            }
    }
}

function detectLaunchLanding(fixes) {
    let ll = [];
    for (let i = 0; i < fixes.length - 1; i++) {
        if (fixes[i].stateFlight) {
            let j;
            for (j = i; j > 0 && !fixes[j].stateGround; j--);
            const launch = j;
            for (j = i; j < fixes.length - 2 && !fixes[j].stateGround; j++);
            const landing = j;
            i = j;
            ll.push({ launch, landing });
        }
    }
    if (ll.length == 0)
        ll.push({ launch: 0, landing: fixes.length - 1 });
    return ll;
}

function analyze(config) {
    const flight = config.flight;
    if (!config.invalid)
        flight.filtered = flight.fixes.filter(x => x.valid).filter((x, i, a) => i == 0 || a[i-1].timestamp !== x.timestamp);
    else
        flight.filtered = flight.fixes.slice(0);
    if (flight.filtered.length < 5)
        throw new Error(`Flight must contain at least 5 valid GPS fixes, ${flight.filtered.length} valid fixes found (out of ${flight.fixes.length})`);

    if (config.trim || config.detectLaunch || config.detectLanding) {
        prepare(flight.filtered);
        detectFlight(flight.filtered);
        detectGround(flight.filtered);
        flight.ll = detectLaunchLanding(flight.filtered);
    } else
        flight.ll = [ { launch: 0, landing: flight.filtered.length - 1 } ];    
}

module.exports = {
    analyze
};