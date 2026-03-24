export type Parameter = {
  id: string;
  slug: string; // Internal key for formulas
  name: string;
  category: "Economic" | "Fiscal" | "External" | "Monetary" | "Institutional" | "ESG";
  type: "raw" | "derived";
  formula?: string;
  dependentParameters?: string[];
  dataSource: "IMF (Auto)" | "World Bank (Auto)" | "Manual" | "Semi-Auto (Editable)" | "Computed";
  frequency: string;
};

export type ModelTransformation = {
  thresholds: [number, number, number, number];
  inverse: boolean;
};

export type RatingModel = {
  id: string;
  name: string;
  version: string;
  weights: Record<string, number>; // paramId -> weight
  transformations: Record<string, ModelTransformation>; // paramId -> config
};

export type RatingScaleEntry = {
  minScore: number;
  maxScore: number;
  rating: string;
};

export type RatingScale = {
  id: string;
  name: string;
  mapping: RatingScaleEntry[];
};

export type FactSheetData = Record<string, any>;

/**
 * Evaluates a formula using parameter slugs as variables.
 */
export function evaluateFormula(formula: string, valuesBySlug: Record<string, number>): number {
  try {
    if (!formula) return 0;

    // 1. Replace parameter slugs with their values
    // Sort by length descending to prevent partial replacements (e.g., 'gdp_growth' before 'gdp')
    const sortedSlugs = Object.keys(valuesBySlug).sort((a, b) => b.length - a.length);
    let expression = formula.toLowerCase();
    
    for (const slug of sortedSlugs) {
      const val = valuesBySlug[slug] ?? 0;
      // Match slug as a whole word to avoid replacing parts of other slugs
      const regex = new RegExp(`\\b${slug.toLowerCase()}\\b`, 'g');
      expression = expression.replace(regex, val.toString());
    }

    // 2. Sanitation - allow numbers, operators, dots, spaces, and parentheses.
    // Replace valid math symbols to check for remaining letters (invalid slugs)
    const remainingAlpha = expression.replace(/[0-9.+\-*/()\s]/g, '');
    if (/[a-z]/i.test(remainingAlpha)) {
      console.warn(`Formula evaluation failed: Unresolved slugs in expression "${expression}"`);
      return 0;
    }

    // 3. Evaluate result safely
    // eslint-disable-next-line no-new-func
    const result = new Function(`return ${expression}`)();
    
    if (typeof result !== 'number' || !isFinite(result)) return 0;
    return result;
  } catch (e) {
    console.error("Formula Evaluation Error:", e);
    return 0;
  }
}

export function scoreMetric(value: number, config: ModelTransformation): number {
  const { thresholds, inverse } = config;
  
  // Standard logic: higher is better (e.g., GDP Growth)
  if (!inverse) {
    if (value >= thresholds[3]) return 5;
    if (value >= thresholds[2]) return 4;
    if (value >= thresholds[1]) return 3;
    if (value >= thresholds[0]) return 2;
    return 1;
  } 
  
  // Inverse logic: lower is better (e.g., Debt)
  if (value <= thresholds[0]) return 5;
  if (value <= thresholds[1]) return 4;
  if (value <= thresholds[2]) return 3;
  if (value <= thresholds[3]) return 2;
  return 1;
}

export function runDynamicRating(
  valuesById: Record<string, number>,
  model: RatingModel,
  scale: RatingScale,
  parameters: Parameter[]
) {
  const weightedScores: Record<string, number> = {};
  const transformedScores: Record<string, number> = {};
  const derivedMetrics: Record<string, number> = {};
  const actualValuesUsed: Record<string, number> = {};
  
  // Build a context map using SLUGS for formula evaluation
  const valuesBySlug: Record<string, number> = {};
  parameters.forEach(p => {
    if (p.type === 'raw') {
      const val = valuesById[p.id] ?? 0;
      valuesBySlug[p.slug] = val;
      actualValuesUsed[p.id] = val;
    }
  });

  // 1. Calculate derived parameters using slugs (Step 1 of pipeline)
  const derivedParams = parameters.filter(p => p.type === 'derived' && p.formula);
  
  // Two passes to handle basic dependency chaining (e.g., param C depends on B which depends on A)
  for (let i = 0; i < 2; i++) {
    derivedParams.forEach(p => {
      const computedValue = evaluateFormula(p.formula!, valuesBySlug);
      derivedMetrics[p.id] = computedValue;
      valuesBySlug[p.slug] = computedValue;
      actualValuesUsed[p.id] = computedValue;
    });
  }

  // 2. Score metrics using the ID-based model weights (Step 2 of pipeline)
  Object.keys(model.weights).forEach((paramId) => {
    const p = parameters.find(param => param.id === paramId);
    if (!p) return;

    const val = actualValuesUsed[paramId] ?? 0;
    const trans = model.transformations[paramId] || { thresholds: [20, 40, 60, 80], inverse: false };
    
    const score = scoreMetric(val, trans);
    transformedScores[paramId] = score;
    weightedScores[paramId] = score * (model.weights[paramId] / 100);
  });

  const rawFinalScore = Object.values(weightedScores).reduce((a, b) => a + b, 0);
  const normalizedScore = (rawFinalScore / 5) * 100;

  const mapping = scale.mapping.find(
    (m) => normalizedScore >= m.minScore && normalizedScore <= m.maxScore
  );

  return {
    transformedScores,
    weightedScores,
    finalScore: normalizedScore,
    initialRating: mapping?.rating || "NR",
    derivedMetrics,
    actualValuesUsed
  };
}
