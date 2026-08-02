-- Idempotencia/orden del webhook de Stripe (auditoría 2026-08-02): Stripe no
-- garantiza el orden de entrega ni descarta reintentos por sí solo — un
-- customer.subscription.updated más viejo reentregado DESPUÉS de uno más
-- nuevo pisaba plan/current_period_end con el estado anterior. Se guarda el
-- timestamp del evento que produjo la última escritura; el webhook solo
-- aplica un evento si es igual o más nuevo que el ya aplicado.
alter table subscriptions add column if not exists stripe_event_created_at bigint;
