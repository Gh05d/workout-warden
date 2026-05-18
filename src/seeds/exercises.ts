// src/seeds/exercises.ts
import type {ExerciseSeed} from '../common/types';

export const EXERCISES: ExerciseSeed[] = [
  // ===== Lower body =====
  {
    slug: 'backward-walking',
    name: 'Backward Walking',
    description:
      'Walk backwards on a treadmill or flat ground, heel-to-toe with full ankle articulation. A foundational ATG drill for tibialis strength and knee health — start with 2–5 minutes uphill if possible.',
  },
  {
    slug: 'tibialis-raise',
    name: 'Tibialis Raise',
    video: 'https://www.youtube.com/watch?v=kIRvGGD21Zw',
    description:
      'Stand with your back against a wall, feet 6–12 inches out. Keep heels down and pull your toes up toward your shins under control. Trains the tibialis anterior to bulletproof the knees and shins.',
  },
  {
    slug: 'straight-leg-calf-raise',
    name: 'Straight Leg Calf Raise',
    video: 'https://www.youtube.com/watch?v=2SOQbnSJSbo',
    description:
      'Knees fully extended. Push up onto the balls of your feet to the highest point, then lower under control past flat (off a step if possible). Trains the gastrocnemius through full range.',
  },
  {
    slug: 'bent-leg-calf-raise',
    name: 'Bent Leg Calf Raise',
    video: 'https://www.youtube.com/watch?v=NIK_hmryfDg',
    description:
      'Seated with knees bent at 90°, weight resting over the knees. Push up onto the balls of your feet and lower below neutral. Isolates the soleus — the deep calf muscle missed by standing raises.',
  },
  {
    slug: 'reverse-step-up',
    name: 'Reverse Step Up',
    video: 'https://www.youtube.com/watch?v=yuvRE6PsvJw',
    description:
      'Stand on a box facing away from it. Step down backwards under control, lightly touch your heel to the floor, then return up using only the standing leg. Builds eccentric knee strength through deep flexion.',
  },
  {
    slug: 'atg-split-squat',
    name: 'ATG Split Squat',
    video: 'https://www.youtube.com/watch?v=Gx7i66uftV4',
    description:
      'Long stance with rear leg straight, front foot flat. Lower into the front leg with the knee tracking well past the toes until you hit elbow-to-instep, then drive up. End-range knee and hip mobility under load.',
  },
  {
    slug: 'vmo-squat',
    name: 'VMO Squat',
    video: 'https://www.youtube.com/watch?v=TnOyAnu5xhE',
    description:
      'Heels elevated on a slant board or plate, feet shoulder-width, torso upright. Descend into a deep squat with knees driving forward over the toes. Targets the VMO (vastus medialis oblique) — the teardrop above the knee.',
  },
  {
    slug: 'nordic',
    name: 'Nordic',
    video: 'https://www.youtube.com/watch?v=6NCN6kOagfY',
    description:
      'Kneel with your ankles anchored under a bar or partner. Lower your torso forward toward the floor by extending only at the knees, hips locked. Resist the eccentric as long as possible — the king of hamstring builders.',
  },

  // ===== Stretches / mobility =====
  {
    slug: 'big-toe-stretch',
    name: 'Big Toe Stretch',
    video: 'https://www.youtube.com/watch?v=tDVR_m9QpKE',
    description:
      'Sit and grip the big toe with your hand. Gently flex and extend it through its full range, 30–60 seconds per direction. Restores big toe mobility — essential for proper push-off and squat depth.',
  },
  {
    slug: 'l-sit-progression',
    name: 'L-Sit Progression',
    video: 'https://www.youtube.com/watch?v=IUZJoSP66HI',
    description:
      'Sit between parallel bars or on the floor with palms down. Press into the floor and lift the legs (tucked first, then extended) parallel to the ground. Builds core compression and shoulder strength simultaneously.',
  },
  {
    slug: 'couch-stretch',
    name: 'Couch Stretch',
    video: 'https://www.youtube.com/watch?v=grrTL9jlrDc',
    description:
      'Place one shin against a wall or couch, foot pointing up, other knee on the floor in front. Square the hips forward and tall through the torso. Hold 1–2 minutes per side. Aggressive hip-flexor and quad opener.',
  },
  {
    slug: 'elephant-walk',
    name: 'Elephant Walk',
    video: 'https://www.youtube.com/watch?v=qqMi-hJjMBk',
    description:
      'Standing forward fold with hands on the floor. Walk one foot back to lock that knee, alternating left and right with a swinging rhythm. Decompresses the spine and loads the posterior chain dynamically.',
  },
  {
    slug: 'pigeon-pushup',
    name: 'Pigeon Pushup',
    video: 'https://www.youtube.com/watch?v=qIe4xUIY5Mc',
    description:
      'Kneel and place your forearms on the floor in front of you, elbows wider than shoulders. Lift the chest off the ground by pulling the shoulder blades back and down. Trains thoracic extension — the antidote to desk posture.',
  },
  {
    slug: 'resting-squat',
    name: 'Resting Squat',
    video: 'https://www.youtube.com/watch?v=TnOyAnu5xhE',
    description:
      'Drop into a deep squat with feet flat, knees tracking over toes, and just rest there. Torso relaxed, weight in the whole foot. Accumulate 5–10 minutes daily to restore hip and ankle mobility.',
  },
  {
    slug: 'calf-stretch-slantboard',
    name: 'Calf Stretch on Slantboard',
    video: 'https://www.youtube.com/watch?v=mafo7o7OnFo',
    description:
      'Stand on a slant board with toes up, knees fully extended, ribs stacked. Lean forward into the stretch through the calves and Achilles tendons. Hold for time — a non-negotiable for squat-depth ankle mobility.',
  },
  {
    slug: 'standing-pancake-pulse',
    name: 'Standing Pancake Pulse',
    video: 'https://www.youtube.com/watch?v=EKSyDNx4atY',
    description:
      'Wide stance, fold forward, hands on the floor between the feet. Pulse the hips deeper while keeping the legs straight and the back flat-ish. Opens hip adductors, hamstrings, and inner thigh tissue.',
  },

  // ===== Upper body =====
  {
    slug: 'band-pull-apart',
    name: 'Band Pull-Apart',
    video: 'https://www.youtube.com/watch?v=stwYTTPXubo',
    description:
      'Hold a light band at chest height, arms extended in front. Pull the band apart by squeezing the shoulder blades together until the band touches your chest. Cheap, high-volume work for scapular retractors and rear delts.',
  },
  {
    slug: 'atg-pushup',
    name: 'ATG Pushup',
    video: 'https://www.youtube.com/watch?v=stwYTTPXubo',
    description:
      'Pushup variant with elbows tracking forward (not flared), hands slightly narrower than shoulder-width. Lower until the chest touches the floor or your hands, controlling the descent. Builds chest, triceps, and overhead reach.',
  },
  {
    slug: 'atg-row',
    name: 'ATG Row',
    video: 'https://www.youtube.com/watch?v=J-L3R7vBd8I',
    description:
      'Bodyweight or weighted row with the elbows flaring out wide (high-elbow row). Pull the chest toward the bar or handles, squeezing the upper back. Hits mid-traps, rhomboids, and rear delts that low rows skip.',
  },
  {
    slug: 'band-overhead-press',
    name: 'Band Overhead Press',
    video: 'https://www.youtube.com/shorts/1-VfJqjYquQ',
    description:
      'Stand on a band with the handles at shoulder height. Press straight overhead to full lockout, keeping the ribs down and core engaged so the spine stays neutral. Builds vertical pressing strength without joint stress.',
  },
  {
    slug: 'superman',
    name: 'Superman',
    video: 'https://www.youtube.com/shorts/KTWWh3GsyYw',
    description:
      'Lie face down with arms extended forward. Simultaneously lift your hands and feet off the floor by extending through the lower back and glutes. Hold briefly at the top, lower with control. Spinal-erector endurance.',
  },
  {
    slug: 'seated-goodmorning',
    name: 'Seated Goodmorning',
    video: 'https://www.youtube.com/watch?v=k2gpUHdRXS4',
    description:
      'Sit on a bench with a barbell racked on the upper back. Hinge forward at the hips, keeping the spine neutral, lowering your torso toward the floor. Reverse with the lower back. Heavy duty for spinal erectors and hamstrings.',
  },
  {
    slug: 'ql-extension',
    name: 'QL Extension',
    video: 'https://www.youtube.com/watch?v=YzomuSc93SM',
    description:
      'Side-lying or standing with a weight in the contralateral hand, lean laterally to load the quadratus lumborum (the deep lower-back muscle on either side of the spine). Builds bulletproof lateral-chain stability.',
  },
  {
    slug: 'wall-pullover',
    name: 'Wall Pullover',
    video: 'https://www.youtube.com/shorts/jCyWP32shXU',
    description:
      'Lie on the floor with arms straight overhead, hands holding a band or light weight. Extend the arms back to touch the floor behind you, then pull back to the start. Lat length + thoracic mobility in one move.',
  },

  // ===== Legacy (v1 Standard plan) — sled / press / pull =====
  {
    slug: 'sled',
    name: 'Sled',
    video: 'https://www.youtube.com/watch?v=XJxex3TnTWo',
    description:
      'Push or pull a weighted sled across the floor, leaning into the handles with the knees driving high. Pure concentric work — builds quad and posterior-chain strength with almost no DOMS or recovery cost.',
  },
  {
    slug: 'poliquin-step-up',
    name: 'Poliquin Step Up',
    video: 'https://www.youtube.com/watch?v=AbjXzX0CVhU',
    description:
      'Stand on a box. Lower the trailing leg under tight control until the toe lightly touches the floor, then drive back up through the standing leg only. Eccentric quad loading with strong VMO bias.',
  },
  {
    slug: 'split-squad',
    name: 'Split Squad',
    video: 'https://www.youtube.com/watch?v=Gx7i66uftV4',
    description:
      'Lunge stance, feet on parallel tracks. Lower until the back knee almost touches the floor, torso upright, then drive up through the front heel. Single-leg lower-body developer for strength and stability.',
  },
  {
    slug: 'hip-flexors',
    name: 'Hip Flexors',
    video: 'https://www.youtube.com/watch?v=ltz0SOFKh64',
    description:
      'Half-kneeling position with the hips squared forward. Drive the front of the rear hip toward the floor without losing posture or arching the lower back. Hold or pulse — opens chronically tight hip flexors.',
  },
  {
    slug: 'reverse-nordic',
    name: 'Reverse Nordic',
    video: 'https://www.youtube.com/watch?v=1a6nfG69c9g',
    description:
      'Kneel upright with hips locked. Lean back as far as you can by extending only at the knees, keeping a straight line from knees to head. Trains the quads through deep knee flexion under long-range eccentric load.',
  },

  {
    slug: 'chest-press',
    name: 'Chest Press',
    video: 'https://www.youtube.com/watch?v=VmB1G1K7v94',
    description:
      'Lie on a bench with dumbbells or a barbell at chest height. Press straight up to full lockout, then lower under control to touch the chest. Standard horizontal pressing — bread-and-butter upper-body strength.',
  },
  {
    slug: 'pullup',
    name: 'Pullup',
    video: 'https://www.youtube.com/watch?v=eGo4IYlbE5g',
    description:
      'Hang from a bar with palms facing away, shoulder-width grip. Pull yourself up until your chin clears the bar by squeezing the lats, then lower under full control. The undisputed vertical-pulling king.',
  },
  {
    slug: 'shoulder-press',
    name: 'Shoulder Press',
    video: 'https://www.youtube.com/watch?v=qEwKCR5JCog',
    description:
      'Standing or seated, press a barbell or dumbbells from shoulder height to overhead lockout. Keep the ribs stacked and glutes engaged if standing. Builds shoulder mass and overhead pressing strength.',
  },
  {
    slug: 'external-rotation',
    name: 'External Rotation',
    video: 'https://www.youtube.com/watch?v=mbdDt0c9bZY',
    description:
      'Band or cable at elbow height, upper arm pinned to the side, elbow bent 90°. Rotate the forearm outward away from the body, then return slowly. Essential rotator-cuff work for shoulder durability.',
  },
  {
    slug: 'neck-flexion',
    name: 'Neck Flexion',
    video: 'https://www.youtube.com/watch?v=BCwM-5Wn6Xg',
    description:
      'Lie face up on a bench with the head hanging off, hold a plate on the forehead. Curl the chin toward the chest, then lower with control. Direct neck-strength work — critical for collision-sport athletes.',
  },
  {
    slug: 'pullover',
    name: 'Pullover',
    video: 'https://www.youtube.com/watch?v=FK4rHfWKEac',
    description:
      'Lie on a bench, hold a single dumbbell with both hands above your chest. Lower it back behind the head with slightly bent arms, then pull back to over the chest. Hits lats, serratus, and thoracic mobility together.',
  },

  // ===== Legacy — mobility / stretches =====
  {
    slug: 'butterfly-stretch',
    name: 'Butterfly Stretch',
    video: 'https://www.youtube.com/watch?v=4J7kbCmPScQ',
    description:
      'Sit on the floor, soles of the feet pressed together, knees out wide. Hinge forward from the hips with a flat back to deepen the stretch. Hold for time — hip adductor and groin opener.',
  },
  {
    slug: 'jefferson-curl',
    name: 'Jefferson Curl',
    video: 'https://www.youtube.com/watch?v=nYS0R4c3qCA',
    description:
      'Stand on a box holding a light dumbbell. Roll down vertebra-by-vertebra into a fully rounded spine, reaching the weight past your feet, then slowly reverse. Loaded spinal flexion — builds back resilience.',
  },
  {
    slug: 'couch-stretch-lounge',
    name: 'Couch Stretch Lounge',
    video: 'https://www.youtube.com/watch?v=grrTL9jlrDc',
    description:
      'Variant of the couch stretch — kneel with the rear shin pressed against a couch or wall, then lean back to lounge against the seat. Hip flexor + quad opener with passive load. Hold 1–2 min per side.',
  },
];
