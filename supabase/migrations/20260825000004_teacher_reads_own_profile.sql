-- A teacher had no select policy on profile at all (only "admin reads
-- profiles"), which was invisible until now: getPendingSubmissions looks up
-- "submitted by" names via a plain profile query, and every caller of it
-- was an admin until the teacher-facing "My requests" read-only view
-- (approvals page) started calling the exact same function -- RLS silently
-- returned zero rows for a teacher's own name, showing a blank "Submitted
-- by" instead of erroring. A teacher reading their own row (id, full_name,
-- role, branch_id) carries no risk, unlike reading arbitrary rows.
create policy "teacher reads own profile" on profile
  for select to authenticated
  using ((select auth_role()) = 'teacher' and id = (select auth.uid()));
