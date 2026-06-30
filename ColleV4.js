const puppeteer = require("puppeteer");
const fs = require("fs");
const colors = require("colors");
const nodemailer = require("nodemailer");
const { Console } = require("console");
const { keyboard, mouse, Key, clipboard } = require("@nut-tree-fork/nut-js");

const os = require("os");
const path = require("path");
const { url } = require("inspector");
const {
  EquiposGenerales,
  Informacion_Empresas,
  Informacion_Economica,
  Geologos,
  Contadores,
} = require("./datosEmpresas");



const NombreEquipo = os.hostname();
console.log(" Nombre del equipo: ", NombreEquipo);

const EquipoActual = EquiposGenerales[NombreEquipo];
console.log(" Equipo Actual: ", EquipoActual);

const Empresa = "Collective";
const CodigoPin = "Co";
const ARCHIVO_AREAS = "Collective";
const DASHBOARD_URL = "https://annamineria.anm.gov.co/sigm/index.html#/extDashboard";
const ESPERA_DASHBOARD_MS = 3000;
const MAX_INTENTOS_DASHBOARD = 3;
const URL_EXITO_AREAS =
  "https://annamineria.anm.gov.co/sigm/index.html#/p_CaaIataInputTechnicalEconomicalDetails";
const RUTAS_FLUJO_RADICACION = [
  "#/p_CaaIataInputTechnicalEconomicalDetails",
  "#/p_CaaIataAttachDocuments",
];
const MONITOREO_AREA_MS = 30 * 1000;
const INTERVALO_PRIMERA_REVISION_MS = 1 * 1000;
const INTERVALO_REVISION_AREA_MS = 5 * 1000;
const ESPERA_ENTRE_AREAS_MS = 30 * 1000;
const INTERVALO_REVISION_ENTRE_AREAS_MS = 3 * 1000;
const TIMEAREA_REINICIO_MS = 5 * 60 * 1000;
const ESPERA_ANTES_CONTINUAR_AREA_MS = 400;
const Pines = JSON.parse(
  fs.readFileSync(path.join(__dirname, "DatosEMPRESAS", "Pines.json"), "utf-8")
);
const MineralesPorEmpresa = JSON.parse(
  fs.readFileSync(path.join(__dirname, "DatosEMPRESAS", "Minerales.json"), "utf-8")
);
const Areas = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "areas", `${ARCHIVO_AREAS}.json`),
    "utf-8"
  )
);
console.log(`Áreas cargadas: ${ARCHIVO_AREAS}.json (${Areas.length} áreas)`);
const Datos_Empresa = Informacion_Empresas[Empresa];
const Datos_Economicos = Informacion_Economica[Empresa];
const Datos_Geologos = Geologos[Empresa];
const Datos_Contadores = Contadores[Empresa];


const user1 = Datos_Empresa.Codigo;
const pass1 = Datos_Empresa.Contraseña;
const user2 = '96233';
const pass2 = 'SuperAgente86*';
const Agente = 1;
const manual = 0; // 1 = pausa en PIN tras colocarlo; 0 = flujo automático
var EnviarCorreosParaPestanas = 0;
var CorreoAvisoLoginEnviado = false;
var contreapertura = 0;
var ContadorVueltas = 0;
var Band = 0;
var ComparacionCeldas = "";
var areaFiltrado;

//console.log( Informacion_Empresas[Empresa]);

Pagina();
async function Pagina() {
  const datosPin = Pines[CodigoPin];
  if (!datosPin) {
    throw new Error(`No se encontró pin para el código "${CodigoPin}" en DatosEMPRESAS/Pines.json`);
  }
  const Pin = datosPin.pin;
  console.log(`Pin ${CodigoPin}:`, Pin, `| vence: ${datosPin.vencimiento}`);

  const browser = await puppeteer.launch({
    //executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    executablePath:
      "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    // Reemplaza con la ruta real a tu Google Chrome
    headless: false,
    args: [
      "--start-maximized",
    ],
    devtools: false,
  });

  Mineria(browser, Pin);
}



async function Login(page) {
  await page.setViewport({ width: 1368, height: 620 });
  await page.goto("https://annamineria.anm.gov.co/sigm/");

  const user = Agente == 0 ? user1 : user2;
  const pass = Agente == 0 ? pass1 : pass2;

  try {
    console.log(user);
    console.log(pass);
    await page.type("#username", user);
    await page.type("#password", pass);
  } catch (ex) {
    console.log("Entro en el catch");
  }

  console.log(
    "⏳ Esperando login manual: resuelva el CAPTCHA e inicie sesión.",
    "El bot continuará cuando detecte el dashboard."
  );

  const avisoLogin = setTimeout(() => {
    if (!CorreoAvisoLoginEnviado) {
      console.log(
        "Han pasado 2 minutos esperando el login manual. Enviando correo de aviso..."
      );
      Correo(7, "", "");
      CorreoAvisoLoginEnviado = true;
    }
  }, 2 * 60 * 1000);

  try {
    await page.waitForFunction(
      (dashboardUrl) =>
        window.location.href === dashboardUrl ||
        window.location.href.includes("#/extDashboard"),
      { timeout: 0 },
      DASHBOARD_URL
    );
  } finally {
    clearTimeout(avisoLogin);
  }

  console.log("✅ Login completado. Dashboard detectado:", DASHBOARD_URL);
}

async function RadicarPropuesta(page) {
  try {
    const solicitudes = await page.$x('//span[contains(.,"Solicitudes")]');
    if (!solicitudes.length) {
      throw new Error("No se encontró el menú 'Solicitudes'");
    }

    const indiceSolicitudes = solicitudes.length > 1 ? 1 : 0;
    await solicitudes[indiceSolicitudes].click();

    await page.waitForTimeout(1000);

    const lblRadicar = await page.$x(
      '//a[contains(.,"Radicar solicitud de propuesta de contrato de concesión")]'
    );
    if (!lblRadicar.length) {
      throw new Error("No se encontró 'Radicar solicitud de propuesta'");
    }

    await lblRadicar[0].click();
    console.log("✅ Radicar propuesta: clic completado.");
    return true;
  } catch (error) {
    console.error("Radicar propuesta falló:", error.message);
    return false;
  }
}

async function esperarDashboardYRadicar(page) {
  for (let intento = 1; intento <= MAX_INTENTOS_DASHBOARD; intento++) {
    console.log(
      `Intento ${intento}/${MAX_INTENTOS_DASHBOARD}: esperando ${ESPERA_DASHBOARD_MS / 1000} segundos...`
    );
    await page.waitForTimeout(ESPERA_DASHBOARD_MS);

    const exito = await RadicarPropuesta(page);
    if (exito) {
      console.log("Dashboard listo y radicar propuesta completado.");
      return true;
    }

    console.log(`Intento ${intento} falló.`);
  }

  return false;
}

async function Agente_Selecion_Empresa(page) {
  // await page.waitForTimeout(2000);
  await page.waitForTimeout(500);
  await page.waitForSelector("#submitterPersonOrganizationNameId", {
    visible: true,
  });

  await page.evaluate(
    () =>
      (document.getElementById("submitterPersonOrganizationNameId").value = "")
  );
  // await page.type("#submitterPersonOrganizationNameId", "76966");
  await page.type("#submitterPersonOrganizationNameId", Datos_Empresa.Codigo);
  // await page.waitForTimeout(300000);
  console.log(`${Datos_Empresa.Nombre} (${Datos_Empresa.Codigo})`);
  try {
    await page.waitForFunction(
      (Datos_Empresa) => {
        const el = document.querySelector(
          // 'a[title*="COLLECTIVE MINING LIMITED SUCURSAL COLOMBIA (76966)"]'
          `a[title*="${Datos_Empresa.Nombre} (${Datos_Empresa.Codigo})"]`
        );
        return (
          el &&
          // el.innerText.includes("COLLECTIVE MINING LIMITED SUCURSAL COLOMBIA")
          el.innerText.includes(Datos_Empresa.Nombre)
        );
      },
      { timeout: 5000 },
      Datos_Empresa
    ); // espera máximo 10s
  } catch (error) {

  }


  await page.keyboard.press("Enter");

}

async function detectarErrorPinObligatorio(page) {
  return page.evaluate(() => {
    const texto = document.body.innerText || "";
    return (
      texto.includes(
        "El campo Número de Identificación de Pago (PIN) es obligatorio"
      ) || texto.includes("PIN) es obligatorio")
    );
  });
}

async function detectarErrorMineralesObligatorio(page) {
  return page.evaluate(() => {
    const objetivo = "El campo Detalle de los minerales es obligatorio";
    const errores = document.querySelectorAll(
      ".errorMsg, .errorMsg a, .errorMsg span"
    );
    for (let i = 0; i < errores.length; i++) {
      if ((errores[i].textContent || "").includes(objetivo)) return true;
    }
    return false;
  });
}

async function asegurarMineralesColocados(page, opciones = {}) {
  const timeout = opciones.timeout ?? (manual == 1 ? 0 : 15000);
  const etiqueta = opciones.etiqueta ? `[${opciones.etiqueta}] ` : "";
  const soloSiError = opciones.soloSiError ?? false;

  if (soloSiError && !(await detectarErrorMineralesObligatorio(page))) {
    return true;
  }

  try {
    await page.waitForSelector('button[ng-class="settings.buttonClasses"]', {
      visible: true,
      timeout,
    });
    console.log(`${etiqueta}Colocando minerales...`);
    await Minerales(page);
    await page.waitForTimeout(500);
    console.log(`${etiqueta}✅ Minerales colocados.`);
    return true;
  } catch (error) {
    console.log(
      `${etiqueta}⚠️ Botón de minerales no disponible:`,
      error.message
    );
    return false;
  }
}

async function corregirMineralesSiObligatorio(page) {
  if (!(await detectarErrorMineralesObligatorio(page))) return false;
  console.log("🔴 Detalle de minerales obligatorio. Colocando minerales...");
  await asegurarMineralesColocados(page, {
    timeout: 15000,
    etiqueta: "corrección",
  });
  return true;
}

async function clickContinuarVerificandoMinerales(page, indice = 1) {
  if (await detectarErrorMineralesObligatorio(page)) {
    await asegurarMineralesColocados(page, {
      timeout: 15000,
      etiqueta: "pre-continuar-área",
    });
  }
  await clickContinuar(page, indice);
  await page.waitForTimeout(400);
  if (await corregirMineralesSiObligatorio(page)) {
    await page.waitForTimeout(400);
    await clickContinuar(page, indice);
  }
}

