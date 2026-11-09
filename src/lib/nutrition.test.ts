import { describe, expect, it } from 'vitest';
import {
  calculateBmr,
  calculateCalorieTarget,
  calculateTdee,
  estimateStepCalories,
  estimateWorkoutCalories,
} from './nutrition.js';

describe('nutrition math', () => {
  it('computes Mifflin–St Jeor BMR for male', () => {
    expect(calculateBmr({ sex: 'male', weightKg: 80, heightCm: 180, age: 30 })).toBe(1780);
  });

  it('computes TDEE and goal targets', () => {
    const tdee = calculateTdee(1780, 'moderate');
    expect(tdee).toBe(Math.round(1780 * 1.55));
    expect(calculateCalorieTarget(tdee, 'lose')).toBe(tdee - 500);
  });

  it('estimates step and workout calories', () => {
    expect(estimateStepCalories(10000, 70)).toBe(400);
    expect(estimateWorkoutCalories('running', 30, 70)).toBeGreaterThan(200);
  });
});
