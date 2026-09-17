# KS-TELEGRAM-STATUS-LABELS-05

Telegram conserva los estados técnicos en logs y telemetría, pero los presenta al
operador mediante el mapper central `technicalStatus`:

| Estado técnico             | Texto visible                                               |
| -------------------------- | ----------------------------------------------------------- |
| `MATCH_STARTED`            | ⏱️ Partido ya iniciado                                      |
| `PREMATCH_WINDOW_CLOSED`   | ⏱️ Ventana prepartido cerrada                               |
| `OBSERVATION_ONLY`         | 👀 Liga todavía no habilitada para modelado                 |
| `INSUFFICIENT_HISTORY`     | 📊 Historial insuficiente                                   |
| `ALIAS_FAILURE`            | ⚠️ Equipo no identificado correctamente                     |
| `UNSUPPORTED_LEAGUE`       | 🚫 Liga todavía no soportada                                |
| `NO_ODDS` / `NO_BOOKMAKER` | 💰 Cuotas no disponibles                                    |
| `BUDGET_GUARD`             | ⚠️ Límite de consultas alcanzado temporalmente              |
| `NO_LONGER_ELIGIBLE`       | ⏱️ Ya no cumple las condiciones para seguimiento prepartido |
| desconocido                | ⚠️ No disponible para análisis                              |

En los descartes de hoy se mantiene el contador real, se muestran hasta tres
ejemplos y los restantes se resumen como partidos adicionales. El formatter no
modifica eligibility, razones, decisiones, probabilidades, stake ni Risk Gate.
