export type Parameter = {
  id: string;
  name: string;
  category: "Economic" | "Fiscal" | "External" | "Monetary" | "Institutional" | "ESG";
  type: "raw" | "derived";
  formula?: string;
  dependentParameters?: string[];
  dataSource: string;
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
 * Simple formula evaluator that replaces parameter IDs with values.
 * Supports basic operators: +, -, *, /, (, )
 */
function evaluateFormula(formula: string, values: Record<string, number>): number {
  try {
    // 1. Replace parameter IDs with their values
    // We sort keys by length descending to avoid partial matches (e.g., 'gdp_growth' vs 'gdp')
    const sortedKeys = Object.keys(values).sort((a, b) => b.length - a.length);
    let expression = formula;
    
    for (const key of sortedKeys) {
      const val = values[key] || 0;
      // Use word boundaries or ensure we match the whole ID
      const regex = new RegExp(`\\b${key}\\b`, 'g');
      expression = expression.replace(regex, val.toString());
    }

    // 2. Basic sanitation: only allow numbers, operators, and whitespace
    if (/[^-+*/().\d\s]/.test(expression)) {
      console.warn("Formula contains invalid characters after replacement:", expression);
      return 0;
    }

    // 3. Evaluate the result
    // Note: In a production enterprise app, use a proper expression parser like mathjs.
    // For this prototype, we use a controlled Function constructor as a safer alternative to eval().
    const result = new Function(`return ${expression}`)();
    
    if (!isFinite(result)) return 0; // Handle division by zero
    return result;
  } catch (e) {
    console.error("Formula evaluation error:", e);
    return 0;
  }
}

export function scoreMetric(value: number, config: ModelTransformation): number {
  const { thresholds, inverse } = config;
  if (inverse) {
    if (value <= thresholds[0]) return 5;
    if (value <= thresholds[1]) return 4;
    if (value <= thresholds[2]) return 3;
    if (value <= thresholds[3]) return 2;
    return 1;
  } else {
    if (value >= thresholds[3]) return 5;
    if (value >= thresholds[2]) return 4;
    if (value >= thresholds[1]) return 3;
    if (value >= thresholds[0]) return 2;
    return 1;
  }
}

export function runDynamicRating(
  values: Record<string, number>,
  model: RatingModel,
  scale: RatingScale,
  parameters: Parameter[]
) {
  const weightedScores: Record<string, number> = {};
  const transformedScores: Record<string, number> = {};
  const derivedMetrics: Record<string, number> = {};
  
  // Create a working copy of values
  const finalValues = { ...values };

  // 1. Calculate all derived parameters first
  const derivedParams = parameters.filter(p => p.type === 'derived' && p.formula);
  
  // We may need multiple passes if derived parameters depend on other derived parameters
  // For simplicity in this version, we'll do one pass.
  derivedParams.forEach(p => {
    const computedValue = evaluateFormula(p.formula!, finalValues);
    derivedMetrics[p.id] = computedValue;
    finalValues[p.id] = computedValue; // Add to pool for scoring or subsequent derivations
  });

  // 2. Execute scoring based on the model weights
  Object.keys(model.weights).forEach((paramId) => {
    const val = finalValues[paramId] || 0;
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
    derivedMetrics 
  };
}
