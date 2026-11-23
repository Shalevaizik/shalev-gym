# Shalev Gym: App Requirements

Cross-platform app for logging and tracking gym workouts.

Source: `App Req.docx`. Numbering matches the source document, so references such as "requirement No. 9" stay valid.

## Requirements

1. The app will be able to log and track gym workouts.
2. The app will receive user input by text and via voice to text.
3. The user will be able to:
   - a. Declare a new workout
   - b. Log their workout
   - c. Ask for a specific workout summary
   - d. Receive a monthly summary of their workouts
4. When the user declares a new workout, the app will:
   - a. Open a new workout record
   - b. Record the time and date
   - c. Wait for user input
5. User workout log input will include:
   - a. Exercise type (e.g. Dumbbell bench press, Cable pushdown etc.)
   - b. Weight (both Kg and Lbs)
   - c. Reps
6. The app will add to each exercise input (independently):
   - a. The total number of sets per exercise
   - b. The start and finish time per set
7. The app will be able to understand and log complicated exercises from the user input, such as:
   - a. Supersets
   - b. Failure
   - c. Pyramid
8. The app will keep logging exercises per the user input under a specific workout until the user declares "end workout".
9. The app will be able to identify targeted muscle groups per workout and understand the whole workout purpose (chest focused, lower body, arms, back & shoulders etc.).
10. There can be multiple workouts per day and multiple exercises per workout.
11. When the user asks for a workout summary, the app will create a simple list composed of:
    - a. Date and time of the workout
    - b. Title of the workout (created independently by the app, per requirement No. 9)
    - c. The list of exercises, number of sets, working weights and reps per set
12. At the end of every calendar month, the app will issue a Monthly summary independently and share it with the user.
13. The Monthly summary will include:
    - a. Workout type (e.g. Bro split, Push/Pull/Legs, Upper/Lower etc.)
    - b. Monthly achievements (PRs either based on reps or weights, most repeated exercise)
    - c. Executive summary
      - Most worked muscle groups
      - Least worked muscle groups
      - Volume per muscle group
    - d. Recommendations for next month
      - Keep current plan / switch
      - Main focus for next month (e.g. legs are neglected, do less chest and give more focus to lower body)
14. The app will identify the type of exercise and ask for user input accordingly:
    - a. Weight and reps for any type of weight movement
    - b. Time and weight for specific exercises that are measured in time (e.g. Plank), with the weight being either bodyweight or added weight
15. When the app is not sure it understood the user's input correctly (for example due to voice-to-text errors or gym noise), it will:
    - a. Show its best guess and a short list of alternatives ("Did you mean…?"), and let the user confirm with one tap, say it again, or type it
    - b. Consider several possible versions of what was heard, and exercise names that sound alike, not only names that are spelled alike
    - c. Prefer exercises that fit the current workout's focus (per requirement No. 9) and exercises the user has done before
    - d. Learn from the user's corrections, so the same mistake is understood correctly next time
    - e. Check numbers that don't fit the user's history (e.g. 18 kg on an exercise usually done with 80 kg) and ask the user to confirm them
16. During a running workout, the app will suggest the next exercise, based on:
    - a. The workout's focus so far (e.g. back focused → suggest other back exercises)
    - b. Exercises the user did in past workouts with a similar focus
    - c. Leaving out exercises already done in the current workout

    The user can pick a suggestion with one tap or ignore it and say or type any other exercise.
17. The app will know the equipment type of each exercise and understand and show the working weight accordingly:
    - a. Barbell: the user says the weight per side (e.g. "20 a side", "two plates"). The app adds the bar's own weight (20 kg by default, adjustable per exercise, e.g. EZ bar or Smith machine) and shows both, e.g. "20 per side (60 kg total)". The bar is picked from Olympic bar (20 kg), EZ bar (10 kg) or Other (any weight, e.g. a Smith machine); saying "EZ bar" picks the EZ bar
    - b. Dumbbells (pair): the user says the weight of one dumbbell. The app shows the pair and the total, e.g. "2 × 20 kg · 40 kg total", and counts 40 kg for progress and volume
    - c. Single dumbbell (e.g. one-arm dumbbell row): the weight of the one dumbbell
    - d. Machine or cable: the weight as shown on the machine
    - e. Plate-loaded machine (e.g. leg press): the weight per side, like a barbell. The app shows the plates total too, e.g. "40 kg per side · 80 kg plates" (the machine's own sled weight isn't known)
    - f. Bodyweight (e.g. pull-ups, dips, plank): bodyweight, with or without added weight (per requirement No. 14). The app will ask the user for their body weight once a month, to include it in progress and volume
    - g. The app will keep what the user said together with the calculated total, so PRs and volume per muscle group (requirement No. 13) are compared correctly across equipment types
