-- Reajuste de renta pactado — Ley 18.101 Art. 13: el reajuste debe estar
-- PACTADO explícitamente en el contrato de arriendo, nunca aplicado
-- unilateralmente. El problema de negocio real: arriendos comerciales que
-- quedan "congelados" porque nadie en el portafolio aplica el reajuste ya
-- pactado — fuga de ingresos que hoy nadie detecta. Mismo patrón de columnas
-- nullable-por-defecto que fecha_vencimiento_contrato
-- (20260808_propiedades_portafolio_vencimiento.sql): no se fabrica un valor
-- cuando el usuario no lo ha declarado todavía.
alter table propiedades_portafolio
  add column reajuste_aplica boolean not null default false,
  add column reajuste_periodicidad_meses integer,
  add column reajuste_fecha_ultimo date;
