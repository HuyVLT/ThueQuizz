/**
 * Authentication store - localStorage based for quiz users
 * Admin uses separate mock auth in admin page
 */

export interface QuizUser {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

const AUTH_USER_KEY = "quiz_user";
const AUTH_USERS_KEY = "quiz_users_db";

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}

/** Get current logged-in user */
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

/** Get all registered users */
export function getAllUsers(): QuizUser[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(AUTH_USERS_KEY);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch {
    return [];
  }
}

/** Register a new user */
export function registerUser(name: string, email: string): { success: boolean; user?: QuizUser; error?: string } {
  const users = getAllUsers();
  const existing = users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (existing) {
    return { success: false, error: "Email đã được sử dụng" };
  }

  const newUser: QuizUser = {
    id: generateId(),
    name: name.trim(),
    email: email.trim().toLowerCase(),
    createdAt: new Date().toISOString(),
  };

  users.push(newUser);
  localStorage.setItem(AUTH_USERS_KEY, JSON.stringify(users));
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(newUser));
  return { success: true, user: newUser };
}

/** Login user */
export function loginUser(email: string): { success: boolean; user?: QuizUser; error?: string } {
  const users = getAllUsers();
  const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (!user) {
    return { success: false, error: "Không tìm thấy tài khoản với email này" };
  }
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
  return { success: true, user };
}

/** Logout */
export function logoutUser(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(AUTH_USER_KEY);
}

/** Update user profile */
export function updateUserProfile(userId: string, updates: { name?: string }): QuizUser | null {
  const users = getAllUsers();
  const idx = users.findIndex(u => u.id === userId);
  if (idx === -1) return null;

  if (updates.name) users[idx].name = updates.name.trim();
  localStorage.setItem(AUTH_USERS_KEY, JSON.stringify(users));

  const current = getCurrentUser();
  if (current && current.id === userId) {
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(users[idx]));
  }
  return users[idx];
}
