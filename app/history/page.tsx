"use client";

import { useState, useEffect, useMemo } from "react";
import { useAuth } from "../components/AuthContext";
import AuthGuard from "../components/AuthGuard";
import {
  getResultsByUser,
  getProgressData,
  getQuestionDifficulties,
  getUserStreak,
  BADGES,
  type QuizResult,
  type ProgressPoint,
  type QuestionDifficulty,
  type UserStreak,
} from "@/lib/resultStore";
import styles from "./history.module.css";

type Tab = "history" | "progress" | "difficulties" | "profile";

function getBadgeIcon(iconId: string): string {
  const icons: Record<string, string> = {
    star: "star", medal: "medal", trophy: "trophy", fire: "fire", fire2: "fire2",
    crown: "crown", gem: "gem", diamond: "diamond", star2: "star2", grad: "grad",
  };
  return icons[iconId] || "star";
}

function HistoryContent() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("history");
  const [results, setResults] = useState<QuizResult[]>([]);
  const [progress, setProgress] = useState<ProgressPoint[]>([]);
  const [difficulties, setDifficulties] = useState<QuestionDifficulty[]>([]);
  const [streak, setStreak] = useState<UserStreak | null>(null);
  const [expandedResult, setExpandedResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    setLoading(true);

    Promise.all([
      getResultsByUser(user.id),
      getProgressData(user.id),
      getQuestionDifficulties(),
      getUserStreak(user.id),
    ]).then(([resultsData, progressData, difficultiesData, streakData]) => {
      setResults(resultsData.reverse());
      setProgress(progressData);
      setDifficulties(difficultiesData);
      setStreak(streakData);
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });
  }, [user]);

  const maxScore = useMemo(() => {
    if (progress.length === 0) return 100;
    return Math.max(...progress.map(p => p.percent), 100);
  }, [progress]);

  if (!user) return null;

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.content}>
          <h1 className={styles.pageTitle}>Lịch sử & Thống kê</h1>
          <div className={styles.empty}>Đang tải dữ liệu...</div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <h1 className={styles.pageTitle}>Lịch sử & Thống kê</h1>

        <div className={styles.tabs}>
          {(["history", "progress", "difficulties", "profile"] as Tab[]).map(t => (
            <button
              key={t}
              className={`${styles.tabBtn} ${tab === t ? styles.tabBtnActive : ""}`}
              onClick={() => setTab(t)}
            >
              {t === "history" && "Lịch sử làm bài"}
              {t === "progress" && "Tiến bộ"}
              {t === "difficulties" && "Câu khó nhất"}
              {t === "profile" && "Hồ sơ"}
            </button>
          ))}
        </div>

        {/* History tab */}
        {tab === "history" && (
          <div>
            {results.length === 0 ? (
              <div className={styles.empty}>Chưa có kết quả nào. Hãy bắt đầu làm quiz!</div>
            ) : (
              <div className={styles.resultList}>
                {results.map(r => (
                  <div key={r.id} className={styles.resultCard}>
                    <div className={styles.resultHeader} onClick={() => setExpandedResult(expandedResult === r.id ? null : r.id)}>
                      <div className={styles.resultScore}>
                        <span className={`${styles.resultPercent} ${r.percent >= 80 ? styles.good : r.percent >= 50 ? styles.mid : styles.bad}`}>
                          {r.percent}%
                        </span>
                        <span className={styles.resultFraction}>{r.score}/{r.total}</span>
                      </div>
                      <div className={styles.resultMeta}>
                        <span className={styles.resultDate}>
                          {new Date(r.date).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </span>
                        <span className={styles.resultCategory}>{r.category === "all" ? "Tất cả" : r.category}</span>
                        <span className={styles.resultTime}>
                          {Math.floor(r.timeTaken / 60)}:{(r.timeTaken % 60).toString().padStart(2, "0")}
                        </span>
                      </div>
                      <span className={styles.expandIcon}>{expandedResult === r.id ? "\u25B4" : "\u25BE"}</span>
                    </div>

                    {expandedResult === r.id && (
                      <div className={styles.resultDetails}>
                        {r.questionResults.map((qr, qi) => (
                          <div key={qi} className={`${styles.detailRow} ${qr.correct ? styles.detailCorrect : styles.detailWrong}`}>
                            <span className={styles.detailIcon}>{qr.correct ? "O" : "X"}</span>
                            <span className={styles.detailText}>{qr.questionText}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Progress chart tab */}
        {tab === "progress" && (
          <div>
            {progress.length === 0 ? (
              <div className={styles.empty}>Chưa có dữ liệu. Hãy làm quiz để xem biểu đồ tiến bộ!</div>
            ) : (
              <div className={styles.chartCard}>
                <h2 className={styles.chartTitle}>Điểm số qua các lần làm</h2>
                <div className={styles.chart}>
                  <div className={styles.chartYAxis}>
                    <span>100%</span>
                    <span>75%</span>
                    <span>50%</span>
                    <span>25%</span>
                    <span>0%</span>
                  </div>
                  <div className={styles.chartArea}>
                    <div className={styles.chartGrid}>
                      <div className={styles.gridLine}></div>
                      <div className={styles.gridLine}></div>
                      <div className={styles.gridLine}></div>
                      <div className={styles.gridLine}></div>
                      <div className={styles.gridLine}></div>
                    </div>
                    <div className={styles.chartBars}>
                      {progress.map((p, i) => (
                        <div key={i} className={styles.barWrap}>
                          <div
                            className={`${styles.bar} ${p.percent >= 80 ? styles.barGood : p.percent >= 50 ? styles.barMid : styles.barBad}`}
                            style={{ height: `${(p.percent / maxScore) * 100}%` }}
                            title={`${p.percent}% - ${new Date(p.date).toLocaleDateString("vi-VN")}`}
                          >
                            <span className={styles.barLabel}>{p.percent}%</span>
                          </div>
                          <span className={styles.barDate}>
                            {new Date(p.date).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className={styles.chartSummary}>
                  <div className={styles.summaryItem}>
                    <span className={styles.summaryValue}>
                      {progress.length > 0 ? Math.round(progress.reduce((a, p) => a + p.percent, 0) / progress.length) : 0}%
                    </span>
                    <span className={styles.summaryLabel}>Điểm trung bình</span>
                  </div>
                  <div className={styles.summaryItem}>
                    <span className={styles.summaryValue}>
                      {progress.length > 0 ? Math.max(...progress.map(p => p.percent)) : 0}%
                    </span>
                    <span className={styles.summaryLabel}>Điểm cao nhất</span>
                  </div>
                  <div className={styles.summaryItem}>
                    <span className={styles.summaryValue}>{progress.length}</span>
                    <span className={styles.summaryLabel}>Tổng bài làm</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Difficulties tab */}
        {tab === "difficulties" && (
          <div>
            {difficulties.length === 0 ? (
              <div className={styles.empty}>Chưa có dữ liệu thống kê.</div>
            ) : (
              <div className={styles.diffCard}>
                <h2 className={styles.chartTitle}>Câu hỏi khó nhất (tỷ lệ sai cao)</h2>
                <div className={styles.diffList}>
                  {difficulties.slice(0, 20).map((d, i) => (
                    <div key={d.questionId} className={styles.diffItem}>
                      <span className={styles.diffRank}>{i + 1}</span>
                      <div className={styles.diffContent}>
                        <div className={styles.diffQuestion}>{d.questionText}</div>
                        {d.category && <span className={styles.diffCategory}>{d.category}</span>}
                        <div className={styles.diffStats}>
                          <span className={styles.diffErrorRate}>{d.errorRate}% sai</span>
                          <span className={styles.diffAttempts}>{d.totalAttempts} lần thử</span>
                        </div>
                        <div className={styles.diffBarBg}>
                          <div
                            className={`${styles.diffBarFill} ${d.errorRate >= 70 ? styles.diffBarHigh : d.errorRate >= 40 ? styles.diffBarMed : styles.diffBarLow}`}
                            style={{ width: `${d.errorRate}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Profile tab */}
        {tab === "profile" && streak && (
          <div className={styles.profileCard}>
            <div className={styles.profileHeader}>
              <div className={styles.profileAvatar}>{user.name.charAt(0).toUpperCase()}</div>
              <h2 className={styles.profileName}>{user.name}</h2>
              <p className={styles.profileEmail}>{user.email}</p>
            </div>

            <div className={styles.profileStats}>
              <div className={styles.profileStatItem}>
                <span className={styles.profileStatValue}>{streak.totalXP}</span>
                <span className={styles.profileStatLabel}>Tổng XP</span>
              </div>
              <div className={styles.profileStatItem}>
                <span className={styles.profileStatValue}>{streak.currentStreak}</span>
                <span className={styles.profileStatLabel}>Streak hiện tại</span>
              </div>
              <div className={styles.profileStatItem}>
                <span className={styles.profileStatValue}>{streak.longestStreak}</span>
                <span className={styles.profileStatLabel}>Streak dài nhất</span>
              </div>
              <div className={styles.profileStatItem}>
                <span className={styles.profileStatValue}>{streak.quizCount}</span>
                <span className={styles.profileStatLabel}>Bài quiz</span>
              </div>
            </div>

            <div className={styles.allBadges}>
              <h3 className={styles.badgesTitle}>Huy hiệu ({streak.badges.length}/{BADGES.length})</h3>
              <div className={styles.badgesGrid}>
                {BADGES.map(badge => {
                  const unlocked = streak.badges.includes(badge.id);
                  return (
                    <div key={badge.id} className={`${styles.profileBadge} ${unlocked ? styles.profileBadgeUnlocked : ""}`}>
                      <span className={styles.profileBadgeIcon}>{getBadgeIcon(badge.icon)}</span>
                      <span className={styles.profileBadgeName}>{badge.name}</span>
                      <span className={styles.profileBadgeDesc}>{badge.description}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function HistoryPage() {
  return (
    <AuthGuard>
      <HistoryContent />
    </AuthGuard>
  );
}
