"use client";

import { useState } from "react";
import { useAuth } from "./AuthContext";
import styles from "./AuthGuard.module.css";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading, login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.spinner}></div>
          <p className={styles.loadingText}>Đang tải...</p>
        </div>
      </div>
    );
  }

  if (user) {
    return <>{children}</>;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError("Vui lòng nhập email");
      return;
    }

    if (mode === "register") {
      if (!name.trim()) {
        setError("Vui lòng nhập tên");
        return;
      }
      setSubmitting(true);
      const result = await register(name.trim(), email.trim());
      setSubmitting(false);
      if (!result.success) {
        setError(result.error || "Đăng ký thất bại");
      }
    } else {
      setSubmitting(true);
      const result = await login(email.trim());
      setSubmitting(false);
      if (!result.success) {
        setError(result.error || "Đăng nhập thất bại");
      }
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.iconWrap}>
          <span className={styles.icon}>T</span>
        </div>
        <h1 className={styles.title}>
          {mode === "login" ? "Đăng nhập" : "Tạo tài khoản"}
        </h1>
        <p className={styles.subtitle}>
          {mode === "login"
            ? "Nhập email để tiếp tục ôn tập"
            : "Đăng ký để bắt đầu hành trình học tập"}
        </p>

        <form onSubmit={handleSubmit} className={styles.form}>
          {error && <div className={styles.error}>{error}</div>}

          {mode === "register" && (
            <div className={styles.field}>
              <label>Tên hiển thị</label>
              <input
                type="text"
                placeholder="VD: Nguyen Van A"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus={mode === "register"}
                disabled={submitting}
              />
            </div>
          )}

          <div className={styles.field}>
            <label>Email</label>
            <input
              type="email"
              placeholder="email@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus={mode === "login"}
              disabled={submitting}
            />
          </div>

          <button type="submit" className={styles.submitBtn} disabled={submitting}>
            {submitting
              ? "Đang xử lý..."
              : mode === "login"
              ? "Đăng nhập"
              : "Đăng ký"}
          </button>
        </form>

        <div className={styles.switchMode}>
          {mode === "login" ? (
            <>
              Chưa có tài khoản?{" "}
              <button onClick={() => { setMode("register"); setError(null); }} disabled={submitting}>
                Đăng ký ngay
              </button>
            </>
          ) : (
            <>
              Đã có tài khoản?{" "}
              <button onClick={() => { setMode("login"); setError(null); }} disabled={submitting}>
                Đăng nhập
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
