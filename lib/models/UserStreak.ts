import mongoose, { Schema, Document } from "mongoose";

export interface IUserStreak extends Document {
  userId: string;
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string;
  totalXP: number;
  badges: string[];
  quizCount: number;
}

const UserStreakSchema = new Schema<IUserStreak>(
  {
    userId: { type: String, required: true, unique: true, index: true },
    currentStreak: { type: Number, default: 0 },
    longestStreak: { type: Number, default: 0 },
    lastActiveDate: { type: String, default: "" },
    totalXP: { type: Number, default: 0 },
    badges: { type: [String], default: [] },
    quizCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.models.UserStreak ||
  mongoose.model<IUserStreak>("UserStreak", UserStreakSchema);
