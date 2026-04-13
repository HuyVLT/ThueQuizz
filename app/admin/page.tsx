"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  getQuestions,
  addQuestion,
  deleteQuestion,
  updateQuestion,
  importFromJSON,
  importQuestions,
  exportToJSON,
  resetQuestions,
  type Question,
} from "@/lib/questionStore";
import { useAuth } from "../components/AuthContext";
import { extractTextFromDocx, parseWordText, type ParsedQuestion } from "@/lib/wordParser";
import styles from "./admin.module.css";

type Tab = "list" | "add" | "import" | "word";

const EMPTY_FORM = {
  question: "",
  options: ["", "", "", ""],
  correctIndex: 0,
  explanation: "",
  category: "",
};

// Mock authentication
const ADMIN_EMAIL = "lemyhoa1978@gmail.com";
const ADMIN_PASSWORD = "kingcute123";
const AUTH_KEY = "quiz_admin_auth";

function getAuthState(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const stored = sessionStorage.getItem(AUTH_KEY);
    return stored === "authenticated";
  } catch {
    return false;
  }
}

function setAuthState(authenticated: boolean) {
  if (typeof window === "undefined") return;
  try {
    if (authenticated) {
      sessionStorage.setItem(AUTH_KEY, "authenticated");
    } else {
      sessionStorage.removeItem(AUTH_KEY);
    }
  } catch {
    // ignore
  }
}

