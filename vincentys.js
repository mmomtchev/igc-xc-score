'use strict';
const util = require('./util');

// Vincenty's Algorithm, courtesy of Movable Type Ltd
// https://www.movable-type.co.uk/scripts/latlong-vincenty.html
// Published and included here under an MIT licence
function inverse(p1, p2) {
    const φ1 = util.radians(p1.y), λ1 = util.radians(p1.x);
    const φ2 = util.radians(p2.y), λ2 = util.radians(p2.x);

    const { a, b, f } = util.WGS84;

    const L = λ2 - λ1; // L = difference in longitude, U = reduced latitude, defined by tan U = (1-f)·tanφ.
    const tanU1 = (1 - f) * Math.tan(φ1), cosU1 = 1 / Math.sqrt((1 + tanU1 * tanU1)), sinU1 = tanU1 * cosU1;
    const tanU2 = (1 - f) * Math.tan(φ2), cosU2 = 1 / Math.sqrt((1 + tanU2 * tanU2)), sinU2 = tanU2 * cosU2;

    const antipodal = Math.abs(L) > Math.PI / 2 || Math.abs(φ2 - φ1) > Math.PI / 2;

    let λ = L, sinλ = null, cosλ = null; // λ = difference in longitude on an auxiliary sphere
    let σ = antipodal ? Math.PI : 0, sinσ = 0, cosσ = antipodal ? -1 : 1, sinSqσ = null; // σ = angular distance P₁ P₂ on the sphere
    let cos2σₘ = 1;                      // σₘ = angular distance on the sphere from the equator to the midpoint of the line
    let sinα = null, cosSqα = 1;         // α = azimuth of the geodesic at the equator
    let C = null;

    let λʹ = null, iterations = 0;
    do {
        sinλ = Math.sin(λ);
        cosλ = Math.cos(λ);
        sinSqσ = (cosU2 * sinλ) * (cosU2 * sinλ) + (cosU1 * sinU2 - sinU1 * cosU2 * cosλ) * (cosU1 * sinU2 - sinU1 * cosU2 * cosλ);
        if (Math.abs(sinSqσ) < Number.EPSILON) break;  // co-incident/antipodal points (falls back on λ/σ = L)
        sinσ = Math.sqrt(sinSqσ);
        cosσ = sinU1 * sinU2 + cosU1 * cosU2 * cosλ;
        σ = Math.atan2(sinσ, cosσ);
        sinα = cosU1 * cosU2 * sinλ / sinσ;
        cosSqα = 1 - sinα * sinα;
        cos2σₘ = (cosSqα != 0) ? (cosσ - 2 * sinU1 * sinU2 / cosSqα) : 0; // on equatorial line cos²α = 0 (§6)
        C = f / 16 * cosSqα * (4 + f * (4 - 3 * cosSqα));
        λʹ = λ;
        λ = L + (1 - C) * f * sinα * (σ + C * sinσ * (cos2σₘ + C * cosσ * (-1 + 2 * cos2σₘ * cos2σₘ)));
        const iterationCheck = antipodal ? Math.abs(λ) - Math.PI : Math.abs(λ);
        if (iterationCheck > Math.PI) throw new EvalError('λ > π');
    } while (Math.abs(λ - λʹ) > 1e-12 && ++iterations < 1000);
    if (iterations >= 1000) throw new EvalError('Vincenty formula failed to converge');

    const uSq = cosSqα * (a * a - b * b) / (b * b);
    const A = 1 + uSq / 16384 * (4096 + uSq * (-768 + uSq * (320 - 175 * uSq)));
    const B = uSq / 1024 * (256 + uSq * (-128 + uSq * (74 - 47 * uSq)));
    const Δσ = B * sinσ * (cos2σₘ + B / 4 * (cosσ * (-1 + 2 * cos2σₘ * cos2σₘ) -
        B / 6 * cos2σₘ * (-3 + 4 * sinσ * sinσ) * (-3 + 4 * cos2σₘ * cos2σₘ)));

    const s = b * A * (σ - Δσ); // s = length of the geodesic

    // note special handling of exactly antipodal points where sin²σ = 0 (due to discontinuity
    // atan2(0, 0) = 0 but atan2(ε, 0) = π/2 / 90°) - in which case bearing is always meridional,
    // due north (or due south!)
    // α = azimuths of the geodesic; α2 the direction P₁ P₂ produced
    const α1 = Math.abs(sinSqσ) < Number.EPSILON ? 0 : Math.atan2(cosU2 * sinλ, cosU1 * sinU2 - sinU1 * cosU2 * cosλ);
    const α2 = Math.abs(sinSqσ) < Number.EPSILON ? Math.PI : Math.atan2(cosU1 * sinλ, -sinU1 * cosU2 + cosU1 * sinU2 * cosλ);

    return {
        distance: s,
        initialBearing: Math.abs(s) < Number.EPSILON ? NaN : util.degrees(α1),
        finalBearing: Math.abs(s) < Number.EPSILON ? NaN : util.degrees(α2),
        iterations: iterations,
    };
}

module.exports = {
    inverse
};