import { Schema, model, type InferSchemaType, Types } from 'mongoose';

const foodCustomSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    brand: { type: String, default: '' },
    servingUnit: { type: String, default: 'serving' },
    servingGrams: { type: Number, default: null },
    calories: { type: Number, required: true, min: 0 },
    proteinG: { type: Number, required: true, min: 0 },
    carbsG: { type: Number, required: true, min: 0 },
    fatG: { type: Number, required: true, min: 0 },
    favorite: { type: Boolean, default: false },
  },
  { timestamps: true },
);

foodCustomSchema.index({ name: 'text', brand: 'text' });
foodCustomSchema.index({ userId: 1, favorite: 1 });

export type FoodCustomDoc = InferSchemaType<typeof foodCustomSchema> & {
  _id: Types.ObjectId;
};
export const FoodCustomModel = model('FoodCustom', foodCustomSchema);
