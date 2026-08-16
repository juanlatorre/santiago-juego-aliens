# Alien Heist

## Game Design Document v0.1

## 1. High Concept

**Alien Heist** es un shooter 2D top-down para celular, diseñado exclusivamente en formato vertical.

El jugador controla a un humano que combate contra aliens, roba sus armas y puede abordar y robar sus naves.

La característica central del juego es que **las naves enemigas no son solo enemigos o vehículos decorativos: son recursos que el jugador puede capturar y usar**.

La experiencia debe sentirse rápida, simple y caótica.

> Matar aliens → robar sus armas → robar sus naves → sobrevivir el mayor tiempo posible.

---

# 2. Pilares

## 2.1 Robar es mejor que comprar

El jugador no obtiene progresión principalmente mediante tiendas.

Las mejores herramientas se consiguen quitándoselas a los enemigos.

Esto aplica a:

* armas;
* naves;
* potencialmente habilidades o tecnología alienígena en versiones futuras.

---

## 2.2 A pie y en nave son dos formas distintas de jugar

El juego alterna constantemente entre dos estados.

### A pie

El jugador es:

* pequeño;
* vulnerable;
* ágil;
* capaz de entrar en estructuras;
* capaz de recoger armas;
* capaz de robar naves.

### En nave

El jugador es:

* más poderoso;
* más grande;
* más resistente;
* más rápido;
* capaz de usar armamento pesado.

Perder una nave **no significa perder la partida**.

Si la nave es destruida y el jugador sobrevive:

> nave destruida → eyección → continuar a pie.

---

## 2.3 Todo debe entenderse rápidamente

El juego está pensado para teléfono y sesiones cortas.

El jugador debe poder comprender las acciones principales sin tutorial extenso.

Las interacciones importantes deben ser visuales:

* arma en el suelo → recoger;
* nave disponible → entrar;
* nave enemiga → atacar;
* piloto muerto → robar nave.

---

# 3. Plataforma

## Plataforma inicial

Android.

## Orientación

**Portrait / vertical exclusivamente.**

Relación objetivo:

```text
9:16
```

Resolución lógica sugerida:

```text
360 × 800
```

El juego escala esta resolución al tamaño físico del dispositivo.

---

# 4. Género

* Action shooter.
* Top-down.
* Twin-stick.
* Roguelite ligero.
* Arcade.

No es inicialmente:

* RPG;
* juego de mundo abierto;
* juego narrativo;
* simulador espacial;
* extraction shooter;
* multiplayer.

---

# 5. Público objetivo

Principalmente jugadores que disfruten:

* acción inmediata;
* partidas cortas;
* progreso visible;
* armas diferentes;
* vehículos;
* caos emergente.

Debe ser comprensible para un niño sin requerir dominar sistemas complejos.

---

# 6. Core Fantasy

La fantasía principal es:

> **Estoy invadiendo territorio alienígena usando sus propias armas y naves contra ellos.**

Un momento representativo del juego:

1. El jugador avanza a pie.
2. Encuentra aliens defendiendo una nave.
3. Mata a uno.
4. Le roba un arma de plasma.
5. Destruye a los guardias.
6. Mata al piloto.
7. Se acerca a la nave y permanece ~0.7 s en su área (proximidad, sin botón).
8. Aparece `ROBAR NAVE` y el jugador entra.
9. La cámara se aleja ligeramente.
10. El jugador comienza a destruir enemigos usando la nave alienígena.

Ese momento debe aparecer durante los primeros minutos de juego.

---

# 7. Core Loop

```text
EXPLORAR
   ↓
ENCONTRAR ALIENS
   ↓
COMBATIR
   ↓
ROBAR ARMAS
   ↓
ENCONTRAR NAVE
   ↓
ELIMINAR TRIPULACIÓN
   ↓
ROBAR NAVE
   ↓
COMBATIR DESDE LA NAVE
   ↓
MEJORAR / CAMBIAR NAVE
   ↓
PERDER NAVE
   ↓
EYECTARSE
   ↓
VOLVER A SOBREVIVIR A PIE
```

