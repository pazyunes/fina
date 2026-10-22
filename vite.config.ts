import { defineConfig, type ViteDevServer } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'


function figmaAssetResolver() {
  return {
    name: 'figma-asset-resolver',
    resolveId(id: string) {
      if (id.startsWith('figma:asset/')) {
        const filename = id.replace('figma:asset/', '')
        return path.resolve(__dirname, 'src/assets', filename)
      }
    },
  }
}

// En `npm run dev` las funciones de api/ no corren solas (Vite las serviría como
// código fuente). Esta sirve SÓLO las dos públicas de inversiones —datos de mercado
// y noticias, sin sesión— para poder probarlas en local con datos reales. En
// producción las atiende Vercel; esto no entra al build.
type ReqDev = { method?: string; url?: string; query?: Record<string, string> };
type ResDev = {
  statusCode: number;
  setHeader(nombre: string, valor: string): void;
  end(cuerpo: string): void;
};
type HandlerPublico = (
  req: ReqDev,
  res: { status(c: number): unknown; json(b: unknown): void; setHeader(n: string, v: string): void },
) => Promise<void>;

function apiPublicasDev() {
  return {
    name: 'api-publicas-dev',
    configureServer(server: ViteDevServer) {
      for (const ruta of ['mercado', 'noticias']) {
        server.middlewares.use(`/api/${ruta}`, async (req: ReqDev, res: ResDev) => {
          try {
            const mod = (await server.ssrLoadModule(`/api/${ruta}.ts`)) as { default: HandlerPublico };
            const shim = {
              status(c: number) { res.statusCode = c; return shim; },
              setHeader(n: string, v: string) { res.setHeader(n, v); },
              json(b: unknown) { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(b)); },
            };
            const query = Object.fromEntries(new URL(req.url ?? '', 'http://localhost').searchParams);
            await mod.default({ method: req.method, query }, shim);
          } catch (e) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: e instanceof Error ? e.message : 'error' }));
          }
        });
      }
    },
  }
}

export default defineConfig({
  plugins: [
    figmaAssetResolver(),
    apiPublicasDev(),
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],
})
