export interface ParsedQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
  category?: string;
}

export interface ParseResult {
  success: boolean;
  questions: ParsedQuestion[];
  error?: string;
  warnings?: string[];
}

/**
 * Normalize Vietnamese text for comparison.
 * KEY FIX: "Đ" (U+0110, D-with-stroke) is NOT regular "D"!
 *   Lowercase of "Đ" = "đ" (U+0111), not "d".
 *   Must explicitly replace đ/Đ → d, otherwise "Đáp án:" → "đap an:" and regex fails!
 */
function normalizeVi(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove combining diacritics (removes â,ê,ô,ă,ư,ơ accents)
    .replace(/[đĐ]/g, "d")           // Vietnamese đ/Đ (D-with-stroke) → d
    .toLowerCase()
    .trim();
}

/**
 * Detect option line.
 * - Uppercase (A-E): lenient match, no space required after period (e.g. "A.text" or "A. text")
 * - Lowercase (a-e): strict match, space required after period to avoid matching
 *   legal sub-items like "a.Khoản 1 Điều 5" (no space = not an option)
 * Returns uppercase letter, or null if not an option line.
 */
function getOptionLetter(line: string): string | null {
  // Uppercase: distinctive enough, space optional (including optional *)
  let match = line.match(/^\s*\(?([A-H])[.)]\s*\*?\s*/);
  if (match) return match[1];
  // Vietnamese "Đ" (U+0110) as option letter (e.g. "Đ. text" or "đ. text")
  match = line.match(/^\s*\(?([đĐ])[.)]\s*\*?\s*/);
  if (match) return "D5"; // Special marker: 5th option (đ)
  // Lowercase: require space after period/paren to avoid false positives
  match = line.match(/^\s*\(?([a-h])[.)]\s*\*?\s+/);
  return match ? match[1].toUpperCase() : null;
}

function stripOptionPrefix(line: string): string {
  return line.replace(/^\s*\(?[A-Ha-hđĐ][.)]\s*\*?\s*/, "").trim();
}

/**
 * Detect answer line.
 * Handles: "Đáp án: A", "Đáp án đúng: B", "DA: C", "Answer: D", "Dap an dung: A"
 * NOTE: Must use normalizeVi which converts Đ→d, otherwise "Đáp" → "đap" not "dap"
 */
function getAnswerLetter(line: string): string | null {
  // Strip leading emoji and non-letter characters (e.g. "👉 Đáp án: B")
  const cleaned = line.replace(/^[^\p{L}\p{N}]+/u, "");
  const norm = normalizeVi(cleaned);
  // Match "Đáp án: B", "Đáp án đúng: A", "(Đáp án a)", "Đáp án B,", "DA: C",
  // "Đáp án: B (Căn cứ...)", "Đáp án: B - Sai", "Đáp án: C  (Căn cứ: ...)"
  // After the answer letter, allow: ) . : space , ( - or end of string
  const match = norm.match(/^(?:\(?\s*)?(?:dap\s*an(?:\s+dung)?|answer|da|correct)\s*[:.,]?\s*([a-h])(?:\s*[.):\s,(-]|$)/);
  return match ? match[1].toUpperCase() : null;
}


/**
 * Detect question start.
 * Handles: "Câu 1.", "CÂU 32:", "Câu 5)", "CÂU 1" (no trailing punct)
 * Does NOT match bare "1. text" (too ambiguous with legal sub-items like "1. Khoản 1...")
 * After normalizeVi: "Câu" -> "cau", "CÂU" -> "cau"
 */
function isQuestionStart(line: string): boolean {
  const norm = normalizeVi(line);
  // Match "cau 1:", "cau 1.", "cau 1)" OR standalone "cau 1" (end of string)
  // Also match "q1.", "q 2:"
  // NOT matching bare "1. text" to avoid false positives with legal citations
  return /^(?:cau\s*\d+\s*(?:[.:)]|$)|q\s*\d+\s*[.:)])/.test(norm);
}