El juego debe permitir repetir este loop varias veces dentro de una misma partida.

---

# 8. Estructura de una partida

Objetivo inicial:

**5–15 minutos por run.**

Una partida comienza con:

* jugador a pie;
* arma humana básica;
* vida completa;
* sin nave.

La dificultad aumenta progresivamente mediante:

* enemigos más numerosos;
* enemigos más fuertes;
* nuevas armas;
* naves más peligrosas;
* elites;
* eventualmente un boss.

La run termina cuando el personaje humano muere.

La destrucción de una nave no termina la run.

---

# 9. Cámara

Top-down.

La cámara sigue al jugador o nave actualmente controlada.

## A pie

Zoom relativamente cercano.

Debe permitir ver:

* jugador;
* enemigos cercanos;
* amenazas próximas;
* parte importante del espacio hacia donde el jugador avanza.

## En nave

La cámara se aleja ligeramente para comunicar:

* mayor escala;
* mayor velocidad;
* mayor poder.

La transición debe sentirse inmediata y satisfactoria.

---

# 10. Dirección del nivel

La dirección predominante del avance es:

**hacia arriba de la pantalla.**

Esto aprovecha el formato vertical.

El jugador puede moverse libremente, pero la composición del nivel debe incentivar:

```text
↑
↑
↑
AVANZAR
```

El contenido nuevo aparece principalmente hacia la parte superior.

---

# 11. Controles

Pensado para dos pulgares.

## Pie

### Joystick de movimiento (toda la pantalla)

Un solo joystick dinámico: aparece donde toques, en cualquier parte de la
pantalla, y mueve a la entidad controlada.

### Disparo automático

El arma **apunta y dispara sola** al enemigo más cercano dentro de ~430 px
(enemigos, naves hostiles y boss). No hay aim manual táctil: el joystick de
movimiento es el único control táctil.

### Interacción por proximidad

No hay botón de acción: acércate al objeto y permanece en su área.

* arma / escudo / botiquín: ~0.4 s en rango;
* robar nave: ~0.7 s en rango.

Una barra de progreso bajo el texto indica el avance. El progreso **no se
reinicia al moverse**, solo al salir del área del objeto (o cambiar de
objeto).

### Botón central (solo al pilotar)

Solo aparece al pilotar una nave: **SALIR DE LA NAVE** (mantener ~0.4 s).

---

# 12. HUD

Debe ser mínimo.

Parte superior:

```text
❤ ██████████░░           🔫 Plasma
```

Información inicial:

* vida (barra continua, verde → amarillo → rojo);
* escudo (🛡 X% bajo la barra, solo mientras hay escudo);
* arma actual;
* munición solo si el arma la requiere.

Cuando se controla una nave:

```text
🚀 ████████
```

Mostrar:

* integridad de nave;
* arma principal.

Evitar:

* minimapa inicialmente;
* múltiples barras;
* inventarios permanentes;
* números innecesarios.

---

# 13. Jugador

## Estado base

Humano.

Propiedades:

* vida;
* escudo (absorbe daño antes que la vida);
* velocidad;
* arma;
* posición;
* dirección;
* estado de invulnerabilidad temporal.

Valores del MVP pueden ser completamente arbitrarios y ajustarse durante pruebas.

Ejemplo:

```text
Vida: 150
Velocidad: media
Arma inicial: pistola
```

---

# 14. Combate

El combate debe priorizar:

* movimiento constante;
* lectura clara de proyectiles;
* feedback inmediato;
* enemigos simples con comportamientos diferenciables.

No buscamos inicialmente combate táctico complejo.

## Daño

Un impacto debe generar:

* flash visual;
* pequeña reacción;
* efecto;
* sonido;
* reducción clara de vida.

La muerte debe ser inmediata y visible.

