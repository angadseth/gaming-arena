-- IITM BS also issues @mg.study.iitm.ac.in student emails; let them sign in.
-- The auth hook and the auth.users trigger both read this list through email_domain_allowed().
-- Safe to run twice.
update public.app_settings
set value = '["ds.study.iitm.ac.in", "es.study.iitm.ac.in", "mg.study.iitm.ac.in"]'::jsonb
where key = 'allowed_email_domains';
