-- SP-1 RLS: compras (recepción staff, finanzas admin+dueño) y gastos.

-- compras
drop policy if exists compras_select on public.compras;
drop policy if exists compras_insert on public.compras;
drop policy if exists compras_update_owner on public.compras;
drop policy if exists compras_delete_owner on public.compras;
create policy compras_select on public.compras for select to authenticated
  using ((select private.is_staff_admin())
    or (registrada_por = (select auth.uid()) and estado = 'pendiente_revision'));
create policy compras_insert on public.compras for insert to authenticated
  with check ((select private.is_staff_admin())
    or ((select private.is_employee()) and estado = 'pendiente_revision'
        and registrada_por = (select auth.uid())
        and total is null and condicion_pago is null
        and monto_pagado = 0 and saldo_pendiente = 0));
create policy compras_update on public.compras for update to authenticated
  using ((select private.is_staff_admin())) with check ((select private.is_staff_admin()));
create policy compras_delete on public.compras for delete to authenticated
  using ((select private.is_staff_admin()));

-- compra_items
drop policy if exists compra_items_select on public.compra_items;
drop policy if exists compra_items_insert on public.compra_items;
drop policy if exists compra_items_update_owner on public.compra_items;
drop policy if exists compra_items_delete_owner on public.compra_items;
create policy compra_items_select on public.compra_items for select to authenticated
  using ((select private.is_staff_admin())
    or exists (select 1 from public.compras c where c.id = compra_id
      and c.registrada_por = (select auth.uid()) and c.estado = 'pendiente_revision'));
create policy compra_items_insert on public.compra_items for insert to authenticated
  with check ((select private.is_staff_admin())
    or ((select private.is_employee()) and costo_unitario is null and subtotal is null
      and exists (select 1 from public.compras c where c.id = compra_id
        and c.registrada_por = (select auth.uid()) and c.estado = 'pendiente_revision')));
create policy compra_items_update on public.compra_items for update to authenticated
  using ((select private.is_staff_admin())) with check ((select private.is_staff_admin()));
create policy compra_items_delete on public.compra_items for delete to authenticated
  using ((select private.is_staff_admin()));

-- compra_documentos: admin+dueño
drop policy if exists compra_docs_owner on public.compra_documentos;
create policy compra_docs_admin on public.compra_documentos for all to authenticated
  using ((select private.is_staff_admin())) with check ((select private.is_staff_admin()));

-- gastos_fijos / pagos: admin+dueño
drop policy if exists gastos_fijos_owner on public.gastos_fijos;
drop policy if exists gastos_fijos_pagos_owner on public.gastos_fijos_pagos;
create policy gastos_fijos_admin on public.gastos_fijos for all to authenticated
  using ((select private.is_staff_admin())) with check ((select private.is_staff_admin()));
create policy gastos_fijos_pagos_admin on public.gastos_fijos_pagos for all to authenticated
  using ((select private.is_staff_admin())) with check ((select private.is_staff_admin()));

-- gastos_variables: cualquier staff registra (ve lo suyo); admin+dueño gestionan todo
drop policy if exists gastos_variables_owner on public.gastos_variables;
create policy gastos_var_select on public.gastos_variables for select to authenticated
  using ((select private.is_staff_admin()) or created_by = (select auth.uid()));
create policy gastos_var_insert on public.gastos_variables for insert to authenticated
  with check ((select private.is_staff_admin()) or created_by = (select auth.uid()));
create policy gastos_var_update on public.gastos_variables for update to authenticated
  using ((select private.is_staff_admin())) with check ((select private.is_staff_admin()));
create policy gastos_var_delete on public.gastos_variables for delete to authenticated
  using ((select private.is_staff_admin()));
