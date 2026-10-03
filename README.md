# Jekyll & Hyde [TBD]

Juego didáctico web, 100 % client-side y en español, basado en *El extraño caso del
Dr. Jekyll y Mr. Hyde* de Robert Louis Stevenson. Cada nivel alterna una viñeta
narrativa, un minijuego arcade de acción y un quiz literario. Público 10+,
mobile-first vertical **720×1280**.

> Título provisional ([SPEC §1.1](docs/SPEC.md#11-título-del-juego--tbd)).

## Documentación

- [`docs/SPEC.md`](docs/SPEC.md) — especificación funcional y técnica (fuente de verdad de diseño).
- [`docs/PLAN.md`](docs/PLAN.md) — plan de desarrollo por etapas.
- [`docs/QA-CHECKLIST.md`](docs/QA-CHECKLIST.md) — **QA manual pendiente en dispositivo real** (Etapa 7).
- [`start.md`](start.md) — pedido original del proyecto.

## Stack

| Capa | Tecnología |
|---|---|
| Motor | [Phaser 4](https://phaser.io) (npm `phaser`) |
| Lenguaje | TypeScript (strict) |
| Build / dev | [Vite](https://vite.dev) |
| Tests | [Vitest](https://vitest.dev) (jsdom) |
| UI | Toda dentro del canvas Phaser (sin React ni framework de DOM) |
| Deploy | GitHub Pages vía GitHub Actions (estático, sin backend) |

## Cómo correr

Requisitos: Node.js 22+.

```bash
npm install      # instalar dependencias
npm run dev      # servidor de desarrollo (http://localhost:5173)
npm run build    # type-check (tsc) + build de producción → dist/
npm run preview  # servir el build de producción en local
npm test         # correr los tests una vez (vitest run)
npm run test:watch  # tests en modo watch
```

## Modo debug de FPS (`?debug`)

El CA de rendimiento del PLAN (FPS ≥ 55 sostenidos en móvil de gama media durante
el minijuego) se mide con el contador de FPS integrado:

1. Abre el juego en el dispositivo (o devtools → device emulation) y añade
   **`?debug`** a la URL, p. ej. `http://localhost:5173/?debug`.
2. Juega el minijuego de acción (Menu → Intro → Narrativa → Acción). Aparece un contador
   «N FPS» en la esquina inferior izquierda, actualizado 2 veces por segundo con
   los FPS reales del loop de Phaser.
3. Sin `?debug` el contador no existe (costo cero): la medición no afecta al juego.

Con el contador visible, completa el ítem de FPS de
[`docs/QA-CHECKLIST.md`](docs/QA-CHECKLIST.md).

## QA manual pendiente (dispositivo real)

La Etapa 7 automatizó todo lo automatizable (responsive 320→1920, persistencia,
accesibilidad, revisión de textos y Definition of Done ejecutable — 1039 tests).
Lo que **exige hardware** queda en [`docs/QA-CHECKLIST.md`](docs/QA-CHECKLIST.md):
FPS en gama media real, multi-touch (60 taps rápidos), hitboxes con dedos,
teclado virtual, audio en iOS/Safari (políticas de autoplay), zoom y
orientación, y persistencia matando la pestaña. Cada ítem lleva instrucciones
y espacio para apuntar el resultado.

## Estado del deploy

**Manual hasta habilitar GitHub Pages** (queda pendiente activar Pages con
fuente *GitHub Actions* en Settings → Pages de este repositorio):

- [`.github/workflows/ci.yml`](.github/workflows/ci.yml) — tests + build en
  cada push y pull request (automático, activo).
- [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) — build con
  Vite (`base: './'`) y publicación de `dist/` en GitHub Pages. Está en modo
  `workflow_dispatch`: se ejecuta a mano desde la pestaña *Actions* una vez
  habilitado Pages. Smoke test de la URL publicada pendiente (ítem final del
  QA-CHECKLIST).
