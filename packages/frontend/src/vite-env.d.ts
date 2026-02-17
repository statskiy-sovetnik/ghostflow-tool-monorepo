/// <reference types="vite/client" />

interface Window {
  gtag?: (...args: unknown[]) => void;
}

interface ImportMetaEnv {
  readonly VITE_ALCHEMY_API_KEY: string;
  readonly VITE_MORALIS_API_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
