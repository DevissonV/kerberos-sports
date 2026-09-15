# Instrucciones para agentes de IA

Este archivo es la fuente canónica de reglas compartidas para cualquier agente que trabaje en
Kerberos Sports. Los archivos específicos de cada proveedor (Claude, Gemini, Copilot) deben apuntar
aquí y no duplicar estas reglas.

## Contexto esencial

Kerberos Sports es un proyecto personal de investigación de apuestas deportivas en modo
PAPER ONLY (sin dinero real, sin brokers, sin casas de apuestas). Alcance inicial: `FOOTBALL`
(único) y mercado candidato `MATCH_WINNER` (no congelado). Todo se valida con simulación y
métricas antes de considerar cualquier ejecución real.

**PAPER FIRST es una restricción del producto:** ningún agente debe introducir ejecución real,
integraciones pagas, infraestructura de deploy ni persistencia remota sin una instrucción
explícita del usuario.

## Relación con bot-kerberos

`~/Sites/personal/bot-kerberos` (Kerberos Crypto) es **referencia técnica de solo lectura**.
Se reutilizan sus principios arquitectónicos (feature-first + hexagonal), nunca su código de
trading, crypto ni infraestructura. Jamás se modifica desde este repo.

## Fuentes de verdad

1. Código, pruebas y `.env.example`: comportamiento implementado.
2. `README.md`: propósito, alcance y estado.
3. `REUSED.md` / `REMOVED.md`: qué se reutilizó y qué se excluyó deliberadamente de bot-kerberos.
4. `resources/temp/KSS-T*.md`: handoffs y decisiones por tarea.

Si una especificación contradice el código, no ocultes la diferencia; determina si la tarea pide
corregir la implementación o actualizar la documentación.

## Reglas de implementación

- TypeScript estricto plano. **Sin NestJS**, sin DI ceremonial, sin frameworks innecesarios.
- Arquitectura feature-first + hexagonal en `src/features/<feature>/{domain,application,ports,adapters}`.
  El dominio vive en la feature propietaria; no crear `src/domain` global ("cajón de sastre").
- Dominio determinista y puro: sin red, sin reloj invisible, sin persistencia.
- Las fronteras externas se modelan como puertos (interfaces) en `ports/` con sus adaptadores en
  `adapters/`. Puertos previstos: `FixturesProvider`, `OddsProvider`, `ResultsProvider`,
  `PaperBetStore`.
- Las funciones puras (`calculateEdge`, `calculateStake`, `calculateMetrics`) no requieren puertos
  ni interfaces.
- **Sin arquitectura ceremonial:** solo crear carpetas/archivos con contenido real. No boilerplate
  especulativo ni carpetas vacías "para después".
- Aplicar el cambio mínimo que complete los criterios de la tarea; evitar abstracciones por
  anticipación.
- Usar nombres e identificadores de código en inglés. Escribir comentarios, JSDoc, documentación y
  mensajes dirigidos al usuario en español.
- Los tipos y nombres documentan el qué. Agrega JSDoc solo cuando aporte propósito, restricciones o
  decisiones que la firma no pueda expresar.

## Flujo de trabajo

- Antes de editar, revisa el estado de Git y los archivos vecinos. Preserva cambios ajenos.
- Coloca pruebas junto al código que verifican (`*.spec.ts`), en `test/` o junto a la feature.
- Antes de cerrar un cambio, ejecuta `npm run validate` (format:check + lint + test + build).
  Nunca afirmes que una validación pasó si no fue ejecutada.
- Los mensajes de commit van en español con Conventional Commits
  (ej.: `refactor(arquitectura): ...`).
- Los handoffs de tarea se guardan en `resources/temp/` siguiendo el patrón `KSS-T*`.

## Contexto bajo demanda

No leas todo el repo ni todos los handoffs al iniciar. Carga solo lo necesario:

| Tarea                   | Contexto adicional                              |
| ----------------------- | ----------------------------------------------- |
| Commit                  | reglas de esta sección Flujo de trabajo         |
| Arquitectura            | `README.md` (sección Estructura)                |
| Historial de decisiones | handoff `KSS-T*` relevante en `resources/temp/` |
| Qué se reutilizó        | `REUSED.md` / `REMOVED.md`                      |