18. App structure. When the app opens, the user sees three large buttons:
    - a. Workout (green):
      - Start a new workout
      - See previous workouts
    - b. Analyse (blue):
      - Workout summary (per requirement No. 11)
      - Monthly summary (per requirements No. 12, 13 and 19)
      - Progress per exercise over time
    - c. Eat (grey): marked "Coming soon" and shows a short "Coming soon" message when tapped
    - d. If a workout is in progress, the Workout button shows "Continue workout" and goes straight back to it
    - e. A menu button (☰) in the top-right corner of the app opens a drop-down menu with the user's profile (requirement No. 20) and settings: bar weights and sign-out
19. The Monthly summary will open with a body heat map:
    - a. Front and back views of the body, each muscle group coloured by the number of hard sets it got that month
    - b. Colours: grey / no colour for neglected muscle groups, then green → blue → purple, where purple marks overtrained muscle groups. Default thresholds, as the weekly average across the month:

      | Colour | Hard sets per week | Meaning |
      |---|---|---|
      | Grey | under 4 | Neglected |
      | Green | 4–10 | Maintaining |
      | Blue | 10–20 | Growing well |
      | Purple | over 20 | Possibly overtrained |

    - c. An exercise counts as a full set for its main muscle group and half a set for each helper muscle group (e.g. Bench Press: chest full; triceps and shoulders half)
    - d. Tapping a muscle group shows its details: number of sets, number of workouts it was trained in, and its top exercises
    - e. Below the map, the rest of the monthly summary (requirement No. 13)
20. User profile, in the menu (requirement No. 18e):
    - a. The user fills in: date of birth, sex, body weight and height. The app works out the age from the date of birth
    - b. Height in cm or in feet and inches; body weight in kg or lb (per requirement No. 5b)
    - c. Once filled in, the menu shows the user's details and an "Update" button to change them
    - d. Each body weight update is saved with its date, so bodyweight exercises (requirement No. 17f) use the user's weight at the time of the workout, and weight changes can be shown over time
    - e. Once a month the app reminds the user to update their body weight (per requirement No. 17f). If the user skips it, the app keeps using the last weight entered
    - f. Until the user enters a body weight, bodyweight exercises count reps and added weight only
21. The list of previous workouts (requirement No. 18a) will show for each workout:
    - a. The title of the workout, e.g. "Upper Body", "Back & Biceps", "Legs"
    - b. The date and time of the workout
    - c. The app creates the title automatically when the workout ends, from the exercises logged and the muscle groups they train (per requirement No. 9). The user never has to say or type a title
    - d. Optionally, the user can tap a title to rename it (e.g. "Deload day")
22. The workout session screen (a running workout) will fit the phone's screen and aspect ratio:
    - a. It fits the full width of the screen on any phone size and shape (e.g. tall 20:9 and shorter 16:9 phones), with nothing cut off at the sides and no sideways scrolling
    - b. The whole screen fits without scrolling up or down. Everything needed to log the next set is visible at once: the timer, the current exercise, the microphone button, and the manual set input (weight, reps or time, and the button to save the set)
    - c. The log of the session so far (exercises done and their sets) moves to a separate screen, opened with a button on the workout screen (e.g. "Session log") and closed with a back button that returns straight to logging. The workout screen shows only a short line about the last set saved (e.g. "Last: Bench Press, 20 per side × 8"), so the user knows it was logged. At the bottom of the Session log screen, a "Previous workouts" button opens the list of previous workouts (requirement 21), to compare this session with past ones
    - d. Nothing is hidden behind the phone's notch, camera cut-out, status bar or bottom navigation bar
    - e. When the keyboard opens for typing, the text input and its button stay visible above it
    - f. Text and buttons keep a readable size and big enough tap targets on small phones, and use the extra space on large ones