async function clickContinuarArea(page, indice = 1) {
  console.log("Clic en Continuar tras colocar área...");
  await clickContinuar(page, indice, 5000);
  await page.waitForTimeout(ESPERA_ANTES_CONTINUAR_AREA_MS);
  if (await detectarErrorMineralesObligatorio(page)) {
    await corregirMineralesSiObligatorio(page);
    await page.waitForTimeout(ESPERA_ANTES_CONTINUAR_AREA_MS);
    await clickContinuar(page, indice, 5000);
  }
}

function sigueEnPantallaPin(page) {
  return page.url().includes("p_CaalataSelectClient");
}

function estaEnFlujoRadicacion(page) {
  try {
    if (!page) return false;
    const url = page.url();
    return RUTAS_FLUJO_RADICACION.some((ruta) => url.includes(ruta));
  } catch (error) {
    return false;
  }
}

function reiniciarMineriaDesdeTimer(browser, Pin, page, etiqueta = "Timer") {
  (async () => {
    if (estaEnFlujoRadicacion(page)) {
      console.log(`✅ ${etiqueta}: ya en flujo de radicación; no se reinicia.`);
      return;
    }
    if (await debeOmitirReinicioModoManual(page)) {
      console.log(
        `✅ ${etiqueta}: modo manual activo; no se reinicia mientras navega.`
      );
      return;
    }
    try {
      page.close();
    } catch (error) {
      console.log("No se pudo cerrar la página:", error.message);
    }
    Mineria(browser, Pin);
  })();
}

async function reiniciarMineria(browser, Pin, page, timers = []) {
  timers.forEach((timer) => {
    if (timer) {
      clearTimeout(timer);
    }
  });

  if (estaEnFlujoRadicacion(page)) {
    console.log(
      "✅ Ya está en pantalla de radicación; no se reinicia Mineria."
    );
    return false;
  }

  if (await debeOmitirReinicioModoManual(page)) {
    console.log(
      "✅ Modo manual: no se reinicia mientras navega hacia las áreas."
    );
    return false;
  }

  console.log("♻️ Reiniciando Mineria por error o bloqueo...");
  try {
    await page.close();
  } catch (error) {
    console.log("No se pudo cerrar la página:", error.message);
  }
  Mineria(browser, Pin);
  return true;
}

async function clickContinuar(page, indice = 1, timeout = 15000) {
  await page.waitForXPath('//span[contains(.,"Continuar")]', {
    visible: true,
    timeout,
  });

  const hacerClic = async () => {
    const botones = await page.$x('//span[contains(.,"Continuar")]');
    if (!botones[indice]) {
      throw new Error(`No se encontró Continuar en índice ${indice}`);
    }
    await botones[indice].click();
  };

  try {
    await hacerClic();
  } catch (error) {
    console.log("Reintentando clic en Continuar:", error.message);
    await page.waitForTimeout(1000);
    await hacerClic();
  }
}

async function esperarContinuarManualPin(page) {
  console.log(
    "⏳ Modo manual PIN: haga clic en Continuar cuando esté listo.",
    "El bot continuará al salir de la pantalla del PIN."
  );
  await page.waitForFunction(
    () => !window.location.href.includes("p_CaalataSelectClient"),
    { timeout: 0 }
  );
  await page.waitForTimeout(1000);
  console.log("✅ Avance manual desde PIN detectado.");
}

async function esperarPantallaAreas(page) {
  console.log(
    "⏳ Modo manual: navegue hasta la pantalla de áreas.",
    "El bot continuará cuando detecte el selector de área."
  );
  await page.waitForSelector('select[name="areaOfConcessionSlct"]', {
    visible: true,
    timeout: 0,
  });
  await page.waitForTimeout(1000);
  console.log("✅ Pantalla de áreas detectada.");
}

async function debeOmitirReinicioModoManual(page) {
  if (manual != 1) return false;
  if (estaEnFlujoRadicacion(page)) return true;
  try {
    if (!page) return true;
    if (sigueEnPantallaPin(page)) return true;
    const selectArea = await page.$('select[name="areaOfConcessionSlct"]');
    if (!selectArea) return true;
  } catch (error) {
    return true;
  }
  return false;
}

async function avanzarDesdePin(page) {
  if (manual == 1) {
    await esperarContinuarManualPin(page);
  } else {
    await page.waitForXPath('//span[contains(.,"Continuar")]');
    await clickContinuar(page, 1);
    await page.waitForTimeout(1000);
  }
}

async function colocarPin(page, Pin) {
  await page.waitForSelector('select[id="pinSlctId"]', { visible: true });
  const selectPin = await page.$('select[id="pinSlctId"]');
  const datosPin = Pines[CodigoPin];
  const pinTexto = `${datosPin.pin}, ${datosPin.vencimiento}`;

  const pinSeleccionado = await page.evaluate(
    ({ pinValue, pinTextoCompleto }) => {
      const select = document.querySelector('select[id="pinSlctId"]');
      if (!select) {
        return false;
      }

      const opcion = Array.from(select.options).find(
        (option) =>
          option.textContent.trim() === pinTextoCompleto ||
          option.textContent.includes(pinValue)
      );

      if (opcion) {
        select.value = opcion.value;
        if (window.angular) {
          angular.element(select).triggerHandler("change");
        }
        return true;
      }

      return false;
    },
    { pinValue: Pin, pinTextoCompleto: pinTexto }
  );

  if (!pinSeleccionado) {
    await page.evaluate(() => {
      const select = document.querySelector('select[id="pinSlctId"]');
      if (select) {
        select.value = "";
      }
    });
    await selectPin.click({ clickCount: 3 });
    await selectPin.type(Pin);
  }

  console.log("PIN colocado:", Pin, "|", pinTexto);

  const allOptions = await page.evaluate((select) => {
    const options = Array.from(select.options);
    return options.map((option) => option.textContent);
  }, selectPin);

  console.log("Opciones PIN disponibles:", allOptions);
  return pinTexto;
}

async function recuperarEmpresaYPin(page, Pin) {
  console.log("⚠️ Reintentando selección de empresa y PIN...");

  if (Agente == 1) {
    await Agente_Selecion_Empresa(page);
    await page.waitForTimeout(1000);
  }

  const pinTexto = await colocarPin(page, Pin);
  await page.waitForTimeout(500);
  return pinTexto;
}

async function seleccionar_Pin(page, Pin, Veces) {
  await page.waitForTimeout(900);
  page.setDefaultTimeout(0);

  const pinTexto = await colocarPin(page, Pin);

  const closestDateOption = pinTexto;
  const input = pinTexto;

  await avanzarDesdePin(page);

  if (await detectarErrorPinObligatorio(page)) {
    console.log("🔴 Error PIN obligatorio detectado tras Continuar.");
    if (Veces == 0) {
      await recuperarEmpresaYPin(page, Pin);
      return seleccionar_Pin(page, Pin, 1);
    }
  }

  const mineralesColocados = await asegurarMineralesColocados(page, {
    timeout: manual == 1 ? 0 : 3000,
    etiqueta: "post-PIN",
  });

  if (manual == 1) {
    return { closestDateOption, input };
  }

  if (!mineralesColocados) {
    console.log(
      "⏱ No apareció el botón de minerales, ejecutando lógica del PIN..."
    );

    if (await detectarErrorPinObligatorio(page) && Veces == 0) {
      console.log("🔴 Error PIN obligatorio detectado. Recuperando...");
      await recuperarEmpresaYPin(page, Pin);
      return seleccionar_Pin(page, Pin, 1);
    }

    if (Veces == 0) {
      await seleccionar_Pin(page, Pin, 1);
    }
  }

  return { closestDateOption, input };
}

async function Minerales(page) {
  const listaMinerales = MineralesPorEmpresa[Empresa];
  if (!listaMinerales) {
    throw new Error(
      `No se encontraron minerales para la empresa "${Empresa}" en DatosEMPRESAS/Minerales.json`
    );
  }

  await page.evaluate((minerales) => {
    document.querySelector('[ng-class="settings.buttonClasses"]').click();
    const elementos = document.getElementsByClassName("ng-binding ng-scope");
    const elementosConMinerales = [];

    for (let i = 0; i < elementos.length; i++) {
      const elemento = elementos[i];
      let agregarElemento = false;

      for (let c = 0; c < minerales.length; c++) {
        if (
          elemento.textContent.includes(minerales[c]) &&
          elemento.textContent.split(/\s+/).includes(minerales[c])
        ) {
          agregarElemento = true;
          break;
        }
      }

      if (agregarElemento) {
        elementosConMinerales.push(elemento);
      }
    }

    for (let i = 0; i < elementosConMinerales.length; i++) {
      elementosConMinerales[i].click();
    }
  }, listaMinerales);
}

async function MonitorearAreas(page, IdArea, Celda, Area) {
  //console.log(IdArea, Aviso, Celda, Comas);

  const AreaCeldas = Area[0].split(',').map(celda => celda.trim());
  await page.evaluate(
    ({ Area }) => {
      document.querySelector('[id="cellIdsTxtId"]').value = Area.join("");
      angular
        .element(document.getElementById("cellIdsTxtId"))
        .triggerHandler("change");
    },
    { Area }
  );

  DetallesCompletos = {
    IdArea: IdArea,
    Celda: Celda,
    Area: Area,
    AreaCeldas: AreaCeldas,
  };

  return DetallesCompletos;
}

async function evaluarEstadoArea(page) {
  if (estaEnFlujoRadicacion(page)) {
    return "exito";
  }

  return await page.evaluate(() => {
    const spans = Array.from(document.querySelectorAll("span")).map((el) =>
      el.textContent.trim()
    );
    const mensajes = Array.from(document.querySelectorAll(".errorMsg a")).map(
      (el) => el.textContent.trim()
    );

    if (mensajes.some((msg) => msg.includes("CELL_REOPENING_DATE"))) {
      return "reopen";
    }

    const hayErrores = spans.includes(
      "Vea los errores a continuación (dentro de las pestañas):"
    );
    const hayNoDisponibles = mensajes.some((msg) =>
      msg.includes("Las siguientes celdas de selección no están disponibles:")
    );

    if (hayErrores || hayNoDisponibles) {
      return "error";
    }

    return "pendiente";
  });
}

