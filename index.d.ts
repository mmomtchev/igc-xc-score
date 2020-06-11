export as namespace XCScoring;

import { IGCFile } from 'igc-parser';

export function solver(flight: IGCFile, scoringRules: object, config: { [key: string]: any });
export const scoringRules: { [key: string]: object[]; };
