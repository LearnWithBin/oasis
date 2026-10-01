-- New tables created through a migration may not inherit API grants.
-- Only the trusted server key receives direct access; student writes remain RPC only.
grant select, insert, update, delete on public.classes, public.oases, public.items,
  public.star_ledger to service_role;
