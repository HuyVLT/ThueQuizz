import mongoose, { Schema, Document } from "mongoose";

export interface IQuestion extends Document {
  question: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
  category?: string;
}

const QuestionSchema = new Schema<IQuestion>(
  {
    question: { type: String, required: true },
    options: { type: [String], required: true },
    correctIndex: { type: Number, required: true, default: -1 },
    explanation: { type: String, default: "" },
    category: { type: String, default: "" },
  },
  { timestamps: true }
);

// Prevent mongoose from compiling the model multiple times in Next.js development
export default mongoose.models.Question || mongoose.model<IQuestion>("Question", QuestionSchema);
