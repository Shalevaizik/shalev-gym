# Shalev Gym: Ideas

Ideas for future improvements, written down as they come up, including from the phone. Nothing here is agreed yet: when an idea is ready, it's discussed and turned into a numbered requirement in [REQUIREMENTS.md](REQUIREMENTS.md), then removed from this list.

Add each idea as a new line under **New ideas**, with the date. A few words are enough.

## Guiding principle

**Flexibility first** (2026-11-23). The app adapts to the user's real training: what was trained, when and how hard, which muscles need work, how much time there is today, and what equipment is free right now. No fixed templates or preset checkboxes, and the user can always change the plan. Every idea below is checked against this.

Why: the gym apps Shalev tried that suggest a daily workout mostly fill a preset set of checkboxes and don't really take previous workouts or targeted muscle groups into account. That's the gap this app fills.

## New ideas

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
- 2026-11-21: "New workout" offers two choices: **Manual workout** (same as today) or **Smart workout** (AI). (1.3.0)
  - Smart: the user asks the agent to suggest today's workout and sets how much time they have (e.g. 45 minutes). (1.3.0)
  - The agent looks at what was already trained this week and suggests a workout type (e.g. legs) with a list of exercises that fits the time. (1.3.0)
  - The user controls the list: reorder exercises (e.g. when a machine is busy), and remove, add or swap exercises. (1.3.0)
  - Machine busy: the user taps "busy" and the agent offers a variation that works the same muscles at the same intensity, with a matching working weight (e.g. leg press busy → hack squat; cable fly busy → dumbbell fly). The user can also choose to just do it later instead. (1.3.0)
  - Suggests a working weight for each exercise, based on the user's history. (1.3.0)
  - The time covers everything: the agent plans a full package (warm-up, exercises, sets, rest, and cardio if wanted) that fits inside it. (1.3.0)
  - No automatic cutting of exercises when running behind schedule. (1.3.0)
  - Needs internet; cellular data is enough. Without any signal, Manual workout still works.
  - A concrete version of AI idea 3 (Personal coach). (1.3.0)
