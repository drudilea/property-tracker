import { useState } from 'react';
import { api } from '../api';
import { useAsyncAction } from '../hooks/useAsyncAction';
import { Card } from './Card';
import { Field } from './Field';
import { Button } from './Button';
import { StatusLine } from './StatusLine';

interface VisitResult {
  url: string;
  title: string;
}

export function VisitCard() {
  const [id, setId] = useState('');
  const [when, setWhen] = useState('');
  const [visitResult, setVisitResult] = useState<VisitResult | null>(null);
  const { state, run } = useAsyncAction();

  const isLoading = state.status === 'loading';

  async function handleCreateVisit() {
    if (!id.trim() || !when) return;
    setVisitResult(null);

    await run(async function createVisit() {
      const trimmedId = id.trim();
      if (!trimmedId || !when) {
        return { ok: false, message: 'Completá el ID y la fecha/hora.' };
      }

      const r = await api.createVisit(trimmedId, when);
      if (!r.ok) {
        return { ok: false, message: r.error };
      }

      setVisitResult({ url: r.url, title: r.title });
      return { ok: true, message: `✓ ${r.title} (visita_programada)` };
    });
  }

  return (
    <Card title="Programar visita">
      <Field
        label="Idealista ID del piso"
        value={id}
        onChange={setId}
        placeholder="ej. 30188343"
        disabled={isLoading}
      />
      <Field
        label="Fecha y hora"
        value={when}
        onChange={setWhen}
        type="datetime-local"
        disabled={isLoading}
      />
      <div className="btn-row">
        <Button
          loading={isLoading}
          onClick={handleCreateVisit}
          disabled={!id.trim() || !when}
        >
          Crear visita
        </Button>
      </div>
      {/* When we have a calendar link, render the ok state inline with it */}
      {visitResult && state.status === 'ok' ? (
        <p className="status ok">
          {state.message}{' '}
          ·{' '}
          <a
            href={visitResult.url}
            onClick={(e) => {
              e.preventDefault();
              void api.openExternal(visitResult.url);
            }}
          >
            Abrir en Google Calendar
          </a>
        </p>
      ) : (
        <StatusLine state={state} />
      )}
    </Card>
  );
}
