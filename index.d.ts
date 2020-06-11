export as namespace XCScoring;

interface IGCFile {
    fixes: BRecord[];
}

/* Only what we need */
interface BRecord {
    /** Unix timestamp of the GPS fix in milliseconds */
    timestamp: number;
    latitude: number;
    longitude: number;
    valid: boolean;
    pressureAltitude: number | null;
    gpsAltitude: number | null;
    fixAccuracy: number | null;
}

export function solver(flight: IGCFile, scoringRules: object, config: { [key: string]: any });
export const scoringRules: { [key: string]: object[] };