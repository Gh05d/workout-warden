/* eslint-disable max-lines */

export const colors = {
  primary: '#FF9800',
  secondary: '#4CAF50',
};

export const demotivationalQuotes = [
  "Don't worry about the world coming to an end today. It's already tomorrow in Australia.",
  "You're not lazy, you're just on energy-saving mode.",
  'Why do it today when you can put it off till tomorrow?',
  'Life is short. Smile while you still have teeth.',
  "I'm not saying I hate you, but I would unplug your life support to charge my phone.",
  "Be yourself; everyone else is already taken. Unfortunately, being yourself isn't all that great either.",
  'Age is just a number, and so is your bank balance.',
  "Some people are like clouds. When they disappear, it's a beautiful day.",
  "I'm great at multitasking. I can waste time, be unproductive, and procrastinate all at once.",
  "Opportunity does knock once, but by the time you stop looking through the peephole, it's gone.",
  'If you think the grass is greener on the other side, you’re probably looking at artificial turf.',
  'A clear conscience is usually the sign of a bad memory.',
  'Laugh and the world laughs with you. Snore and you sleep alone.',
  'Why does a slight tax increase cost you $200 and a substantial tax cut save you 30 cents?',
  'In the journey of life, I choose the psycho path.',
  "If you can't make it good, at least make it look good. Said every politician ever.",
  "You can't have everything. Where would you put it?",
  'If you think you’re too small to be effective, you’ve never been in bed with a mosquito.',
  'The problem with troubleshooting is that sometimes trouble shoots back.',
  'Remember, it’s only a game, unless you’re losing.',
  'If you’re not part of the solution, there’s good money to be made in prolonging the problem.',
  'The best thing about hitting rock bottom is the discovery that rock bottom has a basement.',
  'An expert is someone who knows more and more about less and less, until eventually, they know everything about nothing.',
  'Money can’t buy happiness, but it sure makes misery easier to live with.',
  "If at first you don't succeed, look in the trash for the instructions.",
  'History teaches us that men and nations behave wisely once they have exhausted all other alternatives.',
  'To steal ideas from one person is plagiarism; to steal from many is research.',
  'The best way to lie is to tell the truth, carefully edited truth.',
  'Remember, when you’re going through hell, keep going. You might get out before the devil even knows you’re there.',
  'Achieving success is like finding a needle in a haystack, except the needle is also made of hay.',
  'Dreams are like rainbows. Only idiots chase them.',
  "It's always too early to quit, but never too late to give up.",
  'The road to success is dotted with many tempting parking spaces.',
  'Hard work never killed anyone, but why take the chance?',
  "Remember, Rome wasn't built in a day. But it burned in one.",
  'The light at the end of the tunnel has been turned off due to budget cuts.',
  "If at first you don't succeed, failure may be your style.",
  'If you think you are too small to make a difference, try sleeping with a mosquito.',
  'Teamwork is important; it helps to put the blame on someone else.',
  'If you try to fail, and succeed, which have you done?',
  'Experience is a wonderful thing. It enables you to recognize a mistake when you make it again.',
  'Everybody brings joy to this office. Some when they enter, others when they leave.',
  "If you can't learn to do it well, learn to enjoy doing it badly.",
  'Don’t follow your dreams, they’re probably unreachable.',
  "Be the kind of person that when your feet hit the floor each morning, the devil says, 'Oh crap, they're up.'",
  'Life is full of disappointments, and I just added you to the list.',
  'If you think nobody cares if you’re alive, try missing a couple of payments.',
  "A diamond is merely a lump of coal that did well under pressure. So, you're probably not a diamond.",
  'Motivation is what gets you started. Habit is why you keep making the same mistakes.',
  'Someday we’ll look back on all this and plow into a parked car.',
  'There are no stupid questions, but there are a LOT of inquisitive idiots.',
  'If the grass is greener on the other side, maybe that’s because you’re not there.',
  'I am not a pessimist. I am an optimist who has experienced the realities of life.',
  'Remember, you are unique, just like everyone else.',
  'Not all who wander are lost, but you probably are.',
  "Keep rolling your eyes. Maybe you'll find a brain back there.",
  'I don’t believe in astrology; I’m a Sagittarius and we’re skeptical.',
  'Always borrow money from a pessimist. They won’t expect it back.',
  'Hard work pays off in the future. Laziness pays off now.',
  "If at first you don't succeed, then skydiving definitely isn't for you.",
  'If you think education is expensive, try ignorance.',
  'The early bird might get the worm, but the second mouse gets the cheese.',
  'I didn’t say it was your fault, I said I was blaming you.',
  "If you can't beat them, arrange to have them beaten.",
  'Don’t be irreplaceable. If you can’t be replaced, you can’t be promoted.',
  'Life is like a sewer… what you get out of it depends on what you put into it.',
  'You’re never too old to learn something stupid.',
  'To err is human, to blame it on someone else shows management potential.',
  'War does not determine who is right — only who is left.',
  "If two wrongs don't make a right, try three.",
];

