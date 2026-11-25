-- Creates three test users that can sign in with email + password, for scripts/sync-live-check.mjs
-- and web QA. The app itself only offers the email code; password sign-in exists for tests only.
--
--   vl-test-1@example.test, vl-test-2@example.test, vl-test-3@example.test
--
-- Run as `postgres` (SQL editor, psql or the MCP tool `execute_sql`). The password is either the
-- one you set first in the same session/script:
--     select set_config('vl.test_password', '<at least 12 characters>', false);
-- or, if none is set, a random one. The last result row shows the password: put it into
-- VL_TEST_PASSWORD for the live check. Running the script again resets the password.
--
-- Delete the users afterwards with supabase/tests/test-users-cleanup.sql. Never leave them on a
-- production project longer than the test needs: anyone with the password could sign in as them.

begin;

create temporary table vl_test_password on commit drop as
select coalesce(nullif(current_setting('vl.test_password', true), ''),
                encode(extensions.gen_random_bytes(12), 'hex')) as password;

do $$
begin
  if char_length((select password from vl_test_password)) < 12 then
    raise exception 'vl.test_password must have at least 12 characters';
  end if;
end $$;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token,
  is_sso_user, is_anonymous)
select '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
       extensions.crypt(p.password, extensions.gen_salt('bf', 10)), now(),
       '{"provider":"email","providers":["email"]}', '{}', now(), now(),
       -- GoTrue expects empty strings, not NULL, in these token columns.
       '', '', '', '', '', '', '', '',
       false, false
from (values ('e2e00000-0000-4000-8000-000000000001'::uuid, 'vl-test-1@example.test'),
             ('e2e00000-0000-4000-8000-000000000002'::uuid, 'vl-test-2@example.test'),
             ('e2e00000-0000-4000-8000-000000000003'::uuid, 'vl-test-3@example.test')) u (id, email)
cross join vl_test_password p
on conflict (id) do update
  set encrypted_password = excluded.encrypted_password,
      email_confirmed_at = coalesce(auth.users.email_confirmed_at, excluded.email_confirmed_at),
      updated_at = now();

-- An email identity per user, so password sign-in works like for a normal email account.
insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at,
                             created_at, updated_at)
select u.id::text, u.id,
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true,
                          'phone_verified', false),
       'email', now(), now(), now()
from auth.users u
where u.id in ('e2e00000-0000-4000-8000-000000000001', 'e2e00000-0000-4000-8000-000000000002',
               'e2e00000-0000-4000-8000-000000000003')
on conflict (provider_id, provider) do nothing;

select u.email, p.password
from auth.users u cross join vl_test_password p
where u.email like 'vl-test-_@example.test'
order by u.email;

commit;
