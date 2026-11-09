import { Schema, model, type InferSchemaType, Types } from 'mongoose';

const aiUsageSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: String, required: true },
    textCount: { type: Number, default: 0 },
    photoCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

aiUsageSchema.index({ userId: 1, date: 1 }, { unique: true });

export type AiUsageDoc = InferSchemaType<typeof aiUsageSchema> & { _id: Types.ObjectId };
export const AiUsageModel = model('AiUsage', aiUsageSchema);