async function esperarResultadoMonitoreoArea(page, opciones = {}) {
  const duracionMax = opciones.duracionMax ?? MONITOREO_AREA_MS;
  const intervaloInicial =
    opciones.intervaloInicial ?? INTERVALO_PRIMERA_REVISION_MS;
  const intervaloSiguiente =
    opciones.intervaloSiguiente ?? INTERVALO_REVISION_AREA_MS;
  const etiqueta = opciones.etiqueta ? `[${opciones.etiqueta}] ` : "";

  const inicio = Date.now();
  let esPrimeraEspera = true;
  let numeroValidacion = 0;

  while (Date.now() - inicio < duracionMax) {
    numeroValidacion++;
    const estado = await evaluarEstadoArea(page);
    const segundosTranscurridos = Math.round((Date.now() - inicio) / 1000);

    console.log(
      `${etiqueta}Validación ${numeroValidacion} (${segundosTranscurridos}s): ${estado}`
    );

    if (estado !== "pendiente") {
      console.log(
        `${etiqueta}✅ Resultado en validación ${numeroValidacion}: ${estado}`
      );
      return estado;
    }

    const restante = duracionMax - (Date.now() - inicio);
    if (restante <= 0) {
      break;
    }

    const intervalo = esPrimeraEspera ? intervaloInicial : intervaloSiguiente;
    esPrimeraEspera = false;

    console.log(
      `${etiqueta}Esperando ${Math.min(intervalo, restante) / 1000}s antes de la validación ${numeroValidacion + 1}...`
    );
    await page.waitForTimeout(Math.min(intervalo, restante));
  }

  console.log(
    `${etiqueta}⏱ Timeout tras ${numeroValidacion} validación(es) sin respuesta definitiva.`
  );
  return "timeout";
}

async function esperarEntreAreas(page, opciones = {}) {
  const duracionMax = opciones.duracionMax ?? ESPERA_ENTRE_AREAS_MS;
  const intervalo = opciones.intervalo ?? INTERVALO_REVISION_ENTRE_AREAS_MS;
  const etiqueta = opciones.etiqueta ? `[${opciones.etiqueta}] ` : "";

  const inicio = Date.now();
  let numeroValidacion = 0;

  while (Date.now() - inicio < duracionMax) {
    numeroValidacion++;
    const estado = await evaluarEstadoArea(page);
    const segundosTranscurridos = Math.round((Date.now() - inicio) / 1000);

    console.log(
      `${etiqueta}Validación entre áreas ${numeroValidacion} (${segundosTranscurridos}s): ${estado}`
    );

    if (estado === "exito") {
      console.log(
        `${etiqueta}✅ Pasó a radicar durante la espera entre áreas.`
      );
      return "exito";
    }

    if (estado === "error") {
      console.log(
        `${etiqueta}Errores en celdas; intentando reorganizar el área...`
      );
      const reorganizado = await intentarReorganizarArea(page);
      if (reorganizado) {
        console.log(
          `${etiqueta}✅ Área reorganizada durante la espera entre áreas.`
        );
        return "reorganizado";
      }
    }

    const restante = duracionMax - (Date.now() - inicio);
    if (restante <= 0) {
      break;
    }

    await page.waitForTimeout(Math.min(intervalo, restante));
  }

  return "pendiente";
}

async function pasarSiguienteArea(page) {
  console.log("Paso a la siguiente área (las celdas se actualizarán al colocar la nueva área).");
  Band++;
  if (Areas.length == Band) {
    Band = 0;
  }
}

async function intentarReorganizarArea(page) {
  const maxIntentos = 3;

  if (Band == 81) {
    return false;
  }

  for (let intento = 1; intento <= maxIntentos; intento++) {
    try {
      const celdasNoDisponibles = await page.$$eval("a.errorMsg", (links) => {
        return links
          .filter((link) =>
            link.textContent.includes(
              "Las siguientes celdas de selección no están disponibles:"
            )
          )
          .map((link) =>
            link.textContent
              .split(": ")[1]
              .split(",")
              .map((celda) => celda.trim())
          );
      });

      console.log(
        `===============================================================================================`
          .cyan.bold
      );
      // console.log(`ÁREA COMPLETA => `.magenta.bold);
      // console.log(`[${Areas[Band].Celdas}]`);
      // console.log(`CELDAS NO DISPONIBLES => `.red.bold);
      // console.log(`[${celdasNoDisponibles}]`);

      if (!celdasNoDisponibles.length || !celdasNoDisponibles[0].length) {
        console.log("No se encontraron celdas no disponibles para filtrar.");
        if (intento === 1) {
          console.log("Intentando Continuar tras error de área...");
          await clickContinuarArea(page, 1);
          const resultadoSinFiltro = await esperarResultadoMonitoreoArea(page, {
            intervaloInicial: INTERVALO_PRIMERA_REVISION_MS,
            intervaloSiguiente: INTERVALO_REVISION_AREA_MS,
            etiqueta: `Reorganización ${Areas[Band].NombreArea}`,
          });
          if (resultadoSinFiltro === "exito") {
            Correo(1, Areas[Band].NombreArea, Areas[Band].Referencia);
            return true;
          }
        }
        console.log(
          `===============================================================================================`
            .cyan.bold
        );
        break;
      }

      const celdasNoDisponiblesLimpias = celdasNoDisponibles[0].map((celda) =>
        celda.trim()
      );
      const areaCeldas = ComparacionCeldas?.length
        ? ComparacionCeldas
        : Areas[Band].Celdas[0].split(",").map((celda) => celda.trim());
      areaFiltrado = areaCeldas.filter(
        (celda) => !celdasNoDisponiblesLimpias.includes(celda)
      );
      console.log("area filtrado " + areaFiltrado);

      if (areaFiltrado.length === 0) {
        console.log(
          `===============================================================================================`
            .cyan.bold
        );
        return false;
      }

      console.log(`CELDAS DISPONIBLES => `.green.bold);
      console.log(`["${areaFiltrado.join(", ")}"],`);
      console.log(
        `===============================================================================================`
          .cyan.bold
      );

      const datos = areaFiltrado.join(", ");
      await MonitorearAreas(
        page,
        Areas[Band].NombreArea,
        Areas[Band].Referencia,
        [datos]
      );
      ComparacionCeldas = areaFiltrado;

      console.log(
        `Reorganización intento ${intento}/${maxIntentos}: clic en Continuar...`
      );
      await clickContinuarArea(page, 1);

      const resultado = await esperarResultadoMonitoreoArea(page, {
        intervaloInicial: INTERVALO_PRIMERA_REVISION_MS,
        intervaloSiguiente: INTERVALO_REVISION_AREA_MS,
        etiqueta: `Reorganización ${Areas[Band].NombreArea} #${intento}`,
      });

      if (resultado === "exito") {
        console.log("✅ Área reorganizada y página avanzó correctamente.");
        Correo(1, Areas[Band].NombreArea, Areas[Band].Referencia);
        return true;
      }

      if (resultado === "error" && intento < maxIntentos) {
        console.log("Persisten errores en celdas; reintentando reorganización...");
        continue;
      }

      if (resultado === "pendiente" || resultado === "timeout") {
        console.log("✅ Celdas reorganizadas y Continuar enviado.");
        return true;
      }

      return false;
    } catch (error) {
      console.log("Error al reorganizar las celdas del área:", error.message);
      return false;
    }
  }

  return false;
}

async function Detalles_de_area(page) {
  const continDetallesdelArea2 = await page.$x('//a[contains(.,"área")]');
  await continDetallesdelArea2[4].click();

  const grupoEtnicoYN = await page.$('input[value="N"]');
  await grupoEtnicoYN.click();
}

