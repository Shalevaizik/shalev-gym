# Shalev Gym: Bugs

Problems found while using the app, written down as they come up.

How it works:

1. A new bug goes under **Open**, with the date and a few words on what happened (what you did, what you expected, what the app did instead). A screenshot helps.
2. When a bug is fixed in the code, it moves to **Fixed, waiting for the next build**.
3. When a new version is built, every bug under **Fixed** moves into that version's entry in [VERSIONS.md](VERSIONS.md), and this list starts empty again. That way each build clears the list, and the history of what was fixed stays in VERSIONS.md.

## Open

- 2026-11-26: One-arm dumbbell exercises count only one arm. A Dumbbell Row of 16 kg × 12 reps (12 with each arm) is logged and counted as one arm's work, so the volume for these exercises is half of what was done. Planned for 1.3.0.
  - Fix (chosen by Shalev): for one-arm exercises, the app assumes both arms did the reps. It shows "16 kg × 12 reps each arm" and counts double the volume.
  - Only for exercises done one arm at a time (e.g. Dumbbell Row, Concentration Curl, anything named "one-arm" or "single-arm"). Exercises that hold one dumbbell with both hands (Goblet Squat, Overhead Tricep Extension, Kettlebell Swing, Russian Twist) stay as they are.

## Fixed, waiting for the next build

These go into version 1.3.0.

- 2026-11-23: While a workout was running, there was no way to reach Previous workouts. Now the start screen always shows Workout, Analyse and Eat, and Workout always opens the Workout screen: "Continue workout" (or "Start new workout") on top, "Previous workouts" beneath it (Shalev's choice, replacing an earlier link on the start screen; requirement 18 updated). Still to come with requirement 22: a "Previous workouts" button at the bottom of the Session log screen.
- 2026-11-23: No EZ bar option for barbell exercises. Now the edit screen has a **Bar** choice: Olympic bar (20 kg), EZ bar (10 kg) or Other (type the weight, e.g. a Smith machine). Saying "EZ bar" or "easy bar" (e.g. "Easy Bar skull crusher") picks the EZ bar for that exercise.
- 2026-11-23: Buttons at the bottom of screens (Delete exercise, Delete workout) were hidden behind Android's navigation bar. Now every screen stops above the navigation bar. (Checked in code; it can only be seen on an Android phone, so check it after the next build.)
- 2026-11-23: "Yes, end workout" was red. Now it's the app's green main button; red stays for deleting.

- 2026-11-23: Dumbbell sets showed only "2 × 12 kg", without the total, while barbell sets show it ("20 kg per side · 60 kg total"). Now: "2 × 12 kg · 24 kg total × 12 reps" (on the "Same again" chip: "2×12=24 kg × 12"). The weight was always stored and counted correctly; only the display was missing the total.
- 2026-11-23: An exercise name spelled "dumbell" (one b), as voice recognition sometimes writes it, was treated as a machine exercise. It's now recognised as a dumbbell exercise.
- 2026-11-23: Plate-loaded machines (leg press, hack squat) showed only the weight per side. Now they also show the plates total, e.g. "40 kg per side · 80 kg plates" (the machine's own sled weight isn't known).
