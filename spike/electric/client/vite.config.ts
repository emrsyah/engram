import { defineConfig } from "vite";

// PGlite ships its Postgres WASM + FS data bundle as assets. Vite's dep
// pre-bundler rewrites those URLs and breaks the loader ("Invalid FS bundle
// size"), so exclude PGlite from optimizeDeps and let it load its own assets.
export default defineConfig({
  optimizeDeps: {
    exclude: ["@electric-sql/pglite"],
  },
});
