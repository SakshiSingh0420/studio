'use server';
/**
 * @fileOverview A Genkit flow for suggesting fact sheet data for a given country.
 *
 * - suggestFactSheetData - A function that handles the data suggestion process.
 * - SuggestFactSheetDataInput - The input type for the suggestFactSheetData function.
 * - SuggestFactSheetDataOutput - The return type for the suggestFactSheetData function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestFactSheetDataInputSchema = z.object({
  countryName: z.string().describe('The name of the country for which to suggest fact sheet data.'),
  currency: z.string().optional().default('INR').describe('The reporting currency of the country.'),
});
export type SuggestFactSheetDataInput = z.infer<typeof SuggestFactSheetDataInputSchema>;

const FactSheetDataOutputSchema = z.object({
  gdp: z.number().nullable().describe('Gross Domestic Product in reporting currency.'),
  gdp_growth: z.number().nullable().describe('Annual GDP growth rate as a percentage (e.g., 3.5 for 3.5%).'),
  inflation: z.number().nullable().describe('Annual inflation rate as a percentage.'),
  debt: z.number().nullable().describe('Government debt in reporting currency.'),
  revenue: z.number().nullable().describe('Government revenue in reporting currency.'),
  interest: z.number().nullable().describe('Government interest payments on debt in reporting currency.'),
  fx_reserves: z.number().nullable().describe('Foreign exchange reserves in reporting currency.'),
  imports: z.number().nullable().describe('Total imports of goods and services in reporting currency.'),
  exports: z.number().nullable().describe('Total exports of goods and services in reporting currency.'),
  external_debt: z.number().nullable().describe('Total external debt in reporting currency.'),
  debt_service: z.number().nullable().describe('External debt service in reporting currency.'),
  governance_score: z.number().nullable().describe('A composite governance score or index.'),
  political_stability: z.number().nullable().describe('A political stability indicator or score.'),
  climate_risk: z.number().nullable().describe('A climate risk score or index.'),
}).describe('Suggested data points. Keys MUST be snake_case to match internal parameter slugs.');
export type SuggestFactSheetDataOutput = z.infer<typeof FactSheetDataOutputSchema>;

export async function suggestFactSheetData(input: SuggestFactSheetDataInput): Promise<SuggestFactSheetDataOutput> {
  return suggestFactSheetDataFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestFactSheetDataPrompt',
  input: {schema: SuggestFactSheetDataInputSchema},
  output: {schema: FactSheetDataOutputSchema},
  prompt: `You are an expert financial data analyst specializing in sovereign credit rating.
Your task is to find and provide current (most recent available year) economic, fiscal, and external data points for the country: {{{countryName}}}.

Retrieve the following specific data points:
- Gross Domestic Product (GDP)
- Annual GDP growth rate (gdp_growth)
- Annual inflation rate (inflation)
- Government debt (debt)
- Government revenue (revenue)
- Government interest payments on debt (interest)
- Foreign exchange reserves (fx_reserves)
- Total imports of goods and services (imports)
- Total exports of goods and services (exports)
- Total external debt (external_debt)
- External debt service (debt_service)
- A composite governance score or index (governance_score)
- A political stability indicator or score (political_stability)
- A climate risk score or index (climate_risk)

For all monetary values, provide them in the specified reporting currency: {{{currency}}} as plain numbers. 
For rates, provide them as a percentage number (e.g., 3.5 for 3.5%).
For scores, provide them as numerical values.

Ensure the output keys strictly follow the snake_case naming provided in parentheses.`,
});

const suggestFactSheetDataFlow = ai.defineFlow(
  {
    name: 'suggestFactSheetDataFlow',
    inputSchema: SuggestFactSheetDataInputSchema,
    outputSchema: FactSheetDataOutputSchema,
  },
  async (input) => {
    const {output} = await prompt(input);
    if (!output) {
      throw new Error('Failed to generate fact sheet data suggestions.');
    }
    return output;
  }
);
