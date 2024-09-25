export as namespace XCScoring;

import { BRecord, IGCFile } from 'igc-parser';

interface Point {
	/** Longitude */
	x: number;
	/** Latitude */
	y: number;
	/** GPS fix number in the tracklog */
	r: number;
}

interface Leg {
	name: string;
	/** Scoring distance */
	d: number;
	start: Point;
	finish: Point;
}

interface ClosingPoints {
	d: number;
	in: Point;
	out: Point;
}

interface EndPoints {
	start: Point;
	finish: Point;
}

interface ScoreInfo {
	cp?: ClosingPoints;
	ep?: EndPoints;
	tp?: Point[];
	legs?: Leg[];
	/** Distance without penalty applied */
	distance: number;
	penalty: number;
	score: number;
}

interface Scoring {
	name: string;
	code: string;
	multiplier: number;
	/** Fixed closing distance that is always accepted */
	closingDistanceFixed?: number;
	/** Closing distance that does not incur any scoring penalty */
	closingDistanceFree?: number;
	/** Closing distance that is relative to the full triangle length but incurs a penalty */
	closingDistanceRelative?: number;
}

interface Opt {
	scoring: Scoring;
	flight: IGCFile & {
		/** Filtered GPS fixes when invalid=false, GPS fix number is relative to this array */
		filtered: BRecord[];
	};
	/** launch and landing are the indices of the fixes identified as launch and landing **/
	launch: number;
	landing: number;
	config: { [key: string]: any };
}

interface Solution {
    bound: number;
	currentUpperBound: number;
	id: number | string;
	opt: Opt;
	optimal?: boolean;
	processed?: number;
	score?: number;
	scoreInfo?: ScoreInfo;
	time?: number;
}

export function solver(flight: IGCFile, scoringRules: object, config?: { [key: string]: any }) : Iterator<Solution, Solution>;
export const scoringRules: { [key: string]: object[] };
