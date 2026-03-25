
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
  const { thresholds, inverse } = config;
  
  if (!inverse) {
    // Normal logic: higher is better (e.g. GDP Growth, Reserves)
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
  
  // PHASE 1: Build Variable Context for Formulas (Normalize keys)
  parameters.forEach(p => {
    const val = valuesById[p.id] ?? 0;
    const slugKey = (p.slug || p.id).toLowerCase().replace(/[-\s]/g, '_');
    const nameKey = (p.name || "").toLowerCase().replace(/[\s-]/g, '_');
    
    context[slugKey] = val;
    context[nameKey] = val;
    context[p.id.toLowerCase()] = val;
    
    if (p.type === 'raw') {
      actualValuesUsed[p.id] = val;
    }
  });

  // PHASE 2: Forced Calculations for Mandatory Ratios
  const computeDerived = (targetKeys: string[], logic: (ctx: Record<string, number>) => number) => {
    const p = parameters.find(param => {
      const slug = (param.slug || "").toLowerCase().replace(/[-\s]/g, '_');
      const name = (param.name || "").toLowerCase().replace(/[\s-]/g, '_');
      return targetKeys.some(tk => slug.includes(tk) || name.includes(tk) || param.id.toLowerCase().includes(tk));
    });
    
    if (p) {
        // Build local context for the logic block by mapping conceptual keys to actual user values
        const localCtx: Record<string, number> = {
            debt: context['government_debt'] || context['debt'] || 0,
            gdp: context['gdp'] || context['nominal_gdp'] || 1,
            res: context['fx_reserves'] || context['reserves'] || 0,
            imp: context['imports'] || 1,
            interest: context['interest_payments'] || context['interest'] || 0,
            revenue: context['government_revenue'] || context['revenue'] || 1
        };

      const result = logic(localCtx);
      actualValuesUsed[p.id] = result;
      
      // Update global context for other formulas
      const slugKey = (p.slug || p.id).toLowerCase().replace(/[-\s]/g, '_');
      context[slugKey] = result;
      console.log(`2. Derived [${p.name}]:`, result.toFixed(2));
    }
  };

  // PART 1 REQUIRED CALCULATIONS
  // 1. Debt to GDP: (Government Debt / GDP) * 100
  computeDerived(['debt_to_gdp', 'debt_gdp'], (c) => (c.debt / (c.gdp || 1)) * 100);

  // 2. Reserve Cover: FX Reserves / Imports
  computeDerived(['reserve_cover', 'fx_reserves_imports'], (c) => (c.res / (c.imp || 1)));

  // 3. Interest to Revenue: (Interest Payments / Government Revenue) * 100
  computeDerived(['interest_to_revenue', 'interest_revenue'], (c) => (c.interest / (c.revenue || 1)) * 100);

  // PHASE 3: Generic Formula Evaluation for other derived parameters
  parameters.filter(p => p.type === 'derived' && p.formula).forEach(p => {
    if (actualValuesUsed[p.id] === undefined || actualValuesUsed[p.id] === 0) {
      const result = evaluateFormula(p.formula!, context);
      actualValuesUsed[p.id] = result;
      const slugKey = (p.slug || p.id).toLowerCase().replace(/[-\s]/g, '_');
      context[slugKey] = result;
    }
  });

  // PHASE 4: Scoring and Weighting (Apply Thresholds)
  Object.keys(model.weights).forEach((paramId) => {
    const p = parameters.find(param => param.id === paramId);
    if (!p) return;

    const val = actualValuesUsed[paramId] ?? 0;
    const trans = model.transformations[paramId] || { thresholds: [20, 40, 60, 80], inverse: false };
    
    // TRANS. SCORE (1-5)
    const score = scoreMetric(val, trans);
    transformedScores[paramId] = score;

    // IMPACT Calculation: (Score / 5) * Weight
    const weight = model.weights[paramId] || 0;
    const impact = (score / 5) * weight;
    weightedScores[paramId] = impact;

    console.log(`4. Score [${p.name}]: Value=${val.toFixed(2)}, Score=${score}, Impact=${impact.toFixed(2)}`);
  });

  // PHASE 5: Aggregate Scoring and Scale Mapping
  const finalAggregateScore = Object.values(weightedScores).reduce((a, b) => a + b, 0);
  
  // Sort scale by minScore descending
  const sortedMapping = [...scale.mapping].sort((a, b) => b.minScore - a.minScore);
  const mapping = sortedMapping.find(m => finalAggregateScore >= m.minScore);

  console.log("5. FINAL RESULTS: Score =", finalAggregateScore.toFixed(2) + "%", "Rating =", mapping?.rating || "NR");
  console.log("--- ANALYSIS END ---");

  return {
    transformedScores,
    weightedScores,
    finalScore: finalAggregateScore,
    initialRating: mapping?.rating || "NR",
    actualValuesUsed
  };
}
