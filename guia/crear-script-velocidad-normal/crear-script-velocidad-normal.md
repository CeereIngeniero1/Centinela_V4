# Guía: crear un script `.js` con velocidad normal

Esta guía explica cómo crear un nuevo bot de monitoreo en **Centinela_V4** a partir de un script existente, configurado para **velocidad normal** y **flujo automático**.

---

## Regla principal: no reemplazar archivos existentes

**Nunca modifiques directamente un `.js` que ya esté en uso** (`Operadora.js`, `ColleV4.js`, `Valleduper.js`, etc.).

Si necesitas cambios:

1. Copia el archivo original con un nombre nuevo.
2. Aplica los cambios solo en la copia.
3. Ejecuta y apunta el `.bat` (si aplica) al archivo nuevo.

### Ejemplo

```text
Operadora.js          ← original (no tocar)
Operadora Normal.js   ← copia de trabajo
```

En Windows, desde la carpeta del proyecto:

```powershell
copy "Operadora.js" "Operadora Normal.js"
```

---

## Paso 1: elegir el archivo base

Usa como referencia un script que ya funcione para la misma empresa o un caso similar:

| Archivo base | Empresa | Notas |
|--------------|---------|-------|
| `ColleV4.js` | Collective | Monitoreo estándar (30 s entre áreas) |
| `Operadora.js` | Operadora | Monitoreo estándar |
| `Valleduper Normal.js` | Valleduper | **Ya trae velocidad normal** |
| `18997 Alejandra.js` | Collective / área 18997 | Competencia, 2 s entre áreas |

Para un script nuevo con velocidad normal, lo más simple es copiar el script de la **misma empresa** y ajustar solo `ESPERA_ENTRE_AREAS_MS` y `manual` (pasos 4 y 5).

---

## Paso 2: copiar y renombrar

1. Copia el `.js` base.
2. Ponle un nombre descriptivo: empresa, área o uso.

Ejemplos válidos:

- `Operadora Normal.js`
- `509139 Max.js`
- `Collective 841-17 Celda SANTIAGO.js`

---

## Paso 3: cambiar las constantes de identidad *(opcional)*

> **Solo si vas a usar otra empresa o otro archivo de áreas distinto al del script original.**  
> Si copiaste el `.js` de la misma empresa (por ejemplo `Operadora.js` → `Operadora Normal.js`), **no necesitas tocar estas constantes**.

Al inicio del archivo (aprox. líneas 27–29) están definidas la empresa, el PIN y el archivo de áreas:

```javascript
const Empresa = "Operadora";      // Clave en DatosEMPRESAS/
const CodigoPin = "OP";           // Clave en DatosEMPRESAS/Pines.json
const ARCHIVO_AREAS = "Operadora"; // Nombre del JSON en areas/ (sin .json)
```

| Constante | Qué hace |
|-----------|----------|
| `Empresa` | Credenciales, geólogo, contador, documentos en `Documentos/{Empresa}/` |
| `CodigoPin` | PIN que se selecciona en el portal ANM |
| `ARCHIVO_AREAS` | Archivo `areas/{ARCHIVO_AREAS}.json` con la lista de celdas |

**Cuándo sí debes cambiarlas:**

- El script nuevo es para **otra empresa** (ej. copiaste `Operadora.js` pero lo quieres para Collective).
- Quieres usar **otro JSON de áreas** (ej. monitorear `18997.json` con credenciales de Collective).

Ejemplo de ese caso:

```javascript
const Empresa = "Collective";
const CodigoPin = "Co";
const ARCHIVO_AREAS = "18997";
```

`Empresa` y `ARCHIVO_AREAS` **pueden ser distintos** entre sí cuando el caso lo requiera.

---

## Paso 4: velocidad normal — `ESPERA_ENTRE_AREAS_MS`

Esta constante controla cuánto espera el bot **entre un área y la siguiente** después de monitorear o pasar de área.

```javascript
const ESPERA_ENTRE_AREAS_MS = 1000;        // Velocidad normal (1 segundo)
// const ESPERA_ENTRE_AREAS_MS = 30 * 1000; // Velocidad lenta (30 segundos)
```

| Valor | Comportamiento |
|-------|----------------|
| `1000` | **Velocidad normal** — recomendado para monitoreo ágil |
| `2000` | Intermedio (competencias) |
| `30 * 1000` | Lento — valor por defecto en scripts como `Operadora.js` y `ColleV4.js` |

Para velocidad normal, deja:

```javascript
const ESPERA_ENTRE_AREAS_MS = 1000;
```

Si el script base trae `30 * 1000`, cámbialo a `1000` y, si quieres, deja la línea anterior comentada como referencia:

```javascript
const ESPERA_ENTRE_AREAS_MS = 1000;
// const ESPERA_ENTRE_AREAS_MS = 30 * 1000;
```

