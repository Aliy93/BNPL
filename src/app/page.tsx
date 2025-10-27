import { SiteHeader } from '@/components/site-header';
import { PoemGenerator } from '@/components/poem-generator';

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <PoemGenerator />
      </main>
      <footer className="py-6 md:px-8 md:py-0">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 md:h-24 md:flex-row">
          <p className="text-center text-sm leading-loose text-muted-foreground md:text-left">
            Built with{" "}
            <a
              href="https://firebase.google.com/docs/genkit"
              target="_blank"
              rel="noreferrer"
              className="font-medium underline underline-offset-4"
            >
              Genkit
            </a>
            {" "}and{" "}
            <a
              href="https://nextjs.org"
              target="_blank"
              rel="noreferrer"
              className="font-medium underline underline-offset-4"
            >
              Next.js
            </a>
            .
          </p>
        </div>
      </footer>
    </div>
  );
}
