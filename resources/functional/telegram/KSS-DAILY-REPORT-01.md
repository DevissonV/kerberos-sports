# KSS Daily Report 01

El worker intenta emitir un resumen diario después de `DAILY_REPORT_TIME_BOGOTA`, con zona horaria
fija `America/Bogota`. El valor por defecto es `22:30`. Railway puede conservar el cron operativo
existente; no se requiere otro proceso scheduler.

La fecha se calcula en Bogotá, no en UTC. Una clave durable por día en SQLite impide un segundo
envío después de otro tick o un restart. El resumen separa predicciones, pendientes, resultados,
apuestas autorizadas, apuestas ejecutadas y métricas acumuladas. Un pendiente nunca se cuenta como
miss y siempre se muestra el tamaño de muestra.

Para revisar el formatter sin consumir la clave diaria ni enviar Telegram:

```bash
npm run daily-report:preview
npm run daily-report:preview -- 2026-09-18
```

El preview es de solo lectura respecto al estado de envío del reporte.
