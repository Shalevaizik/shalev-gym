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
- 2026-11-21: "New workout" offers two choices: **Manual workout** (same as today) or **Smart workout** (AI).
  - Smart: the user asks the agent to suggest today's workout and sets how much time they have (e.g. 45 minutes).
  - The agent looks at what was already trained this week and suggests a workout type (e.g. legs) with a list of exercises that fits the time.
  - The user controls the list: reorder exercises (e.g. when a machine is busy), and remove, add or swap exercises.
  - Machine busy: the user taps "busy" and the agent offers a variation that works the same muscles at the same intensity, with a matching working weight (e.g. leg press busy → hack squat; cable fly busy → dumbbell fly). The user can also choose to just do it later instead.
  - Suggests a working weight for each exercise, based on the user's history.
  - The time covers everything: the agent plans a full package (warm-up, exercises, sets, rest, and cardio if wanted) that fits inside it.
  - No automatic cutting of exercises when running behind schedule.
  - Needs internet; cellular data is enough. Without any signal, Manual workout still works.
  - A concrete version of AI idea 3 (Personal coach).
- 2026-11-21: Hebrew version of the app, same functionality, for beta testing with a friend (Android). Could be version 1.4.0.
  - One app with a language choice (Hebrew / English) in the profile menu, defaulting to the phone's language. Not a separate app, so every feature reaches both languages.
  - Translate all screen text (about 18 screen files) and the exercise list (100+ names). Exercise names need care: Israeli gyms mix Hebrew and English (e.g. "לחיצת חזה" vs "בנץ' פרס").
  - Right-to-left layout: flip screens, lists, arrows, progress charts and the body map, and check every screen.
  - Hebrew dates and numbers (e.g. "יום שישי, 27 בנובמבר").
  - Voice logging, the biggest piece: switch speech recognition to Hebrew (`src/voice/useSpeechToText.ts`, currently `en-US`), then teach the app to understand Hebrew phrases ("עשרים כל צד", "דקה וחצי", numbers spoken as words). Two ways, to decide:
    - **Rules** written in the app, like today's English ones in `src/domain/exerciseLog.ts`: free to run, works offline, more work to build.
    - **AI** (AI idea 1, smarter voice logging): understands Hebrew naturally, less to build; needs internet and costs a few agorot per log (about $5 of credit would likely last two testers a couple of months), plus the small online service from Phase 2.
  - Beta on Android: a free test build from the existing EAS "preview" profile, shared as a link (the friend allows "install from unknown sources"). Optional later: Google Play internal testing ($25 one-time) for installs and updates from the Play Store.
  - Each tester's workouts stay on their own phone; no running costs without AI.
  - Before the first beta install, set up **automatic updates** (EAS Update): later changes, including adding AI, reach the friend's app the next time it opens, with no new link or reinstall. Free on Expo's free plan at this scale. It must be in the app from the first install, since updates only reach an app that can receive them. Changes that add native pieces (e.g. camera features) still need a new install link; installing over the old app keeps the friend's workouts.
  - **Back up the Android signing key** (the keystore and its passwords, kept on Shalev's computer, never on GitHub) somewhere safe, e.g. a password manager or a private cloud folder. Android only accepts updates signed with the same key: if it's lost, testers must uninstall (losing their workouts) and install fresh.

## Coming soon

- 2026-11-21: Share workouts and challenge friends.
  - The user picks a workout they did and challenges a friend. The friend gets a message, e.g. "Shalev has challenged you to beat his Push day today, are you up for it?"
  - If the friend accepts, their app pulls in Shalev's Push workout log and sets it up for them in the **Smart workout** section, ready to start.
  - Needs user accounts, friends and online syncing, so it comes after the Phase 2 (Supabase) work.
  - Until it's built, show it in the app as a **"Coming soon"** button on the start screen, like the Eat button (e.g. "Challenges: Challenge your friends"). Tapping it shows a short "coming in a later version" message.
  - To decide: what "beating" it means (more total weight lifted, more reps, or the same exercises faster) and whether weights are copied as-is or adjusted to the friend's level.

## Parked

Ideas that were discussed and set aside for now, with the reason.

- Eat section (nutrition tracking): "Coming soon" button is in place; details to be decided.
- Syncing workouts online (Supabase): planned for Phase 2, so workouts aren't only on one phone.
