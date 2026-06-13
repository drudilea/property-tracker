async function render(): Promise<void> {
  const status = await window.api.getStatus();
  document.querySelector('#version')!.textContent = status.appVersion;
  document.querySelector('#configured')!.textContent = status.configured ? 'sí' : 'no';

  const config = await window.api.getConfig();
  const tokenInput = document.querySelector<HTMLInputElement>('#token')!;
  const dbInput = document.querySelector<HTMLInputElement>('#db')!;
  tokenInput.value = config.notionToken ?? '';
  dbInput.value = config.notionDatabaseId ?? '';

  document.querySelector('#save')!.addEventListener('click', async () => {
    await window.api.setConfig({
      ...config,
      notionToken: tokenInput.value || null,
      notionDatabaseId: dbInput.value || null,
    });
    const saved = document.querySelector<HTMLParagraphElement>('#saved')!;
    saved.hidden = false;
  });

  const notionStatus = document.querySelector<HTMLParagraphElement>('#notion-status')!;
  document.querySelector('#connect')!.addEventListener('click', async () => {
    notionStatus.textContent = 'Validando token…';
    const result = await window.api.validateNotion();
    notionStatus.textContent = result.ok ? '✓ Notion conectado' : `✗ ${result.error}`;
  });

  const urlInput = document.querySelector<HTMLInputElement>('#url')!;
  const scrapeStatus = document.querySelector<HTMLParagraphElement>('#scrape-status')!;
  const scrapeResult = document.querySelector<HTMLPreElement>('#scrape-result')!;

  document.querySelector('#scrape')!.addEventListener('click', async () => {
    const url = urlInput.value.trim();
    if (!url) return;
    scrapeStatus.textContent = 'Scrapeando… (~15s, se abre Chrome)';
    scrapeResult.textContent = '';
    const result = await window.api.scrape(url);
    if (!result.ok) {
      scrapeStatus.textContent = `✗ ${result.error}`;
      return;
    }
    scrapeResult.textContent = JSON.stringify(result.apartment, null, 2);
    scrapeStatus.textContent = `✓ ${result.apartment.title || 'Sin título'} — guardando en Notion…`;
    const saveResult = await window.api.saveToNotion(result.apartment);
    if (saveResult.ok) {
      scrapeStatus.textContent =
        saveResult.status === 'duplicate'
          ? `✓ Ya existía en Notion: ${saveResult.url}`
          : `✓ Guardado en Notion: ${saveResult.url}`;
    } else {
      scrapeStatus.textContent = `Scrapeado, pero no se guardó en Notion: ${saveResult.error}`;
    }
  });
}

render();
