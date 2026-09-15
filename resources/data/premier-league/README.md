# Histórico Premier League — football-data.co.uk

Insumo estático para Poisson V1 (`KSS-POISSON-01`, cohorte `KSS-V1-C01`). Se descarga una sola vez
por temporada y se versiona en el repo: **cero requests en runtime** (`RUNTIME_HISTORICAL_REQUESTS=0`).

## Fuente y fecha de descarga

| Archivo       | URL fuente                                                | Descargado  |
| ------------- | ---------------------------------------------------------- | ----------- |
| `2425-E0.csv` | https://www.football-data.co.uk/mmz4281/2425/E0.csv         | 2026-09-15  |
| `2526-E0.csv` | https://www.football-data.co.uk/mmz4281/2526/E0.csv         | 2026-09-15  |
| `2627-E0.csv` | https://www.football-data.co.uk/mmz4281/2627/E0.csv         | 2026-09-15  |

## Columnas retenidas

El CSV original de football-data.co.uk trae decenas de columnas de cuotas históricas de múltiples
bookmakers (no usadas por Poisson V1). Se conservan solo las columnas que consume el parser:

```
Date, HomeTeam, AwayTeam, FTHG, FTAG, FTR
```

`Date` en formato original `dd/mm/yyyy`. `FTHG`/`FTAG` = goles de tiempo reglamentario (Full Time
Home/Away Goals). `FTR` = resultado (`H`/`A`/`D`).

## Refresco

Para actualizar `2627-E0.csv` conforme avanza la temporada 2026/27 (o añadir la temporada
siguiente cuando corresponda), volver a descargar el CSV de la URL de arriba y aplicar el mismo
recorte de columnas. No se automatiza en esta tarea (pendiente, ya señalado en
`resources/temp/KSS-HISTORY-GATE-01.md`).
