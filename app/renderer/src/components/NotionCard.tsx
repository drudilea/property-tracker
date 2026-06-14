import { useState } from 'react';
import type { AppConfig } from '../../../main/config';
import { api } from '../api';
import { useAsyncAction } from '../hooks/useAsyncAction';
import { Card } from './Card';
import { Field } from './Field';
import { Button } from './Button';
import { StatusLine } from './StatusLine';

interface NotionCardProps {
  config: AppConfig;
  onConfigUpdate: (next: AppConfig) => void;
  onRefresh: () => Promise<void>;
}

export function NotionCard({ config, onConfigUpdate, onRefresh }: NotionCardProps) {
  const [token, setToken] = useState(config.notionToken ?? '');
  const [dbId, setDbId] = useState(config.notionDatabaseId ?? '');
  const saveAction = useAsyncAction();
  const connectAction = useAsyncAction();

  const isBusy =
    saveAction.state.status === 'loading' ||
    connectAction.state.status === 'loading';

  return (
    <Card title="Notion">
      <Field
        label="Token de Notion"
        value={token}
        onChange={setToken}
        placeholder="ntn_… o secret_…"
        disabled={isBusy}
      />
      <Field
        label="Database ID de Notion"
        value={dbId}
        onChange={setDbId}
        placeholder="id de la base de datos"
        disabled={isBusy}
      />
      <div className="btn-row">
        <Button
          loading={saveAction.state.status === 'loading'}
          disabled={connectAction.state.status === 'loading'}
          onClick={() =>
            saveAction.run(async function saveNotionConfig() {
              const next: AppConfig = {
                ...config,
                notionToken: token || null,
                notionDatabaseId: dbId || null,
              };
              await api.setConfig(next);
              onConfigUpdate(next);
              await onRefresh();
              return { ok: true, message: '✓ Guardado' };
            })
          }
        >
          Guardar
        </Button>
        <Button
          variant="secondary"
          loading={connectAction.state.status === 'loading'}
          disabled={saveAction.state.status === 'loading'}
          onClick={() =>
            connectAction.run(async function validateNotion() {
              const r = await api.validateNotion();
              return {
                ok: r.ok,
                message: r.ok ? '✓ Notion conectado' : r.error,
              };
            })
          }
        >
          Conectar Notion
        </Button>
      </div>
      <StatusLine state={saveAction.state} />
      <StatusLine state={connectAction.state} />
    </Card>
  );
}
