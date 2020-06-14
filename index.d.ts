export as namespace XCScoring;

import { IGCFile } from 'igc-parser';

interface Point {
    x: number
    y: number
    r: number
};

interface ClosingPoints {
    d: number,
    in: Point,
    out: Point
};

interface ScoreInfo {
    cp?: ClosingPoints,
    tp?: Point[],
    distance: number,
    score: number
};

interface Scoring {
    name: string,
    code: string,
    multiplier: number
};

interface Opt {
    scoring: Scoring
};

interface Solution {
    bound: number;
    currentUpperBound: number,
    id: number|string,
    opt: Opt,
    optimal?: boolean,
    processed?: number,
    score?: number,
    scoreInfo?: ScoreInfo,
    time?: number
};

export function solver(flight: IGCFile, scoringRules: object, config: { [key: string]: any }) : Iterator<Solution, Solution>;
export const scoringRules: { [key: string]: object[] };