---

# 15. Armas

Las armas son una fuente importante de variedad.

## MVP

### 15.1 Human Pistol

Arma inicial.

```text
Daño: bajo
Cadencia: media
Proyectil: bala
Precisión: alta
```

Objetivo:

Ser funcional pero poco emocionante.

---

### 15.2 Alien Plasma Gun

Primer upgrade evidente.

```text
Daño: medio
Cadencia: media
Proyectil: plasma
Velocidad: media
```

Debe sentirse claramente más poderosa que la pistola.

---

### 15.3 Scatter Blaster

Disparo múltiple.

```text
Daño: alto a corta distancia
Cadencia: baja
Proyectiles: múltiples
```

Promueve acercarse.

---

### 15.4 RÁFAGA (burst rifle)

Ráfaga de 3 disparos por ciclo.

```text
Daño: bajo por bala, alto por ráfaga
Cadencia: 3 disparos + pausa
Proyectil: bala rápida
```

Daño frontal concentrado: ideal para abrir escudos de golpe.

---

### 15.5 PENETRADOR (railgun)

Disparo único que **atraviesa** a todos los enemigos en línea.

```text
Daño: alto
Cadencia: baja
Proyectil: rayo rápido, penetrante
```

Destruye filas enteras; cuidado con el retroceso.

---

### 15.6 MISIL (homing)

Cohete que **persigue al enemigo más cercano** con giro limitado.

```text
Daño: alto
Cadencia: baja
Proyectil: lento, guiado
```

Impacto con explosión amplia; se puede esquivar en giros cerrados.

---

## Drops

Cuando muere un enemigo que porta arma:

puede dejarla caer.

El jugador puede reemplazar su arma actual.

Además, los enemigos pueden soltar un **escudo** y un **botiquín**:

al recoger el escudo el jugador recibe 50 de absorción antes que la vida;
el botiquín cura 50 HP. Ambos se recogen por proximidad.

MVP:

**una sola arma equipada.**

Sin inventario.

---

# 16. Aliens

Para el MVP existen tres enemigos principales.

## 16.1 Grunt

Alien básico.

Comportamiento:

* detecta al jugador;
* se acerca;
* mantiene distancia moderada;
* dispara.

Fácil de entender y matar.

---

## 16.2 Charger

Alien cuerpo a cuerpo.

Comportamiento:

* detecta jugador;
* prepara ataque;
* carga rápidamente;
* queda vulnerable tras fallar.

Obliga a moverse.

---

## 16.3 Gunner

Alien más peligroso.

Comportamiento:

* mantiene distancia;
* dispara ráfagas;
* se reposiciona.

Puede portar mejores armas.

## 16.4 Sniper

Mantiene distancia larga y dispara tiros pesados lentos.

## 16.5 Kamikaze

Corre hacia el jugador, enciende la mecha y **explota al contacto**.

## 16.6 Brute

Tanque lento con ráfagas cortas y daño por contacto.

---

# 17. Naves

Las naves son el sistema distintivo del juego.

Una nave puede tener estados:

```text
ENEMY
DISABLED
STEALABLE
PLAYER_CONTROLLED
DESTROYED
```

---

# 18. Robar una nave

Una nave enemiga no debe poder robarse simplemente tocándola mientras sigue activa.

Debe existir algún requisito claro.

Para MVP:

> **La nave queda robable cuando su piloto ha muerto o ha sido neutralizado.**

Mientras la nave está tripulada, **todo disparo impactado la neutraliza al
piloto** (no hay hitbox separada de cabina): dispara a la nave unas pocas
veces y quedará disponible para robar. Una vez muerto el piloto, los
disparos dañan el casco y pueden destruirla.

Flujo:

```text
NAVE ENEMIGA
↓
combate
↓
piloto eliminado
↓
nave disponible
↓
jugador se acerca
↓
ROBAR NAVE
↓
jugador entra
```

El botón contextual cambia a:

