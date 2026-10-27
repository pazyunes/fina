// Corre los tests de inversiones sin agregar dependencias: arma cada archivo con
// esbuild (que ya viene con Vite) y lo ejecuta con el corredor que trae Node.
//
//   node scripts/test-inversiones.mjs            → cálculos y reglas (sin red), de todas las carpetas de tests/
//   node scripts/test-inversiones.mjs en-vivo    → compara las fuentes reales entre sí
//   node scripts/test-inversiones.mjs backtest   → mira cómo le habría ido a la regla en el pasado

import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const modo = process.argv[2] ?? 'unitarios';
const raiz = resolve(import.meta.dirname, '..');
const base = join(raiz, 'tests');
const patron = modo === 'en-vivo' ? /\.vivo\.test\.ts$/ : modo === 'backtest' ? /\.backtest\.ts$/ : /^(?!.*\.vivo\.)[^.]+\.test\.ts$/;
const archivos = readdirSync(base, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .flatMap((d) => readdirSync(join(base, d.name)).filter((f) => patron.test(f)).map((f) => join(d.name, f)));
if (archivos.length === 0) { console.error('No hay tests para', modo); process.exit(1); }

const salida = mkdtempSync(join(tmpdir(), 'fina-tests-'));
const construidos = [];
for (const f of archivos) {
  const out = join(salida, f.replace(/[\\/]/g, '__').replace(/\.ts$/, '.mjs'));
  await build({
    entryPoints: [join(base, f)],
    outfile: out,
    bundle: true,
    platform: 'node',
    format: 'esm',
    logLevel: 'error',
    banner: { js: "import{createRequire}from'module';const require=createRequire(import.meta.url);" },
  });
  construidos.push(out);
}

const r = spawnSync(process.execPath, modo === 'backtest' ? [construidos[0]] : ['--test', '--test-reporter=spec', ...construidos], { stdio: 'inherit', cwd: raiz });
process.exit(r.status ?? 1);
