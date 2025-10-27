'use server';

import { generatePoemFromImage } from '@/ai/flows/generate-poem-from-image';
import { refinePoemVocabulary } from '@/ai/flows/refine-poem-vocabulary';
import { z } from 'zod';

const FormSchema = z.object({
  imageUrl: z.string().url('Please enter a valid image URL.').optional().or(z.literal('')),
  imageFile: z.instanceof(File).optional(),
  style: z.string().optional(),
  tone: z.string().optional(),
  length: z.string().optional(),
})
.refine(data => data.imageUrl || (data.imageFile && data.imageFile.size > 0), {
  message: "Please upload an image or provide an image URL.",
  path: ["imageFile"],
});


export type PoemState = {
  poem?: string;
  error?: string;
};

async function imageToDataUri(image: File | string): Promise<string> {
  if (typeof image === 'string') {
    // Handle URL
    const response = await fetch(image);
    if (!response.ok) {
      throw new Error('Failed to fetch image from URL. Please check the URL and try again.');
    }
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    if (!contentType.startsWith('image/')) {
        throw new Error('The provided URL does not point to a valid image.');
    }
    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    return `data:${contentType};base64,${base64}`;
  } else {
    // Handle File
    const buffer = await image.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    return `data:${image.type};base64,${base64}`;
  }
}

export async function generatePoemAction(
  _prevState: PoemState,
  formData: FormData
): Promise<PoemState> {
  const validatedFields = FormSchema.safeParse({
    imageUrl: formData.get('imageUrl'),
    imageFile: formData.get('imageFile'),
    style: formData.get('style'),
    tone: formData.get('tone'),
    length: formData.get('length'),
  });

  if (!validatedFields.success) {
    const firstError = Object.values(validatedFields.error.flatten().fieldErrors)[0]?.[0];
    return {
      error: firstError || 'Invalid input.',
    };
  }

  const { imageUrl, imageFile, style, tone, length } = validatedFields.data;

  try {
    const imageSource = imageFile && imageFile.size > 0 ? imageFile : imageUrl!;
    const photoDataUri = await imageToDataUri(imageSource);

    const result = await generatePoemFromImage({
      photoDataUri,
      style,
      tone,
      length,
    });

    return { poem: result.poem };
  } catch (e) {
    console.error(e);
    const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
    return { error: `Generation failed: ${errorMessage}` };
  }
}

export async function refinePoemAction(poem: string): Promise<PoemState> {
  if (!poem) {
    return { error: 'Cannot refine an empty poem.' };
  }
  try {
    const result = await refinePoemVocabulary({ poem });
    return { poem: result.refinedPoem };
  } catch (e) {
    console.error(e);
    const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
    return { error: `Refinement failed: ${errorMessage}` };
  }
}
