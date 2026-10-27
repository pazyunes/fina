import assert from 'node:assert/strict';
import { deflateRawSync } from 'node:zlib';
import { describe, it } from 'node:test';
import { leerCsv } from '../../src/app/lib/importacion/csv';
import { fechaDeSerialExcel, parsearFecha } from '../../src/app/lib/importacion/fechas';
import { leerArchivo, leerNotas, partirEnTramos } from '../../src/app/lib/importacion/leer';
import { parsearMonto, parsearNumero } from '../../src/app/lib/importacion/montos';
import { gastosDeNotas } from '../../src/app/lib/importacion/notas';
import { categoriaQueCoincide, esRepetido } from '../../src/app/lib/importacion/repetidos';
import { gastosDeTabla } from '../../src/app/lib/importacion/tabla';
import { leerXlsx } from '../../src/app/lib/importacion/xlsx';

const HOY = '2026-10-26';

describe('montos como se escriben en Argentina', () => {
  it('lee puntos de miles y comas decimales', () => {
    assert.equal(parsearNumero('8.500'), 8500);
    assert.equal(parsearNumero('8.500,50'), 8500.5);
    assert.equal(parsearNumero('1.234.567'), 1234567);
    assert.equal(parsearNumero('8,5'), 8.5);
    assert.equal(parsearNumero('1,234.50'), 1234.5);
    assert.equal(parsearNumero('8500'), 8500);
  });
  it('no inventa números', () => {
    assert.equal(parsearNumero('abc'), null);
    assert.equal(parsearNumero(''), null);
  });
  it('saca el signo de moneda y detecta los dólares', () => {
    assert.deepEqual(parsearMonto('$ 8.500'), { monto: 8500, moneda: 'ARS' });
    assert.deepEqual(parsearMonto('US$ 20'), { monto: 20, moneda: 'USD' });
    assert.deepEqual(parsearMonto('USD 1.500,50'), { monto: 1500.5, moneda: 'USD' });
    assert.deepEqual(parsearMonto('-1.234'), { monto: 1234, moneda: 'ARS' });
    assert.deepEqual(parsearMonto(5200), { monto: 5200, moneda: 'ARS' });
    assert.equal(parsearMonto(0), null);
    assert.equal(parsearMonto('sin monto'), null);
  });
});

describe('fechas, día primero', () => {
  it('lee las formas habituales', () => {
    assert.equal(parsearFecha('12/10/2025', HOY), '2025-10-12');
    assert.equal(parsearFecha('12-10-25', HOY), '2025-10-12');
    assert.equal(parsearFecha('2025-10-12', HOY), '2025-10-12');
    assert.equal(parsearFecha('3 de octubre', HOY), '2026-10-03');
    assert.equal(parsearFecha('3 oct 2024', HOY), '2024-10-03');
  });
  it('sin año, si cae en el futuro es del año anterior', () => {
    assert.equal(parsearFecha('12/10', HOY), '2026-10-12');
    assert.equal(parsearFecha('15/12', HOY), '2025-12-15');
  });
  it('rechaza días que no existen', () => {
    assert.equal(parsearFecha('31/02/2025', HOY), null);
    assert.equal(parsearFecha('hola', HOY), null);
  });
  it('pasa el serial de Excel a fecha', () => assert.equal(fechaDeSerialExcel(45942), '2025-10-12'));
});

describe('CSV', () => {
  it('detecta el punto y coma y las comillas', () => {
    const t = leerCsv('Fecha;Detalle;Monto\n12/10/2025;"Super; chino";"1.500,50"\n');
    assert.deepEqual(t, [['Fecha', 'Detalle', 'Monto'], ['12/10/2025', 'Super; chino', '1.500,50']]);
  });
});

describe('tablas a gastos', () => {
  it('lee una tabla con títulos', () => {
    const r = gastosDeTabla(leerCsv('Fecha,Descripción,Categoría,Monto\n12/10/2025,Súper,Comida,"31.000"\n13/10/2025,SUBE,Transporte,3000\n,Total,,34000'), HOY);
    assert.ok(r);
    assert.equal(r.gastos.length, 2);
    assert.deepEqual(r.gastos[0], { fecha: '2025-10-12', descripcion: 'Súper', monto: 31000, moneda: 'ARS', categoria: 'Comida' });
    assert.equal(r.omitidos, 1);
  });
  it('adivina las columnas cuando no hay títulos', () => {
    const r = gastosDeTabla([['12/10/2025', 'Súper', 31000], ['13/10/2025', 'Uber', 5200]], HOY);
    assert.ok(r);
    assert.equal(r.gastos[1].descripcion, 'Uber');
    assert.equal(r.gastos[1].monto, 5200);
    assert.equal(r.gastos[1].fecha, '2025-10-13');
  });
  it('en un extracto, toma lo que salió (negativo) y deja las entradas', () => {
    const r = gastosDeTabla([['Fecha', 'Concepto', 'Importe'], ['01/10/2025', 'Sueldo', '400.000'], ['02/10/2025', 'Alquiler', '-250.000'], ['03/10/2025', 'Café', '-4.500']], HOY);
    assert.ok(r);
    assert.deepEqual(r.gastos.map((g) => g.descripcion), ['Alquiler', 'Café']);
    assert.equal(r.omitidos, 1);
  });
  it('con casi todo positivo, las devoluciones negativas quedan afuera', () => {
    const r = gastosDeTabla([['Fecha', 'Detalle', 'Monto'], ['01/10/2025', 'A', '100'], ['02/10/2025', 'B', '200'], ['03/10/2025', 'Devolución', '-50']], HOY);
    assert.ok(r);
    assert.deepEqual(r.gastos.map((g) => g.descripcion), ['A', 'B']);
  });
  it('sin una columna de monto no se anima a adivinar', () => {
    assert.equal(gastosDeTabla([['Nombre', 'Notas'], ['Ana', 'hola'], ['Beto', 'chau']], HOY), null);
  });
});

