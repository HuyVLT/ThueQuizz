/**
 * Authentication store - MongoDB backed via API
 * localStorage used only for session caching (current user)
 */

export interface QuizUser {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

const AUTH_USER_KEY = "quiz_user";

/** Get current logged-in user from session cache */
export function getCurrentUser(): QuizUser | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(AUTH_USER_KEY);
    if (!stored) return null;
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

/** Set current user in session cache */
function setCurrentUser(user: QuizUser): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
}

/** Register a new user via API */
export async function registerUser(
  name: string,
  email: string
): Promise<{ success: boolean; user?: QuizUser; error?: string }> {
  try {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email }),
    });

    const data = await res.json();

    if (!data.success) {
      return { success: false, error: data.error || "Đăng ký thất bại" };
    }

    setCurrentUser(data.user);
    return { success: true, user: data.user };
  } catch (error: any) {
    return { success: false, error: error.message || "Lỗi kết nối" };
  }
}

/** Login user via API */
export async function loginUser(
  email: string
): Promise<{ success: boolean; user?: QuizUser; error?: string }> {
  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    const data = await res.json();

    if (!data.success) {
      return {
        success: false,
        error: data.error || "Đăng nhập thất bại",
      };
    }

    setCurrentUser(data.user);
    return { success: true, user: data.user };
  } catch (error: any) {
    return { success: false, error: error.message || "Lỗi kết nối" };
  }
}

/** Logout - clear session cache */
export function logoutUser(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(AUTH_USER_KEY);
}

/** Update user profile via API */
export async function updateUserProfile(
  userId: string,
  updates: { name?: string }
): Promise<QuizUser | null> {
  try {
    const res = await fetch("/api/auth/me", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, ...updates }),
    });

    const data = await res.json();

    if (!data.success) return null;

    // Update session cache
    const current = getCurrentUser();
    if (current && current.id === userId) {
      setCurrentUser(data.user);
    }

    return data.user;
  } catch {
    return null;
  }
}

/** Verify session - check if cached user still exists in DB */
export async function verifySession(): Promise<QuizUser | null> {
  const cached = getCurrentUser();
  if (!cached) return null;

  try {
    const res = await fetch(`/api/auth/me?id=${cached.id}`);
    const data = await res.json();

    if (!data.success) {
      // User no longer exists - clear session
      logoutUser();
      return null;
    }

    // Update cache with fresh data
    setCurrentUser(data.user);
    return data.user;
  } catch {
    // Network error - return cached data
    return cached;
  }
}