async function Informacion_tecnica(page) {

  const btnInfoTecnica = await page.$x('//a[contains(.,"Información t")]');
  await btnInfoTecnica[0].click();

  await page.evaluate(() => {
    document.querySelector('[id="yearOfExecutionId0"]').value = "number:1";

    angular
      .element(document.getElementById("yearOfExecutionId0"))
      .triggerHandler("change");

    document.querySelector('[id="yearOfDeliveryId0"]').value = "number:2";

    angular
      .element(document.getElementById("yearOfDeliveryId0"))
      .triggerHandler("change");

    document.querySelector('[id="laborSuitabilityId0"]').value = "IIG";

    angular
      .element(document.getElementById("laborSuitabilityId0"))
      .triggerHandler("change");

    //Contactos con la comunidad y enfoque social

    document.querySelector('[id="yearOfExecutionId1"]').value = "number:1";

    angular
      .element(document.getElementById("yearOfExecutionId1"))
      .triggerHandler("change");

    document.querySelector('[id="yearOfDeliveryId1"]').value = "number:2";

    angular
      .element(document.getElementById("yearOfDeliveryId1"))
      .triggerHandler("change");

    document.querySelector('[id="laborSuitabilityId1"]').value = "TSCA";

    angular
      .element(document.getElementById("laborSuitabilityId1"))
      .triggerHandler("change");

    //Base topográfica del área

    document.querySelector('[id="yearOfExecutionId2"]').value = "number:1";

    angular
      .element(document.getElementById("yearOfExecutionId2"))
      .triggerHandler("change");

    document.querySelector('[id="yearOfDeliveryId2"]').value = "number:2";

    angular
      .element(document.getElementById("yearOfDeliveryId2"))
      .triggerHandler("change");

    document.querySelector('[id="laborSuitabilityId2"]').value = "IIG";

    angular
      .element(document.getElementById("laborSuitabilityId2"))
      .triggerHandler("change");

    //Cartografía geológica

    document.querySelector('[id="yearOfExecutionId3"]').value = "number:1";

    angular
      .element(document.getElementById("yearOfExecutionId3"))
      .triggerHandler("change");

    document.querySelector('[id="yearOfDeliveryId3"]').value = "number:2";

    angular
      .element(document.getElementById("yearOfDeliveryId3"))
      .triggerHandler("change");

    document.querySelector('[id="laborSuitabilityId3"]').value = "IIG";

    angular
      .element(document.getElementById("laborSuitabilityId3"))
      .triggerHandler("change");

    //Excavación de trincheras y apiques

    document.querySelector('[id="yearOfExecutionId4"]').value = "number:2";

    angular
      .element(document.getElementById("yearOfExecutionId4"))
      .triggerHandler("change");

    document.querySelector('[id="yearOfDeliveryId4"]').value = "number:2";

    angular
      .element(document.getElementById("yearOfDeliveryId4"))
      .triggerHandler("change");

    document.querySelector('[id="laborSuitabilityId4"]').value = "IIG";

    angular
      .element(document.getElementById("laborSuitabilityId4"))
      .triggerHandler("change");

    //Geoquímica y otros análisis

    document.querySelector('[id="yearOfExecutionId5"]').value = "number:2";

    angular
      .element(document.getElementById("yearOfExecutionId5"))
      .triggerHandler("change");

    document.querySelector('[id="yearOfDeliveryId5"]').value = "number:2";

    angular
      .element(document.getElementById("yearOfDeliveryId5"))
      .triggerHandler("change");

    document.querySelector('[id="laborSuitabilityId5"]').value = "IIG";

    angular
      .element(document.getElementById("laborSuitabilityId5"))
      .triggerHandler("change");

    //Geofísica

    document.querySelector('[id="yearOfExecutionId6"]').value = "number:2";

    angular
      .element(document.getElementById("yearOfExecutionId6"))
      .triggerHandler("change");

    document.querySelector('[id="yearOfDeliveryId6"]').value = "number:2";

    angular
      .element(document.getElementById("yearOfDeliveryId6"))
      .triggerHandler("change");

    document.querySelector('[id="laborSuitabilityId6"]').value = "IIG";

    angular
      .element(document.getElementById("laborSuitabilityId6"))
      .triggerHandler("change");

    //Estudio de dinámica fluvial del cauce

    document.querySelector('[id="yearOfExecutionId7"]').value = "number:2";

    angular
      .element(document.getElementById("yearOfExecutionId7"))
      .triggerHandler("change");

    document.querySelector('[id="yearOfDeliveryId7"]').value = "number:2";

    angular
      .element(document.getElementById("yearOfDeliveryId7"))
      .triggerHandler("change");

    document.querySelector('[id="laborSuitabilityId7"]').value = "IIG";

    angular
      .element(document.getElementById("laborSuitabilityId7"))
      .triggerHandler("change");

    // Características hidrológicas y sedimentológicas del cauce

    document.querySelector('[id="yearOfExecutionId8"]').value = "number:2";

    angular
      .element(document.getElementById("yearOfExecutionId8"))
      .triggerHandler("change");

    document.querySelector('[id="yearOfDeliveryId8"]').value = "number:2";

    angular
      .element(document.getElementById("yearOfDeliveryId8"))
      .triggerHandler("change");

    document.querySelector('[id="laborSuitabilityId8"]').value = "IIG";

    angular
      .element(document.getElementById("laborSuitabilityId8"))
      .triggerHandler("change");

    //Pozos y Galerías Exploratorias

    document.querySelector('[id="yearOfExecutionId9"]').value = "number:2";

    angular
      .element(document.getElementById("yearOfExecutionId9"))
      .triggerHandler("change");

    document.querySelector('[id="yearOfDeliveryId9"]').value = "number:2";

    angular
      .element(document.getElementById("yearOfDeliveryId9"))
      .triggerHandler("change");

    document.querySelector('[id="laborSuitabilityId9"]').value = "IIG";

    angular
      .element(document.getElementById("laborSuitabilityId9"))
      .triggerHandler("change");

    //Perforaciones profundas

    document.querySelector('[id="yearOfExecutionId10"]').value = "number:2";

    angular
      .element(document.getElementById("yearOfExecutionId10"))
      .triggerHandler("change");

    document.querySelector('[id="yearOfDeliveryId10"]').value = "number:2";

    angular
      .element(document.getElementById("yearOfDeliveryId10"))
      .triggerHandler("change");

    document.querySelector('[id="laborSuitabilityId10"]').value = "IIG";

    angular
      .element(document.getElementById("laborSuitabilityId10"))
      .triggerHandler("change");

    //Muestreo y análisis de calidad

    document.querySelector('[id="yearOfExecutionId11"]').value = "number:2";

    angular
      .element(document.getElementById("yearOfExecutionId11"))
      .triggerHandler("change");

    document.querySelector('[id="yearOfDeliveryId11"]').value = "number:2";

    angular
      .element(document.getElementById("yearOfDeliveryId11"))
      .triggerHandler("change");

    document.querySelector('[id="laborSuitabilityId11"]').value = "IIG";

    angular
      .element(document.getElementById("laborSuitabilityId11"))
      .triggerHandler("change");

    //Estudio geotécnico

    document.querySelector('[id="yearOfExecutionId12"]').value = "number:2";

    angular
      .element(document.getElementById("yearOfExecutionId12"))
      .triggerHandler("change");

    document.querySelector('[id="yearOfDeliveryId12"]').value = "number:2";

    angular
      .element(document.getElementById("yearOfDeliveryId12"))
      .triggerHandler("change");

    document.querySelector('[id="laborSuitabilityId12"]').value = "IIG";

    angular
      .element(document.getElementById("laborSuitabilityId12"))
      .triggerHandler("change");

    //Estudio Hidrológico

    document.querySelector('[id="yearOfExecutionId13"]').value = "number:2";

    angular
      .element(document.getElementById("yearOfExecutionId13"))
      .triggerHandler("change");

    document.querySelector('[id="yearOfDeliveryId13"]').value = "number:2";

    angular
      .element(document.getElementById("yearOfDeliveryId13"))
      .triggerHandler("change");

    document.querySelector('[id="laborSuitabilityId13"]').value = "IIG";

    angular
      .element(document.getElementById("laborSuitabilityId13"))
      .triggerHandler("change");

    //Estudio Hidrogeológico

    document.querySelector('[id="yearOfExecutionId14"]').value = "number:2";

    angular
      .element(document.getElementById("yearOfExecutionId14"))
      .triggerHandler("change");

    document.querySelector('[id="yearOfDeliveryId14"]').value = "number:2";

    angular
      .element(document.getElementById("yearOfDeliveryId14"))
      .triggerHandler("change");

    document.querySelector('[id="laborSuitabilityId14"]').value = "IIG";

    angular
      .element(document.getElementById("laborSuitabilityId14"))
      .triggerHandler("change");

    //Evaluación del modelo geológico

    document.querySelector('[id="yearOfExecutionId15"]').value = "number:3";

    angular
      .element(document.getElementById("yearOfExecutionId15"))
      .triggerHandler("change");

    document.querySelector('[id="yearOfDeliveryId15"]').value = "number:3";

    angular
      .element(document.getElementById("yearOfDeliveryId15"))
      .triggerHandler("change");

    document.querySelector('[id="laborSuitabilityId15"]').value = "IIG";

    angular
      .element(document.getElementById("laborSuitabilityId15"))
      .triggerHandler("change");

    //Actividades exploratorias adicionales (Se describe en el anexo Tecnico que se allegue)

    document.querySelector('[id="yearOfExecutionId16"]').value = "number:3";

    angular
      .element(document.getElementById("yearOfExecutionId16"))
      .triggerHandler("change");

    document.querySelector('[id="yearOfDeliveryId16"]').value = "number:3";

    angular
      .element(document.getElementById("yearOfDeliveryId16"))
      .triggerHandler("change");

    document.querySelector('[id="laborSuitabilityId16"]').value = "IIG";

    angular
      .element(document.getElementById("laborSuitabilityId16"))
      .triggerHandler("change");

    // Actividades Ambientales etapa de exploración

    //Selección optima de Sitios de Campamentos y Helipuertos

    angular
      .element(document.getElementById("envYearOfDeliveryId0"))
      .triggerHandler("change");

    document.querySelector('[id="envLaborSuitabilityId0"]').value = "MULT";

    angular
      .element(document.getElementById("envLaborSuitabilityId0"))
      .triggerHandler("change");

    //Manejo de Aguas Lluvias

    angular
      .element(document.getElementById("envYearOfDeliveryId1"))
      .triggerHandler("change");

    document.querySelector('[id="envLaborSuitabilityId1"]').value = "MULT";

    angular
      .element(document.getElementById("envLaborSuitabilityId1"))
      .triggerHandler("change");

    //Manejo de Aguas Residuales Domesticas

    angular
      .element(document.getElementById("envYearOfDeliveryId2"))
      .triggerHandler("change");

    document.querySelector('[id="envLaborSuitabilityId2"]').value = "MULT";

    angular
      .element(document.getElementById("envLaborSuitabilityId2"))
      .triggerHandler("change");

    //Manejo de Cuerpos de Agua

    angular
      .element(document.getElementById("envYearOfDeliveryId3"))
      .triggerHandler("change");

    document.querySelector('[id="envLaborSuitabilityId3"]').value = "MULT";

    angular
      .element(document.getElementById("envLaborSuitabilityId3"))
      .triggerHandler("change");

    //Manejo de Material Particulado y Gases

    angular
      .element(document.getElementById("envYearOfDeliveryId4"))
      .triggerHandler("change");

    document.querySelector('[id="envLaborSuitabilityId4"]').value = "MULT";

    angular
      .element(document.getElementById("envLaborSuitabilityId4"))
      .triggerHandler("change");

    //Manejo del Ruido

    angular
      .element(document.getElementById("envYearOfDeliveryId5"))
      .triggerHandler("change");

    document.querySelector('[id="envLaborSuitabilityId5"]').value = "MULT";

    angular
      .element(document.getElementById("envLaborSuitabilityId5"))
      .triggerHandler("change");

    // Manejo de Combustibles

    angular
      .element(document.getElementById("envYearOfDeliveryId6"))
      .triggerHandler("change");

    document.querySelector('[id="envLaborSuitabilityId6"]').value = "MULT";

    angular
      .element(document.getElementById("envLaborSuitabilityId6"))
      .triggerHandler("change");

    //Manejo de Taludes

    angular
      .element(document.getElementById("envYearOfDeliveryId7"))
      .triggerHandler("change");

    document.querySelector('[id="envLaborSuitabilityId7"]').value = "MULT";

    angular
      .element(document.getElementById("envLaborSuitabilityId7"))
      .triggerHandler("change");

    //Manejo de Accesos

    angular
      .element(document.getElementById("envYearOfDeliveryId8"))
      .triggerHandler("change");

    document.querySelector('[id="envLaborSuitabilityId8"]').value = "MULT";

    angular
      .element(document.getElementById("envLaborSuitabilityId8"))
      .triggerHandler("change");

    // Manejo de Residuos Solidos

    angular
      .element(document.getElementById("envYearOfDeliveryId9"))
      .triggerHandler("change");

    document.querySelector('[id="envLaborSuitabilityId9"]').value = "MULT";

    angular
      .element(document.getElementById("envLaborSuitabilityId9"))
      .triggerHandler("change");

    //Adecuación y Recuperación de Sitios de Uso Temporal

    angular
      .element(document.getElementById("envYearOfDeliveryId10"))
      .triggerHandler("change");

    document.querySelector('[id="envLaborSuitabilityId10"]').value = "MULT";

    angular
      .element(document.getElementById("envLaborSuitabilityId10"))
      .triggerHandler("change");

    //Manejo de Fauna y Flora

    angular
      .element(document.getElementById("envYearOfDeliveryId11"))
      .triggerHandler("change");

    document.querySelector('[id="envLaborSuitabilityId11"]').value = "IFEB";

    angular
      .element(document.getElementById("envLaborSuitabilityId11"))
      .triggerHandler("change");

    //Plan de Gestión Social

    angular
      .element(document.getElementById("envYearOfDeliveryId12"))
      .triggerHandler("change");

    document.querySelector('[id="envLaborSuitabilityId12"]').value = "TSCA";

    angular
      .element(document.getElementById("envLaborSuitabilityId12"))
      .triggerHandler("change");

    //capacitación de Personal

    angular
      .element(document.getElementById("envYearOfDeliveryId13"))
      .triggerHandler("change");

    document.querySelector('[id="envLaborSuitabilityId13"]').value = "MULT";

    angular
      .element(document.getElementById("envLaborSuitabilityId13"))
      .triggerHandler("change");

    //Contratación de Mano de Obra no Calificada

    angular
      .element(document.getElementById("envYearOfDeliveryId14"))
      .triggerHandler("change");

    document.querySelector('[id="envLaborSuitabilityId14"]').value = "MULT";

    angular
      .element(document.getElementById("envLaborSuitabilityId14"))
      .triggerHandler("change");

    //Rescate Arqueológico

    angular
      .element(document.getElementById("envYearOfDeliveryId15"))
      .triggerHandler("change");

    document.querySelector('[id="envLaborSuitabilityId15"]').value = "ARQ";

    angular
      .element(document.getElementById("envLaborSuitabilityId15"))
      .triggerHandler("change");

    //Manejo de Hundimientos

    angular
      .element(document.getElementById("envYearOfDeliveryId16"))
      .triggerHandler("change");

    document.querySelector('[id="envLaborSuitabilityId16"]').value = "MULT";

    angular
      .element(document.getElementById("envLaborSuitabilityId16"))
      .triggerHandler("change");
  });
}

