"use client";

import { useState, useEffect, useCallback } from "react";
import { getQuestions, type Question } from "@/lib/questionStore";
import styles from "./quiz.module.css";

type Phase = "intro" | "quiz" | "review";

interface UserAnswer {
  questionId: string;
  selectedIndex: number;
  correct: boolean;
}

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

export default function QuizPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [shuffled, setShuffled] = useState<Question[]>([]);
  const [phase, setPhase] = useState<Phase>("intro");
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<UserAnswer[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [count, setCount] = useState(10);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  useEffect(() => {
    getQuestions().then((qs) => {
      setQuestions(qs);
      setIsLoading(false);
    });
  }, []);

  const categories = ["all", ...Array.from(new Set(questions.map(q => q.category).filter(Boolean))) as string[]];

  const filteredQuestions = selectedCategory === "all"
    ? questions
    : questions.filter(q => q.category === selectedCategory);

  const startQuiz = useCallback(() => {
    const pool = shuffle(filteredQuestions).slice(0, Math.min(count, filteredQuestions.length));
    setShuffled(pool);
    setAnswers([]);
    setCurrent(0);
    setSelected(null);
    setPhase("quiz");
    setTimeLeft(pool.length * 60); // 1 minute per question
  }, [filteredQuestions, count]);

  useEffect(() => {
    if (phase === "quiz" && timeLeft !== null && timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    } else if (phase === "quiz" && timeLeft === 0) {
      setPhase("review");
    }
  }, [phase, timeLeft]);

  const handleSelect = (idx: number) => {
    setSelected(idx);
  };

  const handleNext = () => {
    // Record answer
    if (selected !== null) {
      const q = shuffled[current];
      const isCorrect = q.correctIndex >= 0 && selected === q.correctIndex;
      setAnswers((prev) => {
        const next = [...prev];
        next[current] = { questionId: q.id, selectedIndex: selected, correct: isCorrect };
        return next;
      });
    }

    if (current + 1 >= shuffled.length) {
      setPhase("review");
    } else {
      setCurrent((c) => c + 1);
      // Try to restore previous choice if they already answered (but we don't have previous navigation yet)
      const existingAns = answers[current + 1];
      setSelected(existingAns ? existingAns.selectedIndex : null);
    }
  };

  const score = answers.filter((a) => a.correct).length;
  // Only count questions that have a defined answer toward the total
  const countable = shuffled.filter((q) => q.correctIndex >= 0).length;
  const percent = countable > 0 ? Math.round((score / countable) * 100) : 0;

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.introCard}>
          <div className={styles.badge}>TRẮC NGHIỆM THUẾ</div>
          <h1 className={styles.title}>Đang tải câu hỏi...</h1>
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
          <h1 className={styles.title}>Kiểm tra kiến thức thuế</h1>
          <p className={styles.subtitle}>
            Ôn luyện các quy định thuế GTGT, TNDN, TNCN và hóa đơn điện tử
          </p>

          <div className={styles.statsRow}>
            <div className={styles.statBox}>
              <span className={styles.statNum}>{filteredQuestions.length}</span>
              <span className={styles.statLabel}>Câu hỏi</span>
            </div>
            <div className={styles.statBox}>
              <span className={styles.statNum}>{categories.length - 1}</span>
              <span className={styles.statLabel}>Danh mục</span>
            </div>
          </div>

          {categories.length > 1 && (
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

          <button
            className={styles.startBtn}
            onClick={startQuiz}
            disabled={filteredQuestions.length === 0}
          >
            Bắt đầu làm bài →
          </button>

        </div>
      </div>
    );
  }

  if (phase === "review") {
    return (
      <div className={styles.container}>
        <div className={styles.reviewCard}>
          <div className={`${styles.scoreCircle} ${percent >= 80 ? styles.scoreGood : percent >= 50 ? styles.scoreMid : styles.scoreBad}`}>
            <span className={styles.scoreNum}>{percent}%</span>
            <span className={styles.scoreLabel}>Đúng</span>
          </div>
          <h2 className={styles.reviewTitle}>
            {percent >= 80 ? "Xuất sắc! 🎉" : percent >= 50 ? "Khá tốt! 👍" : "Cần ôn thêm 📚"}
          </h2>
          <p className={styles.reviewSub}>
            Bạn trả lời đúng <strong>{score}/{countable}</strong> câu có đáp án
            {shuffled.length - countable > 0 && (
              <span className={styles.reviewNoAnswerNote}> ({shuffled.length - countable} câu không có đáp án)</span>
            )}
          </p>

          <div className={styles.reviewList}>
            {shuffled.map((q, i) => {
              const ans = answers[i];
              const noAnswer = q.correctIndex < 0;
              const skipped = !ans; // câu chưa trả lời (kết thúc sớm)
              const isCorrect = !noAnswer && !skipped && ans.correct;
              const itemClass = noAnswer
                ? `${styles.reviewItem} ${styles.reviewNoAnswer}`
                : skipped
                ? `${styles.reviewItem} ${styles.reviewSkipped}`
                : `${styles.reviewItem} ${isCorrect ? styles.reviewCorrect : styles.reviewWrong}`;
              return (
                <div key={q.id} className={itemClass}>
                  <div className={styles.reviewQ}>
                    <span className={styles.reviewIcon}>{noAnswer ? "?" : skipped ? "—" : isCorrect ? "✓" : "✗"}</span>
                    <span>{i + 1}. {q.question}</span>
                  </div>
                  {noAnswer ? (
                    <div className={styles.reviewAnswer}>
                      Câu này không có đáp án
                    </div>
                  ) : skipped ? (
                    <div className={styles.reviewAnswer}>
                      Chưa trả lời — Đáp án: <strong>{q.options[q.correctIndex]}</strong>
                    </div>
                  ) : !isCorrect && (
                    <div className={styles.reviewAnswer}>
                      Đáp án đúng: <strong>{q.options[q.correctIndex]}</strong>
                    </div>
                  )}
                  {q.explanation && (
                    <div className={styles.reviewExplain}>{q.explanation}</div>
                  )}
                </div>
              );
            })}
          </div>

          <div className={styles.reviewActions}>
            <button className={styles.startBtn} onClick={startQuiz}>
              Làm lại
            </button>
            <button className={styles.outlineBtn} onClick={() => setPhase("intro")}>
              Về trang chủ
            </button>
          </div>
        </div>
      </div>
    );
  }

  const q = shuffled[current];
  const progress = ((current + 1) / shuffled.length) * 100;

  return (
    <div className={styles.container}>
      <div className={styles.quizCard}>
        <div className={styles.progressBar}>
          <div className={styles.progressFill} style={{ width: `${progress}%` }} />
        </div>

        <div className={styles.quizHeader}>
          <span className={styles.qNum}>Câu {current + 1} / {shuffled.length}</span>
          {q.category && <span className={styles.qCategory}>{q.category}</span>}
          {timeLeft !== null && (
            <span className={styles.timer}>
              ⏱️ {Math.floor(timeLeft / 60).toString().padStart(2, '0')}:{(timeLeft % 60).toString().padStart(2, '0')}
            </span>
          )}
          <button
            className={styles.endBtn}
            onClick={() => {
              // Always save current unsubmitted answer 
              if (selected !== null) {
                const isCorrect = q.correctIndex >= 0 && selected === q.correctIndex;
                setAnswers(prev => {
                  const next = [...prev];
                  next[current] = { questionId: q.id, selectedIndex: selected, correct: isCorrect };
                  return next;
                });
              }
              if (confirm(`Kết thúc bài làm? Bạn mới làm ${answers.length + (selected !== null && !answers[current] ? 1 : 0)}/${shuffled.length} câu.`)) {
                setPhase("review");
              }
            }}
          >
            Nộp bài
          </button>
        </div>

        <h2 className={styles.question}>{q.question}</h2>

        <div className={styles.options}>
          {q.options.map((opt, i) => {
            let cls = styles.optionBtn;
            if (selected === i) {
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

        <button 
          className={styles.nextBtn} 
          onClick={handleNext} 
          disabled={selected === null}
          style={{ opacity: selected === null ? 0.5 : 1 }}
        >
          {current + 1 >= shuffled.length ? "Nộp bài" : "Câu tiếp theo →"}
        </button>
      </div>
    </div>
  );
}
