import { Schema, model, type InferSchemaType, Types } from 'mongoose';

const waterLogSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: String, required: true },
    amountMl: { type: Number, required: true, min: 1, max: 5000 },
  },
  { timestamps: true },
);

waterLogSchema.index({ userId: 1, date: 1 });

export type WaterLogDoc = InferSchemaType<typeof waterLogSchema> & { _id: Types.ObjectId };
export const WaterLogModel = model('WaterLog', waterLogSchema);
