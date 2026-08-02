-- Recordatorio de vencimiento de contrato — feature de negocio identificada
-- en la investigación de mercado (rentistas/administradores necesitan saber
-- cuándo se vence un arriendo, no solo si el precio está a mercado).
alter table propiedades_portafolio add column fecha_vencimiento_contrato date;
