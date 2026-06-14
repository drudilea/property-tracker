import { useState } from 'react';
import { api } from '../api';
import { Card } from './Card';
import { Button } from './Button';

export function IdealistaLoginCard() {
  const [msg, setMsg] = useState<{ text: string; kind: 'ok' | 'err' } | null>(
    null,
  );

  // Opening Chrome is an instruction, not a result we wait on: show the hint
  // immediately on click and only replace it if loginIdealista actually fails.
  function openLogin() {
    setMsg({
      text: 'Abriendo Chrome… iniciá sesión en Idealista en esa ventana (no hace falta cerrarla).',
      kind: 'ok',
    });
    api
      .loginIdealista()
      .then((r) => {
        if (!r.ok) setMsg({ text: r.error ?? 'No se pudo abrir Chrome.', kind: 'err' });
      })
      .catch((e: unknown) => {
        setMsg({ text: e instanceof Error ? e.message : String(e), kind: 'err' });
      });
  }

  return (
    <Card title="Sesión de Idealista">
      <div className="btn-row">
        <Button variant="secondary" onClick={openLogin}>
          Iniciar sesión en Idealista
        </Button>
      </div>
      {msg && <p className={`status ${msg.kind}`}>{msg.text}</p>}
    </Card>
  );
}
