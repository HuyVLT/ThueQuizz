"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { useAuth } from "./AuthContext";
import styles from "./Header.module.css";

export default function Header() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [darkMode, setDarkMode] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const theme = localStorage.getItem("quiz_theme");
    if (theme === "dark") {
      setDarkMode(true);
    }
  }, []);

  const toggleDarkMode = () => {
    const next = !darkMode;
    setDarkMode(next);
    if (next) {
      document.documentElement.setAttribute("data-theme", "dark");
      localStorage.setItem("quiz_theme", "dark");
    } else {
      document.documentElement.removeAttribute("data-theme");
      localStorage.setItem("quiz_theme", "light");
    }
  };

  const navItems = [
    { href: "/quiz", label: "📚 Ôn tập" },
    { href: "/leaderboard", label: "🏆 Xếp hạng" },
    { href: "/history", label: "📜 Lịch sử" },
    { href: "/admin", label: "⚙️ Quản lý" },
  ];

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link href="/quiz" className={styles.logo}>
          <span className={styles.logoIcon}>T</span>
          <span className={styles.logoText}>TracNghiemThue</span>
        </Link>

        <nav className={`${styles.nav} ${menuOpen ? styles.navOpen : ""}`}>
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`${styles.navLink} ${pathname === item.href ? styles.navLinkActive : ""}`}
              onClick={() => setMenuOpen(false)}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className={styles.actions}>
          <button
            className={styles.themeBtn}
            onClick={toggleDarkMode}
            title={darkMode ? "Chế độ sáng" : "Chế độ tối"}
          >
            <span className={styles.themeEmoji}>{darkMode ? "☀️" : "🌙"}</span>
          </button>

          {user && (
            <div className={styles.userMenu}>
              <span className={styles.userAvatar}>
                {user.name.charAt(0).toUpperCase()}
              </span>
              <div className={styles.userDropdown}>
                <div className={styles.dropdownName}>{user.name}</div>
                <div className={styles.dropdownEmail}>{user.email}</div>
                <hr className={styles.dropdownDivider} />
                <Link href="/history" className={styles.dropdownLink}>
                  Lịch sử làm bài
                </Link>
                <Link href="/leaderboard" className={styles.dropdownLink}>
                  Bảng xếp hạng
                </Link>
                <hr className={styles.dropdownDivider} />
                <button className={styles.dropdownLogout} onClick={logout}>
                  Đăng xuất
                </button>
              </div>
            </div>
          )}

          <button
            className={styles.hamburger}
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <span></span>
            <span></span>
            <span></span>
          </button>
        </div>
      </div>
    </header>
  );
}