---

## Paso 5: flujo automático — `manual`

Esta constante define si el bot **se detiene a mano** después de colocar el PIN o sigue solo.

```javascript
const manual = 0; // 1 = pausa en PIN tras colocarlo; 0 = flujo automático
```

| Valor | Comportamiento |
|-------|----------------|
| `0` | **Flujo automático** — hace clic en Continuar y avanza sin esperar al operador |
| `1` | **Modo manual** — pausa tras el PIN para revisión humana |

Para operación normal sin intervención, **siempre verifica**:

```javascript
const manual = 0;
```

Con `manual = 1` el script puede quedarse esperando en pantalla PIN y no avanzar al monitoreo de áreas.

---

## Paso 6: revisar el resto de constantes (opcional)

Suele bastar con lo anterior. Solo cambia lo demás si el caso lo requiere:

```javascript
const MONITOREO_AREA_MS = 30 * 1000;              // Tiempo máximo esperando resultado por área
const INTERVALO_REVISION_ENTRE_AREAS_MS = 3 * 1000; // Cada cuánto revisa durante la espera entre áreas
const Agente = 1;                                  // 1 = login agente; 0 = login empresa directo
```

No modifiques timeouts de monitoreo salvo que sepas que necesitas otro comportamiento.

---

## Paso 7: archivo de áreas

Confirma que exista el JSON correspondiente:

```text
areas/{ARCHIVO_AREAS}.json
```

Cada entrada debe tener al menos:

```json
{
  "NombreArea": "509139",
  "Referencia": "18P09K22C03F",
  "Celdas": ["18P09K22C03F, 18P09K22C04A, ..."]
}
```

---

## Paso 8: ejecutar el script

Desde la raíz del proyecto:

```bash
cd C:\Centinela_V4
node "Operadora Normal.js"
```

O crea un `.bat` en `.bat\Monitoreo\` o `.bat\Competencias\` que apunte al **archivo nuevo**, no al original:

```bat
start /d "../../../" node "Operadora Normal.js"
```

Ajusta la ruta `start /d` según la profundidad de la carpeta del `.bat`.

---

## Checklist antes de correr

- [ ] Creé una **copia**; no edité el `.js` original
- [ ] *(Opcional)* `Empresa`, `CodigoPin` y `ARCHIVO_AREAS` revisados **solo si** el script es para otra empresa o otro archivo de áreas
- [ ] `ESPERA_ENTRE_AREAS_MS = 1000` (velocidad normal)
- [ ] `manual = 0` (flujo automático)
- [ ] Existe `areas/{ARCHIVO_AREAS}.json`
- [ ] El `.bat` (si hay) ejecuta el **nuevo** archivo

---

## Ejemplo completo (encabezado del script)

```javascript
const Empresa = "Operadora";
const CodigoPin = "OP";
const ARCHIVO_AREAS = "Operadora";

const MONITOREO_AREA_MS = 30 * 1000;
const INTERVALO_PRIMERA_REVISION_MS = 1 * 1000;
const INTERVALO_REVISION_AREA_MS = 5 * 1000;
const ESPERA_ENTRE_AREAS_MS = 1000;
const INTERVALO_REVISION_ENTRE_AREAS_MS = 3 * 1000;

const Agente = 1;
const manual = 0; // 1 = pausa en PIN tras colocarlo; 0 = flujo automático
```

---

## Errores frecuentes

| Problema | Causa probable | Solución |
|----------|----------------|----------|
| El bot va muy lento entre áreas | `ESPERA_ENTRE_AREAS_MS = 30 * 1000` | Cambiar a `1000` |
| Se queda en pantalla PIN | `manual = 1` | Cambiar a `manual = 0` |
| "No se encontró pin para el código..." | `CodigoPin` incorrecto | Revisar `DatosEMPRESAS/Pines.json` |
| Áreas no cargadas | `ARCHIVO_AREAS` sin JSON | Crear o corregir `areas/{nombre}.json` |
| Se rompió el monitoreo de todos | Se editó el `.js` original | Restaurar original y trabajar en una copia |

---

## Referencia rápida de archivos del proyecto

```text
C:\Centinela_V4\
├── ColleV4.js, Operadora.js, Valleduper.js ...   # Scripts (no sobrescribir)
├── Valleduper Normal.js                          # Ejemplo velocidad normal
├── areas\                                        # Listas de áreas/celdas
├── DatosEMPRESAS\                                # Pines, credenciales, geólogos...
├── Documentos\{Empresa}\                         # Shapefiles y certificados
├── .bat\Monitoreo\                               # Lanzadores monitoreo
├── .bat\Competencias\                            # Lanzadores competencia
└── guia\
    └── crear-script-velocidad-normal\            # Esta guía (MD y PDF)
```
