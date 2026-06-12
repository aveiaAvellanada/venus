# Venus — Guía para Claude Code

## Qué es este proyecto
Venus es una app Android para gestionar la tienda de calzado familiar "Venus"
en Florencia, Caquetá, Colombia. Reemplaza un cuaderno físico con un sistema
digital simple y poderoso.

## Usuarios
- Dueño (Don Carlos): Ve todo. Reportes, balance, análisis IA, empleado. Viaja frecuentemente.
- Empleado (Andrés): Solo registra ventas, consulta inventario y recibe mercancía. NO ve reportes financieros ni márgenes.

## Stack tecnológico
- React Native con Expo SDK 56 (TypeScript)
- Supabase (base de datos, auth, storage)
- expo-sqlite para offline-first
- Cliente Supabase en: lib/supabase.ts

## Módulos
1. Ventas (zapatos y productos varios)
2. Inventario calzado (Chanclas, Escolar, Botas caucho, Deportivo, Tennis, Clasico, Otros)
3. Inventario productos varios
4. Proveedores (cuentas bancarias y documentos)
5. Cierre de caja (automatico o manual)
6. Gestion empleado (sueldo fijo, dias trabajados, historial pagos)
7. Reportes y dashboard del dueno
8. Analisis temporadas con IA
9. Gastos fijos (alertas y comprobantes)
10. Gastos variables
11. Balance real del negocio
12. Reportes automaticos WhatsApp y correo
13. Carga inicial inventario (Excel e IA con camara)

## Reglas criticas
- Venta confirmada NUNCA se elimina, solo se corrige con nota
- Inventario NUNCA queda en negativo
- Andres NO ve reportes financieros ni margenes ni costos
- Solo Don Carlos corrige ventas de dias anteriores
- Ventas parciales descuentan stock, quedan en estado Separado
- Pagos mixtos permitidos (efectivo mas Nequi en una venta)
- Fotos comprimir a maximo 500KB antes de subir

## Variables de entorno
- EXPO_PUBLIC_SUPABASE_URL
- EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY

## Convenciones
- TypeScript estricto
- lib/ para utilidades, components/ para componentes, screens/ para pantallas, hooks/ para hooks
- Todo en español en la UI

## No construir en esta version
- Facturacion DIAN
- E-commerce
- Nomina electronica
- Contabilidad formal
- Multiples sucursales
- iOS
- Panel web