function LoginForm({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password.trim()) {
      setError("Vui lòng nhập đầy đủ email và mật khẩu");
      return;
    }

    if (email.trim().toLowerCase() === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
      setAuthState(true);
      onLogin();
    } else {
      setError("Email hoặc mật khẩu không đúng");
    }
  };

  return (
    <div className={styles.loginContainer}>
      <div className={styles.loginCard}>
        <div className={styles.loginIcon}>
          <span>Q</span>
        </div>
        <h1 className={styles.loginTitle}>Đăng nhập quản lý</h1>
        <p className={styles.loginSubtitle}>
          Nhập thông tin tài khoản để truy cập trang quản lý câu hỏi
        </p>

        <form onSubmit={handleSubmit} className={styles.loginForm}>
          {error && (
            <div className={styles.loginError}>
              {error}
            </div>
          )}

          <div className={styles.loginField}>
            <label>Email</label>
            <input
              type="email"
              placeholder="Nhập email..."
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              autoFocus
            />
          </div>

          <div className={styles.loginField}>
            <label>Mật khẩu</label>
            <div className={styles.passwordWrap}>
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Nhập mật khẩu..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
              <button
                type="button"
                className={styles.passwordToggle}
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? "Ẩn" : "Hiện"}
              </button>
            </div>
          </div>

          <button type="submit" className={styles.loginBtn}>
            Đăng nhập
          </button>
        </form>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const { user, isLoading } = useAuth();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  const [tab, setTab] = useState<Tab>("list");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [jsonText, setJsonText] = useState("");
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const wordFileRef = useRef<HTMLInputElement>(null);

  // Word import state
  const [wordParsed, setWordParsed] = useState<ParsedQuestion[] | null>(null);
  const [wordWarnings, setWordWarnings] = useState<string[]>([]);
  const [wordError, setWordError] = useState<string | null>(null);
  const [wordFileName, setWordFileName] = useState<string | null>(null);
  const [wordCategory, setWordCategory] = useState<string>("");
  const [wordLoading, setWordLoading] = useState(false);
  const [wordDragOver, setWordDragOver] = useState(false);

  // Check auth on mount or when user context changes
  useEffect(() => {
    if (isLoading) return; // Wait until global auth loads
    if (user && user.email === ADMIN_EMAIL) {
      setIsAuthenticated(true);
      setAuthChecked(true);
    } else {
      setIsAuthenticated(getAuthState());
      setAuthChecked(true);
    }
  }, [user, isLoading]);

  const reload = useCallback(async () => {
    const qs = await getQuestions();
    setQuestions(qs);
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      reload();
    }
  }, [reload, isAuthenticated]);

  const flash = (type: "ok" | "err", text: string) => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 3000);
  };

  const handleLogout = () => {
    setAuthState(false);
    setIsAuthenticated(false);
  };

  // Show nothing while checking auth
  if (!authChecked) {
    return (
      <div className={styles.loginContainer}>
        <div className={styles.loginCard}>
          <p style={{ textAlign: "center", color: "#888" }}>Đang kiểm tra...</p>
        </div>
      </div>
    );
  }

  // Show login if not authenticated
  if (!isAuthenticated) {
    return <LoginForm onLogin={() => setIsAuthenticated(true)} />;
  }

  const handleFormOpt = (i: number, val: string) => {
    setForm((f) => {
      const opts = [...f.options];
      opts[i] = val;
      return { ...f, options: opts };
    });
  };

  const handleAddOpt = () => {
    if (form.options.length >= 6) return;
    setForm((f) => ({ ...f, options: [...f.options, ""] }));
  };

  const handleRemoveOpt = (i: number) => {
    if (form.options.length <= 2) return;
    setForm((f) => {
      const opts = f.options.filter((_, idx) => idx !== i);
      return {
        ...f,
        options: opts,
        correctIndex: f.correctIndex >= opts.length ? 0 : f.correctIndex,
      };
    });
  };

  const handleSubmit = async () => {
    if (!form.question.trim()) return flash("err", "Vui lòng nhập câu hỏi");
    if (form.options.some((o) => !o.trim())) return flash("err", "Vui lòng điền đầy đủ các lựa chọn");
    if (editId) {
      await updateQuestion(editId, form);
      flash("ok", "Đã cập nhật câu hỏi!");
    } else {
      await addQuestion(form);
      flash("ok", "Đã thêm câu hỏi mới!");
    }
    setForm(EMPTY_FORM);
    setEditId(null);
    setTab("list");
    await reload();
  };

  const startEdit = (q: Question) => {
    setForm({
      question: q.question,
      options: [...q.options],
      correctIndex: q.correctIndex,
      explanation: q.explanation || "",
      category: q.category || "",
    });
    setEditId(q.id);
    setTab("add");
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Xóa câu hỏi này?")) return;
    await deleteQuestion(id);
    await reload();
  };

  const handleImport = async () => {
    const result = await importFromJSON(jsonText);
    if (result.success) {
      flash("ok", `Đã import ${result.count} câu hỏi!`);
      setJsonText("");
      await reload();
    } else {
      flash("err", `Lỗi: ${result.error}`);
    }
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setJsonText(String(ev.target?.result || ""));
    reader.readAsText(file);
  };

  const processWordFile = async (file: File) => {
    if (!file.name.match(/\.docx?$/i)) {
      setWordError("Chỉ hỗ trợ file .docx");
      return;
    }
    setWordLoading(true);
    setWordParsed(null);
    setWordError(null);
    setWordWarnings([]);
    setWordFileName(file.name);
    // Auto-set category from filename (strip extension)
    const autoCategory = file.name.replace(/\.[^.]+$/, "").trim();
    setWordCategory(autoCategory);
    try {
      const buffer = await file.arrayBuffer();
      const text = await extractTextFromDocx(buffer);
      console.log("=== THUE QUIZZ: EXTRACTED TEXT (FIRST 500 CHARS) ===", text.substring(0, 500));
      
      const result = parseWordText(text);
      console.log("=== THUE QUIZZ: PARSER RESULT ===", result);
      
      if (result.success) {
        setWordParsed(result.questions);
        setWordWarnings(result.warnings || []);
      } else {
        setWordError(result.error || "Không thể phân tích file");
        setWordWarnings(result.warnings || []);
      }
    } catch (err) {
      setWordError("Lỗi khi đọc file: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setWordLoading(false);
    }
  };

  const handleWordFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processWordFile(file);
  };

  const handleWordDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setWordDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processWordFile(file);
  };

  const handleWordImport = async () => {
    if (!wordParsed || wordParsed.length === 0) return;
    // Assign category to all parsed questions
    const questionsWithCategory = wordCategory.trim()
      ? wordParsed.map(q => ({ ...q, category: wordCategory.trim() }))
      : wordParsed;
    const result = await importQuestions(questionsWithCategory, "append");
    flash("ok", `Đã thêm ${result.count} câu hỏi từ file Word! Tổng: ${result.total} câu`);
    setWordParsed(null);
    setWordFileName(null);
    setWordCategory("");
    setWordError(null);
    setWordWarnings([]);
    await reload();
    setTab("list");
  };

  const handleExport = async () => {
    await exportToJSON();
  };

  const handleReset = async () => {
    if (!confirm("Xóa toàn bộ câu hỏi?")) return;
    await resetQuestions();
    await reload();
    flash("ok", "Đã xóa toàn bộ câu hỏi!");
  };

  const categories = ["all", ...Array.from(new Set(questions.map(q => q.category).filter(Boolean))) as string[]];
  const displayedQuestions = filterCategory === "all" ? questions : questions.filter(q => q.category === filterCategory);

  return (
    <div className={styles.container}>
      <div className={styles.sidebar}>
        <div className={styles.sidebarLogo}>
          <span>Q</span>
          <span>Quản lý Quiz</span>
        </div>
        {(["list", "add", "import", "word"] as Tab[]).map((t) => (
          <button
            key={t}
            className={`${styles.navBtn} ${tab === t ? styles.navActive : ""}`}
            onClick={() => { setTab(t); setEditId(null); setForm(EMPTY_FORM); }}
          >
            {t === "list" && "Danh sách câu hỏi"}
            {t === "add" && "Thêm câu hỏi"}
            {t === "import" && "Import / Export JSON"}
            {t === "word" && "Import từ Word"}
          </button>
        ))}

        <div className={styles.sidebarFooter}>
          <div className={styles.userInfo}>
            <span className={styles.userEmail}>{ADMIN_EMAIL}</span>
          </div>
          <button className={styles.logoutBtn} onClick={handleLogout}>
            Đăng xuất
          </button>
        </div>
      </div>

      <div className={styles.main}>
        {msg && (
          <div className={`${styles.toast} ${msg.type === "ok" ? styles.toastOk : styles.toastErr}`}>
            {msg.text}
          </div>
        )}

        {/* LIST TAB */}
        {tab === "list" && (
          <div>
            <div className={styles.pageHeader}>
              <h1>Danh sách câu hỏi <span className={styles.countPill}>{displayedQuestions.length}</span></h1>
              <div className={styles.headerActions}>
                {categories.length > 1 && (
                  <select 
                    className={styles.smBtn} 
                    value={filterCategory} 
                    onChange={e => setFilterCategory(e.target.value)}
                    style={{ minWidth: "150px" }}
                  >
                    {categories.map(c => (
                      <option key={c} value={c}>{c === "all" ? "Tất cả danh mục" : c}</option>
                    ))}
                  </select>
                )}
                <button className={styles.smBtn} onClick={handleExport}>Xuất JSON</button>
                <button className={`${styles.smBtn} ${styles.smBtnDanger}`} onClick={handleReset}>Xóa tất cả</button>
              </div>
            </div>
            {displayedQuestions.length === 0 && (
              <div className={styles.empty}>Chưa có câu hỏi nào. Hãy thêm hoặc import!</div>
            )}
            <div className={styles.qList}>
              {displayedQuestions.map((q, i) => (
                <div key={q.id} className={styles.qCard}>
                  <div className={styles.qCardTop}>
                    <span className={styles.qIdx}>{i + 1}</span>
                    {q.category && <span className={styles.qCat}>{q.category}</span>}
                    <div className={styles.qActions}>
                      <button className={styles.editBtn} onClick={() => startEdit(q)}>Sửa</button>
                      <button className={styles.delBtn} onClick={() => handleDelete(q.id)}>Xóa</button>
                    </div>
                  </div>
                  <p className={styles.qText}>{q.question}</p>
                  <div className={styles.qOpts}>
                    {q.options.map((o, oi) => (
                      <span key={oi} className={`${styles.qOpt} ${oi === q.correctIndex ? styles.qOptCorrect : ""}`}>
                        {String.fromCharCode(65 + oi)}. {o}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ADD/EDIT TAB */}
        {tab === "add" && (
          <div className={styles.formWrap}>
            <h1 className={styles.formTitle}>{editId ? "Chỉnh sửa câu hỏi" : "Thêm câu hỏi mới"}</h1>

            <div className={styles.field}>
              <label>Câu hỏi *</label>
              <textarea
                rows={3}
                placeholder="Nhập nội dung câu hỏi..."
                value={form.question}
                onChange={(e) => setForm((f) => ({ ...f, question: e.target.value }))}
              />
            </div>

            <div className={styles.field}>
              <label>Chủ đề / Danh mục</label>
              <input
                type="text"
                placeholder="VD: Thuế GTGT, Thuế TNCN..."
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              />
            </div>

            <div className={styles.field}>
              <label>Các lựa chọn *</label>
              {form.options.map((opt, i) => (
                <div key={i} className={styles.optRow}>
                  <button
                    className={`${styles.correctToggle} ${form.correctIndex === i ? styles.correctActive : ""}`}
                    onClick={() => setForm((f) => ({ ...f, correctIndex: i }))}
                    title="Đáp án đúng"
                  >
                    {String.fromCharCode(65 + i)}
                  </button>
                  <input
                    type="text"
                    placeholder={`Lựa chọn ${String.fromCharCode(65 + i)}`}
                    value={opt}
                    onChange={(e) => handleFormOpt(i, e.target.value)}
                    className={styles.optInput}
                  />
                  <button className={styles.removeOpt} onClick={() => handleRemoveOpt(i)}>x</button>
                </div>
              ))}
              {form.options.length < 6 && (
                <button className={styles.addOptBtn} onClick={handleAddOpt}>+ Thêm lựa chọn</button>
              )}
              <p className={styles.hint}>Nhấn vào chữ cái để chọn đáp án đúng</p>
            </div>

            <div className={styles.field}>
              <label>Giải thích (tùy chọn)</label>
              <textarea
                rows={2}
                placeholder="Giải thích tại sao đáp án đúng..."
                value={form.explanation}
                onChange={(e) => setForm((f) => ({ ...f, explanation: e.target.value }))}
              />
            </div>

            <div className={styles.formActions}>
              <button className={styles.submitBtn} onClick={handleSubmit}>
                {editId ? "Lưu thay đổi" : "Thêm câu hỏi"}
              </button>
              <button className={styles.cancelBtn} onClick={() => { setForm(EMPTY_FORM); setEditId(null); setTab("list"); }}>
                Hủy
              </button>
            </div>
          </div>
        )}

        {/* IMPORT TAB */}
        {tab === "import" && (
          <div className={styles.importWrap}>
            <h1>Import / Export câu hỏi</h1>

            <div className={styles.importSection}>
              <h2>Import từ file JSON</h2>
              <p className={styles.importDesc}>
                File JSON phải có dạng mảng các object với các trường: <code>question</code>, <code>options</code> (mảng), <code>correctIndex</code>, <code>explanation</code> (tùy chọn), <code>category</code> (tùy chọn).
              </p>
              <input
                type="file"
                accept=".json"
                ref={fileRef}
                onChange={handleFileImport}
                style={{ display: "none" }}
              />
              <button className={styles.smBtn} onClick={() => fileRef.current?.click()}>
                Chọn file JSON
              </button>
              <textarea
                className={styles.jsonArea}
                rows={10}
                placeholder={`[\n  {\n    "question": "...",\n    "options": ["A", "B", "C", "D"],\n    "correctIndex": 0,\n    "explanation": "...",\n    "category": "Thuế GTGT"\n  }\n]`}
                value={jsonText}
                onChange={(e) => setJsonText(e.target.value)}
              />
              <button className={styles.submitBtn} onClick={handleImport} disabled={!jsonText.trim()}>
                Import câu hỏi
              </button>
            </div>

            <div className={styles.importSection}>
              <h2>Export câu hỏi hiện tại</h2>
              <p className={styles.importDesc}>Tải xuống toàn bộ câu hỏi dưới dạng file JSON để backup hoặc chia sẻ.</p>
              <button className={styles.smBtn} onClick={handleExport}>
                Tải xuống JSON ({questions.length} câu)
              </button>
            </div>
          </div>
        )}

        {/* WORD IMPORT TAB */}
        {tab === "word" && (
          <div className={styles.importWrap}>
            <h1>Import câu hỏi từ file Word</h1>

            <div className={styles.importSection}>
              <h2>Upload file .docx</h2>
              <p className={styles.importDesc}>
                File Word cần có định dạng câu hỏi như sau:
              </p>
              <div className={styles.formatBox}>{`Câu 1: Thuế GTGT là gì?
A. Thuế giá trị gia tăng
B. Thuế thu nhập
C. Thuế xuất khẩu
D. Thuế nhập khẩu
Đáp án: A
Giải thích: GTGT là viết tắt của...`}</div>

              <input
                type="file"
                accept=".docx,.doc"
                ref={wordFileRef}
                onChange={handleWordFileChange}
                style={{ display: "none" }}
              />

              <div
                className={`${styles.dropZone} ${wordDragOver ? styles.dropZoneActive : ""}`}
                onClick={() => wordFileRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setWordDragOver(true); }}
                onDragLeave={() => setWordDragOver(false)}
                onDrop={handleWordDrop}
                style={{ marginTop: "1rem" }}
              >
                <span className={styles.dropIcon}>W</span>
                <div className={styles.dropTitle}>
                  {wordLoading ? "Đang xử lý..." : wordFileName ? wordFileName : "Kéo thả hoặc nhấn để chọn file .docx"}
                </div>
                <div className={styles.dropSub}>
                  {wordLoading ? "Vui lòng chờ" : "Hỗ trợ định dạng .docx"}
                </div>
              </div>

              {wordError && (
                <div className={`${styles.parseStatus} ${styles.parseStatusErr}`}>
                  X {wordError}
                </div>
              )}

              {wordWarnings.length > 0 && (
                <div className={styles.warningBox}>
                  <div className={styles.warningTitle}>Cảnh báo ({wordWarnings.length}):</div>
                  {wordWarnings.map((w, i) => <div key={i}>- {w}</div>)}
                </div>
              )}

              {wordParsed && wordParsed.length > 0 && (
                <>
                  <div className={`${styles.parseStatus} ${styles.parseStatusOk}`}>
                    Tìm thấy {wordParsed.length} câu hỏi. Kiểm tra trước khi import:
                  </div>

                  <div className={styles.wordPreviewBox}>
                    <div className={styles.wordPreviewHeader}>
                      <span className={styles.wordPreviewTitle}>Xem trước câu hỏi</span>
                      <span className={styles.wordPreviewCount}>{wordParsed.length} câu</span>
                    </div>
                    <div className={styles.wordPreviewList}>
                      {wordParsed.map((q, i) => (
                        <div key={i} className={styles.wordPreviewItem}>
                          <span className={styles.wordPreviewNum}>{i + 1}</span>
                          <div>
                            <div className={styles.wordPreviewQ}>{q.question}</div>
                            {q.options && q.options.length > 0 && (
                               <div className={styles.qOpts} style={{ marginBottom: "8px", marginTop: "8px" }}>
                                 {q.options.map((o, oi) => (
                                   <span key={oi} className={`${styles.qOpt} ${oi === q.correctIndex ? styles.qOptCorrect : ""}`}>
                                     {String.fromCharCode(65 + oi)}. {o}
                                   </span>
                                 ))}
                               </div>
                            )}
                            <div className={styles.wordPreviewAnswer}>
                              Đáp án: {q.correctIndex >= 0 ? `${String.fromCharCode(65 + q.correctIndex)}. ${q.options[q.correctIndex]}` : "Chưa xác định"}
                            </div>
                            {q.explanation && (
                              <div className={styles.wordPreviewExplanation} style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "4px" }}>
                                <span style={{ fontWeight: 600 }}>Giải thích:</span> {q.explanation}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{ margin: "1rem 0", display: "flex", flexDirection: "column", gap: "6px" }}>
                    <label style={{ fontWeight: 600, fontSize: "0.9rem", color: "#333" }}>
                      Danh mục / Category
                    </label>
                    <input
                      type="text"
                      value={wordCategory}
                      onChange={(e) => setWordCategory(e.target.value)}
                      placeholder="Tên danh mục (tự động lấy tên file)"
                      style={{
                        border: "1.5px solid #d0c9b8",
                        borderRadius: 8,
                        padding: "8px 12px",
                        fontSize: "0.9rem",
                        outline: "none",
                        fontFamily: "inherit",
                      }}
                    />
                    <span style={{ fontSize: "0.78rem", color: "#888" }}>
                      Tất cả câu hỏi trong file này sẽ được xếp vào danh mục này
                    </span>
                  </div>

                  <div style={{ display: "flex", gap: "10px" }}>
                    <button
                      className={`${styles.smBtn} ${styles.smBtnPrimary}`}
                      onClick={handleWordImport}
                    >
                      Import {wordParsed.length} câu hỏi
                    </button>
                    <button
                      className={styles.smBtn}
                      onClick={() => { setWordParsed(null); setWordFileName(null); setWordCategory(""); setWordError(null); setWordWarnings([]); }}
                    >
                      Hủy
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