export const WEEKS = 'WEEKS';

export const trainingDays = [
  'Reverse Step Up Leg Day',
  'Chest Pressing Upper Body Day',
  'Mobility Day',
  'Split Squat Leg Day',
  'Shoulder Pressing Upper Body Day',
];

export const training = {
  A: {
    type: 'A',
    startDate: Date.now(),
    endDate: new Date(new Date().getTime() + 5 * 24 * 60 * 60 * 1000),
    finished: false,
    sessions: [
      {
        day: 'Reverse Step Up Leg Day',
        finished: false,
        exercises: [
          {
            name: 'Sled',
            sled: true,
            time: 300,
            finished: false,
            sets: [{reps: 1, weight: 10}],
            video: 'https://www.youtube.com/watch?v=XJxex3TnTWo',
          },
          {
            name: 'Poliquin Step Up',
            sets: [
              {reps: 15, weight: 30},
              {reps: 15, weight: 30},
              {reps: 15, weight: 30},
            ],
            finished: false,
            video: 'https://www.youtube.com/watch?v=AbjXzX0CVhU',
          },
          {
            name: 'Nordic',
            sets: [
              {reps: 5, weight: null},
              {reps: 5, weight: null},
              {reps: 5, weight: null},
            ],
            finished: false,
            video: 'https://www.youtube.com/watch?v=6NCN6kOagfY',
            next: true,
          },
          {
            name: 'Hip Flexors',
            sets: [
              {reps: 20, weight: null},
              {reps: 20, weight: null},
              {reps: 20, weight: null},
            ],
            finished: false,

            video: 'https://www.youtube.com/watch?v=ltz0SOFKh64',
            next: true,
          },
          {
            name: 'Reverse Nordic',
            sets: [
              {reps: 8, weight: null},
              {reps: 8, weight: null},
              {reps: 8, weight: null},
            ],
            finished: false,

            video: 'https://www.youtube.com/watch?v=1a6nfG69c9g',
          },
        ],
      },
      {
        day: 'Chest Pressing Upper Body Day',
        finished: false,
        exercises: [
          {
            name: 'Chest Press',
            sets: [
              {reps: 8, weight: 18},
              {reps: 8, weight: 18},
              {reps: 8, weight: 18},
            ],
            finished: false,

            hint: 'per hand',
            video: 'https://www.youtube.com/watch?v=VmB1G1K7v94',
            next: true,
          },
          {
            name: 'Tibialis Raise',
            sets: [
              {reps: 20, weight: 20},
              {reps: 20, weight: 20},
              {reps: 20, weight: 20},
            ],
            finished: false,

            video: 'https://www.youtube.com/watch?v=kIRvGGD21Zw',
            next: true,
          },
          {
            name: 'Pullup',
            sets: [
              {reps: 0, weight: 5},
              {reps: 0, weight: 5},
              {reps: 0, weight: 5},
            ],
            finished: false,

            video: 'https://www.youtube.com/watch?v=eGo4IYlbE5g',
            next: true,
          },
          {
            name: 'Straight Leg Calf Raise',
            sets: [
              {reps: 15, weight: 20},
              {reps: 15, weight: 20},
              {reps: 15, weight: 20},
            ],
            finished: false,

            video: 'https://www.youtube.com/watch?v=2SOQbnSJSbo',
          },
        ],
      },
      {
        day: 'Mobility Day',
        finished: false,
        exercises: [
          {
            name: 'Pigeon Pushup',
            sets: [
              {reps: 20, weight: null},
              {reps: 20, weight: null},
              {reps: 20, weight: null},
            ],
            finished: false,

            video: 'https://www.youtube.com/watch?v=qIe4xUIY5Mc',
            next: true,
          },
          {
            name: 'Butterfly Stretch',
            sets: [
              {reps: 20, weight: 10},
              {reps: 20, weight: 10},
              {reps: 20, weight: 10},
            ],
            finished: false,

            video: 'https://www.youtube.com/watch?v=4J7kbCmPScQ',
            next: true,
          },
          {
            name: 'Jefferson Curl',
            sets: [
              {reps: 15, weight: 5},
              {reps: 15, weight: 5},
              {reps: 15, weight: 5},
            ],
            finished: false,

            video: 'https://www.youtube.com/watch?v=nYS0R4c3qCA',
            next: true,
          },
          {
            name: 'Reverse Nordic',
            sets: [
              {reps: 8, weight: null},
              {reps: 8, weight: null},
              {reps: 8, weight: null},
            ],
            finished: false,

            video: 'https://www.youtube.com/watch?v=1a6nfG69c9g',
            next: true,
          },
          {
            name: 'Pullover',
            sets: [
              {reps: 10, weight: 12},
              {reps: 10, weight: 12},
              {reps: 10, weight: 12},
            ],
            finished: false,

            video: 'https://www.youtube.com/watch?v=FK4rHfWKEac',
          },
        ],
      },
      {
        day: 'Split Squat Leg Day',
        finished: false,
        exercises: [
          {
            name: 'Sled',
            sled: true,
            time: 300,
            finished: false,
            sets: [{reps: 1, weight: 10}],
            video: 'https://www.youtube.com/watch?v=XJxex3TnTWo',
          },
          {
            name: 'Split Squad',
            sets: [
              {reps: 8, weight: 12},
              {reps: 8, weight: 12},
              {reps: 8, weight: 12},
            ],
            finished: false,

            video: 'https://www.youtube.com/watch?v=Gx7i66uftV4',
          },
          {
            name: 'Seated Goodmorning',
            sets: [
              {reps: 10, weight: 20},
              {reps: 10, weight: 20},
              {reps: 10, weight: 20},
            ],
            finished: false,

            video: 'https://www.youtube.com/watch?v=k2gpUHdRXS4',
            next: true,
          },
          {
            name: 'VMO Squat',
            sets: [
              {reps: 20, weight: 10},
              {reps: 20, weight: 10},
              {reps: 20, weight: 10},
            ],
            finished: false,

            video: 'https://www.youtube.com/watch?v=TnOyAnu5xhE',
          },
        ],
      },
      {
        day: 'Shoulder Pressing Upper Body Day',
        finished: false,
        exercises: [
          {
            name: 'Shoulder Press',
            sets: [
              {reps: 8, weight: 16},
              {reps: 8, weight: 16},
              {reps: 8, weight: 16},
            ],
            finished: false,

            video: 'https://www.youtube.com/watch?v=qEwKCR5JCog',
            next: true,
          },
          {
            name: 'Tibialis Raise',
            sets: [
              {reps: 20, weight: 20},
              {reps: 20, weight: 20},
              {reps: 20, weight: 20},
            ],
            finished: false,

            video: 'https://www.youtube.com/watch?v=kIRvGGD21Zw',
            next: true,
          },
          {
            name: 'External Rotation',
            sets: [
              {reps: 8, weight: 4},
              {reps: 8, weight: 4},
              {reps: 8, weight: 4},
            ],
            finished: false,

            video: 'https://www.youtube.com/watch?v=mbdDt0c9bZY',
            next: true,
          },
          {
            name: 'Bent Leg Calf Raise',
            sets: [
              {reps: 15, weight: 20},
              {reps: 15, weight: 20},
              {reps: 15, weight: 20},
            ],
            finished: false,

            video: 'https://www.youtube.com/watch?v=NIK_hmryfDg',
            next: true,
          },
          {
            name: 'Neck Flexion',
            sets: [
              {reps: 10, weight: 10},
              {reps: 10, weight: 10},
              {reps: 10, weight: 10},
            ],
            finished: false,

            video: 'https://www.youtube.com/watch?v=BCwM-5Wn6Xg',
          },
        ],
      },
    ],
  },
  B: {
    type: 'B',
    startDate: Date.now(),
    endDate: new Date(new Date().getTime() + 5 * 24 * 60 * 60 * 1000),
    finished: false,
    sessions: [
      {
        day: 'Reverse Step Up Leg Day',
        finished: false,
        exercises: [
          {
            name: 'Sled',
            sled: true,
            time: 300,
            finished: false,
            sets: [{reps: 1, weight: 10}],
            video: 'https://www.youtube.com/watch?v=XJxex3TnTWo',
          },
          {
            name: 'Petersen Step Up',
            sets: [
              {reps: 15, weight: 30},
              {reps: 15, weight: 30},
              {reps: 15, weight: 30},
            ],
            finished: false,
            video: 'https://www.youtube.com/watch?v=yuvRE6PsvJw',
          },
          {
            name: 'Back Extension',
            sets: [
              {reps: 8, weight: 15},
              {reps: 8, weight: 15},
              {reps: 8, weight: 15},
            ],
            finished: false,

            hint: 'Single Leg',
            video: 'https://www.youtube.com/watch?v=ph3pddpKzzw',
            next: true,
          },
          {
            name: 'Hip Flexors',
            sets: [
              {reps: 20, weight: null},
              {reps: 20, weight: null},
              {reps: 20, weight: null},
            ],
            finished: false,

            video: 'https://www.youtube.com/watch?v=ltz0SOFKh64',
            next: true,
          },
          {
            name: 'Reverse Nordic',
            sets: [
              {reps: 8, weight: null},
              {reps: 8, weight: null},
              {reps: 8, weight: null},
            ],
            finished: false,

            video: 'https://www.youtube.com/watch?v=1a6nfG69c9g',
          },
        ],
      },
      {
        day: 'Chest Pressing Upper Body Day',
        finished: false,
        exercises: [
          {
            name: 'Dips',
            sets: [
              {reps: 10, weight: 10},
              {reps: 10, weight: 10},
              {reps: 10, weight: 10},
            ],
            finished: false,

            video: 'https://www.youtube.com/watch?v=dX_nSOOJIsE',
            next: true,
          },
          {
            name: 'Tibialis Raise',
            sets: [
              {reps: 20, weight: 20},
              {reps: 20, weight: 20},
              {reps: 20, weight: 20},
            ],
            finished: false,

            video: 'https://www.youtube.com/watch?v=kIRvGGD21Zw',
            next: true,
          },
          {
            name: 'Powell Raise',
            sets: [
              {reps: 8, weight: 8},
              {reps: 8, weight: 8},
              {reps: 8, weight: 8},
            ],
            finished: false,

            video: 'https://www.youtube.com/watch?v=UZ0SIUzOq88',
            next: true,
          },
          {
            name: 'Straight Leg Calf Raise',
            sets: [
              {reps: 15, weight: 20},
              {reps: 15, weight: 20},
              {reps: 15, weight: 20},
            ],
            finished: false,

            video: 'https://www.youtube.com/watch?v=2SOQbnSJSbo',
          },
        ],
      },
      {
        day: 'Mobility Day',
        finished: false,
        exercises: [
          {
            name: 'Pigeon Pushup',
            sets: [
              {reps: 20, weight: null},
              {reps: 20, weight: null},
              {reps: 20, weight: null},
            ],
            finished: false,

            video: 'https://www.youtube.com/watch?v=qIe4xUIY5Mc',
            next: true,
          },
          {
            name: 'Pancake',
            sets: [
              {reps: 20, weight: 0},
              {reps: 20, weight: 0},
              {reps: 20, weight: 0},
            ],
            finished: false,

            video: 'https://www.youtube.com/watch?v=EKSyDNx4atY',
            next: true,
          },
          {
            name: 'QL Extension',
            sets: [
              {reps: 10, weight: 0},
              {reps: 10, weight: 0},
              {reps: 10, weight: 0},
            ],
            finished: false,
            hint: 'per side',
            video: 'https://www.youtube.com/watch?v=YzomuSc93SM',
            next: true,
          },
          {
            name: 'Reverse Nordic',
            sets: [
              {reps: 8, weight: null},
              {reps: 8, weight: null},
              {reps: 8, weight: null},
            ],
            finished: false,
            video: 'https://www.youtube.com/watch?v=1a6nfG69c9g',
            next: true,
          },
          {
            name: 'Pullover',
            sets: [
              {reps: 10, weight: 12},
              {reps: 10, weight: 12},
              {reps: 10, weight: 12},
            ],
            finished: false,
            video: 'https://www.youtube.com/watch?v=FK4rHfWKEac',
          },
        ],
      },
      {
        day: 'Split Squat Leg Day',
        finished: false,
        exercises: [
          {
            name: 'Sled',
            sled: true,
            time: 300,
            finished: false,
            sets: [{reps: 1, weight: 10}],
            video: 'https://www.youtube.com/watch?v=XJxex3TnTWo',
          },
          {
            name: 'Split Squad',
            sets: [
              {reps: 8, weight: 12},
              {reps: 8, weight: 12},
              {reps: 8, weight: 12},
            ],
            finished: false,
            video: 'https://www.youtube.com/watch?v=Gx7i66uftV4',
          },
          {
            name: 'Romanian Deadlift',
            sets: [
              {reps: 12, weight: 50},
              {reps: 12, weight: 50},
              {reps: 12, weight: 50},
            ],
            finished: false,
            video: 'https://www.youtube.com/watch?v=7j-2w4-P14I',
            next: true,
          },
          {
            name: 'VMO Squat',
            sets: [
              {reps: 20, weight: 10},
              {reps: 20, weight: 10},
              {reps: 20, weight: 10},
            ],
            finished: false,
            video: 'https://www.youtube.com/watch?v=TnOyAnu5xhE',
          },
        ],
      },
      {
        day: 'Shoulder Pressing Upper Body Day',
        finished: false,
        exercises: [
          {
            name: 'Neck Press',
            sets: [
              {reps: 8, weight: 30},
              {reps: 8, weight: 30},
              {reps: 8, weight: 30},
            ],
            finished: false,
            video: 'https://www.youtube.com/watch?v=O7pXeoGX6zg',
            next: true,
          },
          {
            name: 'Tibialis Raise',
            sets: [
              {reps: 20, weight: 20},
              {reps: 20, weight: 20},
              {reps: 20, weight: 20},
            ],
            finished: false,
            video: 'https://www.youtube.com/watch?v=kIRvGGD21Zw',
            next: true,
          },
          {
            name: 'Trap-3 Raise',
            sets: [
              {reps: 8, weight: 4},
              {reps: 8, weight: 4},
              {reps: 8, weight: 4},
            ],
            finished: false,
            video: 'https://www.youtube.com/watch?v=9Q410MJq3Hg',
            next: true,
          },
          {
            name: 'Bent Leg Calf Raise',
            sets: [
              {reps: 15, weight: 20},
              {reps: 15, weight: 20},
              {reps: 15, weight: 20},
            ],
            finished: false,
            video: 'https://www.youtube.com/watch?v=NIK_hmryfDg',
            next: true,
          },
          {
            name: 'Neck Bridge',
            sets: [
              {reps: 3, weight: 0},
              {reps: 3, weight: 0},
              {reps: 3, weight: 0},
            ],
            hint: 'Hold 8 seconds',
            finished: false,
            video: 'https://www.youtube.com/watch?v=21WlIZNiyS8',
          },
        ],
      },
    ],
  },
};
