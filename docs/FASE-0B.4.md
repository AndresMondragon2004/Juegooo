# Fase 0B.4 — Entrega técnica

Implementación del ciclo de partida sobre el proyecto existente. La validación visual en navegador y dispositivos continúa pendiente. No se hicieron commits, pushes ni despliegues.

## Arquitectura y comportamiento

`RoundController` mantiene MENU, PLAYING, PAUSED y GAME_OVER sin depender de Phaser. `ScoreSystem` calcula puntuación y estadísticas. `RecordStore` encapsula localStorage con respaldo en memoria durante la sesión. `GameScene` conecta estos módulos con los eventos tipados del gestor y con `GameUI`.

- MENU → PLAYING: Comenzar. Menú sin movimiento, misiles, cronómetro ni puntos.
- PLAYING → PAUSED: P, Escape, botón táctil, pérdida de visibilidad o foco.
- PAUSED → PLAYING: reanudación explícita, siempre que la página sea visible. Nunca se reanuda al recuperar foco automáticamente.
- PLAYING → GAME_OVER: primer evento `airplaneHit` válido.
- GAME_OVER → PLAYING: Volver a jugar reinicia la escena, sin recargar la página.

Se conserva el delta de simulación existente limitado a 0,1 segundos. Al comenzar o reanudar se descarta el primer frame de transición para evitar acumular tiempo de inactividad. No se cambió la cinemática, persecución, generación inteligente, cámara ni distribución de nubes.

## Puntuación y orden temporal

Configuración central en `src/config/roundConfig.ts`:

- 10 puntos por segundo simulado.
- 100 puntos por pareja destruida, una colisión y dos misiles destruidos.
- Total: parte entera inferior de tiempo × 10, con tolerancia numérica de coma flotante, más 100 × colisiones. El tiempo conserva sus fracciones internamente. HUD y resultados comparten este total y el formato minutos:segundos con segundos truncados.
- Los IDs participantes impiden duplicados, parejas invertidas y reutilizar un misil ya contabilizado durante esa partida.
- Caducidad de combustible e impactos contra el avión no dan puntos de colisión.

Se conserva el detector continuo de la fase anterior. Los contactos se ordenan por instante de contacto; los empates exactos priorizan misil-misil y después IDs léxicos. El gestor emite `missilesCollided` y el nuevo `airplaneHit` en ese orden. Al primer contacto con el avión detiene la resolución y las actualizaciones posteriores.

El instante final es `inicioDelPaso + fracciónDeContacto × dt`. Las colisiones anteriores al impacto final y las parejas independientes en empate exacto ya resueltas se contabilizan. Ningún contacto posterior aporta puntos. El avión se sitúa en su centro interpolado al impacto; las demás entidades quedan congeladas con la integración del último paso, sin nuevas actualizaciones físicas.

## Récord, pausa y destrucción

Se guarda solamente un entero con la clave `juegooo.best-score.v1`. Se validan datos almacenados y se conserva el mayor valor conocido. Al terminar se vuelve a consultar el almacenamiento para respetar récords guardados por otra pestaña. Un error al acceder o escribir no impide jugar; el récord persiste en memoria mientras viva la sesión.

La pausa deja de ejecutar la simulación, no solo oculta el juego. Se retiran controles, se congelan misiles, generación, dificultad y estadísticas. Se reconstruyen los controles al reanudar con teclas y gesto táctil limpios.

Game Over congela la simulación y las estadísticas. Solo avanzan efectos cosméticos. El avión se oculta y se dibuja una explosión roja y blanca con doble anillo, destello y doce partículas, diferente del efecto amarillo entre misiles. Dura 0,65 segundos; los resultados aparecen a los 0,8 segundos. No hay filtros ni dependencias nuevas de ejecución.

## Interfaz y limpieza

Interfaz DOM fija sobre el canvas, independiente de la cámara: menú, HUD de tiempo/puntos/pausa, pausa y resultados. CSS contempla áreas seguras, botones de al menos 48 píxeles de alto, orientación horizontal y contenido desplazable en alturas reducidas. Los eventos de puntero de la interfaz no se propagan como control de vuelo.

El reinicio usa `scene.restart({ autoStart: true })`. Shutdown retira eventos de escena, resize, visibilidad, foco y teclado; destruye controles, UI, efectos, renderizadores, fondo y gestor. Se reconstruyen modelos, IDs, temporizadores, progresión y estadísticas. Se conserva el objeto del récord y las texturas compartidas. Se corrigió la retirada de teclas del registro de Phaser y de listeners de gestos del canvas.

