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

const FactSheetDataSchema = z.record(z.union([z.number(), z.string()]).nullable()).describe('Map of parameter names to their observed values.');

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
  derivedMetrics: z.record(z.any()).optional(),
  transformedScores: z.record(z.any()).optional(),
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

CRITICAL INSTRUCTION: Use ONLY the human-readable parameter names provided in the keys of the data objects. DO NOT use or output internal database IDs or random alphanumeric strings.

Country: {{{country.name}}}

Analytical Breakdown:
- Final Assigned Rating: {{{initialRating}}}
- Quantitative Aggregate Score: {{{finalScore}}}%

Detailed Fact Sheet (Names and Values):
{{#each factSheetData}}
  - {{ @key }}: {{ this }}
{{/each}}

Model Impact Factors (Parameter Name and its Weighted Impact):
{{#each weightedScores}}
  - {{ @key }}: Contributing {{ this }} to the final aggregate score.
{{/each}}

Task:
Provide a professional rationale that justifies the assigned rating based on the economic, fiscal, and external data points provided. 
1. Group your points into logical themes (e.g., Economic Performance, Fiscal Sustainability, External Resilience).
2. Connect the quantitative scores to the final credit designation on the {{{ratingScale.name}}} scale.
3. Ensure the output is readable and professional, similar to reports from major rating agencies (Moody's, S&P, Fitch).`,
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