```text
ROBAR NAVE
```

Puede requerir mantener presionado brevemente.

---

# 19. Riesgo al robar naves

Las naves pueden recibir daño antes de ser robadas.

Esto crea una decisión:

> destruir la nave desde lejos

o

> intentar conservarla para robarla.

Una nave dañada permanece dañada cuando el jugador la roba.

No recupera automáticamente toda su vida.

---

# 20. Naves del MVP

## 20.1 Scout Saucer

La primera nave robable.

Características:

```text
Velocidad: alta
Vida: baja
Arma: doble láser
```

Debe sentirse mucho más poderosa que estar a pie.

---

## 20.2 Alien Bomber

Segunda nave.

Características:

```text
Velocidad: baja
Vida: alta
Arma: plasma pesado
```

Más difícil de capturar.

---

## 20.3 Interceptor

Caza rápido y frágil.

Características:

```text
Velocidad: muy alta
Vida: baja
Arma: scatter (ráfaga corta)
```

Ideal para abrir distancias; su arma destroza a corta distancia.

---

## 20.4 Alien Gunship

Nave de asalto media.

Características:

```text
Velocidad: media
Vida: media-alta
Arma: cañón de pulsos
```

Buena defensa y DPS constante.

---

# 21. Destrucción de la nave

Cuando la vida de la nave llega a cero:

```text
NAVE
↓
EXPLOSIÓN
↓
EYECTAR JUGADOR
↓
JUGADOR A PIE
```

El jugador recibe:

* breve invulnerabilidad;
* impulso o desplazamiento;
* feedback visual fuerte.

Si la situación lo permite, puede continuar inmediatamente.

Esta transición es parte del core loop, no un estado de error.

---

# 22. Spawn y dificultad

Para el MVP, el mundo puede ser una única arena grande o mapa generado mediante secciones simples.

No hace falta procedural generation complejo inicialmente.

El juego aumenta dificultad con el tiempo.

Ejemplo:

```text
0–2 min
Grunts

2–4 min
Grunts + Chargers

4–6 min
Gunners

6–8 min
más densidad + Scout Ships

**Dificultad seleccionable** (AJUSTES): fácil / normal / difícil — escala
vida y daño enemigo, cadencia de spawn, daño del jugador y puntaje
(+50 % en difícil, −25 % en fácil).

8+ min
Bomber + elites
```

---

# 23. Boss del MVP

La primera versión puede terminar con un boss.

## Alien Commander

Gran nave alienígena.

Características:

* alta vida;
* varios patrones de disparo;
* invoca enemigos;
* zonas vulnerables.

Al empezar la pelea de boss, **se detiene el spawn ambiental** de enemigos
y naves: el jugador se concentra solo en el comandante (sus invocaciones
siguen funcionando).

Al 25% de vida entra en **modo berserk**: patrón de espiral giratorio,
proyectiles más rápidos, casco rojo pulsante y tema musical propio.

El objetivo inicial es derrotarlo.

Después de derrotarlo:

```text
RUN COMPLETE
```

No es necesario poder robar esta nave en el MVP.

---

# 24. Progresión durante la run

La progresión debe ser principalmente física y visible.

Al inicio:

```text
humano
+
pistola
```

Luego:

```text
humano
+
arma alienígena
```

Después:

```text
nave pequeña
```

Más adelante:

```text
nave poderosa
+
armas mejores
```

La sensación debe ser:

> Empecé siendo insignificante y terminé usando su propia tecnología contra ellos.

**Power-ups de run:** los enemigos pueden soltar buffos temporales (~10 s):
ráfaga rápida, tiro triple, proyectiles penetrantes, velocidad e imán de
recogida. Se muestran con su contador en el HUD.

---

# 25. Meta progresión

**Fuera del MVP.**

Posteriormente podrían desbloquearse:

* nuevas armas iniciales;
* personajes;
* perks;
* naves;
* skins;
* zonas;
* mutaciones de run.

