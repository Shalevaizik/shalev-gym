# Shalev Gym: Bugs

Problems found while using the app, written down as they come up.

How it works:

1. A new bug goes under **Open**, with the date and a few words on what happened (what you did, what you expected, what the app did instead). A screenshot helps.
2. When a bug is fixed in the code, it moves to **Fixed, waiting for the next build**.
3. When a new version is built, every bug under **Fixed** moves into that version's entry in [VERSIONS.md](VERSIONS.md), and this list starts empty again. That way each build clears the list, and the history of what was fixed stays in VERSIONS.md.

## Open

- 2026-11-23: While a workout is running, there's no way to reach **Previous workouts**. The start screen's Workout button skips the Workout menu and goes straight back to the running workout (requirement 18d), and "Previous workouts" is only on that menu. The workout screen has no link to it either.
  - Fix (chosen by Shalev): while a workout is running, the start screen shows a small **"Previous workouts"** link under the "Continue workout" button. The big button still goes straight back to the workout in one tap (requirement 18d); the link only appears while a workout is running. Not in the ☰ menu: previous workouts aren't important enough for that menu.
  - Until then, past workouts can be seen from the start screen → Analyse → Workout summary.

## Fixed, waiting for the next build

These go into version 1.3.0.

- 2026-11-23: Dumbbell sets showed only "2 × 12 kg", without the total, while barbell sets show it ("20 kg per side · 60 kg total"). Now: "2 × 12 kg · 24 kg total × 12 reps" (on the "Same again" chip: "2×12=24 kg × 12"). The weight was always stored and counted correctly; only the display was missing the total.
- 2026-11-23: An exercise name spelled "dumbell" (one b), as voice recognition sometimes writes it, was treated as a machine exercise. It's now recognised as a dumbbell exercise.
- 2026-11-23: Plate-loaded machines (leg press, hack squat) showed only the weight per side. Now they also show the plates total, e.g. "40 kg per side · 80 kg plates" (the machine's own sled weight isn't known).
