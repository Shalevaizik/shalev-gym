# Shalev Gym: Versions

Each version of the app, newest first, with what it contains in plain words.

While the app is still in development, versions are numbered **1.x.0**: the first number stays **1** ("in development") and the middle number goes up with each version (1.1.0, 1.2.0, 1.3.0 …). It moves to 2.0.0 once the app is fully developed.

Bugs are collected in [BUGS.md](BUGS.md). When a version is built, the bugs fixed for it move from BUGS.md into that version's entry below, under "Bugs fixed", and BUGS.md starts empty again.

The version number lives in `app.json` (`expo.version`) and is shown by the phone in the app's settings. Each finished version also gets a label (tag) on GitHub, e.g. `v1.2.0`, so it can always be found and opened again. Android's internal build number (`versionCode`) is separate and goes up automatically with each production build.

## 1.3.0: in development

Started 2026-11-21. Not finished yet, so no GitHub label yet.

Planned for this version (not done yet):

- Fix all open bugs in [BUGS.md](BUGS.md): a "Previous workouts" link while a workout is running, an EZ bar choice for barbell exercises, buttons hidden behind Android's navigation bar, and a green "Yes, end workout" button.

- Android builds from the shalevai Expo account.
- Protection against uploading Android signing keys or their passwords to GitHub.
- Expo packages updated to SDK 58, plus expo-font.
- `IDEAS.md` filled with ideas: cardio logging, AI features, Smart workout, a personal trainer skill, coaching from books, and friend challenges.

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
