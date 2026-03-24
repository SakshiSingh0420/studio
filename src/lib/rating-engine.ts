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
 * Enhanced for robustness: case-insensitive and handles snake_case slugs.
 */
export function evaluateFormula(formula: string, valuesBySlug: Record<string, number>): number {
  try {
    if (!formula) return 0;

    // 1. Prepare expression
    let expression = formula.toLowerCase();
    
    // 2. Sort slugs by length descending to prevent partial replacements (e.g. gdp_growth before gdp)
    const sortedSlugs = Object.keys(valuesBySlug).sort((a, b) => b.length - a.length);
    
    for (const slug of sortedSlugs) {
      const val = valuesBySlug[slug] ?? 0;
      // Match slug as a whole word to avoid nested replacement errors
      const regex = new RegExp(`\\b${slug.toLowerCase()}\\b`, 'g');
      expression = expression.replace(regex, val.toString());
    }

    // 3. Sanitation - allow numbers, operators, dots, spaces, and parentheses.
    // Replace valid math parts to see if any letters (unknown slugs) remain
    const remainingAlpha = expression.replace(/[0-9.+\-*/()\s]/g, '');
    if (/[a-z]/i.test(remainingAlpha)) {
      console.warn(`Analytical Engine: Unresolved identifiers in formula "${expression}"`);
      return 0;
    }

    // 4. Safe evaluation
    // eslint-disable-next-line no-new-func
    const result = new Function(`return ${expression}`)();
    
    if (typeof result !== 'number' || !isFinite(result)) return 0;
    return result;
  } catch (e) {
    console.error("Analytical Engine: Formula evaluation error:", e);
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

/**
 * Executes the full rating calculation pipeline.
 * Implements robust parameter matching (ID -> Slug -> Name) for demo reliability.
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
  
  // Context for formula evaluation (keyed by slug)
  const context: Record<string, number> = {};
  
  // Stage 1: Build context from raw inputs
  parameters.forEach(p => {
    if (p.type === 'raw') {
      // Robust lookup chain for Demo reliability
      let val = valuesById[p.id];
      if (val === undefined) val = valuesById[p.slug];
      if (val === undefined) val = valuesById[p.name];
      
      const finalVal = val ?? 0;
      context[p.slug] = finalVal;
      actualValuesUsed[p.id] = finalVal;
    }
  });

  // Stage 2: Calculate derived parameters (Step 1 of pipeline)
  const derivedParams = parameters.filter(p => p.type === 'derived' && p.formula);
  // Three passes to handle multi-level dependency chains
  for (let i = 0; i < 3; i++) {
    derivedParams.forEach(p => {
      const computedValue = evaluateFormula(p.formula!, context);
      derivedMetrics[p.id] = computedValue;
      context[p.slug] = computedValue;
      actualValuesUsed[p.id] = computedValue;
    });
  }

  // Stage 3: Scoring & Weighting
  Object.keys(model.weights).forEach((paramId) => {
    const p = parameters.find(param => param.id === paramId);
    if (!p) return;

    // Use resolved value from context (includes derived results)
    const val = actualValuesUsed[paramId] ?? 0;
    const trans = model.transformations[paramId] || { thresholds: [20, 40, 60, 80], inverse: false };
    
    const score = scoreMetric(val, trans);
    transformedScores[paramId] = score;
    weightedScores[paramId] = score * (model.weights[paramId] / 100);
  });

  const rawFinalScore = Object.values(weightedScores).reduce((a, b) => a + b, 0);
  // Normalize aggregate score to 0-100 range
  const normalizedScore = (rawFinalScore / 5) * 100;

  // Final stage: Label mapping
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
