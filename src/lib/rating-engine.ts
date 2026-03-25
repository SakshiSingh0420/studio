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
export function calculateScore(value: number, thresholds: number[], inverse = false): number {
  if (!thresholds || thresholds.length < 4) return 1;
  
  const val = Number(value) || 0;
  const T = thresholds.map(t => Number(t));

  if (!inverse) {
    // Higher is better (Standard)
    if (val >= T[3]) return 5;
    if (val >= T[2]) return 4;
    if (val >= T[1]) return 3;
    if (val >= T[0]) return 2;
    return 1;
  } else {
    // Lower is better (Inverse - e.g. Debt, Inflation)
    if (val <= T[0]) return 5;
    if (val <= T[1]) return 4;
    if (val <= T[2]) return 3;
    if (val <= T[3]) return 2;
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

  // 1. Build initial context with all raw and derived inputs
  parameters.forEach(p => {
    const rawVal = valuesById[p.id];
    const val = (rawVal !== undefined && rawVal !== null) ? Number(rawVal) : 0;

    const slugKey = (p.slug || p.id).toLowerCase().replace(/[-\s]/g, '_');
    const nameKey = (p.name || "").toLowerCase().replace(/[\s-]/g, '_');

    context[p.id] = val;
    context[slugKey] = val;
    context[nameKey] = val;

    if (p.type === 'raw') {
      actualValuesUsed[p.id] = val;
    }
  });

  // 2. Perform Failsafe Derived Metric Calculations (Debt/GDP, etc.)
  parameters.filter(p => p.type === 'derived').forEach(p => {
    const slug = (p.slug || "").toLowerCase().replace(/[-\s]/g, '_');
    const name = (p.name || "").toLowerCase().replace(/[\s-]/g, '_');
    let val = 0;

    if (slug.includes('debt_to_gdp') || name.includes('debt_to_gdp')) {
      const debt = context['government_debt'] || context['debt'] || 0;
      const gdp = context['gdp'] || context['nominal_gdp'] || 1;
      val = (debt / (gdp || 1)) * 100;
    } 
    else if (slug.includes('reserve_cover') || name.includes('reserve_cover')) {
      const res = context['fx_reserves'] || context['reserves'] || 0;
      const imp = context['imports'] || 1;
      val = res / (imp || 1);
    }
    else if (slug.includes('interest_to_revenue') || name.includes('interest_to_revenue')) {
      const int = context['interest_payments'] || context['interest'] || 0;
      const rev = context['government_revenue'] || context['revenue'] || 1;
      val = (int / (rev || 1)) * 100;
    }
    else if (p.formula) {
      val = evaluateFormula(p.formula, context);
    }

    actualValuesUsed[p.id] = val;
    context[p.id] = val;
    context[slug] = val;
    context[name] = val;
  });

  // 3. Apply scoring + weights
  let totalImpactPoints = 0;

  Object.keys(model.weights || {}).forEach(pid => {
    const val = actualValuesUsed[pid] ?? context[pid] ?? 0;
    const config = model.transformations?.[pid];

    if (!config) {
      transformedScores[pid] = 1;
      weightedScores[pid] = 0;
      return;
    }

    const score = calculateScore(val, config.thresholds, config.inverse);
    transformedScores[pid] = score;

    const weight = Number(model.weights[pid]) || 0;
    // Impact = score (1-5) * weight (0-100)
    const impact = score * weight;

    weightedScores[pid] = impact;
    totalImpactPoints += impact;
  });

  // 4. Final Normalized Score (0-100%)
  // Max possible points = 5 (max score) * 100 (total weight sum) = 500
  // Normalized score = (points / 500) * 100 = points / 5
  const finalScore = totalImpactPoints / 5;

  // 5. Map to Rating Scale
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
