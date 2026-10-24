-- Stumble Guys copy, rewritten around how the game actually works:
--   * players keep the name they already have (a rename costs gems after the first), so the
--     steps no longer tell them to change it;
--   * the room code only exists once the host creates the party on match day, so check-in
--     and the Meet come before it.
-- Data only; safe to run twice.
update public.games set
  ig_id_label = 'Stumble Guys name',
  ig_id_hint = 'Shown at the top-left of the Stumble Guys home screen. Leave out colours and emoji.',
  join_steps = $j$[
    "Get the game from a link above and open it once",
    "Keep the same in-game name you registered here",
    "Check in on this page when it opens, 45 min before",
    "Join the Google Meet; set Region as the lobby note says",
    "Party > Join > type the room code",
    "Stay till the last game. Results land on Standings"
  ]$j$::jsonb
where slug = 'stumble-guys';
