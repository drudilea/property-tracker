// Ambient (script) declarations for asset imports handled by Vite.
// Kept import/export-free so the wildcard module declarations apply globally.
declare module '*.png' {
  const src: string;
  export default src;
}