function stripQuestionPrefix(line: string): string {
  // Remove "Câu 1.", "CÂU 32:", "CÂU 1" (no punct) etc. from start
  // [.:)]? makes the punctuation optional
  return line.replace(/^\s*(?:[Cc]\S*\s+)?\d+\s*[.:)]?\s*/, "").trim();
}

/**
 * Try to split a single line containing multiple options (table format from Word).
 * Handles: "A.\tOption A\tB.\tOption B\tC.\tOption C\tD.\tOption D"
 * or: "A. Option A  B. Option B  C. Option C  D. Option D"
 */
function tryExtractOptionsFromLine(line: string): string[] | null {
  const trimmed = line.trim();
  if (!/^[A-H][.)]\*?/.test(trimmed)) return null;

  // Split on tab followed by option letter
  const tabSplit = trimmed.split(/\t+(?=[A-H][.)]\*?\s*)/);
  if (tabSplit.length >= 2 && tabSplit.every(p => /^[A-H][.)]\*?\s*/.test(p.trim()))) {
    return tabSplit.map(p => p.trim());
  }

  // Split on 2+ spaces followed by option letter
  const spaceSplit = trimmed.split(/\s{2,}(?=[A-H][.)]\*?\s)/);
  if (spaceSplit.length >= 2 && spaceSplit.every(p => /^[A-H][.)]\*?\s*/.test(p.trim()))) {
    return spaceSplit.map(p => p.trim());
  }

  return null;
}

/**
 * If a line has embedded options (e.g. a table cell with everything on one line
 * "Question text A. option1 B. option2 C. option3 D. option4")
 * split it into [questionText, "A. option1", "B. option2", ...].
 * Only splits when at least 2 consecutive option letters are found.
 */
function splitEmbeddedOptions(line: string): string[] {
  // Find all positions where an option letter starts: whitespace + [A-Ha-h] + [.)] + optional asterisk + whitespace
  const pattern = /\s+([A-Ha-h])[.)]\*?\s+/g;
  const matches: { index: number; letter: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(line)) !== null) {
    matches.push({ index: m.index, letter: m[1].toUpperCase() });
  }

  // Need at least 2 matches (A and B) to be confident these are options
  if (matches.length < 2) return [line];

  // Check that letters form a sequence starting from A (or a)
  const expected = ["A", "B", "C", "D", "E", "F", "G", "H"];
  const foundLetters = matches.map(m => m.letter);
  if (foundLetters[0] !== expected[0] && foundLetters[0] !== "A") return [line];

  const parts: string[] = [];
  parts.push(line.substring(0, matches[0].index).trim());
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index + 1; // skip the leading whitespace
    const end = i + 1 < matches.length ? matches[i + 1].index : line.length;
    parts.push(line.substring(start, end).trim());
  }
  return parts.filter(p => p.length > 0);
}

