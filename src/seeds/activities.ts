// src/seeds/activities.ts
// Free-form activity catalogue. Same lifecycle as the exercise catalogue:
// upserted by slug on every app start, grows but never shrinks, no
// SEED_REVISION interplay. Adding an activity later = one row here + release.
import type {ActivitySeed} from '../common/types';

export const ACTIVITIES: ActivitySeed[] = [
  {slug: 'surf', name: 'Surf'},
  {slug: 'altinha', name: 'Altinha'},
];
