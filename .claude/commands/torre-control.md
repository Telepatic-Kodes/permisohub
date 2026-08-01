---
name: torre-control
description: Chequeo de gobernanza de datos/decisiones al inicio de una sesión — fuentes de datos, commits sin digerir, siguiente acción de mayor valor
argument-hint: ""
allowed-tools:
  - Read
  - Edit
  - Bash
---

<objective>
Correr al INICIO de cualquier sesión de Claude Code sobre este repo (permisohub). No es un ritual de fin de sesión — es rápido, determinista donde se puede, y termina con UNA sola recomendación accionable, no una lista completa.

Hace tres cosas, en este orden. No preguntes confirmación entre pasos — corre los tres y presenta el resultado consolidado al final.
</objective>

<paso-1-validar-registro>
Correr: `node scripts/check-data-sources.mjs`

Mostrar el resumen tal cual (no reformatear la salida). Si hay fallos duros (exit code 1), señalarlos como lo más urgente de la sesión — alguien agregó un scraper/ruta nueva sin documentarlo en `.planning/data-sources.yaml`, o rompió una referencia existente.
</paso-1-validar-registro>

<paso-2-digerir-commits-sin-procesar>
Leer la sección "## Commits sin procesar" de `.planning/STATE.md`.

Si está vacía (solo la nota explicativa en cursiva, sin bullets de commits): decir "nada que digerir" y seguir al paso 3.

Si tiene bullets:
1. Para cada commit listado, mirar `git show --stat <hash>` y el mensaje completo (`git log -1 --format=%B <hash>`) para entender qué cambió.
2. Escribir una entrada narrativa real (mismo estilo que las entradas existentes de "Accumulated Context" en STATE.md — qué se hizo, por qué, qué se verificó) resumiendo esos commits. Si son varios commits de una misma feature/sesión, una sola entrada consolidada basta — no hace falta una por commit.
3. Si algún commit toca algo con implicancia de roadmap/milestone (nueva feature de cara al usuario, no un fix chico), reflejarlo también en `.planning/ROADMAP.md`/`.planning/MILESTONES.md` si corresponde.
4. Agregar la entrada a "Accumulated Context" en STATE.md.
5. Borrar los bullets ya digeridos de "## Commits sin procesar" (dejar la nota explicativa en cursiva intacta).

No hace falta que esto sea exhaustivo por cada línea de código — es un resumen ejecutivo de qué pasó, al nivel de detalle de las entradas ya existentes en el archivo.
</paso-2-digerir-commits-sin-procesar>

<paso-3-proponer-siguiente-accion>
Leer `.planning/data-sources.yaml` y contar cuántas entradas tienen `status: needs-decision` o `status: duplicate`.

Elegir UNA sola — la de mayor valor/menor esfuerzo aparente, o la más antigua sin resolver si no hay una obviamente mejor — y proponerla como la siguiente acción concreta de la sesión. Formato: qué es, por qué importa, qué archivo(s) tocaría. No enumerar las demás — solo mencionar cuántas quedan pendientes en el registro para quien quiera mirar el resto.
</paso-3-proponer-siguiente-accion>

<presentacion>
Terminar con un resumen corto (no un informe largo):
- Estado del registro (paso 1): OK / N fallos
- Qué se digirió hacia STATE.md (paso 2): nada / resumen de 1 línea
- La única acción propuesta (paso 3)
</presentacion>
