
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
    // Sort keys by length descending to prevent partial matches
    const sortedKeys = Object.keys(context).sort((a, b) => b.length - a.length);
    
    for (const key of sortedKeys) {
      const val = context[key] ?? 0;
      const regex = new RegExp(`\\b${key}\\b`, 'g');
      expression = expression.replace(regex, val.toString());
    }

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
 * Executes the full sovereign rating calculation pipeline.
 * Precision Fix: Ensures derived ratios are calculated and injected before scoring.
 */
export function runDynamicRating(
  valuesById: Record<string, number>,
  model: any,
  scale: any,
  parameters: any[]
) {
  const transformedScores: Record<string, number> = {};
  const weightedScores: Record<string, number> = {};
  const actualValuesUsed: Record<string, number> = {};
  const context: Record<string, number> = {};

  // 1. Normalize helper for lookup
  const normalize = (str: string) => (str || "").toLowerCase().replace(/[\s-_]/g, "");

  // 2. Initial Context Population (Raw Values)
  parameters.forEach(p => {
    // Crucial: Use parameter ID to fetch from valuesById
    const val = Number(valuesById[p.id] ?? 0);
    
    // Populate context using all possible keys for maximum reliability
    context[p.id] = val;
    context[normalize(p.id)] = val;
    if (p.slug) {
        const normSlug = normalize(p.slug);
        context[normSlug] = val;
        context[p.slug.toLowerCase()] = val;
    }
    if (p.name) {
        const normName = normalize(p.name);
        context[normName] = val;
        context[p.name.toLowerCase()] = val;
    }
    
    if (p.type === "raw") {
      actualValuesUsed[p.id] = val;
    }
  });

  // 3. Helper to fetch values from context
  function getVal(keys: string[]) {
    for (const key of keys) {
      // Try direct match first
      if (context[key] !== undefined) return context[key];
      // Try normalized match
      const k = normalize(key);
      if (context[k] !== undefined) return context[k];
    }
    return 0;
  }

  // 4. Calculate Critical Derived Ratios with high precision
  const debtToGDP = (() => {
    const debt = getVal(["government_debt", "debt", "total_debt"]);
    const gdp = getVal(["gdp", "nominal_gdp"]);
    return gdp ? (debt / gdp) * 100 : 0;
  })();

  const reserveCover = (() => {
    const res = getVal(["fx_reserves", "reserves"]);
    const imp = getVal(["imports"]);
    return imp ? res / imp : 0;
  })();

  const interestToRevenue = (() => {
    const int = getVal(["interest_payments", "interest"]);
    const rev = getVal(["government_revenue", "revenue"]);
    return rev ? (int / rev) * 100 : 0;
  })();

  // 5. Inject Derived Values back into the Context for scoring
  parameters.forEach(p => {
    const slug = (p.slug || "").toLowerCase();
    const name = (p.name || "").toLowerCase();
    
    if (slug.includes('debt_to_gdp') || name.includes('debt_to_gdp')) {
      actualValuesUsed[p.id] = debtToGDP;
      context[normalize(p.id)] = debtToGDP;
      context[normalize(p.slug)] = debtToGDP;
    } else if (slug.includes('reserve_cover') || name.includes('reserve_cover')) {
      actualValuesUsed[p.id] = reserveCover;
      context[normalize(p.id)] = reserveCover;
      context[normalize(p.slug)] = reserveCover;
    } else if (slug.includes('interest_to_revenue') || name.includes('interest_to_revenue')) {
      actualValuesUsed[p.id] = interestToRevenue;
      context[normalize(p.id)] = interestToRevenue;
      context[normalize(p.slug)] = interestToRevenue;
    } else if (p.type === 'derived' && p.formula) {
        // Fallback to custom formula evaluation
        const val = evaluateFormula(p.formula, context);
        actualValuesUsed[p.id] = val;
        context[normalize(p.id)] = val;
    }
  });

  // 6. Threshold-Based Scoring (Strict 1-5 Comparison)
  function calculateScore(value: number, thresholds: number[], inverse = false) {
    if (!thresholds || thresholds.length !== 4) return 1;
    const [t2, t3, t4, t5] = thresholds.map(t => Number(t));

    if (inverse) {
      // Lower is better (Penalizing high Debt, Inflation)
      if (value <= t2) return 5;
      if (value <= t3) return 4;
      if (value <= t4) return 3;
      if (value <= t5) return 2;
      return 1;
    } else {
      // Higher is better (Rewarding Growth, Reserves)
      if (value >= t5) return 5;
      if (value >= t4) return 4;
      if (value >= t3) return 3;
      if (value >= t2) return 2;
      return 1;
    }
  }

  // 7. Calculate Weights and Impacts
  let totalImpact = 0;
  let totalWeight = 0;

  Object.keys(model.weights || {}).forEach(pid => {
    const val = actualValuesUsed[pid] ?? 0;
    const config = model.transformations?.[pid];
    const weight = Number(model.weights[pid]) || 0;

    if (!config) {
      transformedScores[pid] = 1;
      weightedScores[pid] = 0;
      return;
    }

    const score = calculateScore(val, config.thresholds, config.inverse);
    transformedScores[pid] = score;
    
    // Impact = (Score / 5) * Weight
    const impact = (score / 5) * weight;
    weightedScores[pid] = impact;
    
    totalImpact += impact;
    totalWeight += weight;
  });

  // 8. Normalize Final Aggregate Score (0-100%)
  const finalScore = totalWeight > 0 ? (totalImpact / (totalWeight / 100)) : 0;

  // 9. Map Final Score to Rating Scale
  const sortedMapping = [...(scale.mapping || [])].sort((a, b) => b.minScore - a.minScore);
  const ratingMatch = sortedMapping.find(m => finalScore >= m.minScore);

  return {
    transformedScores,
    weightedScores,
    finalScore,
    initialRating: ratingMatch?.rating || "NR",
    actualValuesUsed
  };
}
