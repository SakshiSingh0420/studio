export type FactSheetData = {
  gdp: number;
  gdpGrowth: number;
  inflation: number;
  debt: number;
  revenue: number;
  interest: number;
  fxReserves: number;
  imports: number;
  exports: number;
  externalDebt: number;
  debtService: number;
  npl: number;
  car: number;
  governanceScore: number;
  politicalStability: number;
  climateRisk: number;
  defaultHistory: boolean;
};

export type DerivedMetrics = {
  debtToGDP: number;
  interestToRevenue: number;
  reserveCover: number;
  externalDebtServiceRatio: number;
  currentAccountBalance: number;
};

export type ModelWeights = {
  economic: number;
  fiscal: number;
  external: number;
  monetary: number;
  governance: number;
  eventRisk: number;
};

export type RatingModel = {
  id: string;
  name: string;
  type: "A" | "B" | "C" | "D";
  weights: ModelWeights;
};

export type RatingScaleEntry = {
  minScore: number;
  maxScore: number;
  rating: string;
};

export type RatingScale = {
  id: string;
  name: string;
  type: "standard" | "numeric" | "moodys";
  mapping: RatingScaleEntry[];
};

export function calculateDerivedMetrics(data: FactSheetData): DerivedMetrics {
  return {
    debtToGDP: data.gdp ? data.debt / data.gdp : 0,
    interestToRevenue: data.revenue ? data.interest / data.revenue : 0,
    reserveCover: data.imports ? data.fxReserves / data.imports : 0,
    externalDebtServiceRatio: data.exports ? data.debtService / data.exports : 0,
    currentAccountBalance: data.gdp ? (data.exports - data.imports) / data.gdp : 0,
  };
}

function scoreMetric(value: number, thresholds: [number, number, number, number], inverse = false): number {
  if (inverse) {
    if (value <= thresholds[0]) return 5;
    if (value <= thresholds[1]) return 4;
    if (value <= thresholds[2]) return 3;
    if (value <= thresholds[3]) return 2;
    return 1;
  } else {
    if (value >= thresholds[3]) return 5;
    if (value >= thresholds[2]) return 4;
    if (value >= thresholds[1]) return 3;
    if (value >= thresholds[0]) return 2;
    return 1;
  }
}

export function transformScores(data: FactSheetData, derived: DerivedMetrics) {
  return {
    economic: scoreMetric(data.gdpGrowth, [0, 1.5, 3, 5]),
    fiscal: scoreMetric(derived.debtToGDP, [0.4, 0.6, 0.8, 1.0], true),
    external: scoreMetric(derived.reserveCover, [0.1, 0.2, 0.3, 0.5]),
    monetary: scoreMetric(data.inflation, [2, 5, 10, 20], true),
    governance: scoreMetric(data.governanceScore, [20, 40, 60, 80]),
    eventRisk: data.defaultHistory ? 1 : 5,
  };
}

export function runRatingModel(
  data: FactSheetData,
  model: RatingModel,
  scale: RatingScale
) {
  const derived = calculateDerivedMetrics(data);
  const scores = transformScores(data, derived);

  const weightedScores = {
    economic: scores.economic * (model.weights.economic / 100),
    fiscal: scores.fiscal * (model.weights.fiscal / 100),
    external: scores.external * (model.weights.external / 100),
    monetary: scores.monetary * (model.weights.monetary / 100),
    governance: scores.governance * (model.weights.governance / 100),
    eventRisk: scores.eventRisk * (model.weights.eventRisk / 100),
  };

  const finalScore = Object.values(weightedScores).reduce((a, b) => a + b, 0);
  
  // Normalize final score to 1-100 for scale mapping if necessary
  const normalizedScore = (finalScore / 5) * 100;

  const mapping = scale.mapping.find(
    (m) => normalizedScore >= m.minScore && normalizedScore <= m.maxScore
  );

  return {
    derivedMetrics: derived,
    transformedScores: scores,
    weightedScores,
    finalScore: normalizedScore,
    initialRating: mapping?.rating || "NR",
  };
}

export const DEFAULT_MODELS: RatingModel[] = [
  {
    id: "model-a",
    name: "MODEL_A (Institutional Emphasis)",
    type: "A",
    weights: { governance: 25, fiscal: 25, economic: 20, monetary: 15, eventRisk: 10, external: 5 },
  },
  {
    id: "model-b",
    name: "MODEL_B (Fiscal Conservative)",
    type: "B",
    weights: { fiscal: 40, governance: 20, economic: 15, monetary: 10, eventRisk: 10, external: 5 },
  },
  {
    id: "model-c",
    name: "MODEL_C (Growth Focused)",
    type: "C",
    weights: { economic: 40, governance: 20, monetary: 15, fiscal: 10, external: 10, eventRisk: 5 },
  },
  {
    id: "model-d",
    name: "MODEL_D (Balanced Emerging)",
    type: "D",
    weights: { governance: 20, fiscal: 20, economic: 20, external: 20, monetary: 10, eventRisk: 10 },
  },
];

export const DEFAULT_SCALES: RatingScale[] = [
  {
    id: "standard",
    name: "Standard Rating",
    type: "standard",
    mapping: [
      { minScore: 90, maxScore: 100, rating: "AAA" },
      { minScore: 80, maxScore: 90, rating: "AA" },
      { minScore: 70, maxScore: 80, rating: "A" },
      { minScore: 60, maxScore: 70, rating: "BBB" },
      { minScore: 50, maxScore: 60, rating: "BB" },
      { minScore: 30, maxScore: 50, rating: "B" },
      { minScore: 0, maxScore: 30, rating: "CCC" },
    ],
  },
  {
    id: "moodys",
    name: "Moody's Scale",
    type: "moodys",
    mapping: [
      { minScore: 90, maxScore: 100, rating: "Aaa" },
      { minScore: 85, maxScore: 90, rating: "Aa1" },
      { minScore: 80, maxScore: 85, rating: "Aa2" },
      { minScore: 75, maxScore: 80, rating: "A1" },
      { minScore: 65, maxScore: 75, rating: "Baa1" },
      { minScore: 0, maxScore: 65, rating: "Ba1" },
    ],
  },
];