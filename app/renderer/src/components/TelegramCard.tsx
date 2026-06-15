import { useState, useEffect } from 'react';
import type { AppConfig } from '../../../main/config';
import { api } from '../api';
import { useAsyncAction } from '../hooks/useAsyncAction';
import { Card } from './Card';
import { Field } from './Field';
import { Button } from './Button';
import { Help } from './Help';
import { StatusLine } from './StatusLine';

interface TelegramCardProps {
  config: AppConfig;
  onConfigUpdate: (next: AppConfig) => void;
}

export function TelegramCard({ config, onConfigUpdate }: TelegramCardProps) {
  const [tgToken, setTgToken] = useState(config.telegramBotToken ?? '');
  // Initial bot-running state read from the main process on mount.
  const [initialStatus, setInitialStatus] = useState<'activo' | 'apagado' | null>(null);
  const { state, run } = useAsyncAction();

  useEffect(function checkTelegramStatus() {
    api.telegramRunning().then((on) => {
      setInitialStatus(on ? 'activo' : 'apagado');
    }).catch(() => {
      setInitialStatus('apagado');
    });
  }, []);

  const isLoading = state.status === 'loading';

  // Show initial status only when the user hasn't triggered an action yet.
  const showInitialStatus = state.status === 'idle' && initialStatus !== null;

  return (
    <Card title="Telegram (opcional)">
      <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--muted)' }}>
        Pegá el token de @BotFather para capturar pisos desde el móvil. Funciona
        mientras la app esté abierta. El primer mensaje que le mandes te vincula
        como dueño.
      </p>
      <Field
        label="Token del bot"
        value={tgToken}
        onChange={setTgToken}
        placeholder="123456:ABC…"
        disabled={isLoading}
        help={
          <Help href="https://t.me/BotFather">
            Abrí <strong>@BotFather</strong> en Telegram, mandá el comando{' '}
            <code>/newbot</code>, seguí los pasos y copiá el token que te da al
            final.
          </Help>
        }
      />
      <div className="btn-row">
        <Button
          loading={isLoading}
          onClick={() =>
            run(async function applyTelegramConfig() {
              const next: AppConfig = {
                ...config,
                telegramBotToken: tgToken || null,
              };
              await api.setConfig(next);
              onConfigUpdate(next);
              const r = await api.applyTelegram();
              return {
                ok: r.ok,
                message: r.ok ? '✓ Bot activo' : r.error,
              };
            })
          }
        >
          Activar / actualizar
        </Button>
      </div>
      {showInitialStatus ? (
        <p className={`status ${initialStatus === 'activo' ? 'ok' : ''}`}>
          {initialStatus === 'activo' ? '✓ Bot activo' : 'Bot apagado'}
        </p>
      ) : (
        <StatusLine state={state} />
      )}
    </Card>
  );
}
