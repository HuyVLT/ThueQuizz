import mongoose, { Schema, Document } from "mongoose";

export interface ISRSCard extends Document {
  userId: string;
  questionId: string;
  interval: number;
  repetitions: number;
  easeFactor: number;
  nextReview: string;
  lastReview: string;
}

const SRSCardSchema = new Schema<ISRSCard>(
  {
    userId: { type: String, required: true, index: true },
    questionId: { type: String, required: true },
    interval: { type: Number, default: 0 },
    repetitions: { type: Number, default: 0 },
    easeFactor: { type: Number, default: 2.5 },
    nextReview: { type: String, required: true },
    lastReview: { type: String, required: true },
  },
  { timestamps: true }
);

// Compound index for efficient lookups
SRSCardSchema.index({ userId: 1, questionId: 1 }, { unique: true });

export default mongoose.models.SRSCard ||
  mongoose.model<ISRSCard>("SRSCard", SRSCardSchema);