Pero el primer prototipo debe funcionar sin ningún sistema de progresión permanente.

Ya implementado (adelantado): **selector de skins** en AJUSTES (4 packs:
CLÁSICO, REBELDE, FANTASMA, IMPERIAL). Cada pack incluye el traje del
jugador **y diseños de naves distintos** (geometrías y paletas propias:
angulares, elegantes, con adornos). Las naves enemigas conservan el diseño
clásico para distinguirlas; al robar una nave, se repinta con el pack
seleccionado. Persistido en `localStorage`, sin desbloqueos.

---

# 26. Level Design

El mapa debe usar zonas claramente diferenciadas.

Ejemplo futuro:

```text
Crash Site
↓
Alien Outpost
↓
Bio Lab
↓
Shipyard
↓
Command Center
```

MVP:

una sola zona.

### Arena alienígena

Contiene:

* obstáculos;
* enemigos;
* pequeñas estructuras;
* naves estacionadas;
* espacios abiertos para combates.

---

# 27. Obstáculos

Inicialmente:

* muros;
* rocas;
* cajas alienígenas;
* estructuras.

Deben bloquear:

* movimiento;
* proyectiles cuando corresponda.

No hace falta destrucción ambiental inicialmente.

---

# 28. Arte

## Dirección

Pixel art.

Top-down.

Inspiración conceptual:

* ciencia ficción colorida;
* aliens exagerados;
* tecnología fácilmente reconocible;
* silhouettes muy claras.

No buscar realismo.

---

# 29. Escala visual

El jugador debe ser pequeño comparado con las naves.

Ejemplo aproximado:

```text
Jugador: 24×24 / 32×32

Alien: 24×24 / 32×32

Scout Ship: 64×64

Bomber: 96×96
```

Los tamaños finales dependen del resultado visual.

---

# 30. Feedback visual

Toda acción importante debe sentirse.

## Disparo

* muzzle flash;
* proyectil;
* sonido;
* pequeño recoil.

## Impacto

* flash;
* partículas;
* sonido;
* número de daño flotante;
* vibración (haptics) en nativo: golpe recibido, kill, robo de nave.

## Puntaje

* PUNTOS y multiplicador de combo (×1–×5) en el HUD;
* la racha se rompe al recibir daño o tras 3.5 s sin kills.

## Muerte

* pequeña explosión o animación.

## Robo de nave

* efecto especial;
* cámara cambia;
* sonido distintivo;
* HUD cambia.

## Destrucción de nave

Debe ser uno de los eventos visualmente más fuertes.

---

# 31. Audio

No es prioridad del primer prototipo, pero debe existir suficiente feedback para evaluar gameplay.

Mínimos:

* disparo humano;
* plasma;
* impacto;
* muerte alien;
* explosión;
* entrada a nave;
* destrucción de nave.

Música: bucle ambiental procedural (Am–F–C–G, pad + bajo + arpegio) que suena
en menú y partida.

Ajustes (GDD §32): desde el menú principal, AJUSTES permite **desactivar y
cambiar el volumen** por separado de la música y de los efectos. Los valores
se guardan en `localStorage`.

---

# 32. Menús

MVP:

```text
JUGAR
AJUSTES  ← música / efectos: volumen y mute
        ← una mano (AUTO): on/off
        ← SKIN: 4 trajes
```

En partida:

* botón ⏸ de pausa (**mantener ~0.3 s** — un toque rápido no pausa, para
  evitar pausas accidentales durante el combate);
* pausa automática al pasar la app a segundo plano.

Nada más es estrictamente necesario.

Al morir:

```text
GAME OVER

TIME
KILLS
SHIPS STOLEN

[ PLAY AGAIN ]
```

---

# 33. Estadísticas de run

Registrar:

* puntaje total;
* combo máximo;
* tiempo sobrevivido;
* enemigos eliminados;
* naves robadas;
* naves destruidas;
* arma más usada.

