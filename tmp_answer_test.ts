import { parseWordText } from './lib/wordParser';
import fs from 'fs';

const textFromLines = `
Câu 50. Câu hỏi
A. Opt A
B. Opt B
C. Opt C
D. Opt D
Đáp án: C ( Khoản 6 Điều 1 Nghị định 70/2025NĐ-CP sửa đổi, bổ sung NĐ 123)

Đáp án:
A. B
B. B
C. A
`.trim();

fs.writeFileSync('out.json', JSON.stringify(parseWordText(textFromLines), null, 2));
