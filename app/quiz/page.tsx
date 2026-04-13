"use client";

import { useState, useEffect, useCallback } from "react";
import { getQuestions, type Question } from "@/lib/questionStore";
import { useAuth } from "../components/AuthContext";
import AuthGuard from "../components/AuthGuard";
import {
  saveResult,
  type QuestionResult,
  getUserStreak,
  getDueCards,
  BADGES,
  type UserStreak,
} from "@/lib/resultStore";
import styles from "./quiz.module.css";

type Phase = "intro" | "quiz" | "review";
type TimerMode = "total" | "per-question";

interface UserAnswer {
  questionId: string;
  selectedIndex: number;
  correct: boolean;
  originalCorrectIndex: number;
  questionText: string;
  category?: string;
}

interface ShuffledQuestion extends Question {
  shuffledOptions: string[];
  shuffleMap: number[]; // shuffleMap[displayIndex] = originalIndex
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function shuffleQuestion(q: Question): ShuffledQuestion {
  const indices = q.options.map((_, i) => i);
  const shuffledIndices = shuffle(indices);
  return {
    ...q,
    shuffledOptions: shuffledIndices.map(i => q.options[i]),
    shuffleMap: shuffledIndices,
  };
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function getBadgeIcon(iconId: string): string {
  const icons: Record<string, string> = {
    star: "⭐",
    medal: "🥇",
    trophy: "🏆",
    fire: "🔥",
    fire2: "🔥",
    crown: "👑",
    gem: "💎",
    diamond: "💠",
    star2: "🌟",
    grad: "🎓",
  };
  return icons[iconId] || "⭐";
}

function QuizContent() {
  const { user } = useAuth();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [shuffled, setShuffled] = useState<ShuffledQuestion[]>([]);
  const [phase, setPhase] = useState<Phase>("intro");
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<(UserAnswer | null)[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [count, setCount] = useState(10);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [navOpen, setNavOpen] = useState(false);
  const [timerMode, setTimerMode] = useState<TimerMode>("total");
  const [perQuestionTime, setPerQuestionTime] = useState(60);
  const [quizStartTime, setQuizStartTime] = useState<number>(0);
  const [streak, setStreak] = useState<UserStreak | null>(null);
  const [newBadges, setNewBadges] = useState<string[]>([]);
  const [showBadgePopup, setShowBadgePopup] = useState(false);
  const [srsMode, setSrsMode] = useState(false);
  const [dueCardCount, setDueCardCount] = useState(0);

  useEffect(() => {
    getQuestions().then((qs) => {
      setQuestions(qs);
      setIsLoading(false);
    });
  }, []);

  useEffect(() => {
    if (user) {
      const s = getUserStreak(user.id);
      setStreak(s);
      const due = getDueCards(user.id);
      setDueCardCount(due.length);
    }
  }, [user, phase]);

  const categories = ["all", ...Array.from(new Set(questions.map(q => q.category).filter(Boolean))) as string[]];

  const filteredQuestions = selectedCategory === "all"
    ? questions
    : questions.filter(q => q.category === selectedCategory);

  const startQuiz = useCallback(() => {
    let pool: Question[];
    if (srsMode && user) {
      const dueCards = getDueCards(user.id);
      const dueIds = new Set(dueCards.map(c => c.questionId));
      const dueQuestions = questions.filter(q => dueIds.has(q.id));
      pool = shuffle(dueQuestions).slice(0, Math.min(count, dueQuestions.length));
    } else {
      pool = shuffle(filteredQuestions).slice(0, Math.min(count, filteredQuestions.length));
    }

    const shuffledPool = pool.map(shuffleQuestion);
    setShuffled(shuffledPool);
    setAnswers(new Array(shuffledPool.length).fill(null));
    setCurrent(0);
    setSelected(null);
    setConfirmed(false);
    setPhase("quiz");
    setNavOpen(false);
    setQuizStartTime(Date.now());

    if (timerMode === "total") {
      setTimeLeft(shuffledPool.length * 60);
    } else {
      setTimeLeft(perQuestionTime);
    }
  }, [filteredQuestions, count, timerMode, perQuestionTime, srsMode, user, questions]);

  // Timer logic
  useEffect(() => {
    if (phase !== "quiz" || timeLeft === null || timeLeft <= 0) return;

    const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
    return () => clearTimeout(timer);
  }, [phase, timeLeft]);

  // Time up handling
  useEffect(() => {
    if (phase !== "quiz" || timeLeft !== 0) return;

    if (timerMode === "total") {
      finishQuiz();
    } else {
      // Per-question: auto advance
      if (current + 1 >= shuffled.length) {
        finishQuiz();
      } else {
        setCurrent(prev => prev + 1);
        setSelected(null);
        setConfirmed(false);
        setTimeLeft(perQuestionTime);
      }
    }
  }, [timeLeft, phase, timerMode]);

  const saveCurrentAnswer = useCallback(() => {
    if (selected !== null) {
      const q = shuffled[current];
      const originalSelectedIndex = q.shuffleMap[selected];
      const isCorrect = q.correctIndex >= 0 && originalSelectedIndex === q.correctIndex;
      setAnswers((prev) => {
        const next = [...prev];
        next[current] = {
          questionId: q.id,
          selectedIndex: originalSelectedIndex,
          correct: isCorrect,
          originalCorrectIndex: q.correctIndex,
          questionText: q.question,
          category: q.category,
        };
        return next;
      });
    }
  }, [selected, shuffled, current]);

  const finishQuiz = useCallback(() => {
    if (!user) return;
    const timeTaken = Math.round((Date.now() - quizStartTime) / 1000);
    const currentAnswers = answers;
    const countable = shuffled.filter(q => q.correctIndex >= 0).length;
    const score = currentAnswers.filter(a => a && a.correct).length;
    const percent = countable > 0 ? Math.round((score / countable) * 100) : 0;

    const questionResults: QuestionResult[] = shuffled.map((q, i) => {
      const ans = currentAnswers[i];
      return {
        questionId: q.id,
        questionText: q.question,
        selectedIndex: ans ? ans.selectedIndex : -1,
        correctIndex: q.correctIndex,
        correct: ans ? ans.correct : false,
        category: q.category,
      };
    });

    const oldBadges = streak?.badges || [];

    saveResult({
      userId: user.id,
      userName: user.name,
      date: new Date().toISOString(),
      score,
      total: countable,
      percent,
      category: selectedCategory,
      timeTaken,
      questionResults,
    });

    // Check for new badges
    const updatedStreak = getUserStreak(user.id);
    const freshBadges = updatedStreak.badges.filter(b => !oldBadges.includes(b));
    if (freshBadges.length > 0) {
      setNewBadges(freshBadges);
      setShowBadgePopup(true);
    }
    setStreak(updatedStreak);
    setPhase("review");
  }, [user, answers, shuffled, quizStartTime, selectedCategory, streak]);

  const handleSelect = (idx: number) => {
    if (confirmed) return;
    setSelected(idx);
  };

  const handleConfirm = () => {
    if (selected === null || confirmed) return;
    setConfirmed(true);
    saveCurrentAnswer();
  };

  const handleNext = () => {
    if (current + 1 >= shuffled.length) {
      finishQuiz();
    } else {
      const nextIdx = current + 1;
      setCurrent(nextIdx);
      const existingAns = answers[nextIdx];
      setSelected(existingAns ? existingAns.selectedIndex : null);
      setConfirmed(!!existingAns);
      if (timerMode === "per-question") {
        setTimeLeft(perQuestionTime);
      }
    }
  };

  const handlePrev = () => {
    if (current <= 0) return;
    const prevIdx = current - 1;
    setCurrent(prevIdx);
    const existingAns = answers[prevIdx];
    if (existingAns) {
      // Find display index from original index
      const q = shuffled[prevIdx];
      const displayIdx = q.shuffleMap.indexOf(existingAns.selectedIndex);
      setSelected(displayIdx >= 0 ? displayIdx : null);
    } else {
      setSelected(null);
    }
    setConfirmed(!!existingAns);
  };

  const jumpToQuestion = (idx: number) => {
    if (idx === current) return;
    setCurrent(idx);
    const existingAns = answers[idx];
    if (existingAns) {
      const q = shuffled[idx];
      const displayIdx = q.shuffleMap.indexOf(existingAns.selectedIndex);
      setSelected(displayIdx >= 0 ? displayIdx : null);
    } else {
      setSelected(null);
    }
    setConfirmed(!!existingAns);
    setNavOpen(false);
    if (timerMode === "per-question") {
      setTimeLeft(perQuestionTime);
    }
  };

  const answeredCount = answers.filter(a => a !== null).length;
  const score = answers.filter((a) => a && a.correct).length;
  const countable = shuffled.filter((q) => q.correctIndex >= 0).length;
  const percent = countable > 0 ? Math.round((score / countable) * 100) : 0;

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.introCard}>
          <div className={styles.badge}>TRẮC NGHIỆM THUẾ</div>
          <h1 className={styles.title}>⏳ Đang tải câu hỏi...</h1>
          <p className={styles.subtitle}>Vui lòng chờ trong giây lát</p>
        </div>
      </div>
    );
  }