export function parseWordText(text: string): ParseResult {
  const warnings: string[] = [];
  const questions: ParsedQuestion[] = [];

  // Pre-process: split lines, handle tab-separated table cells, detect multi-option lines
  const rawLines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  const lines: string[] = [];

  for (const line of rawLines) {
    // First expand tab-separated cells (table row with multiple cells)
    const tabParts = line.split(/\t+/);

    for (const part of tabParts) {
      const trimmed = part.trim();
      if (!trimmed) continue;

      const multiOpts = tryExtractOptionsFromLine(trimmed);
      if (multiOpts) {
        lines.push(...multiOpts);
      } else {
        // Check if this part embeds options inline: "Question text A. opt B. opt C. opt"
        // Pattern: option letter at word boundary preceded by whitespace
        const embedded = splitEmbeddedOptions(trimmed);
        if (embedded.length > 1) {
          lines.push(...embedded);
        } else {
          lines.push(trimmed);
        }
      }
    }
  }

  // DEBUG: log first 60 lines to help diagnose format issues (remove after debugging)
  if (process.env.NODE_ENV === "development") {
    console.log("[wordParser] First 60 processed lines:");
    lines.slice(0, 60).forEach((l, idx) => console.log(`  [${idx}] ${JSON.stringify(l)}`));
  }

  let i = 0;

  while (i < lines.length) {
    // Find next question start
    if (!isQuestionStart(lines[i])) {
      i++;
      continue;
    }

    // === 1. EXTRACT QUESTION TEXT ===
    let questionText = stripQuestionPrefix(lines[i]);
    i++;

    // Multi-line question (before first option)
    while (
      i < lines.length &&
      !getOptionLetter(lines[i]) &&
      !isQuestionStart(lines[i]) &&
      getAnswerLetter(lines[i]) === null
    ) {
      questionText += " " + lines[i];
      i++;
    }
    questionText = questionText.trim();

    // === 2. EXTRACT OPTIONS (uppercase A-E only) ===
    const options: string[] = [];
    const optionLetters: string[] = [];
    let correctIndex = -1; // -1 means no answer provided // ADDED FOR ASTERISK IN OPTIONS
    let hasAnswer = false;

    while (i < lines.length && getOptionLetter(lines[i]) !== null) {
      const letter = getOptionLetter(lines[i])!;
      const isCorrectAsterisk = /^\s*\(?[A-Ha-hđĐ][.)]\s*\*/.test(lines[i]);
      if (isCorrectAsterisk) {
         correctIndex = options.length;
         hasAnswer = true;
      }
      let optText = stripOptionPrefix(lines[i]);
      i++;

      // Multi-line option content
      while (
        i < lines.length &&
        getOptionLetter(lines[i]) === null &&
        getAnswerLetter(lines[i]) === null &&
        !isQuestionStart(lines[i])
      ) {
        optText += " " + lines[i];
        i++;
      }
      optionLetters.push(letter);
      options.push(optText.trim());
    }

    // Skip only if completely no options found (questions can have 2, 3, or 4 options)
    if (options.length < 1) {
      if (questionText.length > 10) {
        warnings.push(
          `Bỏ qua câu "${questionText.substring(0, 50)}..." vì không tìm thấy lựa chọn nào`
        );
      }
      // Skip to next question (skip explanation text)
      while (i < lines.length && !isQuestionStart(lines[i])) i++;
      continue;
    }

    // === 3. EXTRACT ANSWER ===
    // correctIndex and hasAnswer might already be set from options (asterisk)

    // Helper: find index of answer letter in optionLetters.
    // "D" can map to "D5" (Vietnamese đ as 5th option), "E" can also alias D5.
    function findAnswerIndex(letter: string): number {
      let idx = optionLetters.indexOf(letter);
      if (idx < 0 && letter === "D") idx = optionLetters.indexOf("D5");
      return idx;
    }

    let inlineExplanation = "";
    let matchedOptionFromText = -1;

    // First try the standard letter match
    if (i < lines.length) {
      let answerLine = lines[i];
      // If the answer keyword is isolated on its own line (e.g. from table split), merge with next line
      if (/^(?:dap\s*an(?:\s+dung)?|answer|da|correct)\s*[:.,-]?\s*$/i.test(normalizeVi(answerLine)) && i + 1 < lines.length) {
         answerLine = answerLine + " " + lines[i+1];
      }

      if (getAnswerLetter(answerLine) !== null) {
        const answerLetter = getAnswerLetter(answerLine)!;
        const idx = findAnswerIndex(answerLetter);
        correctIndex = idx >= 0 ? idx : -1;
        hasAnswer = true;
        // If we merged, consume the extra line
        if (answerLine !== lines[i]) i++;
        i++;

        // Try to extract inline explanation
        const prefixRegex = /^[^\p{L}\p{N}]*(?:\(?\s*)?(?:đáp\s*án(?:\s*đúng)?|dáp\s*án|đap\s*an|dap\s*an(?:\s*dung)?|answer|da|correct)\s*[:.,]?\s*[a-h]\)?\s*[-.):\s,]*/iu;
        const prefixMatch = answerLine.match(prefixRegex);
        if (prefixMatch) {
           inlineExplanation = answerLine.substring(prefixMatch[0].length).trim();
        } else {
           const letterRegex = new RegExp(`[:.,]\\s*${answerLetter}[.):\\s,-]+`, 'iu');
           const m2 = answerLine.match(letterRegex);
           if (m2) {
              inlineExplanation = answerLine.substring(m2.index! + m2[0].length).trim();
           }
        }
        // Clean up explanation: remove "- Đúng", "- Sai" prefix for T/F questions,
        // and remove "(Căn cứ:" / "Giải thích:" prefix and trailing parenthesis
        inlineExplanation = inlineExplanation
          .replace(/^\s*-?\s*(?:Đúng|Sai|đúng|sai)\s*/i, "")
          .replace(/^\s*\(\s*(?:căn\s*cứ|giải\s*thích)\s*[:.-]*\s*/i, "")
          .replace(/^\s*(?:căn\s*cứ)\s*[:.-]*\s*/i, "")
          .replace(/\)\s*$/, "")
          .trim();
      } else {
        // Fallback: Check if the line says "Đáp án: <Text>"
        const normPrefix = normalizeVi(answerLine);
        const prefixTextRegex = /^(?:[^\w]*)(?:dap\s*an(?:\s+dung)?|answer|da|correct)\s*[:.,]?\s*(.+)/i;
        const textMatch = normPrefix.match(prefixTextRegex);
        
        if (textMatch) {
           // We found "Đáp án: Something"
           let answerTextNorm = textMatch[1].trim();
           
           for (let optIdx = 0; optIdx < options.length; optIdx++) {
              const optNorm = normalizeVi(options[optIdx]);
              if (optNorm === answerTextNorm || optNorm.includes(answerTextNorm) || answerTextNorm.includes(optNorm)) {
                 correctIndex = optIdx;
                 hasAnswer = true;
                 matchedOptionFromText = optIdx;
                 break;
              }
           }
           
           if (hasAnswer) {
              if (answerLine !== lines[i]) i++;
              i++;
           }
        }
      }
    }

    if (!hasAnswer) {
      // Try to find answer in the next few lines (in case it's slightly separated)
      let found = false;
      for (let lookahead = 0; lookahead < 3 && i + lookahead < lines.length; lookahead++) {
        let candidate = lines[i + lookahead];
        let merged = false;
        
        // If the answer keyword is isolated, merge with next line
        if (/^(?:dap\s*an(?:\s+dung)?|answer|da|correct)\s*[:.,-]?\s*$/i.test(normalizeVi(candidate)) && i + lookahead + 1 < lines.length) {
           candidate = candidate + " " + lines[i + lookahead + 1];
           merged = true;
        }

        let letter = getAnswerLetter(candidate);
        if (letter !== null) {
          const idx = findAnswerIndex(letter);
          correctIndex = idx >= 0 ? idx : -1;
          hasAnswer = true;

          // Also try to extract inline explanation from this candidate line
          const prefixRegex = /^[^\p{L}\p{N}]*(?:\(?\s*)?(?:đáp\s*án(?:\s*đúng)?|dáp\s*án|đap\s*an|dap\s*an(?:\s*dung)?|answer|da|correct)\s*[:.,]?\s*[a-h]\)?\s*[-.):\s,]*/iu;
          const prefixMatch = candidate.match(prefixRegex);
          if (prefixMatch) {
             inlineExplanation = candidate.substring(prefixMatch[0].length).trim();
             inlineExplanation = inlineExplanation
               .replace(/^\s*-?\s*(?:Đúng|Sai|đúng|sai)\s*/i, "")
               .replace(/^\s*\(\s*(?:căn\s*cứ|giải\s*thích)\s*[:.-]*\s*/i, "")
               .replace(/^\s*(?:căn\s*cứ)\s*[:.-]*\s*/i, "")
               .replace(/\)\s*$/, "")
               .trim();
          }

          i += lookahead + (merged ? 2 : 1);
          found = true;
          break;
        } else {
          // Fallback: Check if the candidate line says "Đáp án: <Text>"
          const normPrefix = normalizeVi(candidate);
          const prefixTextRegex = /^(?:[^\w]*)(?:dap\s*an(?:\s+dung)?|answer|da|correct)\s*[:.,]?\s*(.+)/i;
          const textMatch = normPrefix.match(prefixTextRegex);
          
          if (textMatch) {
             let answerTextNorm = textMatch[1].trim();
             for (let optIdx = 0; optIdx < options.length; optIdx++) {
                const optNorm = normalizeVi(options[optIdx]);
                if (optNorm === answerTextNorm || optNorm.includes(answerTextNorm) || answerTextNorm.includes(optNorm)) {
                   correctIndex = optIdx;
                   hasAnswer = true;
                   matchedOptionFromText = optIdx;
                   break;
                }
             }
             
             if (hasAnswer) {
                i += lookahead + 1;
                found = true;
                break;
             }
          }
        }
        
        // Stop lookahead if we hit a new question
        if (isQuestionStart(candidate)) break;
      }
      if (!found) {
        warnings.push(
          `Câu "${questionText.substring(0, 50)}..." không có đáp án`
        );
      }
    }

    // === 4. EXTRACT EXPLANATION ===
    let explanation = inlineExplanation; // Start with any inline explanation we found
    const afterAnswerLines: string[] = [];
    while (i < lines.length && !isQuestionStart(lines[i])) {
      const normLine = normalizeVi(lines[i]);
      // Stop extracting if we hit a section header indicating a mass answer key (e.g. "Đáp án:", "Bảng đáp án", "Đáp án chi tiết")
      if (/^(?:bang\s*|phieu\s*)?dap\s*an(?:(?:\s|_)chi\s*tiet)?\s*[:.-]*$/.test(normLine)) {
         break;
      }

      if (getAnswerLetter(lines[i]) === null && !normLine.startsWith("dap an")) {
        afterAnswerLines.push(lines[i]);
      }
      i++;
    }

    if (afterAnswerLines.length > 0) {
      const appended = afterAnswerLines.join(" ").trim();
      const hasCanCu = normalizeVi(appended).includes("can cu");
      const hasGiaiThich = /^giai\s*thich/.test(normalizeVi(appended));
      const hasNgoac = /^\s*\(/.test(appended);
      
      if (hasCanCu || hasGiaiThich || hasNgoac || explanation || hasAnswer) {
        const cleanAppended = appended
          .replace(/^\s*-?\s*(?:Đúng|Sai|đúng|sai)\s*/i, "")
          .replace(/^(?:giai\s*thich|giải\s*thích)\s*[:.-]*\s*/i, "")
          .replace(/^\s*\(/, "")
          .replace(/\)\s*$/, "")
          .trim();
        explanation = explanation ? `${explanation} ${cleanAppended}`.trim() : cleanAppended;
      }
    }

    questions.push({
      question: questionText,
      options,
      correctIndex,
      ...(explanation ? { explanation } : {}),
    });
  }

  if (questions.length === 0) {
    return {
      success: false,
      questions: [],
      error: [
        "Không tìm thấy câu hỏi nào. Định dạng chuẩn được hỗ trợ:",
        "",
        "Câu 1. Nội dung câu hỏi?",
        "A. Lựa chọn A",
        "B. Lựa chọn B",
        "C. Lựa chọn C",
        "D. Lựa chọn D",
        "Đáp án: A",
        "",
        "Lưu ý:",
        "- Lựa chọn phải là CHỮ HOA (A. B. C. D.)",
        "- Các mục viết thường (a. b. c.) sẽ bị bỏ qua (tránh nhầm với văn bản luật)",
        "- 'Đáp án:' phải viết dấu hai chấm",
      ].join("\n"),
      warnings,
    };
  }

  return { success: true, questions, warnings };
}

