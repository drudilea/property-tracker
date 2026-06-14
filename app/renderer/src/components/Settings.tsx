import type { AppConfig } from '../../../main/config';
import { NotionCard } from './NotionCard';
import { IdealistaLoginCard } from './IdealistaLoginCard';
import { TelegramCard } from './TelegramCard';

interface SettingsProps {
  config: AppConfig;
  onConfigUpdate: (next: AppConfig) => void;
  onRefresh: () => Promise<void>;
}

export function Settings({ config, onConfigUpdate, onRefresh }: SettingsProps) {
  return (
    <div className="main-content">
      <NotionCard config={config} onConfigUpdate={onConfigUpdate} onRefresh={onRefresh} />
      <IdealistaLoginCard />
      <TelegramCard config={config} onConfigUpdate={onConfigUpdate} />
    </div>
  );
}
