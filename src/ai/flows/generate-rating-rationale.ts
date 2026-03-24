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
  gdp_growth: z.number().optional(),
  inflation: z.number().optional(),
  debt: z.number().optional(),
  revenue: z.number().optional(),
  interest: z.number().optional(),
  fx_reserves: z.number().optional(),
  imports: z.number().optional(),
  exports: z.number().optional(),
  external_debt: z.number().optional(),
  debt_service: z.number().optional(),
  governance_score: z.number().optional(),
  political_stability: z.number().optional(),
  climate_risk: z.number().optional(),
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
  weights: z.record(z.number()),
});

const RatingScaleMappingSchema = z.object({
  minScore: z.number(),
  maxScore: z.number(),
  rating: z.string(),
});

const RatingScaleSchema = z.object({
  id: z.string(),
  name: z.string(),
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

Country: {{{country.name}}}

Analytical Breakdown:
- Final Assigned Rating: {{{initialRating}}}
- Quantitative Aggregate Score: {{{finalScore}}}%

Detailed Fact Sheet:
{{#each factSheetData}}
  - {{ @key }}: {{ this }}
{{/each}}

Model Impact Factors:
{{#each weightedScores}}
  - Parameter Impact: {{ @key }} contributing {{ this }} to the final score.
{{/each}}

Provide a professional rationale that justifies the assigned rating based on the economic, fiscal, and external data points provided. Connect the quantitative scores to the final credit designation on the {{{ratingScale.name}}} scale.`,
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
