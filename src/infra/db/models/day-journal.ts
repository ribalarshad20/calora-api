import { Schema, model, type InferSchemaType, Types } from 'mongoose';

const dayJournalSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: String, required: true },
    mood: {
      type: String,
      enum: ['great', 'good', 'okay', 'low', 'rough', ''],
      default: '',
    },
    moodScore: { type: Number, min: 1, max: 5, default: null },
    dayNote: { type: String, default: '', maxlength: 2000 },
    energy: { type: Number, min: 1, max: 5, default: null },
    sleepQuality: { type: Number, min: 1, max: 5, default: null },
  },
  { timestamps: true },
);

dayJournalSchema.index({ userId: 1, date: 1 }, { unique: true });

export type DayJournalDoc = InferSchemaType<typeof dayJournalSchema> & {
  _id: Types.ObjectId;
};
export const DayJournalModel = model('DayJournal', dayJournalSchema);
