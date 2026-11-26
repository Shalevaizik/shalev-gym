// The exercises the app knows by name, so a spoken name like "db bench" or "lat pull down"
// becomes one clear exercise the trainer confirms once (and later, requirement 9: muscle groups).

export type Muscle =
  | 'Chest'
  | 'Back'
  | 'Shoulders'
  | 'Biceps'
  | 'Triceps'
  | 'Forearms'
  | 'Quads'
  | 'Hamstrings'
  | 'Glutes'
  | 'Calves'
  | 'Core'
  | 'Full body'
  // Cardio and conditioning: logged and shown in the workout, but not on the body map.
  | 'Cardio';

export type CatalogExercise = { id: string; name: string; muscle: Muscle; aliases?: string[] };

const entry = (name: string, muscle: Muscle, aliases: string[] = []): CatalogExercise => ({
  id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
  name,
  muscle,
  aliases,
});

export const CATALOG: CatalogExercise[] = [
  // Chest
  entry('Bench Press', 'Chest', ['barbell bench press', 'flat bench', 'bench', 'flat bench press']),
  entry('Dumbbell Bench Press', 'Chest', ['db bench press', 'db bench', 'dumbbell press', 'flat dumbbell press']),
  entry('Incline Bench Press', 'Chest', ['incline barbell press', 'incline press', 'incline bench']),
  entry('Incline Dumbbell Press', 'Chest', ['incline db press', 'incline dumbbell bench press']),
  entry('Decline Bench Press', 'Chest', ['decline press', 'decline bench']),
  entry('Chest Press Machine', 'Chest', ['machine chest press', 'chest press']),
  entry('Cable Fly', 'Chest', ['cable flyes', 'cable flies', 'cable crossover', 'crossover', 'cable crossovers']),
  entry('Dumbbell Fly', 'Chest', ['dumbbell flyes', 'dumbbell flies', 'db fly', 'flies', 'flyes']),
  entry('Pec Deck', 'Chest', ['pec deck fly', 'machine fly', 'butterfly', 'pec fly']),
  entry('Push-Up', 'Chest', ['push ups', 'pushups', 'press ups']),
  entry('Dips', 'Chest', ['chest dips', 'parallel bar dips', 'dip']),
  // Back
  entry('Deadlift', 'Back', ['conventional deadlift', 'dead lift', 'deadlifts']),
  entry('Pull-Up', 'Back', ['pull ups', 'pullups', 'wide grip pull up']),
  entry('Chin-Up', 'Back', ['chin ups', 'chinups']),
  entry('Lat Pulldown', 'Back', ['lat pull down', 'pulldown', 'pull down', 'wide grip pulldown', 'lap pulldown']),
  entry('Close Grip Lat Pulldown', 'Back', ['close grip pulldown', 'v bar pulldown']),
  entry('Barbell Row', 'Back', ['bent over row', 'barbell bent over row', 'bb row', 'bent over barbell row']),
  entry('Dumbbell Row', 'Back', ['one arm dumbbell row', 'single arm row', 'db row', 'one arm row']),
  entry('Seated Cable Row', 'Back', ['cable row', 'seated row', 'low row']),
  entry('T-Bar Row', 'Back', ['t bar row', 'tbar row']),
  entry('Machine Row', 'Back', ['chest supported row', 'row machine']),
  entry('Straight Arm Pulldown', 'Back', ['straight arm pushdown', 'lat pushdown']),
  entry('Back Extension', 'Back', ['hyperextension', 'back extensions', 'hyperextensions']),
  entry('Shrugs', 'Back', ['barbell shrug', 'dumbbell shrug', 'shrug']),
  // Shoulders
  entry('Overhead Press', 'Shoulders', ['military press', 'ohp', 'standing press', 'barbell overhead press', 'shoulder press barbell']),
  entry('Dumbbell Shoulder Press', 'Shoulders', ['shoulder press', 'seated dumbbell press', 'db shoulder press', 'dumbbell overhead press']),
  entry('Arnold Press', 'Shoulders', ['arnold dumbbell press']),
  entry('Machine Shoulder Press', 'Shoulders', ['shoulder press machine']),
  entry('Lateral Raise', 'Shoulders', ['lateral raises', 'side raises', 'side lateral raise', 'dumbbell lateral raise', 'laterals']),
  entry('Cable Lateral Raise', 'Shoulders', ['cable lateral raises', 'cable side raise']),
  entry('Front Raise', 'Shoulders', ['front raises', 'dumbbell front raise']),
  entry('Rear Delt Fly', 'Shoulders', ['reverse fly', 'rear delt flyes', 'reverse pec deck', 'rear delt raise']),
  entry('Face Pull', 'Shoulders', ['face pulls', 'cable face pull']),
  entry('Upright Row', 'Shoulders', ['upright rows']),
  // Biceps
  entry('Barbell Curl', 'Biceps', ['bicep curl', 'biceps curl', 'bb curl', 'standing curl', 'curls', 'curl']),
  entry('Dumbbell Curl', 'Biceps', ['db curl', 'dumbbell bicep curl', 'alternating curl', 'dumbbell curls']),
  entry('Hammer Curl', 'Biceps', ['hammer curls', 'hammers']),
  entry('Preacher Curl', 'Biceps', ['preacher curls', 'scott curl']),
  entry('Cable Curl', 'Biceps', ['cable bicep curl', 'cable curls']),
  entry('EZ Bar Curl', 'Biceps', ['ez curl', 'easy bar curl', 'e z bar curl']),
  entry('Incline Dumbbell Curl', 'Biceps', ['incline curl', 'incline curls']),
  entry('Concentration Curl', 'Biceps', ['concentration curls']),
  // Triceps
  entry('Cable Pushdown', 'Triceps', ['tricep pushdown', 'triceps pushdown', 'rope pushdown', 'pushdown', 'pushdowns', 'push down', 'tricep push down']),
  entry('Overhead Tricep Extension', 'Triceps', ['overhead extension', 'overhead triceps extension', 'french press']),
  entry('Skull Crusher', 'Triceps', ['skull crushers', 'lying tricep extension', 'skullcrusher']),
  entry('Close Grip Bench Press', 'Triceps', ['close grip bench', 'cgbp']),
  entry('Tricep Dips', 'Triceps', ['bench dips', 'triceps dips']),
  entry('Tricep Kickback', 'Triceps', ['kickbacks', 'triceps kickback']),
  // Forearms
  entry('Wrist Curl', 'Forearms', ['wrist curls', 'forearm curl']),
  entry("Farmer's Walk", 'Forearms', ['farmers walk', 'farmer carry', 'farmers carry']),
  entry('Dead Hang', 'Forearms', ['hang', 'bar hang', 'dead hangs']),
  // Quads
  entry('Squat', 'Quads', ['back squat', 'barbell squat', 'squats', 'high bar squat']),
  entry('Front Squat', 'Quads', ['front squats']),
  entry('Leg Press', 'Quads', ['leg press machine', 'leg presses']),
  entry('Hack Squat', 'Quads', ['hack squats', 'hack squat machine']),
  entry('Leg Extension', 'Quads', ['leg extensions', 'quad extension']),
  entry('Bulgarian Split Squat', 'Quads', ['split squat', 'bulgarian split squats', 'bulgarians', 'rear foot elevated split squat']),
  entry('Lunges', 'Quads', ['lunge', 'walking lunges', 'dumbbell lunges', 'walking lunge']),
  entry('Goblet Squat', 'Quads', ['goblet squats']),
  entry('Wall Sit', 'Quads', ['wall sits', 'wall squat']),
  entry('Step-Up', 'Quads', ['step ups', 'box step up']),
  // Hamstrings
  entry('Romanian Deadlift', 'Hamstrings', ['rdl', 'rdls', 'romanian deadlifts', 'stiff leg deadlift', 'stiff legged deadlift']),
  entry('Lying Leg Curl', 'Hamstrings', ['leg curl', 'leg curls', 'hamstring curl', 'lying hamstring curl']),
  entry('Seated Leg Curl', 'Hamstrings', ['seated hamstring curl', 'seated leg curls']),
  entry('Good Morning', 'Hamstrings', ['good mornings']),
  // Glutes
  entry('Hip Thrust', 'Glutes', ['hip thrusts', 'barbell hip thrust', 'glute bridge']),
  entry('Cable Kickback', 'Glutes', ['glute kickback', 'cable glute kickback']),
  entry('Hip Abduction', 'Glutes', ['abductor machine', 'abduction', 'hip abductions']),
  entry('Hip Adduction', 'Quads', ['adductor machine', 'adduction']),
  // Calves
  entry('Standing Calf Raise', 'Calves', ['calf raise', 'calf raises', 'standing calf raises']),
  entry('Seated Calf Raise', 'Calves', ['seated calf raises']),
  // Core
  entry('Plank', 'Core', ['planks']),
  entry('Side Plank', 'Core', ['side planks']),
  entry('Crunch', 'Core', ['crunches', 'sit ups', 'sit-ups']),
  entry('Cable Crunch', 'Core', ['cable crunches', 'kneeling cable crunch']),
  entry('Hanging Leg Raise', 'Core', ['leg raises', 'hanging leg raises', 'leg raise', 'knee raises']),
  entry('Russian Twist', 'Core', ['russian twists']),
  entry('Ab Wheel', 'Core', ['ab rollout', 'ab wheel rollout', 'rollouts']),
  // Full body
  entry('Clean and Jerk', 'Full body', ['clean & jerk']),
  entry('Power Clean', 'Full body', ['clean', 'power cleans']),
  entry('Kettlebell Swing', 'Full body', ['kettlebell swings', 'kb swing']),
  entry('Burpees', 'Full body', ['burpee']),
  // Cardio and conditioning, logged as a time
  entry('Treadmill', 'Cardio', ['treadmill walk', 'treadmill run', 'incline walk', 'walking on the treadmill', 'walk', 'walking']),
  entry('Running', 'Cardio', ['run', 'jog', 'jogging', 'outdoor run']),
  entry('Stationary Bike', 'Cardio', ['bike', 'exercise bike', 'cycling', 'spin bike', 'spinning', 'spin class', 'assault bike', 'air bike']),
  entry('Rowing Machine', 'Cardio', ['rower', 'rowing', 'erg', 'rowing erg']),
  entry('Elliptical', 'Cardio', ['cross trainer', 'elliptical trainer']),
  entry('Stair Climber', 'Cardio', ['stairmaster', 'stair master', 'stairs', 'stair mill']),
  entry('HIIT', 'Cardio', ['hiit workout', 'interval training', 'intervals', 'tabata']),
  entry('CrossFit', 'Cardio', ['crossfit wod', 'wod', 'metcon', 'conditioning', 'cross fit']),
  entry('Jump Rope', 'Cardio', ['skipping', 'skipping rope', 'jumping rope']),
  entry('Swimming', 'Cardio', ['swim', 'laps']),
];

