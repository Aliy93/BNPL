'use server';

/**
 * @fileOverview A flow that refines the vocabulary and imagery of a generated poem.
 *
 * - refinePoemVocabulary - A function that refines the poem's vocabulary and imagery.
 * - RefinePoemVocabularyInput - The input type for the refinePoemVocabulary function.
 * - RefinePoemVocabularyOutput - The return type for the refinePoemVocabulary function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const RefinePoemVocabularyInputSchema = z.object({
  poem: z.string().describe('The poem to refine.'),
});
export type RefinePoemVocabularyInput = z.infer<typeof RefinePoemVocabularyInputSchema>;

const RefinePoemVocabularyOutputSchema = z.object({
  refinedPoem: z.string().describe('The refined poem with enhanced vocabulary and imagery.'),
});
export type RefinePoemVocabularyOutput = z.infer<typeof RefinePoemVocabularyOutputSchema>;

export async function refinePoemVocabulary(input: RefinePoemVocabularyInput): Promise<RefinePoemVocabularyOutput> {
  return refinePoemVocabularyFlow(input);
}

const prompt = ai.definePrompt({
  name: 'refinePoemVocabularyPrompt',
  input: {schema: RefinePoemVocabularyInputSchema},
  output: {schema: RefinePoemVocabularyOutputSchema},
  prompt: `You are a master poet, skilled at enhancing the vocabulary and imagery of poems.

  You will receive a poem as input. Your task is to refine the poem's vocabulary and imagery to make it sound more sophisticated and artistic. Only make changes if the poem would benefit from the change; otherwise, return the original poem.

  Poem:
  {{poem}}
  `,
});

const refinePoemVocabularyFlow = ai.defineFlow(
  {
    name: 'refinePoemVocabularyFlow',
    inputSchema: RefinePoemVocabularyInputSchema,
    outputSchema: RefinePoemVocabularyOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
