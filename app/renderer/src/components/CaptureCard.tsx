import { useState } from 'react';
import type { Apartment } from '../../../shared/apartment';
import { api } from '../api';
import { useAsyncAction } from '../hooks/useAsyncAction';
import { Card } from './Card';
import { Field } from './Field';
import { Button } from './Button';
import { StatusLine } from './StatusLine';

interface ScrapeResultData {
  apartment: Apartment;
  notionUrl: string;
  label: string;
}

export function CaptureCard() {
  const [url, setUrl] = useState('');
  const [result, setResult] = useState<ScrapeResultData | null>(null);
  const { state, run } = useAsyncAction();

  async function handleScrape() {
    const trimmed = url.trim();
    if (!trimmed) return;
    setResult(null);

    await run(async function scrapeAndSave() {
      const scrapeRes = await api.scrape(trimmed);
      if (!scrapeRes.ok) {
        return { ok: false, message: scrapeRes.error };
      }

      const apt = scrapeRes.apartment;
      const saveRes = await api.saveToNotion(apt);

      if (!saveRes.ok) {
        // Scrape succeeded but save failed — surface the apartment info anyway
        return {
          ok: false,
          message: `Scrapeado, pero no se guardó en Notion: ${saveRes.error}`,
        };
      }

      const label =
        saveRes.status === 'duplicate'
          ? `✓ Ya existía en Notion: ${saveRes.url}`
          : `✓ Guardado en Notion: ${saveRes.url}`;

      setResult({ apartment: apt, notionUrl: saveRes.url, label });
      return { ok: true, message: label };
    });
  }

  const isLoading = state.status === 'loading';

  return (
    <Card title="Capturar piso">
      <Field
        label="Link de Idealista"
        value={url}
        onChange={setUrl}
        placeholder="https://www.idealista.com/inmueble/…/"
        disabled={isLoading}
      />
      <div className="btn-row">
        <Button loading={isLoading} onClick={handleScrape} disabled={!url.trim()}>
          Scrapear
        </Button>
      </div>
      {/* Override the default loading message with the specific scrape hint */}
      {state.status === 'loading' ? (
        <p className="status loading">
          <span className="spinner" aria-hidden="true" />
          Scrapeando… (~15s, se abre Chrome)
        </p>
      ) : (
        <StatusLine state={state} />
      )}
      {result && (
        <div className="result-card">
          <h3>{result.apartment.title || 'Sin título'}</h3>
          <p className="result-meta">
            {result.apartment.price != null ? `${result.apartment.price.toLocaleString('es-ES')} €` : '—'}
            {result.apartment.photoUrls.length > 0
              ? ` · ${result.apartment.photoUrls.length} fotos`
              : ''}
          </p>
          <a
            href={result.notionUrl}
            onClick={(e) => {
              e.preventDefault();
              void api.openExternal(result.notionUrl);
            }}
          >
            Ver en Notion →
          </a>
        </div>
      )}
    </Card>
  );
}
