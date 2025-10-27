'use client';
import { useFormStatus } from 'react-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { PoemState } from '@/lib/actions';
import { useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

type PoemOutputProps = {
  poem?: string;
  formState: PoemState;
};

export function PoemOutput({ poem, formState }: PoemOutputProps) {
  const { pending } = useFormStatus();
  const { toast } = useToast();

  useEffect(() => {
    if (formState.error) {
      toast({
        variant: 'destructive',
        title: 'An error occurred',
        description: formState.error,
      });
    }
  }, [formState, toast]);

  const poemToDisplay = formState.poem || poem;

  if (pending) {
    return (
      <div className="space-y-4 animate-pulse">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-[80%]" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-[70%]" />
        <Skeleton className="h-4 w-[90%]" />
      </div>
    );
  }

  if (poemToDisplay) {
    return (
      <p className="whitespace-pre-wrap text-lg leading-relaxed font-body animate-in fade-in-25 duration-500">
        {poemToDisplay}
      </p>
    );
  }

  return (
    <div className="h-full flex items-center justify-center text-muted-foreground">
      <p>Your poem awaits...</p>
    </div>
  );
}
