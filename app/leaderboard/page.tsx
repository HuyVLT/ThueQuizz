"use client";

import { useState, useEffect } from "react";
import { useAuth } from "../components/AuthContext";
import AuthGuard from "../components/AuthGuard";
import { getLeaderboard, type LeaderboardEntry } from "@/lib/resultStore";
import styles from "./leaderboard.module.css";

type Period = "week" | "month" | "all";

function LeaderboardContent() {
  const { user } = useAuth();
  const [period, setPeriod] = useState<Period>("all");
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getLeaderboard(period).then((data) => {
      setEntries(data);
      setLoading(false);
    });
  }, [period]);

  if (!user) return null;

  const userRank = entries.findIndex(e => e.userId === user.id) + 1;

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <h1 className={styles.pageTitle}>Bảng xếp hạng</h1>

        <div className={styles.periodTabs}>
          {(["week", "month", "all"] as Period[]).map(p => (
            <button
              key={p}
              className={`${styles.periodBtn} ${period === p ? styles.periodBtnActive : ""}`}
              onClick={() => setPeriod(p)}
            >
              {p === "week" && "Tuần này"}
              {p === "month" && "Tháng này"}
              {p === "all" && "Tất cả"}
            </button>
          ))}
        </div>

        {loading ? (
          <div className={styles.empty}>
            Đang tải dữ liệu...
          </div>
        ) : entries.length === 0 ? (
          <div className={styles.empty}>
            Chưa có ai trên bảng xếp hạng. Hãy là người đầu tiên!
          </div>
        ) : (
          <>
            {/* Top 3 podium */}
            {entries.length >= 1 && (
              <div className={styles.podium}>
                {entries.length >= 2 && (
                  <div className={`${styles.podiumItem} ${styles.podiumSecond}`}>
                    <div className={styles.podiumAvatar}>{entries[1].userName.charAt(0).toUpperCase()}</div>
                    <div className={styles.podiumRank}>2</div>
                    <div className={styles.podiumName}>{entries[1].userName}</div>
                    <div className={styles.podiumXP}>{entries[1].totalXP} XP</div>
                    <div className={styles.podiumStats}>
                      {entries[1].totalQuizzes} bài | {entries[1].avgScore}% TB
                    </div>
                  </div>
                )}
                <div className={`${styles.podiumItem} ${styles.podiumFirst}`}>
                  <div className={styles.podiumCrown}>C</div>
                  <div className={styles.podiumAvatar}>{entries[0].userName.charAt(0).toUpperCase()}</div>
                  <div className={styles.podiumRank}>1</div>
                  <div className={styles.podiumName}>{entries[0].userName}</div>
                  <div className={styles.podiumXP}>{entries[0].totalXP} XP</div>
                  <div className={styles.podiumStats}>
                    {entries[0].totalQuizzes} bài | {entries[0].avgScore}% TB
                  </div>
                </div>
                {entries.length >= 3 && (
                  <div className={`${styles.podiumItem} ${styles.podiumThird}`}>
                    <div className={styles.podiumAvatar}>{entries[2].userName.charAt(0).toUpperCase()}</div>
                    <div className={styles.podiumRank}>3</div>
                    <div className={styles.podiumName}>{entries[2].userName}</div>
                    <div className={styles.podiumXP}>{entries[2].totalXP} XP</div>
                    <div className={styles.podiumStats}>
                      {entries[2].totalQuizzes} bài | {entries[2].avgScore}% TB
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Full list */}
            <div className={styles.rankList}>
              <div className={styles.rankHeader}>
                <span className={styles.rankHeaderCol}>Hạng</span>
                <span className={styles.rankHeaderCol}>Người chơi</span>
                <span className={styles.rankHeaderCol}>XP</span>
                <span className={styles.rankHeaderCol}>Bài quiz</span>
                <span className={styles.rankHeaderCol}>TB</span>
                <span className={styles.rankHeaderCol}>Cao nhất</span>
                <span className={styles.rankHeaderCol}>Streak</span>
              </div>
              {entries.map((entry, i) => {
                const isCurrentUser = entry.userId === user.id;
                return (
                  <div
                    key={entry.userId}
                    className={`${styles.rankRow} ${isCurrentUser ? styles.rankRowMe : ""} ${i < 3 ? styles.rankRowTop : ""}`}
                  >
                    <span className={styles.rankNum}>
                      {i < 3 ? (
                        <span className={`${styles.rankMedal} ${i === 0 ? styles.gold : i === 1 ? styles.silver : styles.bronze}`}>
                          {i + 1}
                        </span>
                      ) : (
                        i + 1
                      )}
                    </span>
                    <span className={styles.rankUser}>
                      <span className={styles.rankAvatar}>
                        {entry.userName.charAt(0).toUpperCase()}
                      </span>
                      <span className={styles.rankName}>
                        {entry.userName}
                        {isCurrentUser && <span className={styles.youTag}>(Bạn)</span>}
                      </span>
                    </span>
                    <span className={styles.rankXP}>{entry.totalXP}</span>
                    <span className={styles.rankQuizzes}>{entry.totalQuizzes}</span>
                    <span className={styles.rankAvg}>{entry.avgScore}%</span>
                    <span className={styles.rankBest}>{entry.bestScore}%</span>
                    <span className={styles.rankStreak}>
                      {entry.streak > 0 && <span className={styles.streakFire}>F</span>}
                      {entry.streak}
                    </span>
                  </div>
                );
              })}
            </div>

            {userRank > 0 && (
              <div className={styles.myRankBanner}>
                Bạn đang ở vị trí thứ <strong>{userRank}</strong> trên bảng xếp hạng!
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function LeaderboardPage() {
  return (
    <AuthGuard>
      <LeaderboardContent />
    </AuthGuard>
  );
}
