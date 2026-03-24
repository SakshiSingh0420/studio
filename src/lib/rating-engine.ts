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
 * Evaluates a formula using parameter slugs as variables.
 */
export function evaluateFormula(formula: string, valuesBySlug: Record<string, number>): number {
  try {
    if (!formula) return 0;

    let expression = formula.toLowerCase();
    const sortedSlugs = Object.keys(valuesBySlug).sort((a, b) => b.length - a.length);
    
    for (const slug of sortedSlugs) {
      const val = valuesBySlug[slug] ?? 0;
      const regex = new RegExp(`\\b${slug.toLowerCase()}\\b`, 'g');
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
    return 0;
  }
}

export function scoreMetric(value: number, config: ModelTransformation): number {
  const { thresholds, inverse } = config;
  
  if (!inverse) {
    if (value >= thresholds[3]) return 5;
    if (value >= thresholds[2]) return 4;
    if (value >= thresholds[1]) return 3;
    if (value >= thresholds[0]) return 2;
    return 1;
  } 
  
  if (value <= thresholds[0]) return 5;
  if (value <= thresholds[1]) return 4;
  if (value <= thresholds[2]) return 3;
  if (value <= thresholds[3]) return 2;
  return 1;
}

/**
 * Executes the full rating calculation pipeline with robust mapping and hardcoded fallbacks.
 */
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
  
  // Context to hold values by SLUG for formulas and logic
  const context: Record<string, number> = {};
  
  // Stage 1: Map raw inputs to context by both ID and SLUG
  parameters.forEach(p => {
    const val = valuesById[p.id] ?? 0;
    context[p.slug] = val;
    if (p.type === 'raw') {
      actualValuesUsed[p.id] = val;
    }
  });

  // Stage 2: Hardcoded Calculation Layer for Demo Resilience
  const calculateHardcoded = (targetSlug: string, sourceSlugs: Record<string, string[]>, logic: (ctx: Record<string, number>) => number) => {
    // Find any parameter that matches this slug (to get its ID)
    const p = parameters.find(param => param.slug === targetSlug);
    
    if (p) {
      const localCtx: Record<string, number> = {};
      Object.entries(sourceSlugs).forEach(([key, variations]) => {
        let foundVal = 0;
        for (const v of variations) {
          if (context[v] !== undefined && context[v] !== 0) {
            foundVal = context[v];
            break;
          }
        }
        localCtx[key] = foundVal;
      });

      const result = logic(localCtx);
      context[p.slug] = result;
      actualValuesUsed[p.id] = result;
      derivedMetrics[p.id] = result;
    }
  };

  // Debt to GDP: (Debt / GDP) * 100
  calculateHardcoded('debt_to_gdp', 
    { debt: ['debt', 'government_debt', 'total_debt', 'govt_debt'], gdp: ['gdp'] }, 
    (c) => (c.debt / (c.gdp || 1)) * 100
  );

  // Reserve Cover: FX Reserves / Imports (Months)
  calculateHardcoded('reserve_cover', 
    { res: ['fx_reserves', 'reserves', 'reserves_total'], imp: ['imports', 'total_imports'] }, 
    (c) => c.res / ((c.imp || 12) / 12)
  );

  // Interest to Revenue: (Interest / Revenue) * 100
  calculateHardcoded('interest_to_revenue', 
    { int: ['interest', 'interest_payments', 'debt_interest'], rev: ['revenue', 'government_revenue', 'total_revenue'] }, 
    (c) => (c.int / (c.rev || 1)) * 100
  );

  // Stage 3: Formula Pass (for any derived parameters not hardcoded)
  parameters.filter(p => p.type === 'derived' && p.formula).forEach(p => {
    if (actualValuesUsed[p.id] === undefined || actualValuesUsed[p.id] === 0) {
      const computedValue = evaluateFormula(p.formula!, context);
      context[p.slug] = computedValue;
      actualValuesUsed[p.id] = computedValue;
      derivedMetrics[p.id] = computedValue;
    }
  });

  // Stage 4: Scoring & Weighting
  Object.keys(model.weights).forEach((paramId) => {
    const p = parameters.find(param => param.id === paramId);
    if (!p) return;

    // Use calculated value if exists, otherwise fallback to context/input
    const val = actualValuesUsed[paramId] ?? context[p.slug] ?? 0;
    const trans = model.transformations[paramId] || { thresholds: [20, 40, 60, 80], inverse: false };
    
    const score = scoreMetric(val, trans);
    transformedScores[paramId] = score;
    weightedScores[paramId] = score * (model.weights[paramId] / 100);
    
    // Ensure actualValuesUsed has the most up-to-date value for the UI
    actualValuesUsed[paramId] = val;
  });

  const rawFinalScore = Object.values(weightedScores).reduce((a, b) => a + b, 0);
  const normalizedScore = (rawFinalScore / 5) * 100;

  const mapping = scale.mapping.find(
    (m) => normalizedScore >= m.minScore && normalizedScore <= m.maxScore
  );

  console.log('Analytical Execution Final Log:', { 
    finalScore: normalizedScore, 
    designation: mapping?.rating,
    values: actualValuesUsed 
  });

  return {
    transformedScores,
    weightedScores,
    finalScore: normalizedScore,
    initialRating: mapping?.rating || "NR",
    derivedMetrics,
    actualValuesUsed
  };
}
