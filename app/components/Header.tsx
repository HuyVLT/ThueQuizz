"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./Header.module.css";

export default function Header() {
  const pathname = usePathname();

  const navItems = [
    { href: "/quiz", label: "Ôn tập" },
    { href: "/admin", label: "Quản lý" },
  ];

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link href="/quiz" className={styles.logo}>
          <span className={styles.logoIcon}>T</span>
          <span className={styles.logoText}>TrắcNghiệmThuế</span>
        </Link>

        <nav className={styles.nav}>
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`${styles.navLink} ${pathname === item.href ? styles.navLinkActive : ""}`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
