# Jekyll & Hyde [TBD]

Juego didáctico web, 100 % client-side y en español, basado en *El extraño caso del
Dr. Jekyll y Mr. Hyde* de Robert Louis Stevenson. Cada nivel alterna una viñeta
narrativa, un minijuego arcade de acción y un quiz literario. Público 10+,
mobile-first vertical **720×1280**.

> Título provisional ([SPEC §1.1](docs/SPEC.md#11-título-del-juego--tbd)).

## Documentación

- [`docs/SPEC.md`](docs/SPEC.md) — especificación funcional y técnica (fuente de verdad de diseño).
- [`docs/PLAN.md`](docs/PLAN.md) — plan de desarrollo por etapas.
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

## Deploy

Cada push a `main` dispara [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml):
build con Vite (`base: './'`) y publicación del `dist/` en GitHub Pages.
Requiere activar Pages con fuente **GitHub Actions** en los ajustes del repositorio.
CI (tests + build) en [`.github/workflows/ci.yml`](.github/workflows/ci.yml) para
cada push y pull request.
