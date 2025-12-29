export type FairnessLevel = "Safe" | "Standard" | "Suspicious" | "Predatory";

export interface AnalysisResultType {
  score: number;
  fairness: FairnessLevel;
  redFlags: string[];
  yellowFlags: string[];
  greenFlags: string[];
  summary: string;
}