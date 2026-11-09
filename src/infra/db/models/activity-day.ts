import { Schema, model, type InferSchemaType, Types } from 'mongoose';

const activityDaySchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: String, required: true },
    steps: { type: Number, default: 0, min: 0 },
    stepCalories: { type: Number, default: 0, min: 0 },
    activeCalories: { type: Number, default: 0, min: 0 },
    source: {
      type: String,
      enum: ['health_connect', 'device_sensor', 'manual'],
      default: 'manual',
    },
  },
  { timestamps: true },
);

activityDaySchema.index({ userId: 1, date: 1 }, { unique: true });

export type ActivityDayDoc = InferSchemaType<typeof activityDaySchema> & {
  _id: Types.ObjectId;
};
export const ActivityDayModel = model('ActivityDay', activityDaySchema);
