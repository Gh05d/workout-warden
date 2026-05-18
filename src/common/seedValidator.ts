// src/common/seedValidator.ts
// Validates a {exercises, plans} seed bundle for internal consistency.
// Throws on the first inconsistency so seed drift fails fast at startup
// before any rows are written to SQLite.

import type {ExerciseSeed, PlanSeed, ExercisePrescription} from './types';

export interface SeedBundle {
  exercises: ExerciseSeed[];
  plans: PlanSeed[];
}

export function validateSeed(bundle: SeedBundle): void {
  const slugs = new Set<string>();
  for (const ex of bundle.exercises) {
    if (slugs.has(ex.slug)) {
      throw new Error(`duplicate exercise slug '${ex.slug}'`);
    }
    slugs.add(ex.slug);
  }

  const planSlugs = new Set<string>();
  for (const plan of bundle.plans) {
    if (planSlugs.has(plan.slug)) {
      throw new Error(`duplicate plan slug '${plan.slug}'`);
    }
    planSlugs.add(plan.slug);

    const templateSlugs = new Set(plan.session_templates.map(t => t.slug));

    for (const day of plan.days) {
      if (!templateSlugs.has(day.session_template_slug)) {
        throw new Error(
          `plan '${plan.slug}' day_index ${day.day_index}: session_template_slug '${day.session_template_slug}' not defined in plan`,
        );
      }
    }

    for (const tpl of plan.session_templates) {
      validateTemplate(plan.slug, tpl.slug, tpl.exercises, slugs);
    }
  }
}

function validateTemplate(
  planSlug: string,
  templateSlug: string,
  exercises: ExercisePrescription[],
  catalogue: Set<string>,
): void {
  const sortedByOrder = [...exercises].sort((a, b) => a.order_index - b.order_index);
  sortedByOrder.forEach((ex, i) => {
    const expected = i + 1;
    if (ex.order_index !== expected) {
      throw new Error(
        `plan '${planSlug}' template '${templateSlug}': order_index must be dense 1..N (got ${ex.order_index} at position ${expected})`,
      );
    }
  });

  for (const ex of exercises) {
    if (!catalogue.has(ex.exercise_slug)) {
      throw new Error(
        `plan '${planSlug}' template '${templateSlug}': exercise_slug '${ex.exercise_slug}' not in catalogue`,
      );
    }

    const hasReps = ex.prescribed_reps !== undefined;
    const hasSecs = ex.prescribed_seconds !== undefined;
    if (!hasReps && !hasSecs) {
      throw new Error(
        `plan '${planSlug}' template '${templateSlug}' order ${ex.order_index}: must set prescribed_reps OR prescribed_seconds`,
      );
    }
    if (hasReps && hasSecs) {
      throw new Error(
        `plan '${planSlug}' template '${templateSlug}' order ${ex.order_index}: cannot set both prescribed_reps and prescribed_seconds`,
      );
    }

    if (ex.circuit_index !== undefined && ex.circuit_rounds === undefined) {
      throw new Error(
        `plan '${planSlug}' template '${templateSlug}' order ${ex.order_index}: circuit_index requires circuit_rounds`,
      );
    }
  }

  const circuits = new Map<number, number>();
  for (const ex of exercises) {
    if (ex.circuit_index === undefined) continue;
    const existing = circuits.get(ex.circuit_index);
    if (existing !== undefined && existing !== ex.circuit_rounds) {
      throw new Error(
        `plan '${planSlug}' template '${templateSlug}': circuit_index ${ex.circuit_index} has inconsistent circuit_rounds (${existing} vs ${ex.circuit_rounds})`,
      );
    }
    circuits.set(ex.circuit_index, ex.circuit_rounds!);
  }
}
