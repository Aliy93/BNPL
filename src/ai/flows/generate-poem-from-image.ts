'use server';

/**
 * @fileOverview Generates a poem based on the content of an image.
 *
 * - generatePoemFromImage - A function that handles the poem generation process.
 * - GeneratePoemFromImageInput - The input type for the generatePoemFromImage function.
 * - GeneratePoemFromImageOutput - The return type for the generatePoemFromImage function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GeneratePoemFromImageInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      'A photo to generate a poem from, as a data URI that must include a MIME type and use Base64 encoding. Expected format: \'data:<mimetype>;base64,<encoded_data>\'.' /* add validation */
    ),
  style: z.string().optional().describe('The style of the poem (e.g., sonnet, haiku, free verse).'),
  tone: z.string().optional().describe('The tone of the poem (e.g., romantic, melancholic, humorous).'),
  length: z.string().optional().describe('The length of the poem (e.g., short, medium, long).'),
});
export type GeneratePoemFromImageInput = z.infer<typeof GeneratePoemFromImageInputSchema>;

const GeneratePoemFromImageOutputSchema = z.object({
  poem: z.string().describe('The generated poem.'),
});
export type GeneratePoemFromImageOutput = z.infer<typeof GeneratePoemFromImageOutputSchema>;

export async function generatePoemFromImage(input: GeneratePoemFromImageInput): Promise<GeneratePoemFromImageOutput> {
  return generatePoemFromImageFlow(input);
}

const poemPrompt = ai.definePrompt({
  name: 'poemPrompt',
  input: {schema: GeneratePoemFromImageInputSchema},
  output: {schema: GeneratePoemFromImageOutputSchema},
  prompt: `You are a skilled poet. Generate a poem inspired by the image.

    Image: {{media url=photoDataUri}}

    {% if style %}Style: {{style}}{% endif %}
    {% if tone %}Tone: {{tone}}{% endif %}
    {% if length %}Length: {{length}}{% endif %}

    Poem:`, /* add Handlebars syntax */
});

const generatePoemFromImageFlow = ai.defineFlow(
  {
    name: 'generatePoemFromImageFlow',
    inputSchema: GeneratePoemFromImageInputSchema,
    outputSchema: GeneratePoemFromImageOutputSchema,
  },
  async input => {
    const {output} = await poemPrompt(input);
    return output!;
  }
);
