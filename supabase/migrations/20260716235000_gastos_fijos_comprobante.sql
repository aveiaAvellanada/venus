-- Gastos Fijos gana comprobante fotográfico, igual que Gastos Variables.
-- Aditiva y nullable: los gastos fijos ya registrados siguen válidos sin foto.
alter table public.gastos_fijos
  add column if not exists comprobante_url text;
