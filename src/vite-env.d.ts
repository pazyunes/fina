/// <reference types="vite/client" />
// Sin esto, `import.meta.env` no existe para TypeScript y supabase.ts no
// compila. Es el archivo estándar de Vite; faltaba porque el proyecto nunca
// había pasado por un typecheck.
