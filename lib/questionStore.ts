export interface Question {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
  category?: string;
}

const API_BASE = "/api/questions";

// ─── READ ──────────────────────────────────────────────────────────────────

/** Lấy tất cả câu hỏi từ server (dùng trong Server Components hoặc client) */
export async function getQuestions(): Promise<Question[]> {
  const res = await fetch(API_BASE, { cache: "no-store" });
  if (!res.ok) return [];
  return res.json();
}

// ─── WRITE ─────────────────────────────────────────────────────────────────

/** Thêm 1 câu hỏi mới */
export async function addQuestion(q: Omit<Question, "id">): Promise<Question> {
  const res = await fetch(API_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(q),
  });
  return res.json();
}

/** Cập nhật câu hỏi */
export async function updateQuestion(id: string, q: Omit<Question, "id">): Promise<Question> {
  const res = await fetch(`${API_BASE}/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(q),
  });
  return res.json();
}

/** Xóa 1 câu hỏi */
export async function deleteQuestion(id: string): Promise<void> {
  await fetch(`${API_BASE}/${id}`, { method: "DELETE" });
}

/** Xóa toàn bộ câu hỏi (reset) */
export async function resetQuestions(): Promise<void> {
  await fetch(API_BASE, { method: "DELETE" });
}

// ─── IMPORT / EXPORT ───────────────────────────────────────────────────────

/** Import nhiều câu hỏi cùng lúc (thay thế toàn bộ hoặc nối thêm) */
export async function importQuestions(
  questions: Omit<Question, "id">[],
  mode: "replace" | "append" = "append"
): Promise<{ count: number; total: number }> {
  const url = mode === "append"
    ? `${API_BASE}/import?mode=append`
    : `${API_BASE}/import`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(questions),
  });
  return res.json();
}

/** Import từ chuỗi JSON (dùng cho tab Import JSON) */
export async function importFromJSON(
  jsonStr: string
): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const data = JSON.parse(jsonStr);
    const questions: Question[] = Array.isArray(data) ? data : data.questions;
    if (!Array.isArray(questions)) throw new Error("Định dạng không hợp lệ");
    const result = await importQuestions(questions, "replace");
    return { success: true, count: result.count };
  } catch (e: unknown) {
    return { success: false, count: 0, error: (e as Error).message };
  }
}

/** Tải xuống câu hỏi dưới dạng file JSON */
export async function exportToJSON(): Promise<void> {
  const questions = await getQuestions();
  const data = JSON.stringify(questions, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "tax_questions.json";
  a.click();
  URL.revokeObjectURL(url);
}