describe('notas', () => {
  it('lee un gasto por línea, con o sin fecha', () => {
    const r = gastosDeNotas('12/10 super 31.000\n- Almuerzo $8500\n3 de octubre, uber, 5200\nsolo texto sin monto\n', HOY);
    assert.equal(r.gastos.length, 3);
    assert.deepEqual(r.gastos[0], { fecha: '2026-10-12', descripcion: 'super', monto: 31000, moneda: 'ARS', categoria: null });
    assert.equal(r.gastos[1].fecha, null);
    assert.equal(r.gastos[1].monto, 8500);
    assert.equal(r.gastos[2].fecha, '2026-10-03');
    assert.equal(r.gastos[2].descripcion, 'uber');
    assert.equal(r.omitidos, 1);
  });
  it('reconoce dólares', () => {
    const r = gastosDeNotas('Spotify US$ 11', HOY);
    assert.deepEqual([r.gastos[0].monto, r.gastos[0].moneda], [11, 'USD']);
  });
  it('las notas van a leer a la IA; si no se entienden acá, no hay respaldo', () => {
    const r = leerNotas('este mes gasté bastante en comida y salidas', HOY);
    assert.ok(r.via === 'servidor' && r.respaldo === null);
  });
  it('lo que se entiende acá queda de respaldo por si la IA no anda', () => {
    const r = leerNotas('12/10 super 31000', HOY);
    assert.ok(r.via === 'servidor' && r.respaldo?.gastos.length === 1);
  });
});

// ── Un xlsx mínimo, armado a mano (zip con las partes imprescindibles). ──
function crc32(b: Buffer): number {
  let c = ~0;
  for (const x of b) { c ^= x; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); }
  return ~c >>> 0;
}
function zip(partes: Record<string, string>, comprimir: boolean): ArrayBuffer {
  const locales: Buffer[] = [];
  const centrales: Buffer[] = [];
  let pos = 0;
  for (const [nombre, texto] of Object.entries(partes)) {
    const datos = Buffer.from(texto);
    const guardado = comprimir ? deflateRawSync(datos) : datos;
    const n = Buffer.from(nombre);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(comprimir ? 8 : 0, 8);
    local.writeUInt32LE(crc32(datos), 14); local.writeUInt32LE(guardado.length, 18); local.writeUInt32LE(datos.length, 22); local.writeUInt16LE(n.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(comprimir ? 8 : 0, 10);
    central.writeUInt32LE(crc32(datos), 16); central.writeUInt32LE(guardado.length, 20); central.writeUInt32LE(datos.length, 24); central.writeUInt16LE(n.length, 28); central.writeUInt32LE(pos, 42);
    locales.push(local, n, guardado);
    centrales.push(central, n);
    pos += 30 + n.length + guardado.length;
  }
  const dirCentral = Buffer.concat(centrales);
  const fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0); fin.writeUInt16LE(Object.keys(partes).length, 8); fin.writeUInt16LE(Object.keys(partes).length, 10);
  fin.writeUInt32LE(dirCentral.length, 12); fin.writeUInt32LE(pos, 16);
  const todo = Buffer.concat([...locales, dirCentral, fin]);
  return todo.buffer.slice(todo.byteOffset, todo.byteOffset + todo.length);
}

const HOJA = `<worksheet><sheetData>
<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c></row>
<row r="2"><c r="A2" s="1"><v>45942</v></c><c r="B2" t="s"><v>3</v></c><c r="C2"><v>31000.5</v></c></row>
<row r="3"><c r="A3" s="1"><v>45943</v></c><c r="B3" t="inlineStr"><is><t>Caf&amp;é</t></is></c><c r="C3"><v>4500</v></c></row>
</sheetData></worksheet>`;
const PARTES = {
  'xl/sharedStrings.xml': '<sst><si><t>Fecha</t></si><si><t>Detalle</t></si><si><t>Monto</t></si><si><r><t>Sú</t></r><r><t>per</t></r></si></sst>',
  'xl/styles.xml': '<styleSheet><numFmts count="0"/><cellXfs count="2"><xf numFmtId="0"/><xf numFmtId="14"/></cellXfs></styleSheet>',
  'xl/worksheets/sheet1.xml': HOJA,
};