async function Profesionales(page, Eventos) {


  // SELECCIÓN DE PROFESIONALES => CONTADOR(ES), GEÓLOGO(S), INGENIERO(S) GEÓLOGO(S), INGENIERO(S) DE MINAS
  // ==============================================================================
  console.log("INICIA LA SELECCIÓN DE LOS PROFESIONALES");
  console.log(
    "================================================================"
  );
  // let profesionales = [
  //   { tipo: "Geólogo", nombres: ["Oscar Javier Pinilla Reyes (73619)"] },
  //   //  { tipo: "Ingeniero Geólogo", nombres: [""]},
  //   //  { tipo: "Ingeniero de Minas", nombres: [""]}
  // ];

  await seleccionar_Profesional(Datos_Geologos, page, 1, Eventos);

  // Hacer clic en el botón "Agregar"
  const addProfesional = await page.$x('//span[contains(.,"Agregar")]');
  await addProfesional[0].click();

  console.log(
    "================================================================"
  );
  console.log("FIN DE LA SELECCIÓN DE LOS PROFESIONALES");
  // =============================================================================
  if (Eventos == 0) {
    // Acepta terminos y da clic en continuar
    await page.click("#technicalCheckboxId");
  }

  const btnInfoEconomica = await page.$x(
    '//a[contains(.,"Información eco")]'
  );
  await btnInfoEconomica[0].click();

  // SELECCIÓN DEL CONTADOR
  // ==============================================================================
  console.log("INICIA LA SELECCIÓN DE CONTADOR(ES)");
  console.log(
    "================================================================"
  );
  // let Contador_es = [
  //   { tipo: "Contador", nombres: ["PABLO ESTEBAN MONTOYA MONTOYA (91124)"] },
  // ];

  await seleccionar_Profesional(Datos_Contadores, page, 2, Eventos);

  console.log(
    "================================================================"
  );
  console.log("FIN DE LA SELECCIÓN DE CONTADOR(ES)");

}

async function Informacion_financiera(page) {

  await page.select("#personClassificationId0", Datos_Empresa.TipoUsuario);
  //sE MANEJA DUALIDAD DSDE EL .ENV PARA CUANDO SON PERSONAS NATURALES O EMPRESAS
  // await page.select("#personClassificationId0", "PN");
  // await page.select("#personClassificationId0", "PJ");
  console.log(Datos_Economicos);

  await page.evaluate((Datos_Economicos) => {
    // console.log(Datos_Empresa);


    document.getElementById("activoCorrienteId0").value = Datos_Economicos.activoCorrienteId0;

    angular
      .element(document.getElementById("activoCorrienteId0"))
      .triggerHandler("change");

    document.getElementById("pasivoCorrienteId0").value = Datos_Economicos.pasivoCorrienteId0;

    angular
      .element(document.getElementById("pasivoCorrienteId0"))
      .triggerHandler("change");
    document.getElementById("activoTotalId0").value = Datos_Economicos.activoTotalId0;

    angular
      .element(document.getElementById("activoTotalId0"))
      .triggerHandler("change");

    document.getElementById("pasivoTotalId0").value = Datos_Economicos.pasivoTotalId0;

    angular
      .element(document.getElementById("pasivoTotalId0"))
      .triggerHandler("change");
  }, Datos_Economicos);

  const continPag4 = await page.$x('//span[contains(.,"Continuar")]');
  await continPag4[1].click();

}

async function Certificado_Shapefile(page, Empresa, IdArea) {
  // Subir Shapefile
  console.log(IdArea);

  try {
    let btncenti = await page.$x('//a[contains(.,"Certificac")]');
    await btncenti[0].click();

    await page.waitForSelector(`#p_CaaCataEnvMandatoryDocumentToAttachId0`);
    const RutadeShapefile = `./Documentos/${Empresa}/Sheips/${IdArea}.zip`;
    const ControladorDeCargaShapefile = await page.$(`#p_CaaCataEnvMandatoryDocumentToAttachId0`);
    await ControladorDeCargaShapefile.uploadFile(RutadeShapefile);


  } catch (error) {
    console.log("No se encontró el shapefile");
    let btncenti = await page.$x('//a[contains(.,"Certificac")]');
    await btncenti[0].click();

    await page.waitForSelector(`#p_CaaCataEnvMandatoryDocumentToAttachId0`);
    const RutadeShapefile = `./Documentos/${Empresa}/Sheips/Sector_${Empresa}.zip`;
    const ControladorDeCargaShapefile = await page.$(`#p_CaaCataEnvMandatoryDocumentToAttachId0`);
    await ControladorDeCargaShapefile.uploadFile(RutadeShapefile);

  }

  try {

    // Subir certificado
    let ArchivoAmbiental;
    ArchivoAmbiental = `./Documentos/${Empresa}/CertificadoAmbiental/${IdArea}.pdf`;


    await page.waitForSelector(`#p_CaaCataEnvMandatoryDocumentToAttachId1`);
    const RutaDelCertificado = ArchivoAmbiental;
    const ControladorCargaCertificado = await page.$(`#p_CaaCataEnvMandatoryDocumentToAttachId1`);
    await ControladorCargaCertificado.uploadFile(RutaDelCertificado);
  } catch (error) {
    console.log("No se encontró el certificado ambiental");
    let ArchivoAmbiental;
    ArchivoAmbiental = `./Documentos/${Empresa}/CertificadoAmbiental/Certificado_Ambiental.pdf`;


    await page.waitForSelector(`#p_CaaCataEnvMandatoryDocumentToAttachId1`);
    const RutaDelCertificado = ArchivoAmbiental;
    const ControladorCargaCertificado = await page.$(`#p_CaaCataEnvMandatoryDocumentToAttachId1`);
    await ControladorCargaCertificado.uploadFile(RutaDelCertificado);
  }


}


async function Documentos_Persona_Natural(page, Empresa) {

  try {


    // await page.waitForTimeout(300);
    await page.click("#acceptanceOfTermsId");
    // await page.waitForTimeout(300);

    const btnDocuSopor = await page.$x('//a[contains(.,"Documentac")]');
    await btnDocuSopor[0].click();
    console.log("si llego");
    await page.waitForTimeout(300);

    console.log("INICIA PROCESO DE ADJUNTAR DOCUMENTOS REGLAMENTARIOS");
    console.log(
      "================================================================"
    );

    let Documentos = [
      "1. Aceptacion Del Profesional Para Refrendar Documentos Tecnicos.pdf",//1
      "2. Fotocopia Tarjeta Profesional.pdf",//2
      "4. Declaracion De Renta Proponente 1 Anio 1.pdf",//3
      "5. Declaracion De Renta Proponente 1 Anio 2.pdf",//4
      "6. Estados Financieros Propios Certificados Y O Dictaminados Proponente 1 Anio 1.pdf",//5
      "7. Estados Financieros Propios Certificados Y O Dictaminados Proponente 1 Anio 2.pdf",//6
      "8. Extractos Bancarios Proponente 1.pdf",//7
      "9. RUT.pdf",//8
      "10. Fotocopia Documento De Identificacion.pdf",//9
      "13. Certificado Vigente De Antecedentes Disciplinarios.pdf",//10
      "14. Fotocopia Tarjeta Profesional Del Contador Revisor Fiscal.pdf",//11

    ];

    let ElementosFile = [
      "p_CaaCataMandatoryDocumentToAttachId0",//1
      "p_CaaCataMandatoryDocumentToAttachId1",//2
      "p_CaaCataMandatoryDocumentToAttachId3",//3
      "p_CaaCataMandatoryDocumentToAttachId4",//4
      "p_CaaCataMandatoryDocumentToAttachId5",//5
      "p_CaaCataMandatoryDocumentToAttachId6",//6
      "p_CaaCataMandatoryDocumentToAttachId7",//7
      "p_CaaCataMandatoryDocumentToAttachId8",//8
      "p_CaaCataMandatoryDocumentToAttachId9",//9
      "p_CaaCataMandatoryDocumentToAttachId10",//10
      "p_CaaCataMandatoryDocumentToAttachId11",//11
      //  "p_CaaCataMandatoryDocumentToAttachId12",//12
    ];
    console.log(ElementosFile.length);
    try {
      for (let i = 0; i < ElementosFile.length; i++) {
        try {
          await page.waitForSelector(`#${ElementosFile[i]}`);
          const RutaDelArchivo = `./Documentos/${Empresa}/DocumentosReglamentarios/${Documentos[i]}`;
          const ElementoControladorDeCarga = await page.$(
            `#${ElementosFile[i]}`
          );
          await ElementoControladorDeCarga.uploadFile(RutaDelArchivo);

          // Verificar si el archivo se cargó correctamente
          console.log(`Archivo ${Documentos[i]} adjuntado correctamente.`);
        } catch (error) {
          console.log(`Error al cargar el archivo ${Documentos[i]}:`, error);

          // Detener el bucle o manejar el error como sea necesario
          throw new Error(`Error al cargar el archivo ${Documentos[i]}`);
        }
      }
      console.log("sadas");
    } catch (error) {
      console.error("Error general al adjuntar archivos:", error);
    }

    console.log(
      "================================================================"
    );
    console.log("FINALIZA PROCESO DE ADJUNTAR DOCUMENTOS REGLAMENTARIOS");


  } catch (error) {
    console.log("BOTO ERROR");
  }

}