// ---------------------------------------------------------------------------
// Matching a spoken name

// Words speech recognizers and people use for the same thing.
const SYNONYMS: Record<string, string> = {
  db: 'dumbbell', dumbbells: 'dumbbell', dumbell: 'dumbbell', dumbel: 'dumbbell',
  bb: 'barbell', barbells: 'barbell',
  flyes: 'fly', flies: 'fly', flys: 'fly', flye: 'fly',
  triceps: 'tricep', biceps: 'bicep',
  pulldowns: 'pulldown', pushdowns: 'pushdown', pullup: 'pull', pushup: 'push', chinup: 'chin',
  presses: 'press', raises: 'raise', rows: 'row', curls: 'curl', squats: 'squat',
  extensions: 'extension', lunges: 'lunge', thrusts: 'thrust', dips: 'dip', crunches: 'crunch',
  deadlifts: 'deadlift', ups: 'up', '&': 'and',
};

// Words that come before a name when speaking: "next is bench press", "let's do squats".
const LEAD_IN = /^(ok(ay)? |so |now |next |then |and )*(exercise |next exercise |i('m| am) (doing|going to do) |let'?s do |doing |i'?ll do |starting |start )(is |with )?/;

function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[-_/]/g, ' ')
    .replace(/\b(pull|push|chin|sit|step) ?ups?\b/g, '$1 up')
    .replace(/\b(lat|leg|cable) ?(pull|push) ?down\b/g, '$1 $2down')
    .replace(/\bdead ?lifts?\b/g, 'deadlift')
    .replace(/[^a-z0-9& ]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => SYNONYMS[w] ?? w);
}

