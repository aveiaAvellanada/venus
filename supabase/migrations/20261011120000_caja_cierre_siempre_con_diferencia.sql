-- Rediseño del carrito, bug A2 (docs/rediseno-carrito/README.md): cerrar la
-- caja debe llevar SIEMPRE a la pantalla de cierre (efectivo esperado,
-- efectivo contado, diferencia y justificación).
--
-- Con caja_config.modo_cierre = 'sin_diferencia', el menú solo pedía
-- "¿Seguro que quieres cerrar la caja?" y cerraba sin contar el efectivo. La
-- app ya no ofrece ese modo (se quitó el selector de Caja → Configuración y
-- siempre guarda 'con_diferencia'); aquí se normaliza el dato guardado, en
-- todas las filas (obtener_modo_cierre() toma la más antigua, así que una fila
-- extra con el valor viejo también lo activaba).
--
-- cerrar_caja no cambia: con 'con_diferencia' ya exige el efectivo contado.

update public.caja_config
  set modo_cierre = 'con_diferencia'
  where modo_cierre is distinct from 'con_diferencia';