async function Documentos_Persona_juridica(page, Empresa) {

  try {


    // await page.waitForTimeout(300);
    await page.click("#acceptanceOfTermsId");
    // await page.waitForTimeout(300);

    const btnDocuSopor = await page.$x('//a[contains(.,"Documentac")]');
    await btnDocuSopor[0].click();
    console.log("si llego");
    await page.waitForTimeout(300);

    console.log("INICIA PROCESO DE ADJUNTAR DOCUMENTOS REGLAMENTARIOS");
    console.log(
      "================================================================"
    );

    let Documentos = [
      "1. Aceptacion Del Profesional Para Refrendar Documentos Tecnicos.pdf", //1
      "2. Fotocopia Tarjeta Profesional.pdf", //2
      "4. Declaracion De Renta Proponente 1 Anio 1.pdf", //3
      "5. Declaracion De Renta Proponente 1 Anio 2.pdf", //4
      "6. Estados Financieros Propios Certificados Y O Dictaminados Proponente 1 Anio 1.pdf", //5
      "7. Estados Financieros Propios Certificados Y O Dictaminados Proponente 1 Anio 2.pdf", //6
      "8. Extractos Bancarios Proponente 1.pdf", //7
      "9. RUT.pdf", //8
      "10. Fotocopia Documento De Identificacion.pdf", //9
      "11. Certificado De Composicion Accionaria De La Sociedad.pdf", //10
      "12. Certificado De Existencia Y Representacion Legal.pdf", //11
      "13. Certificado Vigente De Antecedentes Disciplinarios.pdf", //12
      "14. Fotocopia Tarjeta Profesional Del Contador Revisor Fiscal.pdf", //13
    ];

    let ElementosFile = [
      "p_CaaCataMandatoryDocumentToAttachId0", //1
      "p_CaaCataMandatoryDocumentToAttachId1", //2
      "p_CaaCataMandatoryDocumentToAttachId3", //3
      "p_CaaCataMandatoryDocumentToAttachId4", //4
      "p_CaaCataMandatoryDocumentToAttachId5", //5
      "p_CaaCataMandatoryDocumentToAttachId6", //6
      "p_CaaCataMandatoryDocumentToAttachId7", //7
      "p_CaaCataMandatoryDocumentToAttachId8", //8
      "p_CaaCataMandatoryDocumentToAttachId9", //9
      "p_CaaCataMandatoryDocumentToAttachId10", //10
      "p_CaaCataMandatoryDocumentToAttachId11", //11
      "p_CaaCataMandatoryDocumentToAttachId12", //12
      "p_CaaCataMandatoryDocumentToAttachId13", //13
      // "p_CaaCataMandatoryDocumentToAttachId14"//14
    ];
    console.log(ElementosFile.length);
    try {
      for (let i = 0; i < ElementosFile.length; i++) {
        try {
          await page.waitForSelector(`#${ElementosFile[i]}`);
          const RutaDelArchivo = `./Documentos/${Empresa}/DocumentosReglamentarios/${Documentos[i]}`;
          const ElementoControladorDeCarga = await page.$(
            `#${ElementosFile[i]}`
          );
          await ElementoControladorDeCarga.uploadFile(RutaDelArchivo);

          // Verificar si el archivo se cargó correctamente
          console.log(`Archivo ${Documentos[i]} adjuntado correctamente.`);
        } catch (error) {
          console.log(`Error al cargar el archivo ${Documentos[i]}:`, error);

          // Detener el bucle o manejar el error como sea necesario
          throw new Error(`Error al cargar el archivo ${Documentos[i]}`);
        }
      }
      console.log("sadas");
    } catch (error) {
      console.error("Error general al adjuntar archivos:", error);
    }

    console.log(
      "================================================================"
    );
    console.log("FINALIZA PROCESO DE ADJUNTAR DOCUMENTOS REGLAMENTARIOS");


  } catch (error) {
    console.log("BOTO ERROR");
  }
}

async function RECAPTCHA(page) {

  try {
    // Buscar el h2 que contenga la palabra RECAPTCHA usando XPath
    const [tituloHandle] = await page.$x("//h2[contains(text(), 'RECAPTCHA')]");
    if (!tituloHandle) {
      throw new Error('No se encontró el título con texto RECAPTCHA');
    }

    console.log('✅ Título RECAPTCHA encontrado');

    // Hacer click en el título
    await tituloHandle.click();
    console.log('✅ Hice click en el título');

    // Esperar un momento para que el foco se mueva
    // // // await page.waitForTimeout(500);

    //aca comienza

    console.log('✅ Título RECAPTCHA encontrado');

    // Hacer click en el título
    await tituloHandle.click();
    console.log('✅ Hice click en el título');

    // Esperar un momento para que el foco se mueva
    await page.waitForTimeout(500);
    await page.waitForTimeout(500);
    await page.waitForTimeout(500);
    //aca termina 
    //ACA COMIENZA
    console.log('✅ Título RECAPTCHA encontrado');

    // Hacer click en el título
    await tituloHandle.click();
    console.log('✅ Hice click en el título');


    //ACATERMINA
    await page.waitForTimeout(500);
    await page.waitForTimeout(500);
    await page.waitForTimeout(500);

    // Simular presionar Tab
    await page.keyboard.press('Tab');
    console.log('✅ Presioné TAB para mover el foco');

    // Esperar un poco
    await page.waitForTimeout(100);

    // // Simular presionar Enter
    await page.keyboard.press('Enter');
    console.log('✅ Presioné ENTER para activar el reCAPTCHA');
    return 1; // Salir del bucle si todo fue exitoso
  } catch (error) {
    console.error('❌ Error:', error.message);
    await page.waitForTimeout(500); // Esperar antes de reintentar
    return 0;
  }
}

async function verificarCaptchaResuelto(page, imagendeCaptcha) {
  console.log("Chequeando si el captcha está resuelto...");
  try {
    // Verificar si el captcha está resuelto
    const isCaptchaResolved = await page.evaluate(() => {
      const responseField = document.querySelector("#g-recaptcha-response");
      return responseField && responseField.value.length > 0;
    });

    // // Verificar si aparece el texto "Continuar"
    // const posibleContinuar = await page.$x('//span[contains(.,"Continuar")]');
    // if (posibleContinuar.length > 0) {
    //   console.log("⚠️ Se encontró el botón 'Continuar' en la página.");
    //   console.log([posibleContinuar]);
    //   await posibleContinuar[1].click();
    //   await page.waitForNavigation({
    //     waitUntil: "networkidle0",
    //   });
    //   await RECAPTCHA(page);
    // }

    // Verificar si aparece el iframe de imágenes (reto del captcha)
    // const captchaIframe = await page.$('iframe[src*="bframe"]');
    // if (captchaIframe) {
    //   console.log("🖼️ El reCAPTCHA está mostrando imágenes (desafío activo).");
    //   return 2; // El captcha no está resuelto si hay un iframe de imágenes
    // }
    if (imagendeCaptcha == 0) {
      const captchaIframeHandle = await page.$('iframe[src*="bframe"]');
      if (captchaIframeHandle) {
        console.log("🖼️ El reCAPTCHA está mostrando un desafío de imágenes.");


        // Esperar a que el contenido del iframe esté listo
        const captchaFrame = await captchaIframeHandle.contentFrame();
        if (!captchaFrame) {
          console.log("⚠️ El contenido del iframe aún no está listo. Reintentando...");
        } else {
          // Intentar detectar imágenes
          const imageTiles = await captchaFrame.$$('img');
          console.log(`Se encontraron ${imageTiles.length} imágenes en el desafío.`);
        }

        return 2; // El captcha no está resuelto si hay un iframe de imágenes

      }
    }


    if (isCaptchaResolved) {
      console.log("✅ El captcha ha sido resuelto.");

      return 1;
    } else {
      console.log("❌ El captcha no ha sido resuelto aún.");
      return 0;
    }
  } catch (error) {
    console.error("❌ Error al verificar el estado del captcha:", error);
    return 0;
  }

}


