/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Ingest endpoint for prompt collection. Unset ⇒ collection disabled. */
  readonly VITE_COLLECTOR_ENDPOINT?: string;
  /** 'all' | 'failures' | 'off' — defaults to 'failures'. */
  readonly VITE_COLLECTOR_POLICY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