export function cleanSpokenName(text: string): string {
  return text.toLowerCase().trim().replace(/[.!?]+$/, '').replace(LEAD_IN, '').trim();
}

function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  const row = Array.from({ length: b.length + 1 }, (_, k) => k);
  for (let i = 1; i <= a.length; i++) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const saved = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
      previous = saved;
    }
  }
  return row[b.length];
}

// How alike two words are, 0 to 1, forgiving one or two misheard letters in longer words.
function wordSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  const longest = Math.max(a.length, b.length);
  if (longest < 4) return 0;
  const ratio = 1 - editDistance(a, b) / longest;
  return ratio >= 0.75 ? ratio : 0;
}

// Words in both, weighted by how alike they are, over all the words in either (Dice score).
function phraseSimilarity(spoken: string[], known: string[]): number {
  if (spoken.length === 0 || known.length === 0) return 0;
  if (spoken.join(' ') === known.join(' ')) return 1;
  const used = new Set<number>();
  let total = 0;
  for (const word of spoken) {
    let best = 0;
    let bestIndex = -1;
    known.forEach((candidate, index) => {
      if (used.has(index)) return;
      const score = wordSimilarity(word, candidate);
      if (score > best) {
        best = score;
        bestIndex = index;
      }
    });
    if (bestIndex >= 0) {
      used.add(bestIndex);
      total += best;
    }
  }
  return (2 * total) / (spoken.length + known.length);
}

