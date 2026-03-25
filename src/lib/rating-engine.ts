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

  // -----------------------------
  // 1. Build context
  // -----------------------------
  parameters.forEach(p => {
    const val = Number(valuesById[p.id] ?? 0);

    const slugKey = (p.slug || p.id).toLowerCase().replace(/[-\s]/g, '_');
    const nameKey = (p.name || "").toLowerCase().replace(/[\s-]/g, '_');

    context[p.id] = val;
    context[slugKey] = val;
    context[nameKey] = val;

    if (p.type === 'raw') {
      actualValuesUsed[p.id] = val;
    }
  });

  // -----------------------------
  // 2. Core ratios
  // -----------------------------
  const compute = (idMatch: string[], fn: () => number) => {
    const p = parameters.find(param => {
      const key = (param.slug || param.id).toLowerCase();
      return idMatch.some(t => key.includes(t));
    });

    if (p) {
      const val = fn();
      actualValuesUsed[p.id] = val;
      context[p.id] = val;
    }
  };

  compute(['debt_to_gdp'], () => {
    const debt = context['government_debt'] || context['debt'] || 0;
    const gdp = context['gdp'] || 1;
    return (debt / gdp) * 100;
  });

  compute(['reserve_cover'], () => {
    const res = context['fx_reserves'] || 0;
    const imp = context['imports'] || 1;
    return res / imp;
  });

  compute(['interest_to_revenue'], () => {
    const i = context['interest_payments'] || 0;
    const r = context['government_revenue'] || 1;
    return (i / r) * 100;
  });

  // -----------------------------
  // 3. Derived params
  // -----------------------------
  parameters.filter(p => p.type === 'derived').forEach(p => {
    if (actualValuesUsed[p.id] === undefined) {
      const val = p.formula ? evaluateFormula(p.formula, context) : 0;
      actualValuesUsed[p.id] = val;
      context[p.id] = val;
    }
  });

  // -----------------------------
  // 4. SCORING FUNCTION (FIXED)
  // -----------------------------
  function calculateScore(value: number, thresholds: number[], inverse = false) {
    if (!thresholds || thresholds.length === 0) return 1;

    let score = 1;

    for (let i = 0; i < thresholds.length; i++) {
      if (inverse) {
        if (value <= thresholds[i]) {
          score = 5 - i;
          break;
        }
      } else {
        if (value >= thresholds[i]) {
          score = i + 2;
        }
      }
    }

    return Math.max(1, Math.min(score, 5));
  }

  // -----------------------------
  // 5. Apply scoring + weights
  // -----------------------------
  let totalImpact = 0;

  Object.keys(model.weights || {}).forEach(pid => {
    const val = actualValuesUsed[pid] ?? context[pid] ?? 0;

    const config = model.transformations?.[pid];

    if (!config) {
      console.warn(`Missing transformation for ${pid}`);
      transformedScores[pid] = 1;
      weightedScores[pid] = 0;
      return;
    }

    const score = calculateScore(val, config.thresholds, config.inverse);
    transformedScores[pid] = score;

    const weight = Number(model.weights[pid]) || 0;

    // ✅ CORRECT IMPACT
    const impact = score * weight;

    weightedScores[pid] = impact;
    totalImpact += impact;
  });

  // -----------------------------
  // 6. Final rating
  // -----------------------------
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
