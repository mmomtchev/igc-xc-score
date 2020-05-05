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
        fixes[i].hma = fixes.slice(Math.max(0, i - 5), Math.min(fixes.length - 1, i + 5))
            .reduce((sum, x) => (sum + x.hspeed), 0) / 11;
        fixes[i].vma = fixes.slice(Math.max(0, i - 5), Math.min(fixes.length - 1, i + 5))
            .reduce((sum, x) => (sum + x.vspeed), 0) / 11;
    }
}

function detectLaunch(opt) {
    const fixes = opt.flight.fixes;

    for (let i = 0; i < fixes.length - 1; i++)
        if (fixes[i].hma > 1 && Math.abs(fixes[i].vma) > 0.1)
            return i;
    
    return undefined;
}

function detectLanding(opt) {
    const fixes = opt.flight.fixes;

    for (let i = (detectLaunch(opt) || 0) + 1; i < fixes.length - 1; i++)
        if (fixes[i].hma < 1 && Math.abs(fixes[i].vma) < 0.1)
            return i;

    return undefined;
}

module.exports = {
    analyze,
    detectLaunch,
    detectLanding
}