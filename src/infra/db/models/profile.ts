import { Schema, model, type InferSchemaType, Types } from 'mongoose';

const profileSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    sex: { type: String, enum: ['male', 'female', 'other'], required: true },
    age: { type: Number, required: true, min: 13, max: 120 },
    heightCm: { type: Number, required: true, min: 100, max: 250 },
    weightKg: { type: Number, required: true, min: 30, max: 300 },
    goal: { type: String, enum: ['lose', 'maintain', 'gain'], required: true },
    activityLevel: {
      type: String,
      enum: ['sedentary', 'light', 'moderate', 'active', 'very_active'],
      required: true,
    },
    bmr: { type: Number, required: true },
    tdee: { type: Number, required: true },
    calorieTarget: { type: Number, required: true },
    proteinG: { type: Number, required: true },
    carbsG: { type: Number, required: true },
    fatG: { type: Number, required: true },
    waterGoalMl: { type: Number, default: 2500 },
    theme: {
      type: String,
      enum: ['sage_mist', 'dawn_cream', 'harbor_calm', 'midnight'],
      default: 'sage_mist',
    },
  },
  { timestamps: true },
);

export type ProfileDoc = InferSchemaType<typeof profileSchema> & { _id: Types.ObjectId };
export const ProfileModel = model('Profile', profileSchema);