function Mineria(browser, Pin,) {
  (async () => {
    let page;
    const timersActivos = [];

    try {
    console.log("Esta es la vuelta " + ContadorVueltas);
    page = await browser.newPage();

    let Primerpaso = setTimeout(() => {
      console.log("ENTRO EN EL PRIMERPASO (timeout de login manual)");

      page.close();
      Mineria(browser, Pin);
    }, 30 * 60 * 1000);
    timersActivos.push(Primerpaso);

    await Login(page);

    const radicado = await esperarDashboardYRadicar(page);

    if (!radicado) {
      console.log(
        "No se pudo radicar propuesta tras 3 intentos. Reiniciando..."
      );
      clearTimeout(Primerpaso);
      page.close();
      Mineria(browser, Pin);
      return;
    }

    clearTimeout(Primerpaso);

    let Segundopaso = null;
    if (manual != 1) {
      Segundopaso = setTimeout(() => {
        console.log("ENTRO EN EL Segundopaso");
        page.close();
        Mineria(browser, Pin);
      }, 30000);
      timersActivos.push(Segundopaso);
    }

    if (Agente == 1) {
      await Agente_Selecion_Empresa(page);
    }

    const { closestDateOption, input } = await seleccionar_Pin(page, Pin, 0);

    if (manual == 1) {
      await esperarPantallaAreas(page);
    } else if (sigueEnPantallaPin(page) || (await detectarErrorPinObligatorio(page))) {
      console.log("🔴 Sigue en pantalla PIN. Reintentando empresa y PIN...");
      await recuperarEmpresaYPin(page, Pin);
      await avanzarDesdePin(page);

      if (sigueEnPantallaPin(page) || (await detectarErrorPinObligatorio(page))) {
        console.log("No se pudo avanzar desde PIN. Reiniciando...");
        await reiniciarMineria(browser, Pin, page, timersActivos);
        return;
      }
    }

    await asegurarMineralesColocados(page, {
      timeout: 5000,
      etiqueta: "pre-áreas",
      soloSiError: true,
    });

    if (Segundopaso) clearTimeout(Segundopaso);



    // var IdArea = "";
    ContadorVueltas++;
    // var Celda = 0;

    page.setDefaultTimeout(30000);

    const selectArea = await page.$('select[name="areaOfConcessionSlct"]');
    await selectArea.type("Otro tipo de terreno");

    const continDetallesdelArea = await page.$x('//a[contains(.,"área")]');
    await continDetallesdelArea[4].click();

    const selectporCeldas = await page.$(
      'select[id="selectedCellInputMethodSlctId"]'
    );
    await selectporCeldas.type(
      "Usando el mapa de selección para dibujar un polígono o ingresar celdas"
    );



    while (true) {
      let TimeArea;

      try {
      const Pestanas = await browser.pages();
      console.log(`HAY ${Pestanas.length} PESTAÑAS ABIERTAS`);
      if (Pestanas.length >= 4) {
        EnviarCorreosParaPestanas++;
        if (EnviarCorreosParaPestanas <= 2) {
          // Se realiza envío de correo para alertar
          Correo(5, "", "");
        }
      }
      VerificarVencimientoPin(closestDateOption, input);

      if (sigueEnPantallaPin(page) || (await detectarErrorPinObligatorio(page))) {
        console.log("🔴 Detectado en pantalla PIN durante monitoreo. Recuperando...");
        await recuperarEmpresaYPin(page, Pin);
        await avanzarDesdePin(page);

        if (sigueEnPantallaPin(page) || (await detectarErrorPinObligatorio(page))) {
          await reiniciarMineria(browser, Pin, page, timersActivos);
          return;
        }
      }

      console.log("Inicia el timer de seguridad (TimeArea)");
      TimeArea = setTimeout(() => {
        console.log("ENTRO EN EL TimeArea");
        reiniciarMineriaDesdeTimer(browser, Pin, page, "TimeArea");
      }, TIMEAREA_REINICIO_MS);

      console.log("Bandera: " + Band);
      const nombreAreaActual = Areas[Band].NombreArea;
      const referenciaActual = Areas[Band].Referencia;
      console.log("NombreArea: " + nombreAreaActual);
      console.log("Referencia: " + referenciaActual);

      DetallesCompletos = await MonitorearAreas(
        page,
        Areas[Band].NombreArea,
        Areas[Band].Referencia,
        Areas[Band].Celdas
      );

      ComparacionCeldas = DetallesCompletos.AreaCeldas;
      await clickContinuarArea(page, 1);

      console.log(
        `Monitoreando área ${Areas[Band].NombreArea} durante ${MONITOREO_AREA_MS / 1000} segundos...`
      );
      let resultado = await esperarResultadoMonitoreoArea(page, {
        etiqueta: Areas[Band].NombreArea,
      });
      let areaCompletada = false;

      if (resultado === "exito") {
        console.log("✅ La URL esperada ya está activa");
        Correo(1, Areas[Band].NombreArea, Areas[Band].Referencia);
        areaCompletada = true;
      } else if (resultado === "reopen") {
        console.log("Mensaje que contiene CELL_REOPENING_DATE encontrado");
        if (contreapertura < 2) {
          Correo(3, Areas[Band].NombreArea, Areas[Band].Referencia);
        }
        contreapertura++;
        await pasarSiguienteArea(page);
      } else if (resultado === "error") {
        console.log("Se encontraron errores o celdas no disponibles");

        const spans = await page.$$eval("span", (els) =>
          els.map((el) => el.textContent.trim())
        );
        if (
          spans.includes(
            "Vea los errores a continuación (dentro de las pestañas):"
          )
        ) {
          console.log("Hay errores (se mantienen las celdas hasta la siguiente área).");
        }

        areaCompletada = await intentarReorganizarArea(page);
        if (!areaCompletada) {
          await pasarSiguienteArea(page);
        }
      } else {
        console.log(
          `Pasaron ${MONITOREO_AREA_MS / 1000} segundos sin respuesta. Pasando a la siguiente área.`
        );
        await pasarSiguienteArea(page);
      }

      if (areaCompletada) {
        clearTimeout(TimeArea);
        break;
      }

      console.log(
        `Esperando ${ESPERA_ENTRE_AREAS_MS / 1000} segundos antes de la siguiente área (validando cada ${INTERVALO_REVISION_ENTRE_AREAS_MS / 1000}s)...`
      );
      const resultadoEntreAreas = await esperarEntreAreas(page, {
        etiqueta: `Espera - ${nombreAreaActual}`,
      });

      if (resultadoEntreAreas === "exito") {
        Correo(1, nombreAreaActual, referenciaActual);
        clearTimeout(TimeArea);
        break;
      }

      if (resultadoEntreAreas === "reorganizado") {
        clearTimeout(TimeArea);
        break;
      }

      console.log("limpia el timer");
      clearTimeout(TimeArea);

      } catch (error) {
        console.error("❌ Error en monitoreo de áreas:", error.message);
        if (TimeArea) clearTimeout(TimeArea);
        if (estaEnFlujoRadicacion(page)) {
          console.log(
            "✅ Ya pasó a radicar; continuando el wizard sin reiniciar."
          );
          break;
        }
        await reiniciarMineria(browser, Pin, page, [
          ...timersActivos,
          TimeArea,
        ]);
        return;
      }

    }


    let TimeNOpaso = setTimeout(() => {
      bandera = 99;
      console.log("ENTRO EN EL TimeNOpaso");
      page.close();
      Mineria(browser, Pin);
    }, 20000);


    // while (bandera != 99) {
    //   await page.waitForTimeout(500);
    //   console.log(page.url());
    //   if (
    //     page.url() ==
    //     "https://annamineria.anm.gov.co/sigm/index.html#/p_CaaIataInputTechnicalEconomicalDetails"
    //   ) {
    //     bandera = 99;

    //     console.log("Si cargo la pagina  ");
    //     clearTimeout(TimeNOpaso);
    //   } else {
    //     console.log("Nada no la carga ");
    //   }
    // }


    clearTimeout(TimeNOpaso);
    let RadiPrimero = setTimeout(() => {
      console.log("ENTRO EN EL RadiPrimero");
      reiniciarMineriaDesdeTimer(browser, Pin, page, "RadiPrimero");
    }, 30000);

    try {
      await Detalles_de_area(page);
    } catch (error) {
      await Detalles_de_area(page);
    }

    try {
      await Informacion_tecnica(page);
    } catch (error) {
      await Informacion_tecnica(page);
    }

    try {
      await Profesionales(page, 0);
    } catch (error) {
      await Profesionales(page, 0);
    }

    try {
      await Informacion_financiera(page);
    } catch (error) {
      await Informacion_financiera(page);
    }

    try {
      await page.waitForFunction(
        url => window.location.href === url,
        { timeout: 4000 },
        "https://annamineria.anm.gov.co/sigm/index.html#/p_CaaIataAttachDocuments"
      );

      console.log("✅ La URL esperada ya está activa");

    } catch (error) {
      console.log("Error al esperar la URL esperada:");

      try {
        await page.waitForFunction(() => {
          return Array.from(document.querySelectorAll("span"))
            .some(el => el.textContent.trim() === "Vea los errores a continuación (dentro de las pestañas):");
        }, { timeout: 2000 });

        console.log("Se encontraron errores en la página");
        const btnInfoTecnica = await page.$x('//a[contains(.,"Información t")]');
        await btnInfoTecnica[0].click();
        await Profesionales(page, 1);
        await Informacion_financiera(page);
        try {
          await page.waitForFunction(
            url => window.location.href === url,
            { timeout: 2000 },
            "https://annamineria.anm.gov.co/sigm/index.html#/p_CaaIataAttachDocuments"
          );
          console.log("✅ La URL esperada ya está activa");
        } catch (error) {
          console.log("Error al esperar la URL esperada:");
        }
      } catch (error) {
        console.log("Error al esperar los errores en la página:");
      }
    }

    console.log("Vamos a adjuntar los documentos");




    clearTimeout(RadiPrimero);
    let Radisegundo = setTimeout(() => {
      console.log("ENTRO EN EL Radisegundo");
      //page.close();
      Mineria(browser, Pin);
    }, 10000);


    await Certificado_Shapefile(page, Empresa, Areas[Band].NombreArea);




    if (Datos_Empresa.TipoUsuario === 'PJ') {
      await Documentos_Persona_juridica(page, Empresa);

    } else {
      await Documentos_Persona_Natural(page, Empresa);

    }

    const continPag = await page.$x('//span[contains(.,"Continuar")]');
    await continPag[1].click();

    clearTimeout(Radisegundo);
    await page.waitForNavigation({
      waitUntil: "networkidle0",
    });
    console.log(" si navego ");




    let RadiTercero = setTimeout(() => {
      console.log("ENTRO EN EL Radisegundo");
      //page.close();
      Mineria(browser, Pin);
    }, 120000);

    //  await page.waitForTimeout(1000000);


    while (true) {

      let resultado = await RECAPTCHA(page);
      if (resultado == 1) {
        break;
      }

    }

    var imagendeCaptcha = 0;
    while (true) {
      await page.waitForTimeout(1500);

      if (page.url() === 'https://annamineria.anm.gov.co/sigm/index.html#/p_CaaIataSummary') {
        let resultado = await verificarCaptchaResuelto(page, imagendeCaptcha);
        if (resultado === 1) {
          clearTimeout(RadiTercero);
          break;
        } else if (resultado === 2) {
          console.log("El captcha sigue en modo reto de imagenes");
          Correo(6, Areas[Band].NombreArea, Areas[Band].Referencia);
          // lO RETIRO PORQUE NO VALE LA PENA
          // Mineria(browser, Pin);
          imagendeCaptcha = 1;
        } else {
          // await RECAPTCHA(page);
        }

      } else if (page.url() === 'https://annamineria.anm.gov.co/sigm/index.html#/p_CaaIataAttachDocuments') {
        const posibleContinuar = await page.$x('//span[contains(.,"Continuar")]');
        if (posibleContinuar.length > 0) {
          console.log("⚠️ Se encontró el botón 'Continuar' en la página.");
          console.log([posibleContinuar]);
          await posibleContinuar[1].click();
          await page.waitForNavigation({
            waitUntil: "networkidle0",
          });
          await RECAPTCHA(page);
        }
      }
    }

    // await page.waitForTimeout(1000000);

    console.log("51. Bóton Radicar");

    const btnRadicar1 = await page.$x('//span[contains(.,"Radicar")]');
    console.log("Este es el boton radicar : " + btnRadicar1);

    console.log("Le di click");

    try {
      await btnRadicar1[1].click();
    } catch (exepcion) {
      console.log("La 1 tampoco Y_Y");
    }


    //CORREO RADICACION
    Correo(2, Areas[Band].NombreArea, Areas[Band].Referencia);
    await page.waitForTimeout(180000);
    Mineria(browser, Pin);

    } catch (error) {
      console.error("❌ Error fatal en Mineria:", error.message);
      if (estaEnFlujoRadicacion(page)) {
        console.log(
          "✅ Error en flujo de radicación; no se reinicia para no perder el avance."
        );
        return;
      }
      if (await debeOmitirReinicioModoManual(page)) {
        console.log(
          "✅ Modo manual: error durante navegación; no se reinicia. Espere o navegue hasta áreas."
        );
        return;
      }
      await reiniciarMineria(browser, Pin, page, timersActivos);
    }
  })();
}

