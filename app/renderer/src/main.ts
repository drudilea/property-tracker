async function render(): Promise<void> {
  const status = await window.api.getStatus();
  document.querySelector('#version')!.textContent = status.appVersion;
  document.querySelector('#configured')!.textContent = status.configured ? 'sí' : 'no';

  const config = await window.api.getConfig();
  const tokenInput = document.querySelector<HTMLInputElement>('#token')!;
  tokenInput.value = config.notionToken ?? '';

  document.querySelector('#save')!.addEventListener('click', async () => {
    await window.api.setConfig({ ...config, notionToken: tokenInput.value || null });
    const saved = document.querySelector<HTMLParagraphElement>('#saved')!;
    saved.hidden = false;
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
    if (result.ok) {
      scrapeStatus.textContent = `✓ ${result.apartment.title || 'Sin título'}`;
      scrapeResult.textContent = JSON.stringify(result.apartment, null, 2);
    } else {
      scrapeStatus.textContent = `✗ ${result.error}`;
    }
  });
}

render();
