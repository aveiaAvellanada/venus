# Venus - Guia para Claude Code

## Que es este proyecto
Venus es una app Android para gestionar la tienda de calzado familiar Venus en Florencia, Caqueta, Colombia. Reemplaza un cuaderno fisico con un sistema digital simple y poderoso.

## Usuarios
- Dueno (Don Carlos): Ve todo. Reportes, balance, analisis IA, empleado. Viaja frecuentemente, administra desde su celular.
- Empleado (Andres): Solo registra ventas, consulta inventario y recibe mercancia. NO ve reportes financieros ni margenes.

## Stack tecnologico
- React Native con Expo SDK 56 (TypeScript)
- Supabase (base de datos, auth, storage)
- expo-sqlite para offline-first
- Cliente Supabase en: lib/supabase.ts

## Modulos del sistema
1. Ventas (zapatos y productos varios)
2. Inventario calzado (Chanclas, Escolar, Botas caucho, Deportivo, Tennis, Clasico, Otros)
3. Inventario productos varios (cualquier producto que no sea zapato)
4. Proveedores (cuentas bancarias y documentos adjuntos)
5. Cierre de caja (automatico configurable o manual)
6. Gestion empleado (sueldo fijo, dias trabajados, historial pagos)
7. Reportes y dashboard del dueno
8. Analisis temporadas con IA
9. Gastos fijos (alertas y comprobantes)
10. Gastos variables
11. Balance real del negocio
12. Reportes automaticos WhatsApp y correo
13. Carga inicial inventario (Excel e IA con camara)

## Reglas criticas de negocio
- Venta confirmada NUNCA se elimina, solo se corrige con nota
- Inventario NUNCA queda en negativo
- Andres NO ve reportes financieros de periodos anteriores
- Andres NO ve costos de compra ni margenes
- Solo Don Carlos corrige ventas de dias anteriores
- Ventas parciales desuentan stock inmediatamente, quedan en estado Separado hasta pago completo
- Pagos mixtos permitidos (efectivo mas Nequi en una sola venta)
- Fotos se comprimen a maximo 500KB antes de subir

## Variables de entorno
- EXPO_PUBLIC_SUPABASE_URL
- EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY

## Convenciones de codigo
- TypeScript estricto en todo el proyecto
- lib/ para utilidades compartidas
- components/ para componentes reutilizables
- screens/ para pantallas
- hooks/ para custom hooks
- Todo en espanol en la UI

## No construir en esta version
- Facturacion electronica DIAN
- E-commerce o catalogo WhatsApp
- Nomina electronica
- Contabilidad formal
- Multiples sucursales
- App para iOS
- Panel web
