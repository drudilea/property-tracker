import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAsyncAction } from '../hooks/useAsyncAction';
import { Card } from './Card';
import { Field } from './Field';
import { Button } from './Button';
import { StatusLine } from './StatusLine';
import type { ApartmentRef } from '../../../shared/ipc-contract';

interface VisitResult {
  url: string;
  title: string;
}

type ApartmentListState =
  | { status: 'loading' }
  | { status: 'ok'; apartments: ApartmentRef[] }
  | { status: 'error'; error: string };

export function VisitCard() {
  const [apartmentList, setApartmentList] = useState<ApartmentListState>({
    status: 'loading',
  });
  const [manualMode, setManualMode] = useState(false);
  const [id, setId] = useState('');
  const [when, setWhen] = useState('');
  const [visitResult, setVisitResult] = useState<VisitResult | null>(null);
  const { state, run } = useAsyncAction();

  const isLoading = state.status === 'loading';

  useEffect(function loadApartments() {
    void api.listApartments().then((result) => {
      if (!result.ok) {
        setApartmentList({ status: 'error', error: result.error });
        setManualMode(true);
        return;
      }
      if (result.apartments.length === 0) {
        setApartmentList({ status: 'ok', apartments: [] });
        setManualMode(true);
        return;
      }
      setApartmentList({ status: 'ok', apartments: result.apartments });
    });
  }, []);

  const usePickerMode =
    !manualMode &&
    apartmentList.status === 'ok' &&
    apartmentList.apartments.length > 0;

  async function handleCreateVisit() {
    if (!id.trim() || !when) return;
    setVisitResult(null);

    await run(async function createVisit() {
      if (!id.trim() || !when) {
        return { ok: false, message: 'Elegí un piso y la fecha/hora.' };
      }

      const r = await api.createVisit(id.trim(), when);
      if (!r.ok) {
        return { ok: false, message: r.error };
      }

      setVisitResult({ url: r.url, title: r.title });
      return { ok: true, message: `✓ ${r.title} (visita_programada)` };
    });
  }

  function renderApartmentPicker() {
    if (apartmentList.status === 'loading') {
      return (
        <p className="status loading">
          <span className="spinner" />
          Cargando pisos…
        </p>
      );
    }

    if (apartmentList.status === 'error') {
      return (
        <p className="status err" style={{ marginBottom: 14 }}>
          No se pudo cargar la lista: {apartmentList.error}
        </p>
      );
    }

    return (
      <div className="field">
        <label>
          Piso
          <select
            value={id}
            onChange={(e) => setId(e.target.value)}
            disabled={isLoading}
          >
            <option value="">Elegí un piso…</option>
            {apartmentList.apartments.map((apt) => (
              <option key={apt.idealistaId} value={apt.idealistaId}>
                {apt.title}
              </option>
            ))}
          </select>
        </label>
      </div>
    );
  }

  return (
    <Card title="Programar visita">
      {usePickerMode ? (
        renderApartmentPicker()
      ) : (
        <>
          {apartmentList.status === 'loading' && (
            <p className="status loading" style={{ marginBottom: 14 }}>
              <span className="spinner" />
              Cargando pisos…
            </p>
          )}
          {apartmentList.status === 'error' && !manualMode && (
            <p className="status err" style={{ marginBottom: 14 }}>
              No se pudo cargar la lista: {apartmentList.error}
            </p>
          )}
          <Field
            label="Idealista ID del piso"
            value={id}
            onChange={setId}
            placeholder="ej. 30188343"
            disabled={isLoading}
          />
        </>
      )}

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
        {usePickerMode && (
          <Button
            onClick={() => {
              setManualMode(true);
              setId('');
            }}
            disabled={isLoading}
          >
            ✏️ Ingresar ID manualmente
          </Button>
        )}
        {manualMode && apartmentList.status === 'ok' && apartmentList.apartments.length > 0 && (
          <Button
            onClick={() => {
              setManualMode(false);
              setId('');
            }}
            disabled={isLoading}
          >
            ← Elegir de la lista
          </Button>
        )}
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
