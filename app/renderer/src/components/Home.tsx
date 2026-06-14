import type { AppConfig } from '../../../main/config';
import { CaptureCard } from './CaptureCard';
import { FavoritesCard } from './FavoritesCard';
import { VisitCard } from './VisitCard';

interface HomeProps {
  config: AppConfig;
}

export function Home({ config }: HomeProps) {
  return (
    <main className="grid">
      <CaptureCard />
      <FavoritesCard config={config} />
      <VisitCard />
    </main>
  );
}
