const fs = require("fs");
const path = require("path");

const DATOS_DIR = path.join(__dirname, "DatosEMPRESAS");

function cargarJson(archivo) {
  return JSON.parse(
    fs.readFileSync(path.join(DATOS_DIR, archivo), "utf-8")
  );
}

module.exports = {
  EquiposGenerales: cargarJson("EquiposGenerales.json"),
  Informacion_Empresas: cargarJson("InformacionEmpresas.json"),
  Informacion_Economica: cargarJson("InformacionEconomica.json"),
  Geologos: cargarJson("Geologos.json"),
  Contadores: cargarJson("Contadores.json"),
  Configuracion: cargarJson("Configuracion.json"),
};
