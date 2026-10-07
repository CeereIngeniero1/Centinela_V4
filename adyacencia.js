/**
 * Adyacencia de celdas mineras ANM a partir del código de la celda.
 *
 * Código: 17N12C23G06S = sector "17N12" + sección "C" + conjunto "23" + bloque "G" + grupo "06" + celda "S".
 * Sección y bloque: cuadrícula 4x4 con letras A-Q sin la O.
 * Conjunto y grupo: cuadrícula 5x5 numerada 01-25.
 * Celda: cuadrícula 5x5 con letras A-Z sin la O.
 * Todas se leen de izquierda a derecha y de norte a sur. Cada celda mide 0,001° x 0,001°.
 * Validado contra 67.804 celdas de los shapefiles de Documentos/<Empresa>/Sheips sin errores.
 */
const LETRAS_4X4 = "ABCDEFGHIJKLMNPQ";
const LETRAS_5X5 = "ABCDEFGHIJKLMNPQRSTUVWXYZ";
const FORMATO = /^(\d{2}[A-Z]\d{2})([A-Z])(\d{2})([A-Z])(\d{2})([A-Z])$/;

function posicionCelda(id) {
  const m = FORMATO.exec(String(id || "").trim().toUpperCase());
  if (!m) return null;
  const seccion = LETRAS_4X4.indexOf(m[2]);
  const conjunto = parseInt(m[3], 10) - 1;
  const bloque = LETRAS_4X4.indexOf(m[4]);
  const grupo = parseInt(m[5], 10) - 1;
  const celda = LETRAS_5X5.indexOf(m[6]);
  if ([seccion, bloque, celda].includes(-1) || conjunto < 0 || conjunto > 24 || grupo < 0 || grupo > 24) {
    return null;
  }
  return {
    sector: m[1],
    fila:
      Math.floor(seccion / 4) * 500 +
      Math.floor(conjunto / 5) * 100 +
      Math.floor(bloque / 4) * 25 +
      Math.floor(grupo / 5) * 5 +
      Math.floor(celda / 5),
    col: (seccion % 4) * 500 + (conjunto % 5) * 100 + (bloque % 4) * 25 + (grupo % 5) * 5 + (celda % 5),
  };
}

/**
 * Agrupa las celdas que se tocan. Por defecto solo cuenta lados compartidos;
 * con { esquinas: true } también une celdas que se tocan en diagonal.
 * Devuelve { grupos (de mayor a menor), invalidas }.
 */
function gruposAdyacentes(celdas, opciones = {}) {
  const vecinos = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  if (opciones.esquinas) vecinos.push([1, 1], [1, -1], [-1, 1], [-1, -1]);

  const porPosicion = new Map();
  const invalidas = [];
  for (const id of new Set(celdas.map((c) => String(c).trim()).filter(Boolean))) {
    const p = posicionCelda(id);
    if (!p) {
      invalidas.push(id);
      continue;
    }
    porPosicion.set(`${p.sector}|${p.fila}|${p.col}`, { id, ...p });
  }

  const vistas = new Set();
  const grupos = [];
  for (const inicio of porPosicion.values()) {
    if (vistas.has(inicio.id)) continue;
    const grupo = [];
    const pila = [inicio];
    vistas.add(inicio.id);
    while (pila.length) {
      const actual = pila.pop();
      grupo.push(actual.id);
      for (const [df, dc] of vecinos) {
        const vecino = porPosicion.get(`${actual.sector}|${actual.fila + df}|${actual.col + dc}`);
        if (vecino && !vistas.has(vecino.id)) {
          vistas.add(vecino.id);
          pila.push(vecino);
        }
      }
    }
    grupos.push(grupo);
  }

  grupos.sort((a, b) => b.length - a.length);
  return { grupos, invalidas };
}

module.exports = { posicionCelda, gruposAdyacentes };
