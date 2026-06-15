import { useState } from 'react';
import type { UpdateInfo } from '../../../shared/ipc-contract';
import { api } from '../api';

interface UpdateBannerProps {
  update: UpdateInfo | null;
}

export function UpdateBanner({ update }: UpdateBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (!update?.updateAvailable || dismissed) return null;

  function handleDownload() {
    if (update?.url) void api.openExternal(update.url);
  }

  function handleDismiss() {
    setDismissed(true);
  }

  return (
    <div className="update-banner" role="status">
      <span className="update-banner-text">
        Hay una nueva versión ({update.latestVersion}) disponible.
      </span>
      <div className="update-banner-actions">
        <button className="btn-secondary update-banner-btn" onClick={handleDownload}>
          Descargar
        </button>
        <button
          className="update-banner-close"
          onClick={handleDismiss}
          aria-label="Cerrar aviso de actualización"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
