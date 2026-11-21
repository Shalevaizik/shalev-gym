# Shalev Gym: Ideas

Ideas for future improvements, written down as they come up, including from the phone. Nothing here is agreed yet: when an idea is ready, it's discussed and turned into a numbered requirement in [REQUIREMENTS.md](REQUIREMENTS.md), then removed from this list.

Add each idea as a new line under **New ideas**, with the date. A few words are enough.

## New ideas

- 2026-11-20: Log cardio and conditioning sessions too, not only reps/weight or time/weight exercises. For example 15 minutes of HIIT, CrossFit or walking on the treadmill at the start of a workout.
- 2026-11-21: AI agent features (an AI like Claude built into the app). Ideas, most useful first:
  1. Smarter voice logging: understand messy, natural speech ("three sets of bench, 20 a side, last one I failed at 7", "same as last week but 2.5 heavier") and fix misheard words from context.
  2. Ask your training history: a chat in Analyse ("When did I last train legs?", "How has my bench changed since September?").
  3. Personal coach: suggest today's plan and weights from your progress and recovery ("try 27.5 a side today", "legs haven't been trained for 9 days").
  4. Monthly summary written like a coach: personal advice in plain words, next to the heat map and numbers.
  5. Eat section: photo of a meal → estimated calories and protein, linked to the day's training.
  6. Check-ins: nudges based on habits ("you usually train Tuesdays", "three weeks at the same bench weight").

  Needs internet, a small online service to keep the AI key out of the app (goes with the Phase 2 Supabase work), and a small running cost per use. Suggested start: 1 or 2.
- 2026-11-21: A "Shalev's personal trainer" skill for Claude: a written briefing Claude reads before coaching. It covers goals, experience, limits, schedule and equipment; training style (cardio warm-up then weights, voice logging, heavy-rock music); how to coach and progress weights, and plan around races (like the Lehavim 3K); and how to read the workout history from this app. Could later be the brain behind the in-app Personal coach (AI idea 3).
- 2026-11-21: Base the coaching on Shalev's weightlifting books (PDFs). Keep the PDFs in a separate **private** repo (this repo is public, so the books can't go here). Claude reads them once and writes the key principles into the trainer skill (programming, progression, technique cues), noting the book and chapter for each.

## Parked

Ideas that were discussed and set aside for now, with the reason.

- Eat section (nutrition tracking): "Coming soon" button is in place; details to be decided.
- Syncing workouts online (Supabase): planned for Phase 2, so workouts aren't only on one phone.
