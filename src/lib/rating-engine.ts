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
 * Executes the full rating calculation pipeline.
 */
export function runDynamicRating(
  valuesById: Record<string, number>,
  model: RatingModel,
  scale: RatingScale,
  parameters: Parameter[]
) {
  console.log("--- START RATING EXECUTION ---");
  console.log("Inputs Received:", valuesById);

  const weightedScores: Record<string, number> = {};
  const transformedScores: Record<string, number> = {};
  const derivedMetrics: Record<string, number> = {};
  const actualValuesUsed: Record<string, number> = {};
  
  // 1. Build context using Multi-Layer Mapping (ID, Slug, Name)
  const context: Record<string, number> = {};
  parameters.forEach(p => {
    const val = valuesById[p.id] ?? 0;
    
    // Key 1: Parameter ID (normalized)
    context[p.id.toLowerCase().replace(/-/g, '_')] = val;
    
    // Key 2: Parameter Slug (normalized)
    if (p.slug) {
        context[p.slug.toLowerCase().replace(/-/g, '_')] = val;
    }
    
    // Key 3: Parameter Name (normalized to slug format)
    if (p.name) {
        context[p.name.toLowerCase().replace(/[\s-]/g, '_')] = val;
    }

    actualValuesUsed[p.id] = val;
  });

  console.log("Analytical Context Built:", context);

  // 2. Run Failsafe Hardcoded Calculation Layer (Prioritized for Demo)
  const runHardcoded = (targetKeys: string[], sourceKeys: Record<string, string[]>, logic: (ctx: Record<string, number>) => number) => {
    const p = parameters.find(param => {
        const slug = (param.slug || "").toLowerCase().replace(/-/g, '_');
        const name = (param.name || "").toLowerCase().replace(/[\s-]/g, '_');
        const id = (param.id || "").toLowerCase().replace(/-/g, '_');
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
      console.log(`Hardcoded Calc for ${p.name}:`, result, "using inputs:", localCtx);
      
      const slugKey = (p.slug || p.id || "").toLowerCase().replace(/-/g, '_');
      if (slugKey) context[slugKey] = result;
      
      actualValuesUsed[p.id] = result;
      derivedMetrics[p.id] = result;
    }
  };

  // Debt to GDP (Supports variants like 'Debt', 'Govt Debt', etc.)
  runHardcoded(['debt_to_gdp', 'debt_to_gdp_ratio', 'debt_gdp'], 
    { 
        debt: ['government_debt', 'debt', 'total_debt', 'total_government_debt'], 
        gdp: ['gdp', 'nominal_gdp', 'gross_domestic_product'] 
    }, 
    (c) => (c.debt / (c.gdp || 1)) * 100
  );

  // Reserve Cover
  runHardcoded(['reserve_cover', 'fx_reserve_months', 'reserves_to_imports'], 
    { 
        res: ['fx_reserves', 'reserves', 'foreign_exchange_reserves'], 
        imp: ['imports', 'total_imports'] 
    }, 
    (c) => c.res / ((c.imp || 12) / 12)
  );

  // 3. Run Formula Pass for other derived parameters
  parameters.filter(p => p.type === 'derived' && p.formula).forEach(p => {
    if (derivedMetrics[p.id] === undefined) {
      const result = evaluateFormula(p.formula!, context);
      const slugKey = (p.slug || p.id || "").toLowerCase().replace(/-/g, '_');
      if (slugKey) context[slugKey] = result;
      actualValuesUsed[p.id] = result;
      derivedMetrics[p.id] = result;
    }
  });

  console.log("Final Values Used for Scoring:", actualValuesUsed);

  // 4. Scoring and Weighting
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

  console.log("--- END RATING EXECUTION ---");

  return {
    transformedScores,
    weightedScores,
    finalScore: normalizedScore,
    initialRating: mapping?.rating || "NR",
    derivedMetrics,
    actualValuesUsed
  };
}
