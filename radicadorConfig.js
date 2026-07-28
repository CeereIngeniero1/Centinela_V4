/**
 * Configuración runtime del radicador. Sin valores por defecto:
 * debe inicializarse desde radicadorBuscadorTitulos.js (u otro launcher).
 *
 * Modos de áreas:
 * 1) Local (legacy): areas/<ARCHIVO_AREAS>.json en Centinela_V4
 * 2) BuscaTitulos: lee areasSourcePath (p. ej. Totas.json), filtra por Empresa + NombreArea
 */
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;

let config = null;

function isInitialized() {
  return config !== null;
}

function get() {
  if (!config) {
    throw new Error(
      "radicadorConfig no inicializado. Use radicadorBuscadorTitulos.js con todos los parámetros."
    );
  }
  return { ...config };
}

function init(nuevaConfig) {
  if (!nuevaConfig || typeof nuevaConfig !== "object") {
    throw new Error("radicadorConfig.init: se requiere un objeto de configuración");
  }
  config = {
    Empresa: nuevaConfig.Empresa,
    CodigoPin: nuevaConfig.CodigoPin,
    // Nombre del área a radicar (también sirve como nombre de JSON local en modo legacy)
    ARCHIVO_AREAS: nuevaConfig.ARCHIVO_AREAS,
    Agente: nuevaConfig.Agente,
    user2: nuevaConfig.user2,
    pass2: nuevaConfig.pass2,
    // Ruta absoluta al JSON de áreas de BuscaTitulos (Totas.json u otro)
    areasSourcePath: nuevaConfig.areasSourcePath || null,
  };
  return get();
}

function esFormatoMultiEmpresa(data) {
  return (
    data &&
    typeof data === "object" &&
    !Array.isArray(data) &&
    Object.values(data).every((v) => Array.isArray(v))
  );
}

/**
 * Resuelve la lista de áreas que usará radicadorBot.js.
 * Con areasSourcePath: solo la área NombreArea de la Empresa en Totas/Collective.
 * Sin areasSourcePath: lee areas/<ARCHIVO_AREAS>.json local (array completo).
 */
function cargarAreas() {
  if (!config) {
    throw new Error("radicadorConfig no inicializado");
  }

  const nombreArea = config.ARCHIVO_AREAS;

  if (config.areasSourcePath) {
    const raw = JSON.parse(fs.readFileSync(config.areasSourcePath, "utf-8"));
    let lista;

    if (esFormatoMultiEmpresa(raw)) {
      lista = raw[config.Empresa];
      if (!Array.isArray(lista)) {
        throw new Error(
          `Empresa "${config.Empresa}" no está en ${config.areasSourcePath}`
        );
      }
    } else if (Array.isArray(raw)) {
      lista = raw;
    } else {
      throw new Error(
        `Formato de áreas no reconocido en ${config.areasSourcePath}`
      );
    }

    const encontrada = lista.find((a) => a && a.NombreArea === nombreArea);
    if (!encontrada) {
      throw new Error(
        `Área "${nombreArea}" no encontrada para empresa "${config.Empresa}" en ${config.areasSourcePath}`
      );
    }

    return [
      {
        NombreArea: encontrada.NombreArea,
        Referencia: encontrada.Referencia,
        Celdas: encontrada.Celdas || [encontrada.Referencia],
      },
    ];
  }

  const areasPath = path.join(ROOT, "areas", `${nombreArea}.json`);
  const local = JSON.parse(fs.readFileSync(areasPath, "utf-8"));
  if (!Array.isArray(local)) {
    throw new Error(`El archivo local de áreas debe ser un array: ${areasPath}`);
  }
  return local;
}

function rutaAreasUsada() {
  if (!config) return null;
  if (config.areasSourcePath) return config.areasSourcePath;
  return path.join(ROOT, "areas", `${config.ARCHIVO_AREAS}.json`);
}

function validar() {
  if (!config) {
    return ["radicadorConfig no inicializado"];
  }

  const errores = [];

  if (!config.Empresa) errores.push("Falta Empresa");
  if (!config.CodigoPin) errores.push("Falta CodigoPin");
  if (!config.ARCHIVO_AREAS) errores.push("Falta NombreArea (ARCHIVO_AREAS)");
  if (config.Agente !== 0 && config.Agente !== 1) {
    errores.push("Agente debe ser 0 (empresa) o 1 (agente)");
  }
  if (config.Agente === 1) {
    if (!config.user2) errores.push("Falta user2 (usuario agente)");
    if (!config.pass2) errores.push("Falta pass2 (clave agente)");
  }

  const empresasPath = path.join(ROOT, "DatosEMPRESAS", "InformacionEmpresas.json");
  const pinesPath = path.join(ROOT, "DatosEMPRESAS", "Pines.json");

  if (!fs.existsSync(empresasPath)) {
    errores.push(`No existe ${empresasPath}`);
  } else if (config.Empresa) {
    const empresas = JSON.parse(fs.readFileSync(empresasPath, "utf-8"));
    if (!empresas[config.Empresa]) {
      errores.push(
        `Empresa "${config.Empresa}" no está en InformacionEmpresas.json`
      );
    }
  }

  if (!fs.existsSync(pinesPath)) {
    errores.push(`No existe ${pinesPath}`);
  } else if (config.CodigoPin) {
    const pines = JSON.parse(fs.readFileSync(pinesPath, "utf-8"));
    if (!pines[config.CodigoPin]) {
      errores.push(`CodigoPin "${config.CodigoPin}" no está en Pines.json`);
    }
  }

  if (config.areasSourcePath) {
    if (!fs.existsSync(config.areasSourcePath)) {
      errores.push(`No existe el archivo de áreas de BuscaTitulos: ${config.areasSourcePath}`);
    } else {
      try {
        cargarAreas();
      } catch (e) {
        errores.push(e.message);
      }
    }
  } else {
    const areasPath = path.join(ROOT, "areas", `${config.ARCHIVO_AREAS}.json`);
    if (config.ARCHIVO_AREAS && !fs.existsSync(areasPath)) {
      errores.push(`No existe el archivo de áreas: ${areasPath}`);
    }
  }

  return errores;
}

function requireField(campo) {
  if (!config) {
    throw new Error("radicadorConfig no inicializado");
  }
  return config[campo];
}

module.exports = {
  get,
  init,
  validar,
  isInitialized,
  cargarAreas,
  rutaAreasUsada,
  get Empresa() {
    return requireField("Empresa");
  },
  get CodigoPin() {
    return requireField("CodigoPin");
  },
  get ARCHIVO_AREAS() {
    return requireField("ARCHIVO_AREAS");
  },
  get Agente() {
    return requireField("Agente");
  },
  get user2() {
    return requireField("user2");
  },
  get pass2() {
    return requireField("pass2");
  },
  get areasSourcePath() {
    return requireField("areasSourcePath");
  },
};