**Récords locales:** el top 5 de puntuaciones se guarda en el dispositivo
(`localStorage`) y se muestra en la pantalla de resultados y en el menú
principal. El récord nuevo se resalta (🏆). Los leaderboards online siguen
fuera de alcance (§36).

No necesitan persistencia inicialmente.

---

# 34. MVP

El primer vertical slice debe contener únicamente:

## Player

* movimiento;
* apuntado;
* disparo;
* vida;
* muerte.

## Enemies

* Grunt;
* Charger;
* Gunner.

## Weapons

* Pistol;
* Plasma Gun;
* Scatter Blaster.

## Ships

* Scout Saucer;
* Bomber.

## Systems

* combate;
* drops;
* daño;
* robo de armas;
* robo de naves;
* control de naves;
* eyección;
* game over.

## Level

* una arena;
* una zona visual;
* enemigos;
* naves.

## Boss

* uno.

---

# 35. Primera prueba jugable

Antes de construir el juego completo, el primer prototipo debe demostrar únicamente este flujo:

```text
1. Player aparece.

2. Player camina.

3. Player dispara.

4. Player mata un alien.

5. Alien deja Plasma Gun.

6. Player recoge Plasma Gun.

7. Player encuentra Scout Saucer.

8. Player mata al piloto.

9. Player se acerca.

10. Aparece ROBAR NAVE.

11. Player roba la nave.

12. Player puede mover la nave.

13. Player puede disparar desde la nave.

14. Enemigos destruyen la nave.

15. Player sale eyectado.

16. Player sigue jugando a pie.
```

**Si este flujo no es divertido, no se construyen sistemas adicionales.**

---

# 36. Fuera de alcance inicialmente

No implementar todavía:

* multiplayer;
* cuentas;
* backend;
* leaderboards;
* battle pass;
* tiendas;
* monetización;
* crafting;
* inventario;
* diálogos;
* historia compleja;
* quests;
* procedural generation avanzado;
* múltiples planetas;
* skill trees;
* online;
* cloud saves;
* achievements;
* skins;
* armas con cientos de stats;
* personalización de naves.

---

# 37. Principio de diseño

Cada nueva funcionalidad debe responder:

> ¿Hace más entretenido combatir, robar tecnología alienígena o cambiar entre humano y nave?

Si no fortalece uno de esos elementos, probablemente no pertenece al núcleo del juego.

---

# 38. Restricciones técnicas

El proyecto debe ser totalmente code-first.

Stack objetivo:

```text
TypeScript
Vite
Phaser
Capacitor
```

No utilizar:

* Unity;
* Godot;
* Unreal;
* editores visuales como requisito;
* lógica almacenada en archivos difíciles de revisar por agentes.

Assets visuales pueden ser PNG/spritesheets.

Datos de gameplay deben preferentemente ser declarativos:

```text
weapons.ts
ships.ts
enemies.ts
```

---

# 39. Arquitectura deseada para agentes

Separar:

```text
GAME RULES
↓
GAME STATE
↓
SYSTEMS
↓
PHASER PRESENTATION
```

Evitar que toda la lógica viva dentro de una única `Scene`.

Ejemplo conceptual:

```text
Player
Alien
Ship

CombatSystem
WeaponSystem
ShipStealingSystem
SpawnSystem
```

Esto permite que agentes modifiquen mecánicas sin romper rendering o input innecesariamente.

---

# 40. Definición de éxito del prototipo

El prototipo es exitoso si un jugador puede:

1. comenzar a jugar sin instrucciones;
2. entender cómo moverse y disparar;
3. identificar que puede recoger un arma;
4. descubrir que puede robar una nave;
5. sentir una diferencia evidente al controlar la nave;
6. perder la nave sin terminar la partida;
7. querer encontrar otra nave.

La señal más importante es:

> **“Quiero robar otra nave.”**

Si el juego genera esa reacción, el core loop funciona.