  if (phase === "intro") {
    return (
      <div className={styles.container}>
        <div className={styles.introCard}>
          <div className={styles.badge}>TRẮC NGHIỆM THUẾ</div>
          <h1 className={styles.title}>📚 Kiểm tra kiến thức thuế</h1>
          <p className={styles.subtitle}>
            Ôn luyện các quy định thuế GTGT, TNDN, TNCN và hóa đơn điện tử
          </p>

          {/* Streak & XP display */}
          {streak && user && (
            <div className={styles.streakBar}>
              <div className={styles.streakItem}>
                <span className={styles.streakIcon}>🔥</span>
                <span className={styles.streakValue}>{streak.currentStreak}</span>
                <span className={styles.streakLabel}>Streak</span>
              </div>
              <div className={styles.streakItem}>
                <span className={styles.streakIcon}>⚡</span>
                <span className={styles.streakValue}>{streak.totalXP}</span>
                <span className={styles.streakLabel}>XP</span>
              </div>
              <div className={styles.streakItem}>
                <span className={styles.streakIcon}>📝</span>
                <span className={styles.streakValue}>{streak.quizCount}</span>
                <span className={styles.streakLabel}>Bài quiz</span>
              </div>
              <div className={styles.streakItem}>
                <span className={styles.streakIcon}>🏅</span>
                <span className={styles.streakValue}>{streak.badges.length}</span>
                <span className={styles.streakLabel}>Huy hiệu</span>
              </div>
            </div>
          )}

          {/* Badges display */}
          {streak && streak.badges.length > 0 && (
            <div className={styles.badgesSection}>
              <span className={styles.badgesLabel}>Huy hiệu của bạn:</span>
              <div className={styles.badgesList}>
                {streak.badges.map(badgeId => {
                  const badge = BADGES.find(b => b.id === badgeId);
                  if (!badge) return null;
                  return (
                    <span key={badgeId} className={styles.badgeItem} title={badge.description}>
                      <span className={styles.badgeIcon}>{getBadgeIcon(badge.icon)}</span>
                      <span>{badge.name}</span>
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          <div className={styles.statsRow}>
            <div className={styles.statBox}>
              <span className={styles.statNum}>{filteredQuestions.length}</span>
              <span className={styles.statLabel}>Câu hỏi</span>
            </div>
            <div className={styles.statBox}>
              <span className={styles.statNum}>{categories.length - 1}</span>
              <span className={styles.statLabel}>Danh mục</span>
            </div>
            {dueCardCount > 0 && (
              <div className={styles.statBox}>
                <span className={`${styles.statNum} ${styles.statNumDue}`}>{dueCardCount}</span>
                <span className={styles.statLabel}>Cần ôn tập</span>
              </div>
            )}
          </div>

          {/* SRS mode toggle */}
          {dueCardCount > 0 && (
            <div className={styles.srsToggle}>
              <label className={styles.toggleLabel}>
                <input
                  type="checkbox"
                  checked={srsMode}
                  onChange={(e) => setSrsMode(e.target.checked)}
                  className={styles.toggleInput}
                />
                <span className={styles.toggleSwitch}></span>
                <span>Chế độ ôn tập thông minh (SRS) - {dueCardCount} câu cần ôn</span>
              </label>
            </div>
          )}

          {categories.length > 1 && !srsMode && (
            <div className={styles.categorySection}>
              <label className={styles.countLabel}>Chọn danh mục ôn tập:</label>
              <div className={styles.categoryList}>
                {categories.map((cat) => (
                  <button
                    key={cat}
                    className={`${styles.categoryBtn} ${selectedCategory === cat ? styles.categoryBtnActive : ""}`}
                    onClick={() => { setSelectedCategory(cat); setCount(10); }}
                  >
                    {cat === "all" ? "Tất cả" : cat}
                    <span className={styles.categoryCount}>
                      {cat === "all" ? questions.length : questions.filter(q => q.category === cat).length}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className={styles.countSelect}>
            <label className={styles.countLabel}>Số câu muốn làm:</label>
            <div className={styles.countBtns}>
              {[10, 20, 30, 50, 60].map((n) => (
                <button
                  key={n}
                  className={`${styles.countBtn} ${count === n ? styles.countBtnActive : ""}`}
                  onClick={() => setCount(n)}
                  disabled={n > filteredQuestions.length}
                >
                  {n}
                </button>
              ))}
              <button
                className={`${styles.countBtn} ${count === filteredQuestions.length ? styles.countBtnActive : ""}`}
                onClick={() => setCount(filteredQuestions.length)}
              >
                Tất cả ({filteredQuestions.length})
              </button>
            </div>
          </div>

          {/* Timer mode select */}
          <div className={styles.timerModeSection}>
            <label className={styles.countLabel}>Chế độ thời gian:</label>
            <div className={styles.countBtns}>
              <button
                className={`${styles.countBtn} ${timerMode === "total" ? styles.countBtnActive : ""}`}
                onClick={() => setTimerMode("total")}
              >
                Toàn bài
              </button>
              <button
                className={`${styles.countBtn} ${timerMode === "per-question" ? styles.countBtnActive : ""}`}
                onClick={() => setTimerMode("per-question")}
              >
                Từng câu
              </button>
            </div>
            {timerMode === "per-question" && (
              <div className={styles.perQuestionTimeSelect}>
                <span className={styles.perQLabel}>Giây/câu:</span>
                {[30, 45, 60, 90, 120].map(t => (
                  <button
                    key={t}
                    className={`${styles.countBtn} ${styles.countBtnSm} ${perQuestionTime === t ? styles.countBtnActive : ""}`}
                    onClick={() => setPerQuestionTime(t)}
                  >
                    {t}s
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            className={styles.startBtn}
            onClick={startQuiz}
            disabled={filteredQuestions.length === 0}
          >
            🚀 Bắt đầu làm bài
          </button>

        </div>
      </div>
    );
  }

  if (phase === "review") {
    const timeTaken = Math.round((Date.now() - quizStartTime) / 1000);

    return (
      <div className={styles.container}>
        {/* New badge popup */}
        {showBadgePopup && newBadges.length > 0 && (
          <div className={styles.badgePopupOverlay} onClick={() => setShowBadgePopup(false)}>
            <div className={styles.badgePopup} onClick={e => e.stopPropagation()}>
              <h3 className={styles.badgePopupTitle}>🎊 Huy hiệu mới!</h3>
              <div className={styles.badgePopupList}>
                {newBadges.map(badgeId => {
                  const badge = BADGES.find(b => b.id === badgeId);
                  if (!badge) return null;
                  return (
                    <div key={badgeId} className={styles.badgePopupItem}>
                      <span className={styles.badgePopupIcon}>{getBadgeIcon(badge.icon)}</span>
                      <div>
                        <div className={styles.badgePopupName}>{badge.name}</div>
                        <div className={styles.badgePopupDesc}>{badge.description}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <button className={styles.badgePopupClose} onClick={() => setShowBadgePopup(false)}>
                Tuyệt vời!
              </button>
            </div>
          </div>
        )}

        <div className={styles.reviewCard}>
          <div className={`${styles.scoreCircle} ${percent >= 80 ? styles.scoreGood : percent >= 50 ? styles.scoreMid : styles.scoreBad}`}>
            <span className={styles.scoreNum}>{percent}%</span>
            <span className={styles.scoreLabel}>Đúng</span>
          </div>
          <h2 className={styles.reviewTitle}>
            {percent >= 80 ? "🎉 Xuất sắc!" : percent >= 50 ? "👍 Khá tốt!" : "💪 Cần ôn thêm"}
          </h2>
          <p className={styles.reviewSub}>
            Bạn trả lời đúng <strong>{score}/{countable}</strong> câu có đáp án
            {shuffled.length - countable > 0 && (
              <span className={styles.reviewNoAnswerNote}> ({shuffled.length - countable} câu không có đáp án)</span>
            )}
          </p>

          {/* Stats summary */}
          <div className={styles.reviewStats}>
            <div className={styles.reviewStatItem}>
              <span className={styles.reviewStatValue}>{formatTime(timeTaken)}</span>
              <span className={styles.reviewStatLabel}>Thời gian</span>
            </div>
            {streak && (
              <>
                <div className={styles.reviewStatItem}>
                  <span className={styles.reviewStatValue}>+{streak.totalXP > 0 ? Math.min(85, streak.totalXP) : 0}</span>
                  <span className={styles.reviewStatLabel}>XP</span>
                </div>
                <div className={styles.reviewStatItem}>
                  <span className={styles.reviewStatValue}>{streak.currentStreak}</span>
                  <span className={styles.reviewStatLabel}>Streak</span>
                </div>
              </>
            )}
          </div>

          <div className={styles.reviewList}>
            {shuffled.map((q, i) => {
              const ans = answers[i];
              const noAnswer = q.correctIndex < 0;
              const skipped = !ans;
              const isCorrect = !noAnswer && !skipped && ans.correct;
              const itemClass = noAnswer
                ? `${styles.reviewItem} ${styles.reviewNoAnswer}`
                : skipped
                ? `${styles.reviewItem} ${styles.reviewSkipped}`
                : `${styles.reviewItem} ${isCorrect ? styles.reviewCorrect : styles.reviewWrong}`;
              return (
                <div key={q.id + "-" + i} className={itemClass}>
                  <div className={styles.reviewQ}>
                    <span className={styles.reviewIcon}>{noAnswer ? "❓" : skipped ? "⏭️" : isCorrect ? "✅" : "❌"}</span>
                    <span>{i + 1}. {q.question}</span>
                  </div>

                  <div className={styles.reviewOptions}>
                    {q.options.map((opt, oi) => {
                      const isThisCorrect = !noAnswer && oi === q.correctIndex;
                      const isThisSelected = ans && ans.selectedIndex === oi;
                      const isThisWrong = isThisSelected && !isThisCorrect;

                      let optClass = styles.reviewOptItem;
                      if (isThisCorrect) {
                        optClass = `${styles.reviewOptItem} ${styles.reviewOptCorrect}`;
                      } else if (isThisWrong) {
                        optClass = `${styles.reviewOptItem} ${styles.reviewOptWrong}`;
                      }

                      return (
                        <div key={oi} className={optClass}>
                          <span className={styles.reviewOptLetter}>
                            {String.fromCharCode(65 + oi)}
                          </span>
                          <span className={styles.reviewOptText}>{opt}</span>
                          {isThisCorrect && (
                            <span className={styles.reviewOptTag}>Đáp án đúng</span>
                          )}
                          {isThisWrong && (
                            <span className={styles.reviewOptTagWrong}>Bạn chọn</span>
                          )}
                          {isThisSelected && isThisCorrect && (
                            <span className={styles.reviewOptTag}>Bạn chọn</span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {noAnswer && (
                    <div className={styles.reviewAnswer}>
                      Câu này không có đáp án
                    </div>
                  )}
                  {skipped && !noAnswer && (
                    <div className={styles.reviewAnswer}>
                      Chưa trả lời
                    </div>
                  )}
                  {q.explanation && (
                    <div className={styles.reviewExplain}>
                      <span className={styles.reviewExplainLabel}>Giải thích:</span> {q.explanation}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className={styles.reviewActions}>
            <button className={styles.startBtn} onClick={startQuiz}>
              🔄 Làm lại
            </button>
            <button className={styles.outlineBtn} onClick={() => setPhase("intro")}>
              🏠 Về trang chủ
            </button>
          </div>
        </div>
      </div>
    );
  }

  // QUIZ PHASE
  const q = shuffled[current];
  const progress = ((current + 1) / shuffled.length) * 100;
  const timePercent = timerMode === "per-question"
    ? ((timeLeft || 0) / perQuestionTime) * 100
    : ((timeLeft || 0) / (shuffled.length * 60)) * 100;
  const isTimeLow = (timeLeft || 0) <= 10;

  return (
    <div className={styles.container}>
      <div className={styles.quizWrapper}>
        {/* Question Navigation Panel */}
        <div className={`${styles.navPanel} ${navOpen ? styles.navPanelOpen : ""}`}>
          <div className={styles.navPanelHeader}>
            <span className={styles.navPanelTitle}>Câu hỏi</span>
            <span className={styles.navPanelCount}>{answeredCount}/{shuffled.length}</span>
            <button className={styles.navPanelClose} onClick={() => setNavOpen(false)}>✕</button>
          </div>
          <div className={styles.navGrid}>
            {shuffled.map((_, i) => {
              const ans = answers[i];
              let numClass = styles.navNum;
              if (i === current) {
                numClass = `${styles.navNum} ${styles.navNumCurrent}`;
              } else if (ans) {
                if (ans.correct) {
                  numClass = `${styles.navNum} ${styles.navNumCorrect}`;
                } else {
                  numClass = `${styles.navNum} ${styles.navNumWrong}`;
                }
              }
              return (
                <button
                  key={i}
                  className={numClass}
                  onClick={() => jumpToQuestion(i)}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
          <div className={styles.navLegend}>
            <span><span className={`${styles.legendDot} ${styles.legendCurrent}`}></span> Hiện tại</span>
            <span><span className={`${styles.legendDot} ${styles.legendCorrect}`}></span> Đúng</span>
            <span><span className={`${styles.legendDot} ${styles.legendWrong}`}></span> Sai</span>
            <span><span className={`${styles.legendDot} ${styles.legendUnanswered}`}></span> Chưa làm</span>
          </div>
        </div>

        {/* Quiz Card */}
        <div className={styles.quizCard}>
          {/* Progress bar */}
          <div className={styles.progressBar}>
            <div className={styles.progressFill} style={{ width: `${progress}%` }} />
          </div>

          {/* Timer progress bar */}
          {timeLeft !== null && (
            <div className={styles.timerBar}>
              <div
                className={`${styles.timerBarFill} ${isTimeLow ? styles.timerBarLow : ""}`}
                style={{ width: `${timePercent}%` }}
              />
            </div>
          )}

          <div className={styles.quizHeader}>
            <button
              className={styles.navToggleBtn}
              onClick={() => setNavOpen(!navOpen)}
              title="Danh sách câu hỏi"
            >
              <span className={styles.navToggleIcon}></span>
              <span>{answeredCount}/{shuffled.length}</span>
            </button>
            <span className={styles.qNum}>Câu {current + 1} / {shuffled.length}</span>
            {q.category && <span className={styles.qCategory}>{q.category}</span>}
            {timeLeft !== null && (
              <span className={`${styles.timer} ${isTimeLow ? styles.timerLow : ""}`}>
                {formatTime(timeLeft)}
              </span>
            )}
            <button
              className={styles.endBtn}
              onClick={() => {
                if (confirm(`Kết thúc bài làm? Bạn đã làm ${answeredCount}/${shuffled.length} câu.`)) {
                  finishQuiz();
                }
              }}
            >
              Nộp bài
            </button>
          </div>

          <h2 className={styles.question}>{q.question}</h2>

          <div className={styles.options}>
            {q.shuffledOptions.map((opt, i) => {
              const originalIdx = q.shuffleMap[i];
              let cls = styles.optionBtn;
              if (confirmed) {
                if (originalIdx === q.correctIndex && q.correctIndex >= 0) {
                  cls = `${styles.optionBtn} ${styles.optionCorrect}`;
                } else if (selected === i && originalIdx !== q.correctIndex) {
                  cls = `${styles.optionBtn} ${styles.optionWrong}`;
                } else {
                  cls = `${styles.optionBtn} ${styles.optionDim}`;
                }
              } else if (selected === i) {
                cls = `${styles.optionBtn} ${styles.optionSelected}`;
              }
              return (
                <button key={i} className={cls} onClick={() => handleSelect(i)}>
                  <span className={styles.optionLetter}>{String.fromCharCode(65 + i)}</span>
                  <span>{opt}</span>
                </button>
              );
            })}
          </div>

          {/* Show explanation after confirming */}
          {confirmed && q.explanation && (
            <div className={styles.explanation}>
              <span className={styles.explainIcon}>💡</span>
              <span>{q.explanation}</span>
            </div>
          )}

          <div className={styles.quizActions}>
            <button
              className={styles.prevBtn}
              onClick={handlePrev}
              disabled={current <= 0}
            >
              Câu trước
            </button>

            {!confirmed ? (
              <button
                className={styles.confirmBtn}
                onClick={handleConfirm}
                disabled={selected === null}
                style={{ opacity: selected === null ? 0.5 : 1 }}
              >
                Xác nhận
              </button>
            ) : (
              <button
                className={styles.nextBtn}
                onClick={handleNext}
              >
                {current + 1 >= shuffled.length ? "Nộp bài" : "Câu tiếp theo"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function QuizPage() {
  return (
    <AuthGuard>
      <QuizContent />
    </AuthGuard>
  );
}
