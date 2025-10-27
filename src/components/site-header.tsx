import { BookMarked } from 'lucide-react';

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 w-full border-b bg-card/80 backdrop-blur-sm">
      <div className="mx-auto flex h-20 max-w-7xl items-center px-4 sm:px-6 lg:px-8">
        <div className="flex gap-3 items-center">
          <BookMarked className="h-8 w-8 text-primary" />
          <h1 className="text-4xl font-headline font-bold tracking-tight text-foreground">
            Photo Poet
          </h1>
        </div>
      </div>
    </header>
  );
}
