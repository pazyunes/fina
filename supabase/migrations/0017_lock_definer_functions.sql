-- 0017 — Cerrar las funciones SECURITY DEFINER al público (fix de privacidad).
--
-- reserva_estado(uuid) y tickets_disponibles(uuid) son SECURITY DEFINER: corren
-- con los privilegios del owner y SALTEAN la RLS. Reciben un p_user_id arbitrario
-- y devuelven las finanzas de esa usuaria (reserva, disponible, gastos, topes).
--
-- Problema: por el default de Postgres, EXECUTE queda concedido a PUBLIC. Es
-- decir, cualquier cliente con la anon key podía llamarlas por RPC pasando el
-- UUID de OTRA usuaria y leerle sus datos financieros (vulnerabilidad tipo IDOR).
--
-- Estas funciones son SOLO para el bot de WhatsApp, que usa la service_role key
-- (que igual saltea la RLS). La app web NO las llama: calcula todo del lado del
-- cliente con los datos de la propia usuaria. Por eso restringirlas a
-- service_role cierra el hueco SIN romper nada.
--
-- Correr una vez en el SQL editor de Supabase.

revoke execute on function reserva_estado(uuid)      from public, anon, authenticated;
revoke execute on function tickets_disponibles(uuid) from public, anon, authenticated;

grant execute on function reserva_estado(uuid)      to service_role;
grant execute on function tickets_disponibles(uuid) to service_role;
