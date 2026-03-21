'use server';
/**
 * @fileOverview A Genkit flow for generating a narrative explanation and justification for a country's assigned sovereign credit rating.
 *
 * - generateRatingRationale - A function that handles the generation of the rating rationale.
 * - GenerateRatingRationaleInput - The input type for the generateRatingRationale function.
 * - GenerateRatingRationaleOutput - The return type for the generateRatingRationale function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const FactSheetDataSchema = z.object({
  gdp: z.number().optional(),
  gdpGrowth: z.number().optional(),
  inflation: z.number().optional(),
  debt: z.number().optional(),
  revenue: z.number().optional(),
  interest: z.number().optional(),
  fxReserves: z.number().optional(),
  imports: z.number().optional(),
  exports: z.number().optional(),
  externalDebt: z.number().optional(),
  debtService: z.number().optional(),
  npl: z.number().optional(),
  car: z.number().optional(),
  governanceScore: z.number().optional(),
  politicalStability: z.number().optional(),
  climateRisk: z.number().optional(),
  defaultHistory: z.boolean().optional(),
});

const CountryDataSchema = z.object({
  id: z.string(),
  name: z.string(),
  region: z.string().optional(),
  incomeGroup: z.string().optional(),
  currency: z.string().optional(),
  population: z.number().optional(),
  gdp: z.number().optional(),
});

const ModelSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['A', 'B', 'C', 'D']),
  weights: z.object({
    economic: z.number(),
    fiscal: z.number(),
    external: z.number(),
    monetary: z.number(),
    governance: z.number(),
    eventRisk: z.number(),
  }),
  useFlag: z.boolean(),
});

const RatingScaleMappingSchema = z.object({
  minScore: z.number(),
  maxScore: z.number(),
  rating: z.string(),
});

const RatingScaleSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['standard', 'numeric', 'moodys']),
  mapping: z.array(RatingScaleMappingSchema),
});

const GenerateRatingRationaleInputSchema = z.object({
  country: CountryDataSchema,
  factSheetData: FactSheetDataSchema,
  model: ModelSchema,
  ratingScale: RatingScaleSchema,
  derivedMetrics: z.record(z.number().nullable()),
  transformedScores: z.record(z.number().nullable()),
  weightedScores: z.record(z.number().nullable()),
  finalScore: z.number(),
  initialRating: z.string(),
  adjustedRating: z.string().optional(),
  overrideRating: z.string().optional(),
  approvalStatus: z.string().optional(),
});
export type GenerateRatingRationaleInput = z.infer<typeof GenerateRatingRationaleInputSchema>;

const GenerateRatingRationaleOutputSchema = z.object({
  rationale: z.string().describe('A narrative explanation and justification for the sovereign credit rating.'),
});
export type GenerateRatingRationaleOutput = z.infer<typeof GenerateRatingRationaleOutputSchema>;

export async function generateRatingRationale(input: GenerateRatingRationaleInput): Promise<GenerateRatingRationaleOutput> {
  return generateRatingRationaleFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateRatingRationalePrompt',
  input: {schema: GenerateRatingRationaleInputSchema},
  output: {schema: GenerateRatingRationaleOutputSchema},
  prompt: `You are an expert credit rating analyst. Your task is to generate a clear, concise narrative explanation and justification for a country's assigned sovereign credit rating.

Use the following data to construct your rationale:

Country: {{{country.name}}}

Fact Sheet Data:
{{#each factSheetData}}
  - {{ @key }}: {{ this }}
{{/each}}

Rating Model Used: {{{model.name}}} (Type: {{{model.type}}})
Model Weights:
{{#each model.weights}}
  - {{ @key }}: {{ this }}%
{{/each}}

Derived Metrics:
{{#each derivedMetrics}}
  - {{ @key }}: {{ this }}
{{/each}}

Transformed Scores (1-5, 5 being best):
{{#each transformedScores}}
  - {{ @key }}: {{ this }}
{{/each}}

Weighted Scores:
{{#each weightedScores}}
  - {{ @key }}: {{ this }}
{{/each}}

Final Aggregated Score: {{{finalScore}}}
Initial Rating: {{{initialRating}}}

{{#if adjustedRating}}
Adjustment: The initial rating was adjusted to {{{adjustedRating}}}.
{{/if}}

{{#if overrideRating}}
Override: The rating was overridden to {{{overrideRating}}}.
{{/if}}

Rating Scale Used: {{{ratingScale.name}}}

Based on the above data, provide a comprehensive rationale that:
1. Clearly states the final assigned rating (considering initial, adjusted, or overridden rating).
2. Highlights the most significant raw data points and derived metrics that influenced the score.
3. Explains how the selected rating model's weights impacted the final score, referencing specific categories.
4. Justifies the final rating by connecting the calculated scores to the chosen rating scale.
5. If applicable, explains the reason for any adjustments or overrides.

Ensure the explanation is professional, concise, and easy to understand for financial stakeholders. Focus on the most impactful factors.`,
});

const generateRatingRationaleFlow = ai.defineFlow(
  {
    name: 'generateRatingRationaleFlow',
    inputSchema: GenerateRatingRationaleInputSchema,
    outputSchema: GenerateRatingRationaleOutputSchema,
  },
  async (input) => {
    const {output} = await prompt(input);
    return output!;
  }
);
