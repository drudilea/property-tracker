import type { AppConfig } from '../../../main/config';
import { NotionCard } from './NotionCard';
import { IdealistaLoginCard } from './IdealistaLoginCard';

interface OnboardingProps {
  config: AppConfig;
  onConfigUpdate: (next: AppConfig) => void;
  onRefresh: () => Promise<void>;
}

export function Onboarding({ config, onConfigUpdate, onRefresh }: OnboardingProps) {
  return (
    <div className="main-content">
      <div style={{ paddingBottom: 4 }}>
        <h1
          style={{
            margin: '0 0 6px',
            fontSize: 22,
            fontWeight: 700,
            color: 'var(--text)',
          }}
        >
          Empecemos
        </h1>
        <p style={{ margin: 0, color: 'var(--muted)', fontSize: 13 }}>
          Configurá Notion para empezar a guardar pisos.
        </p>
      </div>
      <NotionCard config={config} onConfigUpdate={onConfigUpdate} onRefresh={onRefresh} />
      <IdealistaLoginCard />
    </div>
  );
}
