# Instrucciones para agentes de IA

Este archivo es la fuente canónica de reglas compartidas para cualquier agente que trabaje en
Kerberos Sports. Los archivos específicos de cada proveedor (Claude, Gemini, Copilot) deben apuntar
aquí y no duplicar estas reglas.

## Contexto esencial

Kerberos Sports es un proyecto personal de investigación de apuestas deportivas en modo
PAPER ONLY (sin dinero real, sin brokers, sin casas de apuestas). Alcance inicial: `FOOTBALL`
(único). Cohorte congelada `KSS-V1-C01` (fuente autoritativa: `resources/temp/KSS-PROTOCOL-01.md`):
English Premier League única (`league.id=39`, `country=England`, nunca por nombre de liga),
mercado `OVER_UNDER_2_5`, ventana de decisión `T-6h`, bookmaker primario Pinnacle con fallback
Bet365. `MATCH_WINNER` ya no es mercado candidato de esta cohorte. QUANT (Poisson) y Luna están
planeados pero NO implementados: el pipeline actual no tiene modelo propio (`edge=0`,
`NO_BET_PIPELINE_ONLY` fijo). Todo se valida con simulación y métricas antes de considerar
cualquier ejecución real.

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

- **Kerberos Sports usa NestJS como chasis**, homólogo técnico de `bot-kerberos` (misma versión
  mayor de NestJS y de Node). Nest solo orquesta módulos, DI de adapters y casos de uso; jamás
  contamina el dominio: las funciones puras (`calculateEdge`, `calculateStake`, `calculateMetrics`,
  matching, normalización) no importan `@nestjs/*`, no llevan decoradores y siguen siendo
  testeables sin el framework (ver `test/domain.no-nest-imports.spec.ts`). Esto sigue siendo
  **PAPER ONLY**: Nest no habilita ejecución real, solo reemplaza el bootstrap plano por
  `ApplicationContext`/módulos.
- Arquitectura feature-first + hexagonal en `src/features/<feature>/{domain,application,ports,adapters}`
  - `<feature>.module.ts`. El dominio vive en la feature propietaria; no crear `src/domain` global
    ("cajón de sastre").
- Dominio determinista y puro: sin red, sin reloj invisible, sin persistencia.
- Las fronteras externas se modelan como puertos (interfaces) en `ports/` con sus adaptadores en
  `adapters/`. Puertos vigentes: `FixturesProvider`, `OddsProvider`, `ResultsProvider`,
  `PaperBetStore`, `NotificationPort`. Aplicá hexagonal de forma **pragmática, no estricta** (igual
  que `bot-kerberos`): un puerto se justifica cuando hay más de un caso de uso real (ej. paper vs.
  futura ejecución real, o más de un proveedor de datos); no crear una interfaz/puerto nuevo "por si
  acaso" para una pieza trivial con un solo consumidor y sin sustituto previsto.
  `ResultsProvider` (`src/features/scanning/ports/resultsProvider.ts`) es el contrato mínimo de
  settlement: existe SIN adapter ni registro en `scanning.module.ts` todavía (implementar el
  adapter es trabajo de una tarea futura, no ceremonial: el puerto ya tiene un consumidor
  previsto).
- Las funciones puras (`calculateEdge`, `calculateStake`, `calculateMetrics`) no requieren puertos
  ni interfaces.
- Los adapters que Nest instancia vía `useFactory` (constructor manual con `new`, patrón usado en
  todos los adapters actuales) no necesitan `@Injectable()`: solo lo llevan las clases que Nest
  gestiona directamente en `providers` (p. ej. un `*Service` con dependencias inyectadas).
- **Sin arquitectura ceremonial:** solo crear carpetas/archivos con contenido real. No boilerplate
  especulativo ni carpetas vacías "para después"; no crear `<feature>.module.ts` para una feature
  que todavía no tiene adapters/servicios reales que orquestar.
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
