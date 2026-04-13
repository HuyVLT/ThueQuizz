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
          <p className={styles.loadingText}>Dang tai...</p>
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
      setError("Vui long nhap email");
      return;
    }

    if (mode === "register") {
      if (!name.trim()) {
        setError("Vui long nhap ten");
        return;
      }
      setSubmitting(true);
      const result = await register(name.trim(), email.trim());
      setSubmitting(false);
      if (!result.success) {
        setError(result.error || "Dang ky that bai");
      }
    } else {
      setSubmitting(true);
      const result = await login(email.trim());
      setSubmitting(false);
      if (!result.success) {
        setError(result.error || "Dang nhap that bai");
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
          {mode === "login" ? "Dang nhap" : "Tao tai khoan"}
        </h1>
        <p className={styles.subtitle}>
          {mode === "login"
            ? "Nhap email de tiep tuc on tap"
            : "Dang ky de bat dau hanh trinh hoc tap"}
        </p>

        <form onSubmit={handleSubmit} className={styles.form}>
          {error && <div className={styles.error}>{error}</div>}

          {mode === "register" && (
            <div className={styles.field}>
              <label>Ten hien thi</label>
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
              ? "Dang xu ly..."
              : mode === "login"
              ? "Dang nhap"
              : "Dang ky"}
          </button>
        </form>

        <div className={styles.switchMode}>
          {mode === "login" ? (
            <>
              Chua co tai khoan?{" "}
              <button onClick={() => { setMode("register"); setError(null); }} disabled={submitting}>
                Dang ky ngay
              </button>
            </>
          ) : (
            <>
              Da co tai khoan?{" "}
              <button onClick={() => { setMode("login"); setError(null); }} disabled={submitting}>
                Dang nhap
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
