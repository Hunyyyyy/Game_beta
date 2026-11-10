# Thiết kế: bậc lính, nghiên cứu, chế tạo, nhà lính

**Trạng thái:** đã làm phần thời Đá (bước 1 đến 4): `src/data/ranks.json`, `src/sim/ranks.ts`, `src/sim/barracks.ts`, trường `rank` của lính, nghiên cứu mở bậc 2 và 3, màn luyện lính ở ba trại, sức mạnh và khẩu phần theo bậc, "ném đá" (`thrown_stone`). Thời Trung cổ mới có bậc 4 đã vẽ, đánh dấu `soon` (chỉ qua dev). Số liệu là **đề xuất**, chỉnh bằng `src/data/*.json` và `npm run economy`. Thay đổi so với bản đầu: kỵ không cần thú đã thuần, giá thú nằm trong giá luyện (`ranks.json`); không thăng cấp.

## 1. Nguyên tắc
Mỗi nhánh (bộ binh, cung, kỵ) có **3 bậc lính ở mỗi thời đại**. **Bậc lính là gốc**, ba hệ thống chỉ trả lời mỗi hệ một câu hỏi:

| Hệ thống | Câu hỏi | Quy tắc |
|---|---|---|
| Nghiên cứu | Làng có **biết** luyện bậc này chưa? | Mỗi bậc có một nghiên cứu mở khóa (tên chính là loại lính). Bậc 1 có sẵn. |
| Nhà chế tạo | Có **đồ** cho bậc này không? | Đồ gắn với bậc. **Không cần nghiên cứu mở bản vẽ**, chỉ cần cấp Nhà chế tạo và vật liệu. |
| Nhà lính | Có **luyện** được không? | Luyện bậc T khi: đã mở bậc T **và** kho có đồ bậc T (kỵ: thêm một thú cưỡi đã thuần bậc T trong Chuồng thú) **và** đủ sò. Nâng nhà **chỉ thêm chỗ** (tổng số, không chia theo bậc). |

Không thăng cấp: muốn lính bậc cao hơn thì cho lính cũ nghỉ (`releaseRole`), đồ của họ về kho, rồi luyện người mới.

## 2. Thang sức mạnh liên tục qua thời đại
Chỉ số nghiên cứu (cộng %) **đi theo người chơi sang thời Trung cổ**, nhân vào gốc **trước** hệ số bậc. Hệ số bậc nằm trong một dãy liền:

| Bậc | Thời Đá 1 | 2 | 3 | Trung cổ 1 | 2 | 3 |
|---|---|---|---|---|---|---|
| Hệ số sức mạnh | ×1 | ×1,75 | ×3 | ×5 | ×8,5 | ×14,5 |
| Nhân mỗi chỉ số (máu, sát thương) | ×1 | ×1,32 | ×1,73 | ×2,24 | ×2,92 | ×3,81 |

Ràng buộc bạn nêu: bậc 3 Đá chỉ gấp 3 bậc 1 Đá (không quá cao); bậc 1 Trung cổ gấp khoảng 1,67 lần bậc 3 Đá (không chỉ nhỉnh một chút). Máu và sát thương mỗi cái nhân **căn bậc hai** của hệ số, để sức mạnh tổng đúng bằng hệ số thay vì bình phương.

## 3. Thời Đá: ba nhánh, ba bậc
| Nhánh | Bậc 1 | Bậc 2 | Bậc 3 |
|---|---|---|---|
| Bộ binh | cầm **gậy gỗ** | cầm **giáo gỗ** | cầm **chùy đá** |
| Kỵ | **sói** + gậy gỗ | **heo rừng** + giáo gỗ | **voi** + chùy đá |
| Cung | **ném đá** (lấy đá chọi, món mới) | **dây quăng đá** | **cung ngắn** |

- **Nghiên cứu:** chuỗi theo nhánh: *chỉ số bậc 1, mở bậc 2, chỉ số bậc 2, mở bậc 3, chỉ số bậc 3*. Chỉ số cộng cho cả nhánh (mọi bậc).
- **Kỵ:** thú cưỡi lấy từ kho Chuồng thú (đã có hệ thuần), thay cho "thú theo cấp trại" hiện nay.
- **Luyện:** 1, 2, 3 sò cho bậc 1, 2, 3 (chỉnh sau).
- **Khẩu phần:** nhân theo bậc, ×1 / ×1,25 / ×1,5. Dùng hệ khẩu phần sẵn có.

## 4. Thời Trung cổ (khung, làm sau)
| Nhánh | Bậc 1 | Bậc 2 | Bậc 3 |
|---|---|---|---|
| Bộ binh | Bộ binh: kiếm thẳng, khiên, giáp xích (**đã vẽ**) | Hộ vệ hoàng gia: đại kiếm hoặc búa chiến, khiên tháp, giáp tấm | Dũng sĩ thánh giáo: đại búa, khiên thánh, giáp bất hoại |
| Kỵ | Kỵ binh: ngựa, giáo, kiếm ngắn, giáp da bọc đinh (**đã vẽ**) | Kỵ binh hoàng gia: ngựa bọc giáp, trường thương, giáp tấm | Thánh kỵ sĩ: chiến mã, thánh lance, thánh giáp |
| Cung | Cung thủ: cung ghép, giáp da, bao tên (**đã vẽ**) | Cung tiễn hoàng gia: trường cung hoặc nỏ nặng | Lính bắn tỉa: cung thần cây hoặc nỏ phép |

