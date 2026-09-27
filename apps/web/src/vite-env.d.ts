/// <reference types="vite/client" />

declare module '*.md?raw' {
  const content: string;
  export default content;
}

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_APP_NAME: string;
  readonly VITE_APP_ENV: 'development' | 'test' | 'production';
  readonly VITE_CARTO_API_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