describe('xlsx', () => {
  for (const comprimir of [true, false]) {
    it(`lee textos, números y fechas (${comprimir ? 'comprimido' : 'sin comprimir'})`, async () => {
      const tablas = await leerXlsx(zip(PARTES, comprimir));
      assert.equal(tablas.length, 1);
      assert.deepEqual(tablas[0][0], ['Fecha', 'Detalle', 'Monto']);
      assert.deepEqual(tablas[0][1], ['2025-10-12', 'Súper', 31000.5]);
      assert.deepEqual(tablas[0][2], ['2025-10-13', 'Caf&é', 4500]);
    });
  }
  it('un archivo xlsx se lee de punta a punta', async () => {
    const buf = zip(PARTES, true);
    const r = await leerArchivo({ name: 'gastos.xlsx', type: '', size: buf.byteLength, text: async () => '', arrayBuffer: async () => buf }, HOY);
    assert.equal(r.via, 'servidor');
    if (r.via === 'servidor') {
      assert.equal(r.entrada.tipo, 'texto');
      assert.ok(r.entrada.tipo === 'texto' && r.entrada.conTitulos === true && r.entrada.texto.startsWith('Fecha | Detalle | Monto\n2025-10-12 | Súper | 31000.5'));
      assert.equal(r.respaldo?.gastos.length, 2);
      assert.equal(r.respaldo?.gastos[0].fecha, '2025-10-12');
    }
  });
  it('lo que no es un xlsx tira error en vez de devolver basura', async () => {
    await assert.rejects(() => leerXlsx(new TextEncoder().encode('esto no es un zip').buffer as ArrayBuffer));
  });
  it('un .xls viejo y un archivo raro se avisan', async () => {
    const vacio = { type: '', size: 10, text: async () => '', arrayBuffer: async () => new ArrayBuffer(0) };
    assert.deepEqual(await leerArchivo({ ...vacio, name: 'viejo.xls' }, HOY), { via: 'error', motivo: 'xls' });
    assert.deepEqual(await leerArchivo({ ...vacio, name: 'cosa.docx' }, HOY), { via: 'error', motivo: 'formato' });
  });
  it('las capturas y los PDF se mandan a leer al servidor', async () => {
    const vacio = { size: 10, text: async () => '', arrayBuffer: async () => new ArrayBuffer(0) };
    const a = await leerArchivo({ ...vacio, name: 'cap.png', type: 'image/png' }, HOY);
    const b = await leerArchivo({ ...vacio, name: 'resumen.pdf', type: 'application/pdf' }, HOY);
    assert.equal(a.via === 'servidor' && a.entrada.tipo, 'imagen');
    assert.equal(b.via === 'servidor' && b.entrada.tipo, 'pdf');
  });
});

describe('tramos para la IA', () => {
  it('una planilla se parte en tramos y cada uno lleva los títulos', () => {
    const texto = ['Fecha | Monto', ...Array.from({ length: 100 }, (_, i) => `2026-10-01 | ${i + 1}`)].join('\n');
    const t = partirEnTramos(texto, true);
    assert.equal(t.length, 3);
    assert.ok(t.every((x) => x.startsWith('Fecha | Monto\n')));
    assert.equal(t.join('\n').split('\n').filter((l) => l.startsWith('2026')).length, 100);
  });
  it('unas notas se parten sin repetir la primera línea', () => {
    const t = partirEnTramos(Array.from({ length: 50 }, (_, i) => `gasto ${i}`).join('\n'), false);
    assert.equal(t.length, 2);
    assert.equal(t.join('\n').split('\n').length, 50);
  });
  it('un texto corto es un solo tramo', () => assert.equal(partirEnTramos('a 100\nb 200', false).length, 1));
});

describe('repetidos y categorías', () => {
  const existentes = [{ fecha: '2026-10-12', descripcion: 'Súper', monto: 31000 }];
  it('un gasto del mismo día, monto y nombre ya está', () => {
    assert.equal(esRepetido({ fecha: '2026-10-12', descripcion: 'super', monto: 31000, moneda: 'ARS', categoria: null }, existentes), true);
  });
  it('otro monto u otro día no es repetido', () => {
    assert.equal(esRepetido({ fecha: '2026-10-12', descripcion: 'super', monto: 30000, moneda: 'ARS', categoria: null }, existentes), false);
    assert.equal(esRepetido({ fecha: '2026-10-13', descripcion: 'super', monto: 31000, moneda: 'ARS', categoria: null }, existentes), false);
    assert.equal(esRepetido({ fecha: null, descripcion: 'super', monto: 31000, moneda: 'ARS', categoria: null }, existentes), false);
  });
  it('encuentra la categoría por nombre, sin importar mayúsculas ni tildes', () => {
    assert.equal(categoriaQueCoincide('COMIDA', [{ id: 'a', nombre: 'Comida' }]), 'a');
    assert.equal(categoriaQueCoincide('Súper', [{ id: 'a', nombre: 'Super' }]), 'a');
    assert.equal(categoriaQueCoincide('Ropa', [{ id: 'a', nombre: 'Comida' }]), null);
  });
});
