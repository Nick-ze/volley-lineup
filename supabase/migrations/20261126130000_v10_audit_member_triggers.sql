-- v10 audit, after the independent review of 20261126120000 (docs/AUDIT_V10.md, "After the
-- fixes"; DECISIONS #303).
--
-- 1. Deleting a user in the dashboard (Authentication → Users) or through the auth admin API
--    runs as `supabase_auth_admin`, which has no rights on the app's tables. The foreign-key
--    cascade removes the user's memberships as the table owner, but the AFTER ROW triggers on
--    team_members fire at the end of the outer statement, as the role that deleted the user:
--    they failed with "permission denied for table team_members", and so did the deletion of
--    any user who belonged to a team. The three functions now run as their owner. They keep
--    `search_path = ''`, are not executable by any API role and can only run as triggers.
--    (The BEFORE trigger, the last-manager guard, already runs inside the cascade as the owner.)
--
-- 2. Codes created before 20261126120000 could already have outlived a demotion or a removal
--    (the hole that migration closed for everything afterwards). Demotions weren't recorded,
--    so every open manager code is revoked once, and every open code of a team from which
--    someone was removed after the code was created. Managers create new codes where needed.
--    On the hosted project this changes nothing: it had no invites when this was applied.
--
-- Nothing is dropped. Apply after 20261126120000_v10_audit_invite_revocation.sql.

alter function private.drop_empty_team() security definer;
alter function private.drop_member_holds() security definer;
alter function private.revoke_manager_invites() security definer;

update public.invites i set revoked_at = now()
where i.revoked_at is null
  and (i.role = 'manager'
       or exists (select 1 from private.team_removals r
                  where r.team_id = i.team_id and r.removed_at >= i.created_at));
