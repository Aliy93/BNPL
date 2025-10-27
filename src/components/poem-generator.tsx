'use client';

import { useFormState } from 'react-dom';
import Image from 'next/image';
import { generatePoemAction, refinePoemAction, PoemState } from '@/lib/actions';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useEffect, useRef, useState, useTransition } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Camera, Clipboard, Download, Loader2, Sparkles, Image as ImageIcon, Link as LinkIcon } from 'lucide-react';
import { PoemOutput } from '@/components/poem-output';
import { GeneratorSubmitButton } from './generator-submit-button';

const initialState: PoemState = {};

export function PoemGenerator() {
  const { toast } = useToast();
  const [formState, formAction] = useFormState(generatePoemAction, initialState);
  
  const [isRefining, startRefineTransition] = useTransition();
  const [poem, setPoem] = useState<string | undefined>(undefined);
  const [imagePreview, setImagePreview] = useState<string | null>(PlaceHolderImages[0]?.imageUrl || null);
  const [uploadMode, setUploadMode] = useState<'upload' | 'url'>('upload');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const urlInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (formState.poem) {
      setPoem(formState.poem);
    }
  }, [formState]);
  
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
        if (urlInputRef.current) urlInputRef.current.value = '';
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUrlChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const url = event.target.value;
    if (url) {
      setImagePreview(url);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  const handleRefine = async () => {
    const poemToRefine = formState.poem || poem;
    if (!poemToRefine) return;
    startRefineTransition(async () => {
      const result = await refinePoemAction(poemToRefine);
      if (result.poem) {
        setPoem(result.poem);
        toast({ title: 'Poem Refined!', description: 'Your poem has been enhanced.' });
      }
      if (result.error) {
        toast({ variant: 'destructive', title: 'Refinement Failed', description: result.error });
      }
    });
  };

  const handleCopy = () => {
    const poemToCopy = formState.poem || poem;
    if (!poemToCopy) return;
    navigator.clipboard.writeText(poemToCopy);
    toast({ title: 'Copied to Clipboard!' });
  };

  const handleDownload = () => {
    const poemToDownload = formState.poem || poem;
    if (!poemToDownload) return;
    const blob = new Blob([poemToDownload], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'photo-poem.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  const currentPoem = formState.poem || poem;

  return (
    <form action={formAction}>
      <div className="grid gap-8 md:grid-cols-2 p-4 md:p-8">
        <Card className="shadow-lg animate-in fade-in-50 duration-500">
          <CardHeader>
            <CardTitle className="font-headline text-2xl flex items-center gap-2"><Camera /> Your Image</CardTitle>
            <CardDescription>Upload a photo or paste an image URL to begin.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg border-2 border-dashed flex items-center justify-center bg-muted/50">
              {imagePreview ? (
                <Image src={imagePreview} alt="Image preview" fill sizes="(max-width: 768px) 100vw, 50vw" style={{ objectFit: 'contain' }} data-ai-hint="poem inspiration" />
              ) : (
                <div className="text-center text-muted-foreground p-8"><ImageIcon className="mx-auto h-12 w-12" /><p className="mt-2">Your image will appear here</p></div>
              )}
            </div>
            
            <div className="grid grid-cols-2 gap-2">
                <Button type="button" variant={uploadMode === 'upload' ? 'secondary' : 'ghost'} onClick={() => setUploadMode('upload')}><ImageIcon className="mr-2 h-4 w-4" /> Upload</Button>
                <Button type="button" variant={uploadMode === 'url' ? 'secondary' : 'ghost'} onClick={() => setUploadMode('url')}><LinkIcon className="mr-2 h-4 w-4" /> URL</Button>
            </div>

            {uploadMode === 'upload' ? (
              <div className="space-y-1.5"><Label htmlFor="imageFile">Upload Image</Label><Input id="imageFile" name="imageFile" type="file" accept="image/*" onChange={handleFileChange} ref={fileInputRef} /></div>
            ) : (
              <div className="space-y-1.5"><Label htmlFor="imageUrl">Image URL</Label><Input id="imageUrl" name="imageUrl" type="url" placeholder="https://example.com/image.jpg" onChange={handleUrlChange} ref={urlInputRef} /></div>
            )}
            
            <CardDescription>Fine-tune your poem (optional)</CardDescription>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5"><Label htmlFor="style">Style</Label><Select name="style" defaultValue="free-verse"><SelectTrigger id="style"><SelectValue placeholder="Select style" /></SelectTrigger><SelectContent><SelectItem value="free-verse">Free Verse</SelectItem><SelectItem value="haiku">Haiku</SelectItem><SelectItem value="sonnet">Sonnet</SelectItem><SelectItem value="limerick">Limerick</SelectItem></SelectContent></Select></div>
              <div className="space-y-1.5"><Label htmlFor="tone">Tone</Label><Select name="tone" defaultValue="reflective"><SelectTrigger id="tone"><SelectValue placeholder="Select tone" /></SelectTrigger><SelectContent><SelectItem value="reflective">Reflective</SelectItem><SelectItem value="romantic">Romantic</SelectItem><SelectItem value="humorous">Humorous</SelectItem><SelectItem value="melancholic">Melancholic</SelectItem><SelectItem value="joyful">Joyful</SelectItem></SelectContent></Select></div>
              <div className="space-y-1.5"><Label htmlFor="length">Length</Label><Select name="length" defaultValue="medium"><SelectTrigger id="length"><SelectValue placeholder="Select length" /></SelectTrigger><SelectContent><SelectItem value="short">Short</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="long">Long</SelectItem></SelectContent></Select></div>
            </div>
            <GeneratorSubmitButton />
          </CardContent>
        </Card>
        
        <Card className="shadow-lg flex flex-col animate-in fade-in-50 duration-500 delay-100">
          <CardHeader>
            <CardTitle className="font-headline text-2xl flex items-center gap-2"><Sparkles /> Generated Poem</CardTitle>
            <CardDescription>Your AI-generated poem will appear below.</CardDescription>
          </CardHeader>
          <CardContent className="flex-grow">
            <PoemOutput poem={poem} formState={formState} />
          </CardContent>
          {currentPoem && (
            <CardFooter className="flex-col sm:flex-row gap-2">
              <Button onClick={handleRefine} disabled={isRefining} variant="outline" className="w-full sm:w-auto">
                {isRefining ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Refining...</> : <><Sparkles className="mr-2 h-4 w-4" /> Refine</>}
              </Button>
              <div className="flex-grow" />
              <Button onClick={handleCopy} variant="ghost" size="icon"><Clipboard className="h-4 w-4" /><span className="sr-only">Copy</span></Button>
              <Button onClick={handleDownload} variant="ghost" size="icon"><Download className="h-4 w-4" /><span className="sr-only">Download</span></Button>
            </CardFooter>
          )}
        </Card>
      </div>
    </form>
  );
}
