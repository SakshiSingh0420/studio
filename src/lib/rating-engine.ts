'use client';

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
 * Evaluates a formula using parameter slugs or normalized names as variables.
 */
export function evaluateFormula(formula: string, context: Record<string, number>): number {
  try {
    if (!formula) return 0;

    let expression = formula.toLowerCase();
    // Sort keys by length descending to prevent partial matches (e.g., 'gdp' before 'gdp_growth')
    const sortedKeys = Object.keys(context).sort((a, b) => b.length - a.length);
    
    for (const key of sortedKeys) {
      const val = context[key] ?? 0;
      // Replace all occurrences of the key (as a whole word)
      const regex = new RegExp(`\\b${key}\\b`, 'g');
      expression = expression.replace(regex, val.toString());
    }

    // Clean up any remaining characters that aren't numbers or math symbols
    const remainingAlpha = expression.replace(/[0-9.+\-*/()\s]/g, '');
    if (/[a-z]/i.test(remainingAlpha)) {
      return 0;
    }

    // eslint-disable-next-line no-new-func
    const result = new Function(`return ${expression}`)();
    
    if (typeof result !== 'number' || !isFinite(result)) return 0;
    return result;
  } catch (e) {
    console.error("Formula Eval Error:", e);
    return 0;
  }
}

/**
 * Maps a quantitative value to a 1-5 score based on thresholds.
 * Thresholds: [T2, T3, T4, T5]
 */
export function scoreMetric(value: number, config: ModelTransformation): number {
  if (!config || !config.thresholds) return 1;
  
  const { thresholds, inverse } = config;
  if (thresholds.length < 4) return 1;

  // ENSURE NUMERICAL COMPARISON - Force cast thresholds to numbers
  const numValue = Number(value) || 0;
  const T = thresholds.map(t => Number(t));

  if (!inverse) {
    // Normal logic: higher is better
    if (numValue >= T[3]) return 5;
    if (numValue >= T[2]) return 4;
    if (numValue >= T[1]) return 3;
    if (numValue >= T[0]) return 2;
    return 1;
  } else {
    // Inverse logic: lower is better (e.g. Debt, Inflation)
    if (numValue <= T[0]) return 5;
    if (numValue <= T[1]) return 4;
    if (numValue <= T[2]) return 3;
    if (numValue <= T[3]) return 2;
    return 1;
  }
}

/**
 * Executes the full sovereign rating calculation pipeline.
 */
export function runDynamicRating(
  valuesById: Record<string, number>,
  model: RatingModel,
  scale: RatingScale,
  parameters: Parameter[]
) {
  const transformedScores: Record<string, number> = {};
  const weightedScores: Record<string, number> = {};
  const actualValuesUsed: Record<string, number> = {};
  const context: Record<string, number> = {};
  
  // 1. Build initial variable context from all raw inputs
  parameters.forEach(p => {
    const rawVal = valuesById[p.id];
    const val = (rawVal !== undefined && rawVal !== null && rawVal !== "") ? Number(rawVal) : 0;
    
    // Index by ID, Slug, and Name Slugs for maximum formula compatibility
    const slugKey = (p.slug || p.id).toLowerCase().replace(/[-\s]/g, '_');
    const nameKey = (p.name || "").toLowerCase().replace(/[\s-]/g, '_');
    
    context[p.id] = val;
    context[slugKey] = val;
    context[nameKey] = val;
    
    if (p.type === 'raw') {
      actualValuesUsed[p.id] = val;
    }
  });

  // 2. Phase 1: Explicitly calculate core sovereign ratios
  const computeSpecificRatio = (targets: string[], logic: () => number) => {
    const p = parameters.find(param => {
      const s = (param.slug || "").toLowerCase().replace(/[-\s]/g, '_');
      const n = (param.name || "").toLowerCase().replace(/[\s-]/g, '_');
      return targets.some(t => s.includes(t) || n.includes(t) || param.id.toLowerCase().includes(t));
    });

    if (p) {
      const result = logic();
      actualValuesUsed[p.id] = result;
      context[p.id] = result;
      const slugKey = (p.slug || p.id).toLowerCase().replace(/[-\s]/g, '_');
      context[slugKey] = result;
      return result;
    }
    return 0;
  };

  // Hardcoded ratios for demo accuracy
  computeSpecificRatio(['debt_to_gdp', 'debt_gdp'], () => {
    const debt = context['government_debt'] || context['debt'] || 0;
    const gdp = context['gdp'] || context['nominal_gdp'] || 1;
    return (debt / (gdp || 1)) * 100;
  });

  computeSpecificRatio(['reserve_cover', 'fx_reserves_imports'], () => {
    const res = context['fx_reserves'] || context['reserves'] || 0;
    const imp = context['imports'] || 1;
    return res / (imp || 1);
  });

  computeSpecificRatio(['interest_to_revenue', 'interest_revenue'], () => {
    const int = context['interest_payments'] || context['interest'] || 0;
    const rev = context['government_revenue'] || context['revenue'] || 1;
    return (int / (rev || 1)) * 100;
  });

  // 3. Phase 2: Calculate remaining derived parameters
  parameters.filter(p => p.type === 'derived').forEach(p => {
    if (actualValuesUsed[p.id] === undefined) {
      const result = p.formula ? evaluateFormula(p.formula, context) : 0;
      actualValuesUsed[p.id] = result;
      context[p.id] = result;
      const slugKey = (p.slug || p.id).toLowerCase().replace(/[-\s]/g, '_');
      context[slugKey] = result;
    }
  });

  // 4. Scoring and Weight Application
  let totalImpact = 0;
  Object.keys(model.weights || {}).forEach((pid) => {
    const p = parameters.find(param => param.id === pid);
    if (!p) return;

    // GET THE FINAL CALCULATED OR RAW VALUE
    const val = actualValuesUsed[pid] ?? context[pid] ?? 0;
    
    // GET TRANSFORMATION CONFIG (Fallback to safe defaults)
    const config = model.transformations?.[pid] || { thresholds: [20, 40, 60, 80], inverse: false };
    
    // CALCULATE 1-5 SCORE
    const score = scoreMetric(val, config);
    transformedScores[pid] = score;

    // CALCULATE IMPACT: (Score / 5) * Weight
    const weight = Number(model.weights[pid]) || 0;
    const impact = (score / 5) * weight;
    
    weightedScores[pid] = impact;
    totalImpact += impact;
  });

  // 5. Final Mapping to Rating Scale
  const finalScore = totalImpact;
  const sortedMapping = [...scale.mapping].sort((a, b) => b.minScore - a.minScore);
  const ratingMatch = sortedMapping.find(m => finalScore >= m.minScore);

  return {
    transformedScores,
    weightedScores,
    finalScore,
    initialRating: ratingMatch?.rating || "NR",
    actualValuesUsed
  };
}
