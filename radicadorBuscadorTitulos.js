/**
 * Entrada parametrizada para radicación Centinela (desde BuscaTitulos u otros).
 *
 * Uso (áreas locales Centinela — legacy):
 *   node radicadorBuscadorTitulos.js <Empresa> <CodigoPin> <ARCHIVO_AREAS> <Agente> <userAgente> <passAgente>
 *
 * Uso (áreas desde BuscaTitulos — recomendado):
 *   node radicadorBuscadorTitulos.js <Empresa> <CodigoPin> <NombreArea> <Agente> <userAgente> <passAgente> <rutaTotasJson>
 *
 * Parámetros:
 *   Empresa         — clave en DatosEMPRESAS/InformacionEmpresas.json
 *   CodigoPin       — clave en DatosEMPRESAS/Pines.json
 *   NombreArea      — NombreArea a radicar (con ruta Totas) o nombre JSON local sin extensión
 *   Agente          — 0 = login empresa, 1 = login agente
 *   userAgente      — usuario agente (si Agente=1; si 0 puede ser "-")
 *   passAgente      — clave agente (si Agente=1; si 0 puede ser "-")
 *   rutaTotasJson   — (opcional) ruta a areas/Totas.json de BuscaTitulos
 *
 * Ejemplo BuscaTitulos:
 *   node radicadorBuscadorTitulos.js CARNEOLA Co KAQ-11171PRUEBA 1 43987 "Sagitario_2026**" "C:\BuscaTitulos\areas\Totas.json"
 *
 * Ejemplo local:
 *   node radicadorBuscadorTitulos.js CARNEOLA Co Prueba 0 - -
 */

const colors = require("colors");
const radicadorConfig = require("./radicadorConfig");

function mostrarUso() {
  console.log(
    colors.yellow(
      "\nUso: node radicadorBuscadorTitulos.js <Empresa> <CodigoPin> <NombreArea> <Agente> <userAgente> <passAgente> [rutaTotasJson]\n"
    )
  );
  console.log("Ejemplos:");
  console.log(
    '  node radicadorBuscadorTitulos.js CARNEOLA Co KAQ-11171PRUEBA 1 43987 Sagitario_2026** "C:\\BuscaTitulos\\areas\\Totas.json"'
  );
  console.log("  node radicadorBuscadorTitulos.js CARNEOLA Co Prueba 0 - -\n");
}

const args = process.argv.slice(2);
const [
  empresa,
  codigoPin,
  nombreArea,
  agenteRaw,
  userAgente,
  passAgente,
  areasSourcePath,
] = args;

if (
  !empresa ||
  !codigoPin ||
  !nombreArea ||
  agenteRaw === undefined ||
  userAgente === undefined ||
  passAgente === undefined
) {
  console.error(colors.red("❌ Faltan parámetros obligatorios."));
  mostrarUso();
  process.exit(1);
}

const agenteNum = Number(agenteRaw);
if (agenteNum !== 0 && agenteNum !== 1) {
  console.error(colors.red("❌ Agente debe ser 0 o 1."));
  mostrarUso();
  process.exit(1);
}

radicadorConfig.init({
  Empresa: empresa,
  CodigoPin: codigoPin,
  ARCHIVO_AREAS: nombreArea,
  Agente: agenteNum,
  user2: agenteNum === 1 ? userAgente : "",
  pass2: agenteNum === 1 ? passAgente : "",
  areasSourcePath: areasSourcePath || null,
});

const errores = radicadorConfig.validar();
if (errores.length) {
  console.error(colors.red("❌ Configuración inválida:"));
  errores.forEach((e) => console.error(colors.red(`   - ${e}`)));
  process.exit(1);
}

const cfg = radicadorConfig.get();
console.log(colors.cyan.bold("═══ Radicador Buscador de Títulos ═══"));
console.log(` Empresa:       ${cfg.Empresa}`);
console.log(` CodigoPin:     ${cfg.CodigoPin}`);
console.log(` NombreArea:    ${cfg.ARCHIVO_AREAS}`);
console.log(
  ` Áreas desde:   ${cfg.areasSourcePath || `areas/${cfg.ARCHIVO_AREAS}.json (local)`}`
);
console.log(
  ` Agente:        ${cfg.Agente === 1 ? "1 (login agente)" : "0 (login empresa)"}`
);
if (cfg.Agente === 1) {
  console.log(` userAgente:    ${cfg.user2}`);
}
console.log(colors.cyan.bold("══════════════════════════════════════\n"));

require("./radicadorBot.js");
