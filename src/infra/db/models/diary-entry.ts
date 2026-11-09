import { Schema, model, type InferSchemaType, Types } from 'mongoose';

const macrosSchema = new Schema(
  {
    calories: { type: Number, required: true, min: 0 },
    proteinG: { type: Number, required: true, min: 0 },
    carbsG: { type: Number, required: true, min: 0 },
    fatG: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const diaryEntrySchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    date: { type: String, required: true },
    mealType: {
      type: String,
      enum: ['breakfast', 'lunch', 'dinner', 'snack'],
      required: true,
    },
    name: { type: String, required: true, trim: true },
    brand: { type: String, default: '' },
    servingQty: { type: Number, default: 1, min: 0 },
    servingUnit: { type: String, default: 'serving' },
    grams: { type: Number, default: null },
    macros: { type: macrosSchema, required: true },
    source: {
      type: String,
      enum: ['manual', 'barcode', 'custom', 'ai_text', 'ai_photo', 'favorite'],
      default: 'manual',
    },
    barcode: { type: String, default: null },
    idempotencyKey: { type: String, default: null },
    notes: { type: String, default: '' },
    mood: {
      type: String,
      enum: ['great', 'good', 'okay', 'low', 'rough', ''],
      default: '',
    },
    moodScore: { type: Number, min: 1, max: 5, default: null },
  },
  { timestamps: true },
);

diaryEntrySchema.index({ userId: 1, date: 1 });
diaryEntrySchema.index(
  { userId: 1, idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } },
);

export type DiaryEntryDoc = InferSchemaType<typeof diaryEntrySchema> & {
  _id: Types.ObjectId;
};
export const DiaryEntryModel = model('DiaryEntry', diaryEntrySchema);