// FUNCIÓN PARA ENVÍO DE CORREO SEGÚN LA SITUACIÓN
function Correo(Tipo, Area, Celda) {
  // 1. Liberada 2. radicada 3. Fecha reapertura
  let msg = ""; 
  let Color = "";
  let Texto = "";
  //Area = "Tranquilos area de prueba";
  if (Tipo == 1) {
    msg =
      `¡¡¡Posible Area Liberada!!! ${EquipoActual} ${Area} ${Empresa}`;
    Color = "#0eff16ff";
    Texto = "POSIBLE AREA LIBERADA";
  } else if (Tipo == 2) {
    msg =
      `Area Radicada  ${EquipoActual} ${Area} ${Empresa}`;
    Color = "#D4AF37";
    Texto = "POSIBLE AREA RADICADA";
  } else if (Tipo == 3) {
    msg =
      `¡¡¡Area Con fecha de Reapertura!!! ${EquipoActual} ${Area} ${Empresa}`;
    Color = "#427345ff";
    Texto = "AREA CON REAPERTURA";
  } else if (Tipo == 4) {
    msg = Area + " " + Empresa + " ¡¡¡Verificar!!!!.";
  } else if (Tipo == 5) {
    msg = "¡¡¡Ojo Pestañas!!! " + EquipoActual;
    Color = "#fe1426";
    Texto = "Pestañas";
  } else if (Tipo == 6) {
    msg =
      `Rapido aparecio un recaptcha   ${EquipoActual}`;
    Color = "rgba(180, 33, 170, 1)";
    Texto = "RECAPTCHA RECAPTCHA RECAPTCHA";
  }else if (Tipo == 7) {
    msg = "LOGIN";
    Color = "#fe1426";
    Texto = "😡😡AVISO llevo 1:00 minutos en login😡😡😡😡😡😡";
  }



  let transporter = nodemailer.createTransport({
    host: "mail.ceere.net", // hostname
    secureConnection: false,
    port: 465,
    tls: {
      ciphers: "SSLv3",
    },
    auth: {
      user: "correomineria2@ceere.net",
      pass: "1998Ceere*",
    },
  });

  let mailOptions = {
    from: msg + '"Ceere" <correomineria2@ceere.net>', //Deje eso quieto Outlook porne demasiados problemas
    to: "jorgecalle@hotmail.com, jorgecaller@gmail.com, alexisaza@hotmail.com,  ceereweb@gmail.com, Soporte2ceere@gmail.com, soportee4@gmail.com, soporte.ceere06068@gmail.com",
    //to: '  Soporte2ceere@gmail.com',
    subject: "LA AREA ES-> " + Area,
    text: "LA AREA ES->  " + Area + "  " + Celda,
    html: `
            <html>
                <head>
                    <style>
                        .container {
                            font-family: Arial, sans-serif;
                            max-width: 600px;
                            margin: auto;
                            padding: 20px;
                            border: 1px solid #ddd;
                            border-radius: 5px;
                            background-color: #f9f9f9;
                        }
                        .header {
                            background-color: ${Color};
                            color: white;
                            padding: 10px;
                            text-align: center;
                            border-radius: 5px 5px 0 0;
                        }
                        .content {
                            margin: 20px 0;
                        }
                        .footer {
                            text-align: center;
                            padding: 10px;
                            font-size: 12px;
                            color: #777;
                            border-top: 1px solid #ddd;
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h3> ${Texto} </h3>
                        </div>
                        <div class="content">
                            <p><strong>Detalles:</strong></p>
                            <ul>
                                <li><strong>Empresa: </strong><br>${Empresa}</li>
                                <li><strong>Area:</strong><br>${Area}</li>
                                <li><strong>Celda:</strong><br>${Celda}</li>
                            <li><strong>Equipo Actual:</strong><br>${EquipoActual}</li>
                            </ul>
                        </div>
                        <div class="footer">
                            <p>Creado por Ceere Software - © 2024 Todos los derechos reservados</p>
                        </div>
                    </div>
                </body>
            </html>
        `,
  };

  transporter.sendMail(mailOptions, function (error, info) {
    if (error) {
      return console.log(error);
    }

    console.log("Message sent: " + info.response);
  });
}



async function seleccionar_Profesional(profesionales, page, Tipo, Eventos) {
  if (Eventos == 1) {
    DeleteProfesional = await page.$x('//span[contains(.,"Eliminar")]');
    if (Tipo == 1) {
      await DeleteProfesional[0].click();
    } else {
      try {
        await DeleteProfesional[0].click();
      } catch (error) {
        console.log("ERR 0");
      }
      try {
        await DeleteProfesional[1].click();
      } catch (error) {
        console.log("ERR 1");
      }
      try {
        await DeleteProfesional[2].click();
      } catch (error) {
        console.log("ERR 2");
      }
      try {
        await DeleteProfesional[3].click();
      } catch (error) {
        console.log("ERR 3");
      }
      try {
        await DeleteProfesional[4].click();
      } catch (error) {
        console.log("ERR 4");
      }
    }
  }
  for (const profesional of profesionales) {
    const tipoProfesional = profesional.tipo;
    const nombres = profesional.nombres;

    // Seleccionar el tipo de profesional en el primer select
    let selectorTipoProfesion =
      Tipo == 1
        ? 'select[id="techProfessionalDesignationId"]'
        : 'select[id="ecoProfessionalDesignationId"]';

    await page.waitForSelector(selectorTipoProfesion, { visible: true });
    await page.select(
      selectorTipoProfesion,
      await page.evaluate((selector, tipo) => {
        const select = document.querySelector(selector);
        const option = [...select.options].find(opt =>
          opt.textContent.includes(tipo)
        );
        return option ? option.value : "";
      }, selectorTipoProfesion, tipoProfesional)
    );

    // Iterar sobre los nombres y seleccionar cada uno en el segundo select
    for (const nombre of nombres) {
      console.log(`Tipo Profesional: ${tipoProfesional} - Nombre: (${nombre})`);

      let selectorProfesional =
        Tipo == 1
          ? 'select[id="techApplicantNameId"]'
          : 'select[id="ecoApplicantNameId"]';

      await page.waitForSelector(selectorProfesional, { visible: true });

      // Esperar que la opción con ese nombre aparezca
      await page.waitForFunction(
        (selector, nombre) => {
          const select = document.querySelector(selector);
          if (!select) return false;
          return [...select.options].some(opt =>
            opt.textContent.includes(nombre)
          );
        },
        {},
        selectorProfesional,
        nombre
      );

      // Seleccionar el valor de esa opción
      await page.select(
        selectorProfesional,
        await page.evaluate((selector, nombre) => {
          const select = document.querySelector(selector);
          const option = [...select.options].find(opt =>
            opt.textContent.includes(nombre)
          );
          return option ? option.value : "";
        }, selectorProfesional, nombre)
      );

      await page.waitForTimeout(300);


      addProfesional = await page.$x('//span[contains(.,"Agregar")]');
      if (Tipo == 1) {
        await addProfesional[0].click();
      } else {
        try {
          await addProfesional[0].click();
        } catch (error) {
          console.log("ERR 0");
          console.log(`Bro manito sabe que  pilke -> ${error}`);
        }
        try {
          await addProfesional[1].click();
        } catch (error) {
          console.log("ERR 1");
          console.log(`Bro manito sabe que  pilke -> ${error}`);
        }
        try {
          await addProfesional[2].click();
        } catch (error) {
          console.log("ERR 2");
          console.log(`Bro manito sabe que  pilke -> ${error}`);
        }
        try {
          await addProfesional[3].click();
        } catch (error) {
          console.log("ERR 3");
          console.log(`Bro manito sabe que  pilke -> ${error}`);
        }
        try {
          await addProfesional[4].click();
        } catch (error) {
          console.log("ERR 4");
          console.log(`Bro manito sabe que  pilke -> ${error}`);
        }
      }
    }
  }
}



var CorreoEnviado = false;
var PrimerCorreoEnviado = false;
// FUNCIÓN PARA VERIFICAR VENCIMIENTO DE PIN Y ENVIAR RECORDATORIO
function parseFechaPin(dateString) {
  const monthMap = {
    ENE: "01", FEB: "02", MAR: "03", ABR: "04", MAY: "05", JUN: "06",
    JUL: "07", AGO: "08", SEP: "09", OCT: "10", NOV: "11", DIC: "12",
  };
  const [day, monthName, year] = dateString.trim().split("/");
  return new Date(`${year}-${monthMap[monthName]}-${day}`);
}

function VerificarVencimientoPin(
  selectedText,
  TextoDeOpcionSeleccionadaEnCampoPin
) {
  const input = TextoDeOpcionSeleccionadaEnCampoPin;

  const dateString = input.split(",")[1].trim();
  const targetDate = parseFechaPin(dateString);

  // Obtener la fecha actual
  const currentDate = new Date();

  // Calcular la diferencia en milisegundos
  const diffInMs = targetDate - currentDate;

  // Convertir la diferencia en días
  const diffInDays = Math.ceil(diffInMs / (1000 * 60 * 60 * 24));

  const diaSemana = targetDate.toLocaleString("es-Es", { weekday: "long" });
  console.log(`¡¡¡ DIFERENCIA EN DÍAS PIN: ${diffInDays}`);
  const Description = `El pin vence en ${diffInDays} días, es decir, tiene vigencia hasta el día ${diaSemana} - ${dateString}`;

  // Se captura la hora del día actual
  const HoraActual = currentDate.getHours();

  // Se captura el minuto actual
  const MinutoActual = currentDate.getMinutes();

  // Se captura el segundo actual
  const SegundoActual = currentDate.getSeconds();

  // Se verifica si la diferencia de días es igual a 5 y si la hora actual contiene 7 de la mañana ó contiene 3 de la tarde. Para hacer 2 envíos de recordatorio el día que se cumplan todas las condiciones

  // Primer envío: 07:00 am
  if (
    diffInDays === 5 &&
    [7].includes(HoraActual) &&
    MinutoActual === 0 &&
    CorreoEnviado === false &&
    !PrimerCorreoEnviado
  ) {
    console.log(
      "TODAS LAS CONDICIONES SE CUMPLIERON, SE ENVIARÁ EL PRIMER CORREO RECORDANDO EL VENCIMIENTO DEL PIN SELECCIONADO..."
    );
    Correo(4, selectedText, Description);
    CorreoEnviado = true;
    PrimerCorreoEnviado = true;
  }

  // Resetear el flag solo una vez después del primer correo
  if (
    diffInDays === 5 &&
    HoraActual > 7 &&
    HoraActual < 15 &&
    MinutoActual === 0 &&
    PrimerCorreoEnviado &&
    CorreoEnviado
  ) {
    CorreoEnviado = false;
    console.log("LA VARIABLE DE CORREO ENVIADO SE HIZO FALSA");
  }

  // Segundo envío: 03:00 pm
  if (
    diffInDays === 5 &&
    [15].includes(HoraActual) &&
    MinutoActual === 0 &&
    CorreoEnviado === false
  ) {
    console.log(
      "TODAS LAS CONDICIONES SE CUMPLIERON, SE ENVIARÁ EL SEGUNDO CORREO RECORDANDO EL VENCIMIENTO DEL PIN SELECCIONADO..."
    );
    Correo(4, selectedText, Description);
    CorreoEnviado = true;
    PrimerCorreoEnviado = false;
  }
}
