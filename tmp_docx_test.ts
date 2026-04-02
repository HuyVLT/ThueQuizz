import { parseWordText } from './lib/wordParser';
import fs from 'fs';

const text = `
Câu 20. Các cơ quan, đơn vị thuộc hệ thống cơ quan dự trữ nhà nước bán hàng dự trữ quốc gia theo quy định của pháp luật thì sử dụng:
A.	Hóa đơn điện tử bán tài sản công
B.	Hóa đơn điện tử bán hàng dự trữ quốc gia
C.	Hóa đơn giá trị gia tăng điện tử
D.	Hóa đơn bán hàng điện tử
Đáp án B.
Căn cứ: Khoản 4 Điều 8 Nghị định số 123/2020/NĐ-CP
Câu 34. Tổ chức cho thuê tài chính cho thuê tài sản thuộc đối tượng chịu thuế GTGT khi lập hóa đơn đối với hoạt động cho thuê tài chính thì:
A.	Thuế suất gạch chéo, tiền thuế giá trị gia tăng thể hiện bằng tiền thuế giá trị gia tăng đầu vào của tài sản cho thuê tài chính
B.	Thuế suất thể hiện “CTTC”, tiền thuế giá trị gia tăng thể hiện bằng tiền thuế giá trị gia tăng đầu vào của tài sản cho thuê tài chính
C.	Thuế suất thể hiện “KCT”, tiền thuế giá trị gia tăng thể hiện bằng tiền thuế giá trị gia tăng đầu vào của tài sản cho thuê tài chính
D.	Thuế suất thể hiện “10%”, tiền thuế giá trị gia tăng thể hiện bằng tiền thuế giá trị gia tăng đầu vào của tài sản cho thuê tài chính.
Đáp án B. 
Căn cứ: Điểm b khoản 2 Điều 5 Thông tư số 32/2025/TT-BTC
`;

fs.writeFileSync('out.json', JSON.stringify(parseWordText(text), null, 2));
