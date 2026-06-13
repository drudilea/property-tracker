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
}

render();
