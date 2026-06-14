import type { RendererApi } from '../../shared/ipc-contract';

declare global {
  interface Window {
    api: RendererApi;
  }
}

/** The preload bridge. Typed via the IPC registry's RendererApi. */
export const api: RendererApi = window.api;
