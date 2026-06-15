-- SP-2 esquema: calzado precio mín/máx; Granja sin stock + precio_sugerido; venta_items snapshot.

-- productos_calzado: añadir mín/máx, backfill desde precio_venta, constraint de rango, drop precio_venta
alter table public.productos_calzado add column if not exists precio_minimo numeric(12,2) not null default 0 check (precio_minimo >= 0);
alter table public.productos_calzado add column if not exists precio_maximo numeric(12,2) not null default 0 check (precio_maximo >= 0);
update public.productos_calzado set precio_minimo = precio_venta, precio_maximo = precio_venta;
alter table public.productos_calzado drop constraint if exists productos_calzado_rango_precio;
alter table public.productos_calzado add constraint productos_calzado_rango_precio check (precio_maximo >= precio_minimo);
drop trigger if exists trg_calzado_precio_hist on public.productos_calzado;
alter table public.productos_calzado drop column if exists precio_venta;

-- productos_varios (Granja): reemplazar precio_venta por precio_sugerido (nullable), quitar stock
alter table public.productos_varios add column if not exists precio_sugerido numeric(12,2) check (precio_sugerido >= 0);
update public.productos_varios set precio_sugerido = precio_venta;
drop trigger if exists trg_varios_precio_hist on public.productos_varios;
alter table public.productos_varios drop column if exists precio_venta;
alter table public.productos_varios drop column if exists stock_actual;
alter table public.productos_varios drop column if exists stock_minimo;

-- venta_items: snapshot del rango de calzado vigente al vender (null en Granja)
alter table public.venta_items add column if not exists precio_minimo_snapshot numeric(12,2);
alter table public.venta_items add column if not exists precio_maximo_snapshot numeric(12,2);