## Archivos creados

- `src/config/roundConfig.ts`
- `src/core/game/RoundController.ts`
- `src/core/game/ScoreSystem.ts`
- `src/core/game/RecordStore.ts`
- `src/rendering/AirplaneExplosion.ts`
- `src/ui/GameUI.ts`
- `src/ui/gameUI.css`
- `tests/game/RoundController.test.ts`
- `tests/game/CollisionScoring.test.ts`
- `tests/game/GameScene.test.ts`
- Este informe.

## Archivos modificados

- `src/scenes/GameScene.ts`
- `src/core/missile/MissileManager.ts`
- `src/rendering/MissileRenderer.ts`
- `src/rendering/AirplaneRenderer.ts`
- `src/input/DesktopKeyboardInput.ts`
- `src/input/TouchInputManager.ts`
- `src/main.ts`
- `index.html`
- `package.json` y `package-lock.json`: jsdom, exclusivamente para desarrollo/pruebas.

## Pruebas automatizadas

Se mantienen las 83 anteriores y se agregan 51:

- 31 de estado, puntuación, deduplicación, tiempo, pausa, reinicio, récord, errores de almacenamiento y cambios externos de récord.
- 6 de integración con MissileManager real y renderizadores sustituidos: recompensa antes del impacto, corte después, empate, inversión del arreglo y caducidad sin recompensa.
- 14 de lógica real de GameScene e interfaz DOM con Phaser/gráficos sustituidos: menú, controles, pausa, visibilidad, Game Over, resultados, explosión, cinco reinicios, retirada de listeners y contenido a 390×844, 844×390 y 1280×720.

Los tests de escena emulan shutdown/create de Phaser. No son una ejecución real del renderizador ni una medición de rendimiento o fugas del navegador.

## Verificación visual y limitaciones

Se intentó inspeccionar la ventana local del juego con Computer Use. La herramienta detuvo la interacción porque no pudo determinar la URL del navegador con suficiente confianza. No se consiguieron verificar visualmente menú, explosiones, tamaños, orientación ni cinco reinicios en navegador. Las pruebas DOM no prueban media queries ni geometría real.

Pendientes: validación manual en escritorio y celular, rendimiento prolongado, visualización de efectos y comportamiento bajo el ciclo real de Phaser. No quedaron herramientas temporales de depuración en el juego.

## Cómo probar manualmente

1. Ejecutar `npm run dev` y abrir la dirección que indique Vite.
2. Dejar el menú varios segundos: sin movimiento ni amenazas. Pulsar Comenzar.
3. Verificar HUD y aproximadamente 10 puntos por segundo de simulación. Girar con A/D, flechas o arrastre.
4. Pausar con botón, P y Escape; comprobar congelación y reanudación sin salto. Cambiar de pestaña y regresar: debe seguir en pausa.
5. Sobrevivir al menos 20 segundos y provocar cruces entre dos misiles. Cada pareja suma 100 puntos adicionales, una colisión y dos misiles destruidos.
6. Recibir un impacto: comprobar explosión roja/blanca, fin de controles y resultados tras la transición. Comparar puntuación, tiempo y estadísticas.
7. Pulsar Volver a jugar cinco veces tras perder. Verificar inicio en origen, sin misiles anteriores y cronómetro/puntos reiniciados. El récord debe conservarse.
8. Recargar la página y comprobar el récord local. Repetir en móvil vertical/horizontal y escritorio; comprobar botones, áreas seguras y legibilidad.

La fase no incorpora habilidades, backend, monetización ni otros sistemas posteriores.

## Validación técnica final

- `npm run typecheck`: aprobado.
- `npm run test`: 134 pruebas aprobadas en 11 archivos; 83 anteriores más 51 nuevas.
- `npm run build`: aprobado, 33 módulos transformados.
- Bundle JavaScript: 1.521,13 kB, gzip 351,50 kB.
- CSS: 3,70 kB, gzip 1,29 kB.
- HTML: 1,18 kB, gzip 0,63 kB.
- Advertencia de Vite: chunk JavaScript superior a 500 kB. No se modificó la estrategia de empaquetado en esta fase.

Una compilación correcta no sustituye las comprobaciones visuales pendientes descritas arriba.