- Cây nghiên cứu Trung cổ cũng 3 bậc mỗi nhánh (không gộp thành cây 6 bậc cho khỏi dài). Chỉ **con số** là một dãy liền (mục 2).
- Vật liệu mới (quặng sắt, thỏi sắt, thép, mithril...) cần danh sách tài nguyên riêng: làm ở đợt sau.

## 5. Giá luyện và cân bằng kỵ
- Hiện kỵ đắt hơn vì thú cưỡi có giá riêng (`mounts.json`: sói, heo, voi tốn 10, 20, 30 sò cùng lương, da). Cộng thêm sò luyện thì kỵ đắt gấp nhiều lần bộ và cung.
- Đề xuất: đồ của kỵ giống bộ binh (gậy, giáo, chùy), nên phần chênh nằm ở **thú**. Hạ sò thuần thú (ví dụ 3, 6, 9) để tổng giá kỵ cao hơn bộ và cung **vừa phải**, bù lại bằng tốc độ và giảm sát thương nhận (đã có ở thú cưỡi). Chỉnh bằng `npm run economy` sau khi có số.
- Giá sò luyện thời Trung cổ gợi ý theo hệ số sức mạnh: 5, 8, 14.

## 6. Dữ liệu và tương thích save
- Thêm trường **`rank`** (bậc lính) cho mỗi lính. Hiện `tier` của vũ khí đang kiêm màu vật liệu khi vẽ (gỗ, đá, đồng), nên vũ khí cần thêm trường riêng cho bậc lính để không đổi màu đầu vũ khí.
- Bảng bậc trong một file mới (`src/data/ranks.json`): theo nhánh, thời đại, bậc: tên, vũ khí, thú, nghiên cứu mở khóa, sò, khẩu phần, hệ số sức mạnh.
- Nâng `SAVE_VERSION` và thêm bước chuyển đổi: lính cũ nhận `rank` theo vũ khí đang cầm (gậy 1, giáo 2, chùy 3; sói 1, heo 2, voi 3). Kỵ cũ giữ thú đang cưỡi.
- Bỏ quy tắc "thú theo cấp trại" (`campBeast`) sau khi chuyển đổi.

## 7. Việc phải làm (theo thứ tự, mỗi bước build được)
1. **Khung và dữ liệu thời Đá:** `ranks.json`, trường `rank`, đồ theo bậc (thêm "ném đá", đổi bậc vũ khí cũ), chuyển đổi save.
2. **Nghiên cứu:** đổi "mở bậc vũ khí" thành "mở loại lính"; thêm chuỗi cho bộ và cung (hiện kỵ có chuỗi riêng).
3. **Nhà lính:** màn "Luyện lính" (chọn bậc, hiện điều kiện thiếu gì: nghiên cứu, đồ, thú, sò), trừ kho khi luyện; nhà chế tạo phân đồ theo bậc.
4. **Sức mạnh và khẩu phần theo bậc** (sim).
5. **Thời Trung cổ:** nối ba lính cấp 1 đã vẽ làm bậc 1, vật liệu mới, rồi bậc 2 và 3.

## 8. Chưa chốt
- Có thêm điều kiện "thành tích" (thắng trận, hạ boss) cho bậc 3 không?
- Sò luyện thực tế và giá đồ từng bậc (sau khi có khung).
- Hình vẽ và hoạt họa lính bậc 2, 3 của thời Đá (cầm giáo, chùy trên sói, heo, voi đã có; "ném đá bằng tay" cần động tác ném).

## 9. Lính gác (nhánh thứ tư) và quy tắc nam giới

- **Lính gác** là nhánh của Trại lính gác, 3 bậc đồ đá (Người canh gác: gậy, Lính gác: giáo + khiên gỗ, Lính canh: chùy + khiên gỗ) và 3 bậc Trung cổ đã vẽ, `soon` (Tuần đinh: giáo ngắn, Lính gác chuyên nghiệp: giáo dài, Cận vệ thành trì: kiếm dài). Dùng cùng gậy, giáo, chùy với bộ binh (`postStyle`, `postShield` trong weapons.json đổi dáng đứng và thêm khiên gỗ cho người gác), luyện bằng cùng màn bậc, nghiên cứu mở bậc trong nhóm Quân sự.
- **Thiên về phòng thủ:** `ranks.json` `profile.guard` nhân thêm máu 1,2, sát thương 0,75, thủ cận và thủ xa 1,4 lên hệ số bậc.
- **Dáng đứng:** lính gác ở chỗ gác dùng động tác đứng nghiêm (`post_*`, `gpost_*` trong anims.json), chỉ vào thế chiến đấu khi có giao tranh.
- **Lính là nam:** chỉ người nam được giao vai trò lính (các trại, lính gác, chòi canh); lính của các làng khác và toán cướp cũng là nam.
- Chòi canh, lính chòi canh và cả cây trận pháp, kế hoạch, hành quân chỉ có từ Trung cổ.
