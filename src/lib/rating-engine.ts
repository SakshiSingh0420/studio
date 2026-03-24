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
 * Executes the full rating calculation pipeline with hardcoded fallbacks for critical metrics.
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
  
  const context: Record<string, number> = {};
  
  // Stage 1: Map all raw inputs to context by SLUG for consistency
  parameters.forEach(p => {
    if (p.type === 'raw') {
      const val = valuesById[p.id] ?? valuesById[p.slug] ?? 0;
      context[p.slug] = val;
      actualValuesUsed[p.id] = val;
    }
  });

  // Stage 2: Hardcoded Failsafe Calculations (Prioritize these over formula engine for critical demo metrics)
  const calculateHardcoded = (slug: string, logic: () => number) => {
    const p = parameters.find(param => param.slug === slug);
    if (p && p.type === 'derived') {
      const result = logic();
      context[slug] = result;
      derivedMetrics[p.id] = result;
      actualValuesUsed[p.id] = result;
    }
  };

  // Debt to GDP: (Debt / GDP) * 100
  calculateHardcoded('debt_to_gdp', () => {
    const debt = context['debt'] || 0;
    const gdp = context['gdp'] || 1; // Avoid div by zero
    return (debt / gdp) * 100;
  });

  // Reserve Cover: FX Reserves / Imports (Months)
  calculateHardcoded('reserve_cover', () => {
    const reserves = context['fx_reserves'] || 0;
    const imports = context['imports'] || 12;
    return (reserves / (imports / 12));
  });

  // Interest to Revenue: (Interest / Revenue) * 100
  calculateHardcoded('interest_to_revenue', () => {
    const interest = context['interest'] || 0;
    const revenue = context['revenue'] || 1;
    return (interest / revenue) * 100;
  });

  // Stage 3: Formula Engine (Secondary Pass for remaining derived parameters)
  const derivedParams = parameters.filter(p => p.type === 'derived' && p.formula);
  derivedParams.forEach(p => {
    // Only calculate if not already handled by hardcoded logic or if value is still 0
    if (!actualValuesUsed[p.id]) {
      const computedValue = evaluateFormula(p.formula!, context);
      derivedMetrics[p.id] = computedValue;
      context[p.slug] = computedValue;
      actualValuesUsed[p.id] = computedValue;
    }
  });

  // Stage 4: Scoring & Weighting
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