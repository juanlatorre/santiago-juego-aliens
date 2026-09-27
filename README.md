# Alien Heist

Shooter 2D top-down para celular (portrait 9:16) — prototipo MVP siguiendo
[`GDD.md`](./GDD.md). TypeScript + Vite + Phaser + Capacitor. 100% code-first:
sin assets binarios, todo el arte es procedural y el audio es sintetizado.

> Matar aliens → robar sus armas → robar sus naves → sobrevivir el mayor tiempo posible.

## Requisitos

- Node.js ≥ 18
- (Opcional, para Android) JDK 17 y Android SDK

## Desarrollo

```bash
npm install
npm run dev        # servidor local de Vite
```

## Controles

| Acción          | Móvil                            | PC            |
|-----------------|----------------------------------|---------------|
| Moverse         | Joystick virtual izquierdo       | WASD / flechas |
| Apuntar/disparar| Joystick virtual derecho (pasado cierto umbral dispara) | Ratón (clic para disparar) |
| Recoger/robar   | Botón contextual central (mantener para robar naves) | E / Espacio (mantener) |

## Verificación

```bash
npm run build      # typecheck (tsc --noEmit) + build de producción
npm run smoke      # flujo jugable completo (GDD §35) en Chrome real
node scripts/touch-test.mjs   # sticks táctiles + rampa de dificultad + AI del Charger
```

Ambos tests usan el API de debug `window.__ah` (getState/cheat) expuesto en la
escena de juego; no forman parte del build de producción.

## Android (Capacitor)

```bash
npm run build
npm run cap:sync            # copia dist/ a la plataforma
cd android && ./gradlew assembleDebug   # genera app-debug.apk
```

Nota: la plataforma `android/` no está versionada (generarla con
`npm run cap:add:android`). El CLI de Capacitor 6 usa `tar@6` internamente;
`npm audit` reporta avisos de `tar@6` solo en la cadena de tooling del
desarrollador (extracción de plantillas al añadir la plataforma), no en el
juego distribuido.

## Hosting (web)

El juego está desplegado gratis en **Cloudflare Pages** (estático, sin backend,
ancho de banda ilimitado):

| URL | Uso |
|---|---|
| https://alienshy.inshalabs.com | URL oficial |
| https://alienshy-dev.inshalabs.com | Alias del mismo sitio |
| https://alien-heist.pages.dev | URL de Cloudflare Pages |

```bash
npm run deploy   # build + deploy a Cloudflare Pages (main = producción)
```

La app Android carga el juego desde la red (`server.url` en
`capacitor.config.ts`), así que **los cambios de juego llegan sin reinstalar el
APK**: desplegar y recargar la app. Para desarrollo en vivo en el teléfono
(HMR) existe el modo túnel: `npm run dev:remote` (requiere el registro DNS del
túnel en `inshalabs.com`). Nota: cambiar `capacitor.config.ts` o plugins
nativos (p. ej. haptics) sí exige recompilar e instalar el APK.

## Arquitectura (GDD §39)

```
src/
├── data/        # REGLAS declarativas: weapons.ts, enemies.ts, ships.ts, level.ts
├── core/        # ESTADO: RunState (stats, fase, modo), tipos, audio sintetizado
├── systems/     # SISTEMAS: Combat, Weapon, Enemy, Ship, Spawn, Boss, Input
└── presentation/# PHASER: Boot (texturas procedurales), Menu, Game, GameOver, HUD, joysticks
```

La lógica de juego vive en `systems/` operando sobre datos declarativos; las
escenas se encargan de input, cámara y rendering. Las texturas pixel-art se
generan en `BootScene` (mapas de píxeles en código) y el audio es WebAudio
sintetizado (`core/audio.ts`).

## Estado del MVP (GDD §34)

- Jugador: movimiento, apuntado, disparo, vida, muerte, invulnerabilidad.
- Enemigos: Grunt, Charger (telegraph → carga → stun), Gunner (ráfagas), elites.
- Armas: Pistola, Plasma, Scatter + drops al morir (un arma equipada, swap en el suelo).
- Naves: Scout Saucer y Alien Bomber (estacionadas + voladoras), estados
  ENEMY → DISABLED (piloto muerto) → PLAYER_CONTROLLED → DESTROYED, eyección.
- Boss: Comandante Alien (ráfagas radiales, barrera apuntada, invocaciones,
  núcleo débil, enrage) → RUN COMPLETE.
- Rampa de dificultad por tiempo (0/2/4/6/8 min), una arena vertical 360×3200,
  obstáculos sólidos, HUD mínimo, estadísticas de run, menús PLAY / GAME OVER.
