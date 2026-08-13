# Prompt para IA — Preparar scripts de PRUEBA (Centinela V4)

Copia y pega el bloque siguiente en el chat con la IA. **Debes indicar los archivos** antes de enviar; si no los das, la IA no debe modificar nada.

---

## Prompt (copiar desde aquí)

```
Necesito preparar uno o más scripts .js de Centinela V4 como bots de PRUEBA.
Aplica exactamente dos cambios descritos en: C:\Centinela_V4\GUIA PRUEBAS\GUIA_PREPARAR_SCRIPTS_PRUEBA.md

## REGLA OBLIGATORIA — LISTA DE ARCHIVOS

Los cambios SOLO se aplican a los archivos que yo indique explícitamente.
No importa el nombre del archivo ni la carpeta: puede ser cualquier .js del proyecto.

Archivos indicados por el usuario:
[ESCRIBE AQUÍ LOS ARCHIVOS .js, UNO POR LÍNEA — ruta relativa o nombre exacto]

Si la lista está vacía, incompleta o ambigua:
1. NO modifiques ningún archivo.
2. Pregúntame: "Indica los archivos .js exactos a preparar para prueba (nombre o ruta completa)."
3. Repite la pregunta hasta que yo entregue la lista completa y sin dudas.
4. Antes de editar, confirma: "Voy a modificar únicamente: [lista]. ¿Correcto?"

PROHIBIDO:
- Aplicar cambios a archivos que no estén en mi lista.
- Asumir que todos los de una carpeta, todos los "copy" o todos los de una competencia deben cambiarse.
- Inferir archivos por similitud de nombre; solo los que yo escriba.

## CAMBIO 1 — Quitar bloque de radicación automática final

En CADA archivo de mi lista, ELIMINAR por completo el bloque que va desde:

    const continPag = await page.$x('//span[contains(.,"Continuar")]');

(habitualmente justo después de Documentos_Persona_juridica / Documentos_Persona_Natural)

hasta el cierre del try/catch del botón Radicar (inclusive):

    try {
      await btnRadicar1[1].click();
    } catch (exepcion) {
      console.log("La 1 tampoco Y_Y");
    }

Ese bloque incluye, si existe: clic en Continuar, waitForNavigation, timers (Radisegundo/RadiTercero), bucles RECAPTCHA, verificarCaptchaResuelto y click en Radicar.

Después de eliminar, el flujo debe quedar: tras el cierre de documentos viene DIRECTAMENTE:

    //CORREO RADICACION
    Correo(2, Areas[Band].NombreArea, Areas[Band].Referencia);

No modifiques código anterior a documentos ni posterior a //CORREO RADICACION (salvo el Cambio 2).

## CAMBIO 2 — Correo solo a soporte (modo prueba)

En la función Correo de cada archivo, dentro de mailOptions:

- COMENTAR la línea to: con la lista larga de destinatarios (producción).
- DEJAR ACTIVA solo la línea to: con Soporte2ceere@gmail.com.

Patrón esperado:

    //to: "correo1@..., correo2@..., ...",
    to: '  Soporte2ceere@gmail.com',

Si solo hay una línea to:, coméntala y agrega la de soporte debajo.
Si ya existe una línea comentada con soporte, invierte comentarios (comenta producción, descomenta soporte).

## AL TERMINAR

1. Lista los archivos que SÍ modificaste.
2. Lista los archivos del proyecto que NO tocaste.
3. Indica si algún archivo de mi lista no tenía el bloque esperado (y qué hiciste).
4. No hagas commit salvo que yo lo pida.
```

---

## Ejemplo de lista que debe dar el usuario

```
Archivos indicados:
- MiCompetencia Agente1.js
- MiCompetencia Agente1 copy.js
- Radi EMPRESA 123456.js
- C:\Centinela_V4\pruebas\bot-validacion.js
```

Los nombres son **ilustrativos**. Mañana pueden ser otros archivos; lo único obligatorio es que el usuario los escriba explícitamente.

## Notas para quien usa la IA

| Regla | Motivo |
|-------|--------|
| Lista explícita obligatoria | Evita tocar bots de producción por error |
| Confirmar antes de editar | Nombres pueden tener espacios y caracteres especiales |
| No inferir por carpeta o patrón | Cada tarea define su propia lista de archivos |
| No tocar credenciales, Agente, Empresa, áreas | Esta guía es solo: quitar radicación final + correo de prueba |
| Válido para cualquier .js del repo | Misma estructura en todos los bots Centinela V4 |
