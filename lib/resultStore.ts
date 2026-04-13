/**
 * Quiz result history store - localStorage based
 * Stores quiz attempt results per user for history, analytics, leaderboard, SRS
 */

export interface QuizResult {
  id: string;
  userId: string;
  userName: string;
  date: string;
  score: number;
  total: number;
  percent: number;
  category: string; // "all" or specific category
  timeTaken: number; // seconds
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
  interval: number; // days until next review
  repetitions: number;
  easeFactor: number;
  nextReview: string; // ISO date
  lastReview: string; // ISO date
}

// Streak data
export interface UserStreak {
  userId: string;
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string; // YYYY-MM-DD
  totalXP: number;
  badges: string[];
  quizCount: number;
}

const RESULTS_KEY = "quiz_results";
const SRS_KEY = "quiz_srs_cards";
const STREAK_KEY = "quiz_streaks";

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}

// ─── RESULTS ──────────────────────────────────────────────────────────
export function getAllResults(): QuizResult[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(RESULTS_KEY);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch {
    return [];
  }
}

export function getResultsByUser(userId: string): QuizResult[] {
  return getAllResults().filter(r => r.userId === userId);
}

export function saveResult(result: Omit<QuizResult, "id">): QuizResult {
  const results = getAllResults();
  const newResult: QuizResult = { ...result, id: generateId() };
  results.push(newResult);
  localStorage.setItem(RESULTS_KEY, JSON.stringify(results));

  // Update streak
  updateStreak(result.userId, result.score, result.total);

  // Update SRS cards for wrong answers
  result.questionResults
    .filter(qr => !qr.correct)
    .forEach(qr => {
      updateSRSCard(result.userId, qr.questionId, false);
    });

  result.questionResults
    .filter(qr => qr.correct)
    .forEach(qr => {
      updateSRSCard(result.userId, qr.questionId, true);
    });

  return newResult;
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

export function getQuestionDifficulties(): QuestionDifficulty[] {
  const results = getAllResults();
  const map = new Map<string, { text: string; total: number; wrong: number; category?: string }>();

  for (const r of results) {
    for (const qr of r.questionResults) {
      const existing = map.get(qr.questionId) || {
        text: qr.questionText,
        total: 0,
        wrong: 0,
        category: qr.category,
      };
      existing.total++;
      if (!qr.correct) existing.wrong++;
      map.set(qr.questionId, existing);
    }
  }

  return Array.from(map.entries())
    .map(([id, data]) => ({
      questionId: id,
      questionText: data.text,
      totalAttempts: data.total,
      wrongAttempts: data.wrong,
      errorRate: data.total > 0 ? Math.round((data.wrong / data.total) * 100) : 0,
      category: data.category,
    }))
    .sort((a, b) => b.errorRate - a.errorRate);
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

export function getLeaderboard(period?: "week" | "month" | "all"): LeaderboardEntry[] {
  const results = getAllResults();
  const now = new Date();
  let filtered = results;

  if (period === "week") {
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    filtered = results.filter(r => new Date(r.date) >= weekAgo);
  } else if (period === "month") {
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    filtered = results.filter(r => new Date(r.date) >= monthAgo);
  }

  const map = new Map<string, { name: string; scores: number[]; xp: number }>();

  for (const r of filtered) {
    const existing = map.get(r.userId) || { name: r.userName, scores: [], xp: 0 };
    existing.scores.push(r.percent);
    existing.xp += calculateXP(r.score, r.total);
    map.set(r.userId, existing);
  }

  const streaks = getAllStreaks();

  return Array.from(map.entries())
    .map(([userId, data]) => {
      const streak = streaks.find(s => s.userId === userId);
      return {
        userId,
        userName: data.name,
        avgScore: Math.round(data.scores.reduce((a, b) => a + b, 0) / data.scores.length),
        totalQuizzes: data.scores.length,
        bestScore: Math.max(...data.scores),
        totalXP: streak?.totalXP || data.xp,
        streak: streak?.currentStreak || 0,
      };
    })
    .sort((a, b) => b.totalXP - a.totalXP);
}

// ─── PROGRESS CHART ───────────────────────────────────────────────────
export interface ProgressPoint {
  date: string;
  score: number;
  percent: number;
  category: string;
}

export function getProgressData(userId: string): ProgressPoint[] {
  return getResultsByUser(userId)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map(r => ({
      date: r.date,
      score: r.score,
      percent: r.percent,
      category: r.category,
    }));
}

// ─── STREAKS & GAMIFICATION ───────────────────────────────────────────
function calculateXP(score: number, total: number): number {
  const baseXP = 10;
  const bonusXP = Math.round((score / Math.max(total, 1)) * 50);
  const perfectBonus = score === total ? 25 : 0;
  return baseXP + bonusXP + perfectBonus;
}

export const BADGES = [
  { id: "first_quiz", name: "Khởi đầu", description: "Hoàn thành bài quiz đầu tiên", icon: "star", condition: (s: UserStreak) => s.quizCount >= 1 },
  { id: "five_quizzes", name: "Thành thạo", description: "Hoàn thành 5 bài quiz", icon: "medal", condition: (s: UserStreak) => s.quizCount >= 5 },
  { id: "ten_quizzes", name: "Chuyên gia", description: "Hoàn thành 10 bài quiz", icon: "trophy", condition: (s: UserStreak) => s.quizCount >= 10 },
  { id: "streak_3", name: "Ổn định", description: "Streak 3 ngày liên tiếp", icon: "fire", condition: (s: UserStreak) => s.longestStreak >= 3 },
  { id: "streak_7", name: "Kiên trì", description: "Streak 7 ngày liên tiếp", icon: "fire2", condition: (s: UserStreak) => s.longestStreak >= 7 },
  { id: "streak_30", name: "Huyền thoại", description: "Streak 30 ngày liên tiếp", icon: "crown", condition: (s: UserStreak) => s.longestStreak >= 30 },
  { id: "xp_100", name: "100 XP", description: "Đạt 100 XP", icon: "gem", condition: (s: UserStreak) => s.totalXP >= 100 },
  { id: "xp_500", name: "500 XP", description: "Đạt 500 XP", icon: "diamond", condition: (s: UserStreak) => s.totalXP >= 500 },
  { id: "xp_1000", name: "1000 XP", description: "Đạt 1000 XP", icon: "star2", condition: (s: UserStreak) => s.totalXP >= 1000 },
  { id: "twenty_five", name: "Tiến sĩ", description: "Hoàn thành 25 bài quiz", icon: "grad", condition: (s: UserStreak) => s.quizCount >= 25 },
];

function getAllStreaks(): UserStreak[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(STREAK_KEY);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch {
    return [];
  }
}

export function getUserStreak(userId: string): UserStreak {
  const streaks = getAllStreaks();
  const existing = streaks.find(s => s.userId === userId);
  return existing || {
    userId,
    currentStreak: 0,
    longestStreak: 0,
    lastActiveDate: "",
    totalXP: 0,
    badges: [],
    quizCount: 0,
  };
}

function updateStreak(userId: string, score: number, total: number): void {
  const streaks = getAllStreaks();
  let streak = streaks.find(s => s.userId === userId);
  const today = new Date().toISOString().split("T")[0];
  const xp = calculateXP(score, total);

  if (!streak) {
    streak = {
      userId,
      currentStreak: 1,
      longestStreak: 1,
      lastActiveDate: today,
      totalXP: xp,
      badges: [],
      quizCount: 1,
    };
    streaks.push(streak);
  } else {
    streak.totalXP += xp;
    streak.quizCount++;

    if (streak.lastActiveDate !== today) {
      const lastDate = new Date(streak.lastActiveDate);
      const todayDate = new Date(today);
      const diffDays = Math.floor((todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        streak.currentStreak++;
      } else if (diffDays > 1) {
        streak.currentStreak = 1;
      }
      streak.lastActiveDate = today;
    }
    streak.longestStreak = Math.max(streak.longestStreak, streak.currentStreak);
  }

  // Check badges
  for (const badge of BADGES) {
    if (!streak.badges.includes(badge.id) && badge.condition(streak)) {
      streak.badges.push(badge.id);
    }
  }

  localStorage.setItem(STREAK_KEY, JSON.stringify(streaks));
}

// ─── SPACED REPETITION (SRS) ──────────────────────────────────────────
function getAllSRSCards(): SRSCard[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(SRS_KEY);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch {
    return [];
  }
}

export function getSRSCardsForUser(userId: string): SRSCard[] {
  return getAllSRSCards().filter(c => c.userId === userId);
}

export function getDueCards(userId: string): SRSCard[] {
  const now = new Date().toISOString();
  return getSRSCardsForUser(userId).filter(c => c.nextReview <= now);
}

function updateSRSCard(userId: string, questionId: string, correct: boolean): void {
  const cards = getAllSRSCards();
  let card = cards.find(c => c.userId === userId && c.questionId === questionId);
  const now = new Date();

  if (!card) {
    card = {
      userId,
      questionId,
      interval: correct ? 1 : 0,
      repetitions: correct ? 1 : 0,
      easeFactor: 2.5,
      nextReview: new Date(now.getTime() + (correct ? 24 * 60 * 60 * 1000 : 10 * 60 * 1000)).toISOString(),
      lastReview: now.toISOString(),
    };
    cards.push(card);
  } else {
    // SM-2 algorithm variant
    if (correct) {
      if (card.repetitions === 0) {
        card.interval = 1;
      } else if (card.repetitions === 1) {
        card.interval = 6;
      } else {
        card.interval = Math.round(card.interval * card.easeFactor);
      }
      card.repetitions++;
      card.easeFactor = Math.max(1.3, card.easeFactor + 0.1);
    } else {
      card.repetitions = 0;
      card.interval = 0;
      card.easeFactor = Math.max(1.3, card.easeFactor - 0.2);
    }
    card.lastReview = now.toISOString();
    card.nextReview = new Date(
      now.getTime() + card.interval * 24 * 60 * 60 * 1000
    ).toISOString();
  }

  localStorage.setItem(SRS_KEY, JSON.stringify(cards));
}
