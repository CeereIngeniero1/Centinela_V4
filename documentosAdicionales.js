const fs = require("fs");
const path = require("path");

const NOMBRES_CARPETA = ["DocumentosAdiconales", "DocumentosAdicionales"];

function resolverCarpetaAdicionales(empresa) {
  const base = path.join(__dirname, "Documentos", empresa);
  for (const nombre of NOMBRES_CARPETA) {
    const carpeta = path.join(base, nombre);
    if (fs.existsSync(carpeta)) return carpeta;
  }
  return null;
}

function listarDocumentosAdicionales(empresa) {
  const carpeta = resolverCarpetaAdicionales(empresa);
  if (!carpeta) return { carpeta: null, archivos: [] };
  const archivos = fs
    .readdirSync(carpeta)
    .filter((f) => /\.(pdf|zip)$/i.test(f))
    .sort((a, b) => a.localeCompare(b, "es", { numeric: true }));
  return { carpeta, archivos };
}

async function asignarTipoOtroEnTodosLosAdicionales(page, archivos) {
  console.log(
    `Asignando "Otro" solo en los ${archivos.length} documentos adicionales...`
  );

  for (let i = 0; i < archivos.length; i++) {
    const archivo = archivos[i];
    console.log(`Otro (${i + 1}/${archivos.length}): ${archivo}`);

    const selectId = await page.evaluate((nombre) => {
      const links = Array.from(document.querySelectorAll("a"));
      const link = links.find((a) =>
        (a.textContent || "").trim().includes(nombre)
      );
      if (!link) return null;

      let row = link;
      for (let j = 0; j < 15 && row; j++) {
        const tipo = row.querySelector
          ? row.querySelector('[id^="p_CaaCataDocumentTypeId"]')
          : null;
        if (tipo && tipo.id) return tipo.id;
        row = row.parentElement;
      }
      return null;
    }, archivo);

    if (!selectId) {
      console.log(`No se encontró select de tipo para: ${archivo}`);
      continue;
    }

    const estado = await page.evaluate((selId) => {
      const root = document.getElementById(selId);
      if (!root) return "ausente";
      const selectize = root.querySelector(".selectize-input");
      const texto = ((selectize && selectize.innerText) || "")
        .replace(/\s+/g, " ")
        .trim();
      if (texto === "Otro") return "ok";
      if (!texto || texto.includes("Tipo de documento")) return "pendiente";
      const soloOtro = texto.replace(/\s/g, "").toLowerCase();
      if (/^(otro){2,}$/i.test(soloOtro) || soloOtro.includes("otrootro")) {
        return "corrupto";
      }
      return "otro_tipo";
    }, selectId);

    if (estado === "ok") {
      console.log(`#${selectId} ya tiene Otro`);
      continue;
    }
    if (estado === "otro_tipo" || estado === "ausente") {
      console.log(`#${selectId} omitido (${estado})`);
      continue;
    }

    await page.evaluate((selId) => {
      const root = document.getElementById(selId);
      if (!root) return;
      const selectize = root.querySelector(".selectize-input");
      if (selectize) selectize.click();
      const search = root.querySelector("input.ui-select-search");
      if (search) {
        search.focus();
        search.value = "";
        search.dispatchEvent(new Event("input", { bubbles: true }));
      }
    }, selectId);

    await page.waitForTimeout(120);

    const search = await page.$(`#${selectId} input.ui-select-search`);
    if (search) {
      try {
        await search.click({ clickCount: 3 });
        await page.keyboard.down("Control");
        await page.keyboard.press("KeyA");
        await page.keyboard.up("Control");
        await page.keyboard.press("Backspace");
        await search.type("otro", { delay: 20 });
      } catch (e) {
        await page.keyboard.type("otro", { delay: 20 });
      }
    } else {
      await page.keyboard.type("otro", { delay: 20 });
    }

    await page.waitForTimeout(200);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(250);

    const active = await page.$(
      `#${selectId} .ui-select-choices-row.active > div, #${selectId} .ui-select-choices-row.active`
    );
    if (active) {
      try {
        await active.click();
      } catch (e) {}
      await page.waitForTimeout(150);
    }

    await page.keyboard.press("Escape");

    await page.evaluate((selId) => {
      const root = document.getElementById(selId);
      if (!root) return;
      let row = root;
      for (let j = 0; j < 8 && row; j++) {
        const inputs = Array.from(
          row.querySelectorAll(
            'input[type="text"]:not(.ui-select-search), textarea'
          )
        ).filter((inp) => {
          const st = window.getComputedStyle(inp);
          return (
            st.display !== "none" &&
            st.visibility !== "hidden" &&
            !(inp.value || "").trim()
          );
        });
        for (const inp of inputs) {
          inp.value = "Otro";
          inp.dispatchEvent(new Event("input", { bubbles: true }));
          inp.dispatchEvent(new Event("change", { bubbles: true }));
          if (window.angular) {
            angular.element(inp).triggerHandler("input");
            angular.element(inp).triggerHandler("change");
          }
        }
        if (inputs.length) break;
        row = row.parentElement;
      }
    }, selectId);
  }

  console.log(`Listo: "Otro" en ${archivos.length} adicionales.`);
}

