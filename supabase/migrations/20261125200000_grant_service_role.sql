/*
 * The Edge Functions act as service_role, which skips row-level security but still
 * needs table privileges. The production project does not grant them by default,
 * so every function failed with "permission denied for table games".
 */
grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
alter default privileges in schema public grant execute on functions to service_role;