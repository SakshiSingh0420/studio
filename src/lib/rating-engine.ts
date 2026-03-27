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
  version: number;
  isActive: boolean;
  isDefault: boolean;
  status: "draft" | "published";
  parentModelId?: string;
  weights: Record<string, number>; // paramId -> weight
  transformations: Record<string, ModelTransformation>; // paramId -> config
  applicability?: { // Added for fit-guidance
    marketType?: string[];
    incomeGroup?: string[];
    sizeCategory?: string[];
  };
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
    
    // Sort keys by length descending to prevent partial matches (e.g., 'debt' and 'total_debt')
    const sortedKeys = Object.keys(context).sort((a, b) => b.length - a.length);
    
    for (const key of sortedKeys) {
      const val = context[key] ?? 0;
      // Use word boundaries to match exactly the variable name
      const regex = new RegExp(`\\b${key.toLowerCase()}\\b`, 'g');
      expression = expression.replace(regex, val.toString());
    }

    // Safety check: ensure only numbers and operators remain
    const remainingAlpha = expression.replace(/[0-9.+\-*/()\s\.]/g, '');
    if (/[a-z]/i.test(remainingAlpha)) {
      // If we still have letters, it means a variable wasn't replaced
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
    const rawValue = valuesById[p.id];
    const val = (rawValue !== undefined && rawValue !== null && rawValue !== "") ? Number(rawValue) : 0;
    
    // Map by ID
    context[p.id] = val;
    // Map by normalized ID
    context[normalize(p.id)] = val;
    
    // Map by Slug
    if (p.slug) {
        context[p.slug.toLowerCase()] = val;
        context[normalize(p.slug)] = val;
    }
    
    // Map by Name
    if (p.name) {
        context[p.name.toLowerCase()] = val;
        context[normalize(p.name)] = val;
    }
    
    if (p.type === "raw") {
      actualValuesUsed[p.id] = val;
    }
  });

  // 3. Resolve Derived Metrics for the calculation run
  parameters.filter(p => p.type === 'derived').forEach(p => {
    const slug = (p.slug || "").toLowerCase();
    const name = (p.name || "").toLowerCase();
    
    let derivedVal = 0;
    
    // Check standard formulas if explicitly named/slugged
    if (slug.includes('debt_to_gdp') || name.includes('debt_to_gdp')) {
      const debt = context['government_debt'] || context['debt'] || context['total_debt'] || 0;
      const gdp = context['gdp'] || context['nominal_gdp'] || 1;
      derivedVal = gdp ? (debt / gdp) * 100 : 0;
    } else if (slug.includes('reserve_cover') || name.includes('reserve_cover')) {
      const res = context['fx_reserves'] || context['reserves'] || 0;
      const imp = context['imports'] || 1;
      derivedVal = imp ? res / imp : 0;
    } else if (slug.includes('interest_to_revenue') || name.includes('interest_to_revenue')) {
      const int = context['interest_payments'] || context['interest'] || 0;
      const rev = context['government_revenue'] || context['revenue'] || 1;
      derivedVal = rev ? (int / rev) * 100 : 0;
    } else if (p.formula) {
      derivedVal = evaluateFormula(p.formula, context);
    }
    
    actualValuesUsed[p.id] = derivedVal;
    context[p.id] = derivedVal;
    if (p.slug) context[p.slug.toLowerCase()] = derivedVal;
  });

  // 4. Transform Values to 1-5 Scores and Apply Weights
  function calculateScore(value: number, thresholds: number[], inverse = false) {
    if (!thresholds || thresholds.length !== 4) return 1;
    const [t2, t3, t4, t5] = thresholds.map(t => Number(t));

    if (inverse) {
      if (value <= t2) return 5;
      if (value <= t3) return 4;
      if (value <= t4) return 3;
      if (value <= t5) return 2;
      return 1;
    } else {
      if (value >= t5) return 5;
      if (value >= t4) return 4;
      if (value >= t3) return 3;
      if (value >= t2) return 2;
      return 1;
    }
  }

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
    const impact = (score / 5) * weight;
    weightedScores[pid] = impact;
    totalImpact += impact;
    totalWeight += weight;
  });

  const finalScore = totalWeight > 0 ? (totalImpact / (totalWeight / 100)) : 0;
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
