-- Forward-only permission hardening for the SECURITY DEFINER quota function.
revoke all on function public.consume_growth_event_quota(text, integer) from public;
revoke all on function public.consume_growth_event_quota(text, integer) from anon;
revoke all on function public.consume_growth_event_quota(text, integer) from authenticated;
grant execute on function public.consume_growth_event_quota(text, integer) to service_role;