// How a word sounds, roughly: letters that speech recognizers confuse are merged and vowels after
// the first letter dropped, so "dead left" and "deadlift" sound the same (requirement 15b).
export function soundKey(text: string): string {
  const letters = text
    .toLowerCase()
    .replace(/[^a-z]/g, '')
    .replace(/ph/g, 'f')
    .replace(/ck/g, 'k')
    .replace(/qu/g, 'kw')
    .replace(/x/g, 'ks')
    .replace(/c(?=[eiy])/g, 's')
    .replace(/c/g, 'k')
    .replace(/z/g, 's')
    .replace(/dg/g, 'j')
    .replace(/gh/g, 'g')
    .replace(/^kn/, 'n')
    .replace(/^wr/, 'r')
    .replace(/th/g, 't')
    .replace(/d/g, 't')
    .replace(/b/g, 'p')
    .replace(/v/g, 'f')
    .replace(/g/g, 'k');
  if (!letters) return '';
  const rest = letters.slice(1).replace(/[aeiouyhw]/g, '');
  return (letters[0] + rest).replace(/(.)\1+/g, '$1').replace(/s$/, '');
}

// How alike two phrases sound as a whole, 0 to 1, ignoring where the spaces fall.
function soundSimilarity(spoken: string[], known: string[]): number {
  const a = soundKey(spoken.join(''));
  const b = soundKey(known.join(''));
  if (a.length < 3 || b.length < 3) return 0;
  if (a[0] !== b[0]) return 0;
  const ratio = 1 - editDistance(a, b) / Math.max(a.length, b.length);
  return ratio >= 0.8 ? 0.9 * ratio : 0;
}

export type ExerciseOption = {
  name: string;
  muscle: Muscle | null;
  catalogId: string | null;
  score: number;
};

export type ExerciseMatch = {
  heard: string; // what the trainer said, cleaned up
  best: ExerciseOption | null;
  // true when the best match is clearly what was said, so one tap confirms it.
  confident: boolean;
  alternatives: ExerciseOption[];
};

// What the app knows about this trainer and workout, used to pick between close matches
// (requirement 15c and d).
export type MatchContext = {
  // Muscle groups trained so far in this workout.
  focus?: string[];
  // What the trainer picked before when the app heard something else: heard words → name.
  corrections?: Map<string, string>;
};

// The words that identify what was heard, for remembering a correction.
export function correctionKey(spoken: string): string {
  return words(cleanSpokenName(spoken)).join(' ');
}

