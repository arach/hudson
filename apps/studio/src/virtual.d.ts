/// <reference types="vite/client" />

declare module "virtual:eng-mtimes" {
  /** Map of repo-relative .md path → mtimeMs. Produced by the
   *  engMtimesPlugin in vite.config.ts. */
  const mtimes: Record<string, number>;
  export default mtimes;
}
