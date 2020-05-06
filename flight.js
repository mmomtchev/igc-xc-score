/* Launch and landing detection can affect the score,
 * and must be as precise as possible
 *
 * Launch and landing are detected on a n-second moving average
 * of the horizontal and vertical speed
 * 
 * n is the number of seconds for the moving average
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
const detectLaunchLanding = {
    n: 10,
    t: 20,
    x: 3,
    z: 0.05
};

function printFixes(fixes, a, b) {
    for (let i = a; i <= b; i++)
        console.log(i, fixes[i].time, 'speed', fixes[i].hspeed, fixes[i].vspeed, 'ma', fixes[i].hma, fixes[i].vma, 'alt', fixes[i].pressureAltitude);
}

function analyze(opt) {
    const fixes = opt.flight.fixes;

    for (let i in fixes)
        if (i > 0)
            fixes[i].hspeed = (opt.flight.flightPoints[i - 1].distanceEarth(opt.flight.flightPoints[i])) * 1000 /
                (fixes[i].timestamp - fixes[i - 1].timestamp) * 1000;
        else
            fixes[i].hspeed = 0;

    for (let i in fixes) {
        if (fixes[i].pressureAltitude === null || fixes[i].pressureAltitude === undefined || fixes[i].pressureAltitude < -1000)
            fixes[i].pressureAltitude = fixes[i].gpsAltitude;
        if (fixes[i].pressureAltitude === null)
            fixes[i].gpsAltitude = undefined;
        if (i > 0)
            fixes[i].vspeed = (fixes[i].pressureAltitude - fixes[i - 1].pressureAltitude) /
                (fixes[i].timestamp - fixes[i - 1].timestamp) * 1000;
        else
            fixes[i].vspeed = 0;
    }

    for (let _i in fixes) {
        const i = parseInt(_i);
        const now = fixes[i].timestamp;
        let start, end;
        for (start = i; start > 0 && fixes[start].timestamp > now - Math.round(detectLaunchLanding.n * 1000 / 2); start--);
        for (end = i; end < fixes.length - 1 && fixes[end].timestamp < now + Math.round(detectLaunchLanding.n * 1000 / 2); end++);
        const maSegment = fixes.slice(start, end + 1);
        fixes[i].hma = maSegment.reduce((sum, x) => (sum + x.hspeed), 0) / maSegment.length;
        fixes[i].vma = maSegment.reduce((sum, x) => (sum + Math.abs(x.vspeed)), 0) / maSegment.length;
    }
}

function detectLaunch(opt) {
    const fixes = opt.flight.fixes;

    let start;
    for (let i = 0; i < fixes.length - 1; i++)
        if (fixes[i].hma > detectLaunchLanding.x && Math.abs(fixes[i].vma) > detectLaunchLanding.z) {
            if (start !== undefined && fixes[i].timestamp > fixes[start].timestamp + detectLaunchLanding.t * 1000) {
                return start;
            }
            if (start === undefined)
                start = i;
        } else
            start = undefined;
    
    return undefined;
}

function detectLanding(opt) {
    const fixes = opt.flight.fixes;
    const launch = detectLaunch(opt);

    if (launch === undefined)
        return undefined;

    let start;
    //printFixes(fixes, 0, 20);
    for (let i = launch; i < fixes.length - 1; i++)
        if (fixes[i].hma < detectLaunchLanding.x && Math.abs(fixes[i].vma) < detectLaunchLanding.z) {
            if (start !== undefined && fixes[i].timestamp > fixes[start].timestamp + detectLaunchLanding.t * 1000) {
                return start;
            }
            if (start === undefined)
                start = i;
        } else
            start = undefined;

    return undefined;
}

module.exports = {
    analyze,
    detectLaunch,
    detectLanding
}