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
// código fuente). Esta sirve SÓLO /api/mercado —datos públicos, sin sesión— para
// poder probar las inversiones en local con datos reales. En producción lo
// atiende la función de Vercel; esto no entra al build.
type ReqDev = { method?: string };
type ResDev = {
  statusCode: number;
  setHeader(nombre: string, valor: string): void;
  end(cuerpo: string): void;
};
type HandlerMercado = (
  req: ReqDev,
  res: { status(c: number): unknown; json(b: unknown): void; setHeader(n: string, v: string): void },
) => Promise<void>;

function apiMercadoDev() {
  return {
    name: 'api-mercado-dev',
    configureServer(server: ViteDevServer) {
      server.middlewares.use('/api/mercado', async (req: ReqDev, res: ResDev) => {
        try {
          const mod = (await server.ssrLoadModule('/api/mercado.ts')) as { default: HandlerMercado };
          const shim = {
            status(c: number) { res.statusCode = c; return shim; },
            setHeader(n: string, v: string) { res.setHeader(n, v); },
            json(b: unknown) { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(b)); },
          };
          await mod.default(req, shim);
        } catch (e) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: e instanceof Error ? e.message : 'error' }));
        }
      });
    },
  }
}

export default defineConfig({
  plugins: [
    figmaAssetResolver(),
    apiMercadoDev(),
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
