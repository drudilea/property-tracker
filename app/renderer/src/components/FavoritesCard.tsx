import type { AppConfig } from '../../../main/config';
import { api } from '../api';
import { useAsyncAction } from '../hooks/useAsyncAction';
import { Card } from './Card';
import { Button } from './Button';
import { StatusLine } from './StatusLine';

interface FavoritesCardProps {
  config: AppConfig;
}

/** Detected login/session error messages from the scraper. */
function isLoginError(msg: string): boolean {
  const lower = msg.toLowerCase();
  return (
    lower.includes('login') ||
    lower.includes('sesión') ||
    lower.includes('session') ||
    lower.includes('autenti') ||
    lower.includes('acceso') ||
    lower.includes('iniciar')
  );
}

export function FavoritesCard({ config: _config }: FavoritesCardProps) {
  const loginAction = useAsyncAction();
  const syncAction = useAsyncAction();

  const isLoginLoading = loginAction.state.status === 'loading';
  const isSyncLoading = syncAction.state.status === 'loading';

  const showLoginHint =
    syncAction.state.status === 'error' &&
    syncAction.state.message != null &&
    isLoginError(syncAction.state.message);

  return (
    <Card title="Idealista &amp; favoritos">
      <div className="btn-row">
        <Button
          variant="secondary"
          loading={isLoginLoading}
          disabled={isSyncLoading}
          onClick={() =>
            loginAction.run(async function loginIdealista() {
              const r = await api.loginIdealista();
              return {
                ok: r.ok,
                message: r.ok
                  ? '✓ Chrome abierto. Iniciá sesión en Idealista ahí (no hace falta cerrarlo) y después tocá Sincronizar.'
                  : r.error,
              };
            })
          }
        >
          Iniciar sesión en Idealista
        </Button>
      </div>
      <StatusLine state={loginAction.state} />

      <div className="btn-row" style={{ marginTop: 12 }}>
        <Button
          loading={isSyncLoading}
          disabled={isLoginLoading}
          onClick={() =>
            syncAction.run(async function syncFavorites() {
              const r = await api.syncFavorites();
              if (!r.ok) {
                return { ok: false, message: r.error ?? 'Error al sincronizar' };
              }
              return {
                ok: true,
                message: `✓ ${r.found} favoritos · ${r.created} nuevos · ${r.duplicates} ya estaban · ${r.failed} con error`,
              };
            })
          }
        >
          Sincronizar favoritos
        </Button>
      </div>
      <StatusLine state={syncAction.state} />
      {showLoginHint && (
        <p className="status" style={{ color: 'var(--muted)', marginTop: 6 }}>
          Tip: usá "Iniciar sesión en Idealista" primero y luego volvé a sincronizar.
        </p>
      )}
    </Card>
  );
}
