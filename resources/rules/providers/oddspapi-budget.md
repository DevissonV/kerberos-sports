# Presupuesto OddsPapi

Los full scans están limitados inicialmente a dos por día. El refinamiento prioriza fixtures
MODEL_ENABLED cercanos a T-6h, reutiliza cache y cuotas recientes cuando el flujo lo permite, y
aplica un budget guard antes de pedir el mercado.

No se solicitan odds para fixtures fuera de ventana ni para `OBSERVATION_ONLY`. El modelado
Poisson sin cuotas continúa y produce `MODEL_ANALYSIS`; el límite de mercado no debe elevarse
automáticamente.
