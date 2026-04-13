/**
 * Quiz result store - MongoDB backed via API
 * All data persisted server-side
 */

export interface QuizResult {
  id: string;
  userId: string;
  userName: string;
  date: string;
  score: number;
  total: number;
  percent: number;
  category: string;
  timeTaken: number;
  questionResults: QuestionResult[];
}

export interface QuestionResult {
  questionId: string;
  questionText: string;
  selectedIndex: number;
  correctIndex: number;
  correct: boolean;
  category?: string;
}

// SRS card data
export interface SRSCard {
  questionId: string;
  userId: string;
  interval: number;
  repetitions: number;
  easeFactor: number;
  nextReview: string;
  lastReview: string;
}

// Streak data
export interface UserStreak {
  userId: string;
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string;
  totalXP: number;
  badges: string[];
  quizCount: number;
}

// ─── RESULTS ──────────────────────────────────────────────────────────

/** Lay tat ca ket qua tu server */
export async function getAllResults(): Promise<QuizResult[]> {
  try {
    const res = await fetch("/api/results", { cache: "no-store" });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

/** Lay ket qua theo user */
export async function getResultsByUser(userId: string): Promise<QuizResult[]> {
  try {
    const res = await fetch(`/api/results?userId=${userId}`, {
      cache: "no-store",
    });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

/** Luu ket qua quiz - server tu dong cap nhat streak + SRS */
export async function saveResult(
  result: Omit<QuizResult, "id">
): Promise<{ result: QuizResult; streak: UserStreak } | null> {
  try {
    const res = await fetch("/api/results", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(result),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

// ─── ANALYTICS ────────────────────────────────────────────────────────
export interface QuestionDifficulty {
  questionId: string;
  questionText: string;
  totalAttempts: number;
  wrongAttempts: number;
  errorRate: number;
  category?: string;
}

/** Lay thong ke do kho cua cau hoi */
export async function getQuestionDifficulties(): Promise<
  QuestionDifficulty[]
> {
  try {
    const res = await fetch("/api/results/difficulties", {
      cache: "no-store",
    });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

// ─── LEADERBOARD ──────────────────────────────────────────────────────
export interface LeaderboardEntry {
  userId: string;
  userName: string;
  avgScore: number;
  totalQuizzes: number;
  bestScore: number;
  totalXP: number;
  streak: number;
}

/** Lay bang xep hang */
export async function getLeaderboard(
  period?: "week" | "month" | "all"
): Promise<LeaderboardEntry[]> {
  try {
    const p = period || "all";
    const res = await fetch(`/api/leaderboard?period=${p}`, {
      cache: "no-store",
    });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

// ─── PROGRESS CHART ───────────────────────────────────────────────────
export interface ProgressPoint {
  date: string;
  score: number;
  percent: number;
  category: string;
}

/** Lay du lieu tien bo cua user */
export async function getProgressData(
  userId: string
): Promise<ProgressPoint[]> {
  try {
    const results = await getResultsByUser(userId);
    return results
      .sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      )
      .map((r) => ({
        date: r.date,
        score: r.score,
        percent: r.percent,
        category: r.category,
      }));
  } catch {
    return [];
  }
}

// ─── STREAKS & GAMIFICATION ───────────────────────────────────────────

export const BADGES = [
  {
    id: "first_quiz",
    name: "Khoi dau",
    description: "Hoan thanh bai quiz dau tien",
    icon: "star",
    condition: (s: UserStreak) => s.quizCount >= 1,
  },
  {
    id: "five_quizzes",
    name: "Thanh thao",
    description: "Hoan thanh 5 bai quiz",
    icon: "medal",
    condition: (s: UserStreak) => s.quizCount >= 5,
  },
  {
    id: "ten_quizzes",
    name: "Chuyen gia",
    description: "Hoan thanh 10 bai quiz",
    icon: "trophy",
    condition: (s: UserStreak) => s.quizCount >= 10,
  },
  {
    id: "streak_3",
    name: "On dinh",
    description: "Streak 3 ngay lien tiep",
    icon: "fire",
    condition: (s: UserStreak) => s.longestStreak >= 3,
  },
  {
    id: "streak_7",
    name: "Kien tri",
    description: "Streak 7 ngay lien tiep",
    icon: "fire2",
    condition: (s: UserStreak) => s.longestStreak >= 7,
  },
  {
    id: "streak_30",
    name: "Huyen thoai",
    description: "Streak 30 ngay lien tiep",
    icon: "crown",
    condition: (s: UserStreak) => s.longestStreak >= 30,
  },
  {
    id: "xp_100",
    name: "100 XP",
    description: "Dat 100 XP",
    icon: "gem",
    condition: (s: UserStreak) => s.totalXP >= 100,
  },
  {
    id: "xp_500",
    name: "500 XP",
    description: "Dat 500 XP",
    icon: "diamond",
    condition: (s: UserStreak) => s.totalXP >= 500,
  },
  {
    id: "xp_1000",
    name: "1000 XP",
    description: "Dat 1000 XP",
    icon: "star2",
    condition: (s: UserStreak) => s.totalXP >= 1000,
  },
  {
    id: "twenty_five",
    name: "Tien si",
    description: "Hoan thanh 25 bai quiz",
    icon: "grad",
    condition: (s: UserStreak) => s.quizCount >= 25,
  },
];

/** Lay streak cua user tu server */
export async function getUserStreak(userId: string): Promise<UserStreak> {
  try {
    const res = await fetch(`/api/streaks/${userId}`, { cache: "no-store" });
    if (!res.ok) {
      return {
        userId,
        currentStreak: 0,
        longestStreak: 0,
        lastActiveDate: "",
        totalXP: 0,
        badges: [],
        quizCount: 0,
      };
    }
    return res.json();
  } catch {
    return {
      userId,
      currentStreak: 0,
      longestStreak: 0,
      lastActiveDate: "",
      totalXP: 0,
      badges: [],
      quizCount: 0,
    };
  }
}

// ─── SPACED REPETITION (SRS) ──────────────────────────────────────────

/** Lay tat ca SRS cards cua user */
export async function getSRSCardsForUser(
  userId: string
): Promise<SRSCard[]> {
  try {
    const res = await fetch(`/api/srs/${userId}`, { cache: "no-store" });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

/** Lay cac card den han on tap */
export async function getDueCards(userId: string): Promise<SRSCard[]> {
  try {
    const res = await fetch(`/api/srs/${userId}?due=true`, {
      cache: "no-store",
    });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}
