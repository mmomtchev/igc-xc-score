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
  config: SolverConfig;
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

interface SolverConfig {
  /** maximum execution time of the solver in ms, each successive call will return a better solution, default undefined for unlimited */
  maxcycle?: number;
  /** do not include the flight track data in the output GeoJSON, default false */
  noflight?: boolean;
  /** include invalid GPS fixes when evaluating the flight, default false */
  invalid?: boolean;
  /** use high-precision distance calculation (Vincenty's), much slower for slightly higher precision, default false */
  hp?: boolean;
  /** automatically detect launch and landing and trim the flight track, default false */
  trim?: boolean;
}

export function solver(
  flight: IGCFile,
  scoringRules: object,
  config?: SolverConfig
): Iterator<Solution, Solution>;
export const scoringRules: { [key: string]: object[] };
