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
      console.warn("Formula evaluation: residual characters found", remainingAlpha);
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
 */
export function scoreMetric(value: number, config: ModelTransformation): number {
  const { thresholds, inverse } = config;
  
  if (!inverse) {
    // Normal logic: higher is better
    if (value >= thresholds[3]) return 5;
    if (value >= thresholds[2]) return 4;
    if (value >= thresholds[1]) return 3;
    if (value >= thresholds[0]) return 2;
    return 1;
  } 
  
  // Inverse logic: lower is better (e.g. Debt/GDP, Inflation)
  if (value <= thresholds[0]) return 5;
  if (value <= thresholds[1]) return 4;
  if (value <= thresholds[2]) return 3;
  if (value <= thresholds[3]) return 2;
  return 1;
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
  console.log("--- ANALYSIS START: QUANTITATIVE PIPELINE ---");
  console.log("1. Raw Inputs Received:", valuesById);

  const transformedScores: Record<string, number> = {};
  const weightedScores: Record<string, number> = {};
  const actualValuesUsed: Record<string, number> = {};
  const context: Record<string, number> = {};
  
  // PHASE 1: Build Variable Context for Formulas
  parameters.forEach(p => {
    const val = valuesById[p.id] ?? 0;
    
    // Primary key for context is the SLUG
    const slugKey = (p.slug || p.id).toLowerCase().replace(/[-\s]/g, '_');
    context[slugKey] = val;
    
    // Also map by ID and Name for maximum compatibility
    context[p.id.toLowerCase()] = val;
    context[p.name.toLowerCase().replace(/[\s-]/g, '_')] = val;

    // Default "Actual Value Used" is the raw input
    actualValuesUsed[p.id] = val;
  });

  // PHASE 2: Hardcoded Failsafe Calculations (Prioritized over generic formulas)
  const computeDerived = (targetKeys: string[], sourceKeys: Record<string, string[]>, logic: (ctx: Record<string, number>) => number) => {
    const p = parameters.find(param => {
      const slug = (param.slug || "").toLowerCase().replace(/[-\s]/g, '_');
      const name = (param.name || "").toLowerCase().replace(/[\s-]/g, '_');
      const id = (param.id || "").toLowerCase();
      return targetKeys.includes(slug) || targetKeys.includes(name) || targetKeys.includes(id);
    });
    
    if (p) {
      const localCtx: Record<string, number> = {};
      Object.entries(sourceKeys).forEach(([key, variations]) => {
        let foundVal = 0;
        for (const v of variations) {
          const normV = v.toLowerCase().replace(/[\s-]/g, '_');
          if (context[normV] !== undefined) {
            foundVal = context[normV];
            break;
          }
        }
        localCtx[key] = foundVal;
      });

      const result = logic(localCtx);
      const slugKey = (p.slug || p.id).toLowerCase().replace(/[-\s]/g, '_');
      context[slugKey] = result;
      actualValuesUsed[p.id] = result;
      console.log(`2. Computed Derived Metric [${p.name}]:`, result);
    }
  };

  // Debt to GDP
  computeDerived(['debt_to_gdp', 'debt_gdp'], 
    { debt: ['government_debt', 'debt'], gdp: ['gdp', 'nominal_gdp'] }, 
    (c) => (c.debt / (c.gdp || 1)) * 100
  );

  // Reserve Cover
  computeDerived(['reserve_cover', 'fx_reserves_imports'], 
    { res: ['fx_reserves', 'reserves'], imp: ['imports'] }, 
    (c) => c.imp === 0 ? 0 : (c.res / c.imp)
  );

  // Interest to Revenue
  computeDerived(['interest_to_revenue', 'interest_revenue'], 
    { interest: ['interest_payments', 'interest'], revenue: ['government_revenue', 'revenue'] }, 
    (c) => c.revenue === 0 ? 0 : (c.interest / c.revenue) * 100
  );

  // PHASE 3: Generic Formula Evaluation
  parameters.filter(p => p.type === 'derived' && p.formula).forEach(p => {
    // Only run if not already hardcoded above
    if (!actualValuesUsed[p.id] || actualValuesUsed[p.id] === 0) {
      const result = evaluateFormula(p.formula!, context);
      const slugKey = (p.slug || p.id).toLowerCase().replace(/[-\s]/g, '_');
      context[slugKey] = result;
      actualValuesUsed[p.id] = result;
      console.log(`3. Evaluated Formula for [${p.name}]:`, result);
    }
  });

  // PHASE 4: Scoring and Weighting (Impact Calculation)
  Object.keys(model.weights).forEach((paramId) => {
    const p = parameters.find(param => param.id === paramId);
    if (!p) return;

    const val = actualValuesUsed[paramId] ?? 0;
    const trans = model.transformations[paramId] || { thresholds: [20, 40, 60, 80], inverse: false };
    
    // TRANS. SCORE (1-5)
    const score = scoreMetric(val, trans);
    transformedScores[paramId] = score;

    // IMPACT Calculation: (Score / 5) * Weight
    // This represents the parameter's contribution to the final 100% score.
    const weight = model.weights[paramId] || 0;
    const impact = (score / 5) * weight;
    weightedScores[paramId] = impact;

    console.log(`4. Scoring [${p.name}]: Val=${val.toFixed(2)}, Score=${score}, Impact=${impact.toFixed(2)}`);
  });

  // PHASE 5: Aggregate Scoring and Rating Mapping
  const finalAggregateScore = Object.values(weightedScores).reduce((a, b) => a + b, 0);
  
  const mapping = scale.mapping.find(
    (m) => finalAggregateScore >= m.minScore && finalAggregateScore <= m.maxScore
  );

  console.log("5. FINAL RESULTS: Score =", finalAggregateScore.toFixed(2) + "%", "Rating =", mapping?.rating || "NR");
  console.log("--- ANALYSIS END ---");

  return {
    transformedScores,
    weightedScores, // This now contains "IMPACT"
    finalScore: finalAggregateScore,
    initialRating: mapping?.rating || "NR",
    actualValuesUsed
  };
}