- 2026-11-21: Hebrew version of the app, same functionality, for beta testing with a friend (Android). Not in 1.3.0 (Shalev, 2026-11-26): 1.3.0 ships in English. Already in the code, switched off: every screen's text goes through the language layer (`src/i18n/`), dates follow the language, and a language choice in the menu. Still to do: the Hebrew text, Hebrew exercise names, Hebrew voice rules, and checking right-to-left on every screen.
  - One app with a language choice (Hebrew / English) in the profile menu, defaulting to the phone's language. Not a separate app, so every feature reaches both languages. (1.3.0)
  - Translate all screen text (about 18 screen files) and the exercise list (100+ names). Exercise names need care: Israeli gyms mix Hebrew and English (e.g. "לחיצת חזה" vs "בנץ' פרס"). (1.3.0)
  - Right-to-left layout: flip screens, lists, arrows, progress charts and the body map, and check every screen.
  - Hebrew dates and numbers (e.g. "יום שישי, 27 בנובמבר"). (1.3.0)
  - Voice logging, the biggest piece: switch speech recognition to Hebrew (`src/voice/useSpeechToText.ts`, currently `en-US`), then teach the app to understand Hebrew phrases ("עשרים כל צד", "דקה וחצי", numbers spoken as words). Two ways, to decide:
    - **Rules** written in the app, like today's English ones in `src/domain/exerciseLog.ts`: free to run, works offline, more work to build.(1.3.0)
    - **AI** (AI idea 1, smarter voice logging): understands Hebrew naturally, less to build; needs internet and costs a few agorot per log (about $5 of credit would likely last two testers a couple of months), plus the small online service from Phase 2.
  - Beta on Android: a free test build from the existing EAS "preview" profile, shared as a link (the friend allows "install from unknown sources"). Optional later: Google Play internal testing ($25 one-time) for installs and updates from the Play Store. (1.3.0)
  - Each tester's workouts stay on their own phone; no running costs without AI. (1.3.0)
  - Before the first beta install, set up **automatic updates** (EAS Update): later changes, including adding AI, reach the friend's app the next time it opens, with no new link or reinstall. Free on Expo's free plan at this scale. It must be in the app from the first install, since updates only reach an app that can receive them. Changes that add native pieces (e.g. camera features) still need a new install link; installing over the old app keeps the friend's workouts. (1.3.0)
  - **Back up the Android signing key** (the keystore and its passwords, kept on Shalev's computer, never on GitHub) somewhere safe, e.g. a password manager or a private cloud folder. Android only accepts updates signed with the same key: if it's lost, testers must uninstall (losing their workouts) and install fresh.
- 2026-11-23: Specialised AI models from Hugging Face, next to Claude. The small online service (the "one door") sends each job to the best tool, so each piece can be swapped on its own.
  - **Better Hebrew speech recognition:** a Hebrew-trained speech-to-text model instead of the phone's built-in recognition. Only if testing the Hebrew version shows the phone mishears gym words. This improves *hearing* (sound → words); understanding the words stays with rules or Claude.
  - **Form checking with pose detection:** the camera finds the body's joints to count reps or warn about form (e.g. "knees cave in on squats"). Small models can run on the phone itself: no internet, no per-use cost. Needs a new install (camera is a native piece).
  - Before using any model: check its license (some are personal or non-commercial use only), test its quality on real voice and video, and compare running costs (Hugging Face paid hosting vs. a small model on the phone).
  - Optional: finish the Hugging Face connector sign-in on claude.ai (Settings → Connectors) so Claude can search and compare models.

## Design

Not in 1.3.0: design changes come in a future version (Shalev, 2026-11-23).

- 2026-11-23: A new look, based on three reference designs in Shalev's Google Drive folder "design ideas" (images 1–3 and the "Personal Touch" notes). What Shalev liked: the colour palettes, the "milky" screens and tiles, the tile arrangements, and the infographics.
  - **Milky glass tiles:** translucent, frosted cards over a dark background or photo, instead of today's flat white cards.
  - **Dark first,** with one strong accent colour. The references use electric blue (1), lime green (2) and orange (3). To decide: which accent, and whether to keep a light mode.
  - **Infographics:** big numbers, progress rings and gauges (e.g. "75% of this week's goal"), streaks, small charts, and stat tiles (calories, duration, workouts done this week).
  - **Tile grid:** stats in tiles of different sizes (like reference 2's 58 min / 176 bpm / 3.24 km), e.g. for the workout summary and the start screen.
  - Rounded pill buttons, rows of icons, and possibly a bottom tab bar (reference 3). Reference 3 also has an "Ask me anything" box, which fits AI idea 2 (ask your training history).
  - Start with the start screen, the workout screen and Analyse; one shared set of colours and tiles in `src/ui/theme.ts` so every screen follows.
  - Check: text must stay easy to read in a bright gym and with sweaty hands (contrast, big tap targets); frosted blur can be slow on older Android phones, so have a plain fallback; it must also work right to left for the Hebrew version.
  - The references are other people's designs: use them for style, not copied. Any athlete photos must be our own or free to use.
- 2026-11-23: A realistic body map, based on four new references in the "design ideas" folder ("body 1 male", "Body map 2- male", "Body map 3- female", "Body map 4- female"). (1.3.0)
  - Today's heat map (requirement 19, `src/ui/BodyMap.tsx`) draws the body from rounded rectangles. The references show a real body outline with each muscle drawn in its true shape: front and back (reference 3 also has a side view), with the worked muscles coloured and the rest grey. (1.3.0)
  - **Male and female bodies:** show the one that matches the sex in the user's profile (requirement 20a). (1.3.0)
  - **More detailed muscles** where it helps training decisions, e.g. lats vs. traps, front vs. side vs. rear shoulders, glutes, hamstrings and calves. Reference 2 labels individual muscles; that much anatomy is probably too much for the app, but a muscle could show its name when tapped (requirement 19d). (1.3.0)
  - **A recovery view** (reference 4, a dark screen): the body coloured by how recently each muscle was trained, with "days since your last workout" and "fresh muscle groups" counts, and a Start workout button. Fits the guiding principle (flexibility first) and the Smart workout: the user sees which muscles are ready before choosing today's workout. 
  - Fits the Design idea above: dark background, one accent colour for the worked muscles.
  - References 1–3 are stock images (Adobe Stock and Alamy watermarks) and reference 4 is from another app: use them for style only. The body drawing must be drawn for this app or come from a source that's free to use. (1.3.0)

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
