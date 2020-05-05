/* Launch and landing detection can affect the score,
 * and must be as precise as possible
 *
 * Launch and landing are detected on a n-second moving average
 * of the horizontal and vertical speed
 * 
 * n is the number of seconds for the moving average
 * x is the horizontal speed in m/s
 * z is the absolute value of the vertical speed in m/s
 * 
 * Launch/landing is detected when both of the moving averages
 * cross the detection threshold
 */
const detectLaunchLanding = {
    n: 10,
    x: 1.5,
    z: 0.05
};

function analyze(opt) {
    const fixes = opt.flight.fixes;

    for (let i in fixes)
        if (i > 0)
            fixes[i].hspeed = (opt.flight.flightPoints[i - 1].distanceEarth(opt.flight.flightPoints[i])) * 1000 /
                (fixes[i].timestamp - fixes[i - 1].timestamp) * 1000;
        else
            fixes[i].hspeed = 0;

    for (let i in fixes) {
        if (fixes[i].pressureAltitude === null || fixes[i].pressureAltitude === undefined)
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
        fixes[i].vma = maSegment.reduce((sum, x) => (sum + x.vspeed), 0) / maSegment.length;
    }
}

function detectLaunch(opt) {
    const fixes = opt.flight.fixes;

    for (let i = 0; i < fixes.length - 1; i++)
        if (fixes[i].hma > detectLaunchLanding.x && Math.abs(fixes[i].vma) > detectLaunchLanding.z)
            return i;
    
    return undefined;
}

function detectLanding(opt) {
    const fixes = opt.flight.fixes;

    for (let i = (detectLaunch(opt) || 0) + 1; i < fixes.length - 1; i++)
        if (fixes[i].hma < detectLaunchLanding.x && Math.abs(fixes[i].vma) < detectLaunchLanding.z)
            return i;

    return undefined;
}

module.exports = {
    analyze,
    detectLaunch,
    detectLanding
}