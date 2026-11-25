-- v10.0 — keep-alive (see docs/SUPABASE.md).
--
-- The free tier pauses a project after about a week without activity. The GitHub workflow
-- `supabase-keepalive.yml` reads this one-row table every 3 days with the publishable key.
-- It holds no data, which is why it is the only table `anon` may read.

create table public.keepalive (
  id smallint primary key check (id = 1),
  note text not null default 'ok'
);
insert into public.keepalive (id) values (1) on conflict do nothing;

alter table public.keepalive enable row level security;
revoke all on public.keepalive from public, anon, authenticated;
grant select on public.keepalive to anon; -- unauthenticated keep-alive read, no data

create policy keepalive_select_anyone on public.keepalive
  for select to anon
  using (true);
