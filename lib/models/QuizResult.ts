import mongoose, { Schema, Document } from "mongoose";

export interface IQuestionResult {
  questionId: string;
  questionText: string;
  selectedIndex: number;
  correctIndex: number;
  correct: boolean;
  category?: string;
}

export interface IQuizResult extends Document {
  userId: string;
  userName: string;
  date: string;
  score: number;
  total: number;
  percent: number;
  category: string;
  timeTaken: number;
  questionResults: IQuestionResult[];
}

const QuestionResultSchema = new Schema<IQuestionResult>(
  {
    questionId: { type: String, required: true },
    questionText: { type: String, required: true },
    selectedIndex: { type: Number, required: true },
    correctIndex: { type: Number, required: true },
    correct: { type: Boolean, required: true },
    category: { type: String, default: "" },
  },
  { _id: false }
);

const QuizResultSchema = new Schema<IQuizResult>(
  {
    userId: { type: String, required: true, index: true },
    userName: { type: String, required: true },
    date: { type: String, required: true },
    score: { type: Number, required: true },
    total: { type: Number, required: true },
    percent: { type: Number, required: true },
    category: { type: String, default: "all" },
    timeTaken: { type: Number, required: true },
    questionResults: { type: [QuestionResultSchema], default: [] },
  },
  { timestamps: true }
);

export default mongoose.models.QuizResult ||
  mongoose.model<IQuizResult>("QuizResult", QuizResultSchema);
