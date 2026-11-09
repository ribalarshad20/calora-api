export type Sex = 'male' | 'female' | 'other';
export type Goal = 'lose' | 'maintain' | 'gain';
export type ActivityLevel =
  | 'sedentary'
  | 'light'
  | 'moderate'
  | 'active'
  | 'very_active';

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

const GOAL_DELTAS: Record<Goal, number> = {
  lose: -500,
  maintain: 0,
  gain: 300,
};

/** Mifflin–St Jeor BMR (kcal/day). `other` uses average of male/female formulas. */
export function calculateBmr(input: {
  sex: Sex;
  weightKg: number;
  heightCm: number;
  age: number;
}): number {
  const { weightKg, heightCm, age } = input;
  const male = 10 * weightKg + 6.25 * heightCm - 5 * age + 5;
  const female = 10 * weightKg + 6.25 * heightCm - 5 * age - 161;
  if (input.sex === 'male') return Math.round(male);
  if (input.sex === 'female') return Math.round(female);
  return Math.round((male + female) / 2);
}

export function calculateTdee(bmr: number, activityLevel: ActivityLevel): number {
  return Math.round(bmr * ACTIVITY_MULTIPLIERS[activityLevel]);
}

export function calculateCalorieTarget(tdee: number, goal: Goal): number {
  return Math.max(1200, Math.round(tdee + GOAL_DELTAS[goal]));
}

/** Default macro split: protein 30%, carbs 40%, fat 30% */
export function calculateMacroTargets(calorieTarget: number): {
  proteinG: number;
  carbsG: number;
  fatG: number;
} {
  return {
    proteinG: Math.round((calorieTarget * 0.3) / 4),
    carbsG: Math.round((calorieTarget * 0.4) / 4),
    fatG: Math.round((calorieTarget * 0.3) / 9),
  };
}

export function computeTargets(profile: {
  sex: Sex;
  weightKg: number;
  heightCm: number;
  age: number;
  activityLevel: ActivityLevel;
  goal: Goal;
}) {
  const bmr = calculateBmr(profile);
  const tdee = calculateTdee(bmr, profile.activityLevel);
  const calorieTarget = calculateCalorieTarget(tdee, profile.goal);
  const macros = calculateMacroTargets(calorieTarget);
  return { bmr, tdee, calorieTarget, ...macros };
}

/** Rough step calorie burn: ~0.04 kcal per step scaled by weight. */
export function estimateStepCalories(steps: number, weightKg: number): number {
  const perStep = 0.04 * (weightKg / 70);
  return Math.round(steps * perStep);
}

export const MET_TABLE: Record<string, number> = {
  walking: 3.5,
  running: 9.8,
  cycling: 7.5,
  swimming: 8.0,
  weightlifting: 6.0,
  yoga: 3.0,
  hiking: 6.0,
  hiit: 10.0,
  dancing: 5.0,
  sports: 7.0,
  other: 5.0,
};

export function estimateWorkoutCalories(
  type: string,
  durationMin: number,
  weightKg: number,
): number {
  const met = MET_TABLE[type] ?? MET_TABLE.other;
  return Math.round((met * 3.5 * weightKg * durationMin) / 200);
}