/**
 * Convert mammoth HTML output to structured text.
 * KEY: Word list items (ol/ul/li) become "A. B. C. D." prefix lines
 * so the parser can detect them as answer options.
 * Uses browser DOMParser for reliable HTML parsing.
 */
function htmlToStructuredText(html: string): string {
  // Pre-process HTML to convert bolded options to asterisk format so they are recognized as correct answers
  // This supports the format where the correct option is bolded (bôi đen để chọn đáp án).
  let processedHtml = html.replace(/<(?:strong|b)[^>]*>\s*([A-Ha-hđĐ])\s*<\/(?:strong|b)>\s*([.)])/gi, "$1$2* ");
  processedHtml = processedHtml.replace(/<(?:strong|b)[^>]*>\s*([A-Ha-hđĐ])\s*([.)])/gi, "$1$2* ");

  const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];
  const lines: string[] = [];

  // Use DOMParser if available (browser context)
  if (typeof DOMParser !== "undefined") {
    const doc = new DOMParser().parseFromString(processedHtml, "text/html");

    // Helper: extract text from a node tree, converting <br> to \n
    // so soft returns inside Word paragraphs/cells are preserved as line breaks.
    function getTextWithBreaks(node: Node): string {
      let text = "";
      for (const child of Array.from(node.childNodes)) {
        const el = child as Element;
        if (child.nodeType === 3) {
          text += child.textContent || "";
        } else if (el.tagName?.toLowerCase() === "br") {
          text += "\n";
        } else if (el.childNodes?.length) {
          text += getTextWithBreaks(child);
        } else {
          text += el.textContent || "";
        }
      }
      return text;
    }

    function walkNode(node: Element): void {
      const tag = node.tagName?.toLowerCase();

      if (tag === "ol" || tag === "ul") {
        let idx = 0;
        for (const child of Array.from(node.children)) {
          if (child.tagName.toLowerCase() === "li") {
            // Use getTextWithBreaks so <br> inside li becomes newline
            const rawText = getTextWithBreaks(child);
            // Split by newline in case li has internal soft returns
            const liLines = rawText.split("\n").map(l => l.trim()).filter(l => l);

            for (const lineText of liLines) {
              const norm = lineText
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .replace(/[\u0111\u0110]/g, "d")
                .toLowerCase();

              if (/^(?:dap\s*an|answer|da)\s*[:.]/i.test(norm)) {
                lines.push(lineText);
              } else if (/^[A-Ea-eđĐ][.)]/. test(lineText.trim())) {
                // Already has option prefix - push as-is
                lines.push(lineText.trim());
              } else {
                const stripped = lineText.replace(/^[a-hA-HđĐ][.)\s]\s*/, "").trim();
                const letter = LETTERS[idx] ?? String.fromCharCode(65 + idx);
                lines.push(`${letter}. ${stripped}`);
                idx++;
              }
            }
          }
        }
        return;
      }

      if (tag === "table") {
        for (const row of Array.from(node.querySelectorAll("tr"))) {
          const cells = Array.from(row.querySelectorAll("td, th"))
            .map((c) => getTextWithBreaks(c).trim())
            .filter((t) => t.length > 0);
          if (cells.length > 0) lines.push(cells.join("\t"));
        }
        return;
      }

      if (/^h[1-6]$/.test(tag) || tag === "p") {
        // Use getTextWithBreaks so soft returns inside paragraph become separate lines
        const raw = getTextWithBreaks(node);
        const pLines = raw.split("\n").map(l => l.trim()).filter(l => l);
        for (const l of pLines) lines.push(l);
        return;
      }

      // Generic: recurse into children
      for (const child of Array.from(node.children)) {
        walkNode(child as Element);
      }
    }

    walkNode(doc.body);
    let finalStr = lines.join("\n");
    // VERY IMPORTANT: Force split squashed options. If mammoth dumped "A. text B. text" onto one line,
    // we must guarantee A., B., C., D. start on new lines!
    function forceSplitOptions(match: string, p1: string, p2: string, offset: number, string: string): string {
      const prefixContext = string.substring(Math.max(0, offset - 20), offset + p1.length);
      const normContext = prefixContext.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[\u0111\u0110]/g, "d").toLowerCase();
      if (/(?:dap\s*an(?:\s+dung)?|answer|da|correct)\s*[:.,-]?\s*$/i.test(normContext)) {
          return match;
      }
      return `${p1}\n${p2}`;
    }

    finalStr = finalStr.replace(/([a-z0-9à-ỹ.,”"\])]\s*)([A-HđĐ]\.\*?)/gi, forceSplitOptions);
    finalStr = finalStr.replace(/([a-z0-9à-ỹ.,”"\])]\s*)([A-HđĐ]\)\*?)/gi, forceSplitOptions);
    return finalStr.split("\n").map(l => l.trim()).filter(l => l).join("\n");
  }

  // Fallback: regex-based HTML → text (server-side / no DOM)
  let result = processedHtml;
  const LETTERS_FB = ["A", "B", "C", "D", "E", "F"];
  let listCounter = 0;

  result = result.replace(/<(?:ol|ul)[^>]*>/gi, () => { listCounter = 0; return ""; });
  result = result.replace(/<\/(?:ol|ul)>/gi, "\n");
  result = result.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, content) => {
    const text = content.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "").trim();
    const norm = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[\u0111\u0110]/g, "d").toLowerCase();
    if (/^(?:dap\s*an|answer|da)\s*[:.]/i.test(norm)) {
      return `${text}\n`;
    }
    const stripped = text.replace(/^[a-hA-H\u0111\u0110][.)\s]\s*/, "").trim();
    const letter = LETTERS_FB[listCounter] ?? String.fromCharCode(65 + listCounter);
    listCounter++;
    return `${letter}. ${stripped}\n`;
  });
  result = result.replace(/<(?:p|h[1-6])[^>]*>([\s\S]*?)<\/(?:p|h[1-6])>/gi, (_, c) =>
    c.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "").trim() + "\n"
  );
  result = result.replace(/<td[^>]*>([\s\S]*?)<\/td>/gi, (_, c) =>
    c.replace(/<br\s*\/?\u003e/gi, "\n").replace(/<[^>]+>/g, "").trim() + "\t"
  );
  result = result.replace(/<\/tr>/gi, "\n");
  result = result
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"');

  // VERY IMPORTANT: Force split squashed options
  // Match any lowercase/uppercase letter, number, or common punctuation immediately followed by A., B., C., etc.
  function forceSplitOptionsFb(match: string, p1: string, p2: string, offset: number, string: string): string {
    const prefixContext = string.substring(Math.max(0, offset - 20), offset + p1.length);
    const normContext = prefixContext.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[\u0111\u0110]/g, "d").toLowerCase();
    if (/(?:dap\s*an(?:\s+dung)?|answer|da|correct)\s*[:.,-]?\s*$/i.test(normContext)) {
        return match;
    }
    return `${p1}\n${p2}`;
  }

  result = result.replace(/([a-z0-9à-ỹ.,”"\])]\s*)([A-HđĐ]\.\*?)/gi, forceSplitOptionsFb);
  result = result.replace(/([a-z0-9à-ỹ.,”"\])]\s*)([A-HđĐ]\)\*?)/gi, forceSplitOptionsFb);

  return result.split("\n").map((l) => l.trim()).filter((l) => l.length > 0).join("\n");
}

/**
 * Extract text from a .docx ArrayBuffer using mammoth HTML mode.
 * HTML mode preserves Word list structure → options keep A./B./C./D. prefix.
 */
export async function extractTextFromDocx(buffer: ArrayBuffer): Promise<string> {
  const mammoth = await import("mammoth");
  // Use convertToHtml (not extractRawText) to preserve list item markers
  const result = await mammoth.convertToHtml({ arrayBuffer: buffer });
  return htmlToStructuredText(result.value);
}
