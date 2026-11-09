import { Schema, model, type InferSchemaType, Types } from 'mongoose';

const setSchema = new Schema(
  {
    setNumber: { type: Number, required: true, min: 1 },
    weightKg: { type: Number, default: 0, min: 0 },
    reps: { type: Number, default: 0, min: 0 },
    rpe: { type: Number, min: 1, max: 10, default: null },
    completed: { type: Boolean, default: true },
  },
  { _id: false },
);

const exerciseSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    muscleGroup: { type: String, default: '' },
    notes: { type: String, default: '' },
    sets: { type: [setSchema], default: [] },
  },
  { _id: true },
);

const workoutSessionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    date: { type: String, required: true },
    title: { type: String, default: 'Workout' },
    notes: { type: String, default: '' },
    durationMin: { type: Number, default: 0, min: 0 },
    caloriesBurned: { type: Number, default: 0, min: 0 },
    exercises: { type: [exerciseSchema], default: [] },
    startedAt: { type: Date, default: Date.now },
    finishedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

workoutSessionSchema.index({ userId: 1, date: 1 });

export type WorkoutSessionDoc = InferSchemaType<typeof workoutSessionSchema> & {
  _id: Types.ObjectId;
};
export const WorkoutSessionModel = model('WorkoutSession', workoutSessionSchema);
