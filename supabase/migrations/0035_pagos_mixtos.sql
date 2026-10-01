-- ─────────────────────────────────────────────────────────────────────────
-- 0035 — Pagar un gasto con más de un medio.
--
-- Hasta ahora un gasto se pagaba con UN medio (`payment_method`, texto). Esto
-- agrega la posibilidad de dividirlo entre varios, cada uno con su monto:
-- "la mitad con Mercado Pago, la mitad en efectivo".
--
-- `payment_methods` es ADITIVA y nullable: un gasto con un solo medio sigue
-- usando sólo `payment_method`, como siempre (texto, no FK — el medio puede
-- borrarse y el gasto histórico igual tiene que seguir diciendo con qué se
-- pagó, misma razón que en 0020). Sólo cuando se divide entre dos o más se
-- llena `payment_methods` con el detalle y `payment_method` queda en null.
--
-- ADITIVA. Correr después de 0034.
-- ─────────────────────────────────────────────────────────────────────────

alter table transactions
  add column if not exists payment_methods jsonb;

comment on column transactions.payment_methods is
  'Cuando un gasto se paga con más de un medio: [{"medio": "Efectivo", "monto": 500}, ...]. Null si se pagó con uno solo (ver payment_method).';