/**
 * Sube documentos adicionales y asigna tipo "Otro" si la empresa tiene
 * DocumentosAdiconales / DocumentosAdicionales con archivos.
 * @returns {Promise<boolean>} true si hubo archivos y se procesaron
 */
async function Documentos_Adicionales(page, Empresa) {
  const { carpeta, archivos } = listarDocumentosAdicionales(Empresa);

  if (!carpeta) {
    console.log(
      `Sin carpeta DocumentosAdiconales/DocumentosAdicionales para ${Empresa}; se omite.`
    );
    return false;
  }

  if (archivos.length === 0) {
    console.log(
      `Carpeta de adicionales vacía (${carpeta}); se omite adjunto adicional.`
    );
    return false;
  }

  console.log("INICIA CARGA RAPIDA DE DOCUMENTOS ADICIONALES");
  console.log(
    "================================================================"
  );
  console.log(`Empresa: ${Empresa} | Archivos: ${archivos.length}`);
  console.log(`Carpeta: ${carpeta}`);

  await page.waitForSelector("#p_CaaCataDocumentToAttachId", {
    timeout: 30000,
  });

  for (let i = 0; i < archivos.length; i++) {
    const archivo = archivos[i];
    const rutaAbsoluta = path.join(carpeta, archivo);
    console.log(
      `Subiendo adicional (${i + 1}/${archivos.length}): ${archivo}`
    );

    try {
      const yaEnLista = await page.evaluate((nombre) => {
        return Array.from(document.querySelectorAll("a")).some((a) =>
          (a.textContent || "").trim().includes(nombre)
        );
      }, archivo);

      if (yaEnLista) {
        console.log(`Ya estaba en lista (omitido): ${archivo}`);
        continue;
      }

      await page.evaluate(() => {
        const el = document.querySelector("#p_CaaCataDocumentToAttachId");
        if (el) el.value = "";
      });

      const input = await page.$("#p_CaaCataDocumentToAttachId");
      if (!input) {
        throw new Error("No se encontró #p_CaaCataDocumentToAttachId");
      }

      await input.uploadFile(rutaAbsoluta);

      await page.waitForFunction(
        (nombre) =>
          Array.from(document.querySelectorAll("a")).some((a) =>
            (a.textContent || "").trim().includes(nombre)
          ),
        { timeout: 30000, polling: 100 },
        archivo
      );

      console.log(`✅ Subido: ${archivo}`);
    } catch (error) {
      console.log(
        `Error al subir adicional ${archivo}:`,
        error.message || error
      );
      throw error;
    }
  }

  console.log(
    "================================================================"
  );
  console.log("FINALIZA CARGA RAPIDA DE DOCUMENTOS ADICIONALES");

  await page.waitForTimeout(400);
  await asignarTipoOtroEnTodosLosAdicionales(page, archivos);
  return true;
}

module.exports = {
  Documentos_Adicionales,
  listarDocumentosAdicionales,
  resolverCarpetaAdicionales,
  asignarTipoOtroEnTodosLosAdicionales,
};
