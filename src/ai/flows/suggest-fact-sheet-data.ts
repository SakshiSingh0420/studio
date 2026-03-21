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
});
export type SuggestFactSheetDataInput = z.infer<typeof SuggestFactSheetDataInputSchema>;

const FactSheetDataOutputSchema = z.object({
  gdp: z.number().nullable().describe('Gross Domestic Product in current US dollars (e.g., 2,700,000,000,000 for 2.7 trillion).'),
  gdpGrowth: z.number().nullable().describe('Annual GDP growth rate as a percentage (e.g., 3.5 for 3.5%).'),
  inflation: z.number().nullable().describe('Annual inflation rate as a percentage (e.g., 2.1 for 2.1%).'),
  debt: z.number().nullable().describe('Government debt in current US dollars.'),
  revenue: z.number().nullable().describe('Government revenue in current US dollars.'),
  interest: z.number().nullable().describe('Government interest payments on debt in current US dollars.'),
  fxReserves: z.number().nullable().describe('Foreign exchange reserves in current US dollars.'),
  imports: z.number().nullable().describe('Total imports of goods and services in current US dollars.'),
  exports: z.number().nullable().describe('Total exports of goods and services in current US dollars.'),
  externalDebt: z.number().nullable().describe('Total external debt in current US dollars.'),
  debtService: z.number().nullable().describe('External debt service in current US dollars.'),
  governanceScore: z.number().nullable().describe('A composite governance score or index, typically a numerical value.'),
  politicalStability: z.number().nullable().describe('A political stability indicator or score, typically a numerical value.'),
  climateRisk: z.number().nullable().describe('A climate risk score or index, typically a numerical value.'),
}).describe('Suggested economic, fiscal, and external data points for the fact sheet. Values should be numerical. If a value is unavailable, use null.');
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
- Annual GDP growth rate
- Annual inflation rate
- Government debt
- Government revenue
- Government interest payments on debt
- Foreign exchange reserves
- Total imports of goods and services
- Total exports of goods and services
- Total external debt
- External debt service
- A composite governance score or index
- A political stability indicator or score
- A climate risk score or index

For all monetary values (GDP, debt, revenue, interest, fxReserves, imports, exports, externalDebt, debtService), provide them in current US dollars, converted to a plain number representing the full value (e.g., 2,700,000,000,000 for 2.7 trillion). For GDP, use the most standard and recent reported value.
For rates (gdpGrowth, inflation), provide them as a percentage number (e.g., 3.5 for 3.5%).
For scores (governanceScore, politicalStability, climateRisk), provide them as numerical values.

If a specific data point is not readily available or cannot be found, output 'null' for that field.
Ensure the output strictly adheres to the JSON schema provided.`,
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
