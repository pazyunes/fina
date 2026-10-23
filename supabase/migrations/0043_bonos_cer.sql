-- Bonos CER: un tipo más de inversión que se puede registrar (Inversiones, renta fija).
--
-- La tabla investment_positions limita `kind` a una lista cerrada (migración 0039). Se amplía la lista
-- con 'bono_cer'. No toca ningún dato existente. Hasta que se corra, registrar un bono CER da error y el
-- resto de Inversiones sigue funcionando igual.

alter table investment_positions
  drop constraint if exists investment_positions_kind_check;

alter table investment_positions
  add constraint investment_positions_kind_check check (kind in (
    'cuenta_remunerada', 'fci', 'plazo_fijo', 'plazo_fijo_uva',
    'letra', 'bono_cer', 'dolar', 'cedear'));