// Finds the exercise the trainer named, among the catalog and the names they used before
// (custom exercises they confirmed in earlier workouts).
export function matchExercise(spoken: string, history: string[] = [], context: MatchContext = {}): ExerciseMatch {
  const heard = cleanSpokenName(spoken);
  const spokenWords = words(heard);
  const options = new Map<string, ExerciseOption>();
  const focus = new Set(context.focus ?? []);
  const used = new Set(history.map((name) => name.toLowerCase()));

  const consider = (option: Omit<ExerciseOption, 'score'>, phrases: string[]) => {
    const score = Math.max(
      ...phrases.map((phrase) => {
        const known = words(phrase);
        return Math.max(phraseSimilarity(spokenWords, known), soundSimilarity(spokenWords, known));
      }),
    );
    const key = option.name.toLowerCase();
    const previous = options.get(key);
    if (!previous || previous.score < score) options.set(key, { ...option, score });
  };
  // Close matches lean toward this workout's muscle groups and the trainer's own exercises.
  const leaning = (option: ExerciseOption) =>
    option.score + (option.muscle && focus.has(option.muscle) ? 0.05 : 0) + (used.has(option.name.toLowerCase()) ? 0.03 : 0);

  for (const exercise of CATALOG) {
    consider(
      { name: exercise.name, muscle: exercise.muscle, catalogId: exercise.id },
      [exercise.name, ...(exercise.aliases ?? [])],
    );
  }
  for (const name of history) {
    if (options.has(name.toLowerCase())) continue;
    consider({ name, muscle: null, catalogId: null }, [name]);
  }

  let ranked = [...options.values()]
    .filter((option) => option.score >= 0.5)
    .sort((a, b) => leaning(b) - leaning(a) || a.name.length - b.name.length);

  // The trainer corrected this exact mishearing before: trust what they chose then.
  const corrected = context.corrections?.get(words(heard).join(' '));
  if (corrected) {
    const known = options.get(corrected.toLowerCase());
    const option: ExerciseOption = known
      ? { ...known, score: 1 }
      : { name: corrected, muscle: muscleOf(corrected), catalogId: null, score: 1 };
    ranked = [option, ...ranked.filter((o) => o.name.toLowerCase() !== corrected.toLowerCase())];
    return { heard, best: option, confident: true, alternatives: ranked.slice(1).filter((o) => o.score >= 0.6).slice(0, 3) };
  }

  const best = ranked[0] ?? null;
  const runnerUp = ranked[1];
  const confident =
    best !== null &&
    (best.score === 1 || (best.score >= 0.85 && (!runnerUp || leaning(best) - leaning(runnerUp) >= 0.1)));
  return { heard, best, confident, alternatives: ranked.slice(1).filter((o) => o.score >= 0.6).slice(0, 3) };
}

export function muscleOf(name: string): Muscle | null {
  const key = name.toLowerCase();
  return CATALOG.find((exercise) => exercise.name.toLowerCase() === key)?.muscle ?? null;
}

// Suggestions while typing a name: names the trainer used before first, then known exercises
// whose name or another common name starts a word with what was typed.
export function searchExercises(query: string, history: string[] = [], limit = 6): ExerciseOption[] {
  const typed = words(query);
  if (typed.length === 0) return [];
  const fits = (phrase: string) => {
    const known = words(phrase);
    return typed.every((part) => known.some((word) => word.startsWith(part)));
  };
  const results: ExerciseOption[] = [];
  const seen = new Set<string>();
  const add = (option: ExerciseOption) => {
    const key = option.name.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    results.push(option);
  };
  for (const name of history) {
    if (fits(name)) add({ name, muscle: muscleOf(name), catalogId: null, score: 1 });
  }
  const catalogHits = CATALOG.filter((e) => fits(e.name) || (e.aliases ?? []).some(fits)).sort(
    (a, b) => Number(!fits(a.name)) - Number(!fits(b.name)) || a.name.length - b.name.length,
  );
  for (const exercise of catalogHits) {
    add({ name: exercise.name, muscle: exercise.muscle, catalogId: exercise.id, score: 1 });
  }
  return results.slice(0, limit);
}
