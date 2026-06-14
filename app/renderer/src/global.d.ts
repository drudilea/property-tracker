import type { RendererApi } from '../../shared/ipc-contract';

declare global {
  interface Window {
    api: RendererApi;
  }
}

/** Allow importing CSS files as side-effects. */
declare module '*.css' {
  const _: Record<string, string>;
  export default _;
}

export {};
