-- =====================================================================
-- Offensive usernames are refused at the database, not just in the UI.
-- blocked_words: whole = false matches anywhere in the name (after
-- leetspeak and repeated letters are folded: "fuuuck", "b1tch", "f_u_c_k");
-- whole = true only matches a complete part of the name split on _ and
-- digits, so short words do not hit real names ("ass" never blocks
-- "aasim", "chod" never blocks "chodankar", "gand" never blocks "gandhi").
-- To add a word later: insert into public.blocked_words values ('word', false);
-- =====================================================================

create table public.blocked_words (
  word  text primary key check (word ~ '^[a-z]{2,20}$'),
  whole boolean not null default false
);
alter table public.blocked_words enable row level security;
-- No grants: clients never read or write it; the functions below do.

insert into public.blocked_words (word, whole) values
  -- English, anywhere in the name
  ('fuck', false), ('fuk', true), ('fck', true), ('bitch', false), ('bastard', false), ('cunt', false),
  ('whore', false), ('slut', false), ('nigga', false), ('nigger', false), ('faggot', false), ('fagot', false),
  ('pussy', false), ('pusy', false), ('penis', false), ('vagina', false), ('porn', true), ('porno', false), ('pornhub', false), ('rapist', false),
  ('motherf', false), ('asshole', false), ('ashole', false), ('dickhead', false), ('blowjob', false),
  ('jerkoff', false), ('wanker', false), ('retard', false), ('terrorist', false), ('hitler', false),
  -- English, whole part only
  ('ass', true), ('arse', true), ('dick', true), ('cock', true), ('sex', true), ('sexy', true),
  ('boob', true), ('boobs', true), ('tits', true), ('rape', true), ('cum', true), ('anal', true),
  ('nazi', true), ('fag', true), ('hoe', true), ('wtf', true), ('stfu', true), ('shit', true), ('bullshit', false),
  -- Hindi / Hinglish, anywhere in the name
  ('chutiya', false), ('chutia', false), ('chutiye', false), ('chootiya', false), ('madarchod', false),
  ('maderchod', false), ('madharchod', false), ('maadarchod', false), ('bhenchod', false), ('behenchod', false),
  ('bhanchod', false), ('benchod', false), ('bhosdi', false), ('bhosda', false), ('bhosad', false),
  ('bhosri', false), ('gaand', false), ('gandu', false), ('gandmar', false), ('harami', false),
  ('haramkhor', false), ('haramzada', false), ('haramzade', false), ('kamina', true), ('kamine', true), ('kaminey', true),
  ('randwa', false), ('randibaz', false), ('chinal', false), ('jhaatu', false), ('jhantu', false),
  ('jhaant', false), ('tatti', false), ('chudai', false), ('chodu', false), ('chodna', false),
  ('lavde', false), ('lawde', false), ('lauda', false), ('lavda', false), ('lawda', false),
  ('lodu', false), ('betichod', false), ('bhadwa', false), ('bhadwe', false), ('bhadva', false),
  ('suwar', true), ('kutiya', false), ('hijda', false), ('hijra', false), ('chakka', true),
  -- Hindi / Hinglish, whole part only
  ('chut', true), ('choot', true), ('lund', true), ('loda', true), ('lode', true), ('randi', true),
  ('kutta', true), ('kutte', true), ('chod', true), ('gand', true), ('suar', true),
  ('bc', true), ('mc', true), ('bkl', true), ('bsdk', true), ('mkc', true), ('bhsdk', true),
  ('mf', true), ('bsdke', true), ('mcbc', true);

-- True when no blocked word appears in the username.
create function public.username_is_clean(p_username text) returns boolean
language sql stable security definer set search_path = '' as $$
  with f as (
    select lower(coalesce(p_username, '')) as raw,
           translate(lower(coalesce(p_username, '')), '01345789_', 'oieastbg') as flat
  ), g as (
    select raw, flat, regexp_replace(flat, '(.)\1+', '\1', 'g') as squashed from f
  )
  select not exists (
    select 1 from public.blocked_words w, g
    where (not w.whole and (strpos(g.flat, w.word) > 0 or strpos(g.squashed, w.word) > 0))
       or (w.whole and (g.flat = w.word or g.squashed = w.word
             or w.word in (select s from regexp_split_to_table(g.raw, '[_0-9]+') s)))
  )
$$;
revoke all on function public.username_is_clean(text) from public, anon, authenticated;

-- Every insert or rename goes through this, whichever function or SQL did it.
create function public.profiles_username_clean() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (tg_op = 'INSERT' or new.username is distinct from old.username)
     and not public.username_is_clean(new.username) then
    raise exception 'That username is not allowed. Keep it respectful.'
      using errcode = 'P0001', hint = 'USERNAME_BLOCKED';
  end if;
  return new;
end $$;

create trigger profiles_username_clean before insert or update of username on public.profiles
  for each row execute function public.profiles_username_clean();

-- The live "Available" check now says no to blocked names too.
create or replace function public.username_available(p_username text) returns boolean
language sql stable security definer set search_path = '' as $$
  select lower(btrim(p_username)) ~ '^[a-z][a-z0-9_]{2,19}$'
     and not exists (select 1 from public.reserved_usernames where name = lower(btrim(p_username)))
     and lower(btrim(p_username)) !~ '(admin|moder|staff|offici|pugmark|iitm|organi[sz]|support|esport|superuser|root)'
     and public.username_is_clean(btrim(p_username))
     and not exists (select 1 from public.profiles where lower(username) = lower(btrim(p_username)))
$$;
