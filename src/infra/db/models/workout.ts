import { Schema, model, type InferSchemaType, Types } from 'mongoose';

const workoutSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: String, required: true },
    type: { type: String, required: true },
    label: { type: String, default: '' },
    durationMin: { type: Number, required: true, min: 1 },
    caloriesBurned: { type: Number, required: true, min: 0 },
  },
  { timestamps: true },
);

workoutSchema.index({ userId: 1, date: 1 });

export type WorkoutDoc = InferSchemaType<typeof workoutSchema> & { _id: Types.ObjectId };
export const WorkoutModel = model('Workout', workoutSchema);
