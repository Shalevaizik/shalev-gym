# Shalev Gym: Versions

Each version of the app, newest first, with what it contains in plain words.

While the app is still in development, versions are numbered **1.x.0**: the first number stays **1** ("in development") and the middle number goes up with each version (1.1.0, 1.2.0, 1.3.0 …). It moves to 2.0.0 once the app is fully developed.

Bugs are collected in [BUGS.md](BUGS.md). When a version is built, the bugs fixed for it move from BUGS.md into that version's entry below, under "Bugs fixed", and BUGS.md starts empty again.

The version number lives in `app.json` (`expo.version`) and is shown by the phone in the app's settings. Each finished version also gets a label (tag) on GitHub, e.g. `v1.2.0`, so it can always be found and opened again. Android's internal build number (`versionCode`) is separate and goes up automatically with each production build.

## 1.4.0: next

Not started. Planned so far: the realistic male and female body map (see IDEAS.md).

The app's version number in `app.json` stays 1.3.0 until 1.4.0 is built: automatic updates only reach phones whose installed version matches it, so changing it early would stop fixes from reaching the 1.3.0 build.

## 1.3.0: built 2026-11-26

Started 2026-11-21, built for Android on 2026-11-26 (EAS preview build). GitHub label `v1.3.0` still to be added from Shalev's computer.

What's in it:

- Fix all open bugs in [BUGS.md](BUGS.md): "Previous workouts" reachable while a workout is running, an EZ bar choice for barbell exercises, buttons hidden behind Android's navigation bar, and a green "Yes, end workout" button. Done 2026-11-23.

- Android builds from the shalevai Expo account.
- Protection against uploading Android signing keys or their passwords to GitHub.
- Expo packages updated to SDK 58, plus expo-font.
- `IDEAS.md` filled with ideas: cardio logging, AI features, Smart workout, a personal trainer skill, coaching from books, and friend challenges.
- One-arm exercises (Dumbbell Row, Concentration Curl) count both arms (bug fixed 2026-11-26).
- Requirement 22: the running workout fits one screen; the session log has its own screen. Done 2026-11-26.
- Requirement 23: cardio sessions with the machine's settings (speed, incline, level, distance, calories). Done 2026-11-26.
- Requirement 24: HIIT and CrossFit sessions logged on their own screen, with saved routines and half credit on the body map. Done 2026-11-26.
- "Coming soon" buttons: Smart workout (needs the AI service) on the Workout screen, and Challenges on the start screen.
- Automatic updates (EAS Update) set up, so later changes reach the phone without a new install. This build needs a new install, because it adds the update and language modules.
- Not in 1.3.0: the realistic male and female body map (moved to 1.4.0).
- In English only. The Hebrew version's groundwork is in the code but switched off (`HEBREW_READY` in `src/i18n/language.ts`); the Hebrew text and voice come in a later version.

Bugs fixed:

- 2026-11-23: While a workout was running, there was no way to reach Previous workouts. Now the start screen always shows Workout, Analyse and Eat, and Workout always opens the Workout screen: "Continue workout" (or "Start new workout") on top, "Previous workouts" beneath it (Shalev's choice, replacing an earlier link on the start screen; requirement 18 updated). The Session log screen (requirement 22) also has a "Previous workouts" button.
- 2026-11-23: No EZ bar option for barbell exercises. Now the edit screen has a **Bar** choice: Olympic bar (20 kg), EZ bar (10 kg) or Other (type the weight, e.g. a Smith machine). Saying "EZ bar" or "easy bar" (e.g. "Easy Bar skull crusher") picks the EZ bar for that exercise.
- 2026-11-23: Buttons at the bottom of screens (Delete exercise, Delete workout) were hidden behind Android's navigation bar. Now every screen stops above the navigation bar. (Checked in code; it can only be seen on an Android phone, so check it after the next build.)
- 2026-11-23: "Yes, end workout" was red. Now it's the app's green main button; red stays for deleting.
- 2026-11-23: Dumbbell sets showed only "2 × 12 kg", without the total, while barbell sets show it ("20 kg per side · 60 kg total"). Now: "2 × 12 kg · 24 kg total × 12 reps" (on the "Same again" chip: "2×12=24 kg × 12"). The weight was always stored and counted correctly; only the display was missing the total.
- 2026-11-23: An exercise name spelled "dumbell" (one b), as voice recognition sometimes writes it, was treated as a machine exercise. It's now recognised as a dumbbell exercise.
- 2026-11-23: Plate-loaded machines (leg press, hack squat) showed only the weight per side. Now they also show the plates total, e.g. "40 kg per side · 80 kg plates" (the machine's own sled weight isn't known).

## 1.2.0: Shalev's fixes (2026-11-20)

GitHub label: `v1.2.0` (commit `471e2a1`). Version 1.1.0 plus the fixes Shalev asked for:

- Log exercises by voice or text; choose the exercise once, then log its sets by voice.
- Start screen, profile in a top-right menu, and automatic workout titles (requirements 18, 20, 21).
- Timed exercises, equipment types and checks for misheard voice input (requirements 14, 15, 17).
- Next-exercise suggestions and the Analyse sections: monthly view, progress charts and workout summaries (requirements 11, 12, 13, 16, 19).
- Explains the problem instead of crashing when the database is busy in another tab.
- EAS build setup and Android package ID.
- `IDEAS.md` for collecting future improvements.

## 1.1.0: initial draft (2026-11-02)

GitHub label: `v1.1.0` (commit `4499a68`). Ohad's first draft: Phase 1 of the workout tracker.
