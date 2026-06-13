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

  const loginStatus = document.querySelector<HTMLParagraphElement>('#login-status')!;
  document.querySelector('#login-idealista')!.addEventListener('click', async () => {
    loginStatus.textContent = 'Abriendo Chrome…';
    const r = await window.api.loginIdealista();
    loginStatus.textContent = r.ok
      ? '✓ Chrome abierto. Iniciá sesión en Idealista ahí (no hace falta cerrarlo) y después tocá Sincronizar.'
      : `✗ ${r.error}`;
  });

  const favStatus = document.querySelector<HTMLParagraphElement>('#fav-status')!;
  document.querySelector('#sync-fav')!.addEventListener('click', async () => {
    favStatus.textContent = 'Sincronizando favoritos… (se abre Chrome)';
    const r = await window.api.syncFavorites();
    favStatus.textContent = r.ok
      ? `✓ ${r.found} favoritos · ${r.created} nuevos · ${r.duplicates} ya estaban · ${r.failed} con error`
      : `✗ ${r.error}`;
  });

  const visitId = document.querySelector<HTMLInputElement>('#visit-id')!;
  const visitWhen = document.querySelector<HTMLInputElement>('#visit-when')!;
  const visitStatus = document.querySelector<HTMLParagraphElement>('#visit-status')!;
  document.querySelector('#create-visit')!.addEventListener('click', async () => {
    const id = visitId.value.trim();
    const when = visitWhen.value;
    if (!id || !when) {
      visitStatus.textContent = 'Completá el ID y la fecha/hora.';
      return;
    }
    visitStatus.textContent = 'Creando visita…';
    const r = await window.api.createVisit(id, when);
    if (!r.ok) {
      visitStatus.textContent = `✗ ${r.error}`;
      return;
    }
    visitStatus.textContent = `✓ ${r.title} (visita_programada) · `;
    const link = document.createElement('a');
    link.textContent = 'Abrir en Google Calendar';
    link.href = r.url;
    link.addEventListener('click', (e) => {
      e.preventDefault();
      window.api.openExternal(r.url);
    });
    visitStatus.appendChild(link);
  });
}

render();
