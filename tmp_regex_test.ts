let str1 = "Đáp án B.";
let str2 = "Đáp án đúng: C.";
let str3 = "A. Option A B. Option B";
let str4 = "This is a sentence. D. Option D";

function replaceSquashed(text: string): string {
    text = text.replace(/([a-z0-9à-ỹ.,”"\])]\s*)([A-HđĐ]\.\*?)/gi, (match, p1, p2, offset, string) => {
      const prefixContext = string.substring(Math.max(0, offset - 20), offset + p1.length);
      const normContext = prefixContext.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[\u0111\u0110]/g, "d").toLowerCase();
      if (/(?:dap\s*an(?:\s+dung)?|answer|da|correct)\s*[:.,-]?\s*$/i.test(normContext)) {
          return match;
      }
      return `${p1}\n${p2}`;
    });
    return text;
}

console.log({
    str1: replaceSquashed(str1),
    str2: replaceSquashed(str2),
    str3: replaceSquashed(str3),
    str4: replaceSquashed(str4)
});
