import type { Tabla } from './tipos';

// Un CSV a una tabla. El separador (coma, punto y coma o tab) se elige mirando
// las primeras líneas: los Excel en español guardan con punto y coma.

function elegirSeparador(texto: string): string {
  const muestra = texto.split(/\r?\n/).slice(0, 5).join('\n');
  const cuenta = (c: string) => muestra.split(c).length - 1;
  const candidatos = [';', '\t', ','];
  return candidatos.reduce((mejor, c) => (cuenta(c) > cuenta(mejor) ? c : mejor), ',');
}

export function leerCsv(texto: string): Tabla {
  const limpio = texto.replace(/^﻿/, '');
  const sep = elegirSeparador(limpio);
  const filas: Tabla = [];
  let fila: string[] = [];
  let celda = '';
  let entreComillas = false;

  const cerrarCelda = () => { fila.push(celda); celda = ''; };
  const cerrarFila = () => {
    cerrarCelda();
    if (fila.some((c) => c.trim() !== '')) filas.push(fila.map((c) => c.trim()));
    fila = [];
  };

  for (let i = 0; i < limpio.length; i++) {
    const c = limpio[i];
    if (entreComillas) {
      if (c === '"' && limpio[i + 1] === '"') { celda += '"'; i++; }
      else if (c === '"') entreComillas = false;
      else celda += c;
    } else if (c === '"') entreComillas = true;
    else if (c === sep) cerrarCelda();
    else if (c === '\n') cerrarFila();
    else if (c !== '\r') celda += c;
  }
  if (celda !== '' || fila.length > 0) cerrarFila();
  return filas;
}
