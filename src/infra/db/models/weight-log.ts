import { Schema, model, type InferSchemaType, Types } from 'mongoose';

const weightLogSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: String, required: true },
    weightKg: { type: Number, required: true, min: 30, max: 300 },
    note: { type: String, default: '' },
  },
  { timestamps: true },
);

weightLogSchema.index({ userId: 1, date: 1 }, { unique: true });

export type WeightLogDoc = InferSchemaType<typeof weightLogSchema> & { _id: Types.ObjectId };
export const WeightLogModel = model('WeightLog', weightLogSchema);
