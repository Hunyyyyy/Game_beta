# ART BRIEF: mô tả hình ảnh cho Claude Code vẽ (lính, nhà, nhân vật)

Đặt ở `docs/ART_BRIEF.md`. Bổ sung cho prompt cũ và `UPDATE_di_san_mo_khoa.md`. File này chỉ mô tả HÌNH DÁNG và MÀU; cách ra JSON theo `doc/art_pack/` Part 2 (đọc mẫu `samples/`).

## 0. Cách làm tiết kiệm token

- Mỗi hạng lính là MỘT dòng cấu hình rig: `armor` (file JSON trong `src/data/armors/`) + `tool:{kind,tier,shield}` + `mount:{species,clip}` nếu có. Không vẽ tay từng khung. Sinh bằng một script `tools/gen-ranks.mjs` đọc bảng bên dưới.
- Xem ảnh: chỉ chạy `art-preview` MỘT sheet hạng 4 đến 10 cho mỗi binh chủng (4 ảnh), rồi chỉnh. Không xem lại từng chỉnh nhỏ.
- Công trình: viết `tools/art-derive.mjs` tạo cấp sau bằng cách THÊM KHỐI NHÀ và mở rộng footprint theo mục 3.1 (không chỉ chồng trang trí lên bản cũ). Chỉ vẽ tay những mục ghi "VẼ TAY".
- Màu mới phải đặt tên và khai báo một chỗ (`src/data/palette_ext.json`), dùng chung; không nhúng hex trực tiếp trong layer.

## 1. Thang màu theo hạng (để nhìn là biết hạng)

Giữ quy tắc: viền 1px `#2b1d10`, 3 tông (cơ bản / sáng L / tối D), sáng từ trên trái. Hạng 7 hiện là bạc (templar, paladin, warden). Đọc armor hạng 7 trước rồi đặt hạng 8 đến 10 TRỘI HƠN một bậc rõ rệt:

| Hạng | Chất liệu | Màu chủ đạo (gợi ý) | Điểm nhấn |
|---|---|---|---|
| 8 | giáp tấm thép | `plate` #8fa3b0 / L #b9c7d0 / D #5d6e7a | áo choàng trơn màu chức vụ, mũ có sống |
| 9 | thép tôi đen viền đỏ | `blackSteel` #3b4350 / L #626c7a / D #232831, viền `crimson` #a8322d | lông chim hoặc chổi trên mũ, huy hiệu ngực |
| 10 | thép trắng viền vàng | `royal` #dfe4ea / L #ffffff / D #9aa5b1, viền `gold` #d9a93a | mũ lông dài, áo choàng dài, cờ hiệu nhỏ ở lưng |

Màu chức năng theo binh chủng (áo choàng, dải): foot xanh lam `#2f5d9e`, archer xanh lục `#3d7a45`, cavalry đỏ `#a03a2e`, guard tím `#6a3f8a`. Dùng xuyên các hạng để nhận ra binh chủng ngay.

## 2. Lính hạng 8 đến 10 (12 dòng cấu hình)

| Binh chủng | Hạng | Tên | Armor | Tool | Hình dáng nhận diện (bóng đen) |
|---|---|---|---|---|---|
| foot | 8 | kích thủ giáp lá | `halberdier` | halberd (cán dài, lưỡi rìu + mũi nhọn) | cao, mũ sắt tròn có sống, giáp vảy lá, không khiên |
| foot | 9 | hiệp sĩ bộ | `knight_foot` | longsword (vỏ bên hông) + khiên chữ nhật | mũ kín mặt có khe, áo khoác huy hiệu |
| foot | 10 | đội trưởng cấm quân | `guard_captain` | đại kiếm (vỏ trên lưng), rút ra khi đánh | mũ lông chim, áo choàng dài, vai giáp lớn |
| archer | 8 | nỏ thủ nặng | `heavy_crossbow` | nỏ lớn (cung ngang, báng gỗ) | mũ nón, áo giáp da gia cố, mang túi tên ngang |
| archer | 9 | hỏa thương thủ | `fire_lancer` | giáo ngắn có ống sắt dưới mũi, khói nhỏ khi tấn công | áo vải dày, mũ sắt hở, bình thuốc bên hông |
| archer | 10 | pháo thủ tay | `hand_gunner` | ống pháo tay (ống sắt ngắn trên báng gỗ), chớp lửa + khói ở khung bắn | giáp ngực nhẹ, nón rộng vành, túi thuốc súng trước ngực |
| cavalry | 8 | kỵ binh nặng giáo dài | `heavy_lancer` | giáo kỵ rất dài | mount `horse` bọc giáp nửa người, người mặc giáp tấm |
| cavalry | 9 | hiệp sĩ kỵ | `knight_rider` | lance + khiên tam giác | ngựa phủ vải huy hiệu (caparison) màu binh chủng, mũ kín |
| cavalry | 10 | kỵ sĩ vương | `king_rider` | lance dài có cờ hiệu | ngựa giáp đầy đủ, lông chim trên đầu ngựa, người mặc `royal` |
| guard | 8 | cận vệ hoàng gia | `royal_guard` | kiếm (vỏ bên hông) + khiên tròn lớn | giáp tấm, khiên có huy hiệu, mũ có lưỡi trai |
| guard | 9 | cận vệ tinh nhuệ | `elite_guard` | kiếm dài (vỏ bên hông) + khiên cao | `blackSteel` viền đỏ, áo choàng đen tím |
| guard | 10 | cận vệ vương | `king_guard` | đại kiếm hai tay (vỏ trên lưng) | `royal` viền vàng, áo choàng dài, đứng tư thế tấn công thấp |

Quy tắc: tool bắn (nỏ, hỏa thương, pháo tay) vẽ nhìn nghiêng, pivot ở đầu báng; chớp lửa pháo tay chỉ xuất hiện ở khung bắn thứ 2 hoặc 3 trong 4 khung. Súng chỉ ở mức đời 13 đến 14: không có ngòi hiện đại, không báng cong.

## 2b. Kiếm vào vỏ, rút ra khi đánh

Mọi lính và nhân vật dùng kiếm hoặc dao găm phải:

- **Ngoài chiến đấu (idle, đi, làm việc):** kiếm nằm TRONG VỎ, đeo bên hông. Tay không cầm kiếm. Hiện chuôi kiếm nhô khỏi miệng vỏ và đầu vỏ (chape) lộ ra sau đùi.
- **Khi đánh (anim tấn công, tư thế sẵn sàng khi địch ở tầm):** kiếm RÚT ra cầm tay. Vỏ vẫn còn bên hông nhưng trống (không có chuôi).
- Chuyển trạng thái bằng một khung rút kiếm ngắn (1 đến 2 khung) khi vào chiến đấu và một khung tra kiếm khi ra khỏi chiến đấu; nếu muốn tiết kiệm, bỏ khung chuyển và đổi tức thời.

Vị trí vỏ:

| Vũ khí | Chỗ mang khi không đánh |
|---|---|
| kiếm một tay (bronze sword, arming sword, knight sword, longsword, ward sword, kiếm cận vệ) | bên hông trái, nghiêng chếch sau khoảng 35 độ |
| đại kiếm hai tay (greatsword, đại kiếm cấp 10) | vỏ trên lưng, chuôi nhô qua vai |
| dao găm (sát thủ, nội gián) | thắt lưng sau hoặc cổ chân |
| giáo, kích, pike, halberd, lance | cầm tay hoặc vác vai, không có vỏ |
| cung, nỏ, hỏa thương, pháo tay | cầm tay hoặc đeo lưng, không đổi |

Màu vỏ: da nâu `scabbard` #4a3322 (L #6b4a33, D #2f2015), đầu và miệng vỏ kim loại cùng tông giáp của hạng đó (đồng ở hạng 4, bạc ở hạng 7, vàng viền ở hạng 10). Hạng cao có vỏ trang trí hơn.

Lính gác (guard): từ hạng 7 trở lên đã đổi sang kiếm (ward sword, cận vệ hoàng gia, tinh nhuệ, vương). Hạng 4 đến 6 giữ giáo và pike. Cả dòng kiếm của guard phải theo quy tắc rút và tra kiếm ở trên.

Chạm logic cũ cần hỏi ở Phase 0: `src/character/rig.js` (vẽ vỏ ở hông, đổi tool theo trạng thái), `src/data/anims.json` (khung rút và tra), và cách rig biết "đang chiến đấu" (đọc trạng thái combat của đơn vị). Đề xuất: thêm lớp `sheath` vào mỗi file armor (một vị trí hông) và một cờ `drawn` do trạng thái combat đặt, không đổi hệ anim khác.

## 3. Công trình theo cấp

### 3.1 Công trình LỚN LÊN, không phải bị dán thêm trang trí

Lỗi cần tránh: vẽ nhà như một tấm ảnh dán lên nền (cùng khung, cùng đáy, chỉ thêm cờ và đuốc). Mẫu đúng là dãy Nhà chung trong `palace_dev.png`: mỗi cấp là một công trình MỚI to hơn, có thêm khối nhà, tháp, cánh, nền lát đá.

Quy tắc bắt buộc cho `art-derive` và các bản vẽ tay:

1. **Không đặt cứng 2x2.** Footprint của A(n+1) tính từ footprint hiện có của chính kind đó (đọc `L1.json`, `A1.json`), cộng bước ở bảng dưới. Công trình càng lên cấp càng rộng, giống Nhà chung.
2. **Thêm thể tích, không chỉ thêm đồ vật.** Mỗi cấp thêm khối thật: cánh nhà, tầng trên, tháp góc, mái phụ. Tháp và tường phải có hai mặt (sáng L và tối D) nhìn thấy, không phải hình phẳng.
3. **Có đế chạm đất.** Từ A2 trở lên luôn có nền lát đá dạng thoi (diamond) đúng bằng footprint, bóng đổ dưới chân, bậc thềm trước cửa, cỏ và đuốc ở góc nền, như hình Nhà chung. Chân tường phải chạm nền, không lơ lửng trên một bóng tròn.
4. **Giữ chất liệu và bảng màu xuyên cấp** (đá xám, mái xanh lam, cờ đỏ hoặc xanh) để nhìn ra là cùng một công trình lớn lên.

Bước tăng kích thước (so với footprint A1 của kind, đơn vị ô; Claude Code chỉnh theo khoảng trống bản đồ ở Phase 0):

| Cấp art | Dùng cho Nhà chung cấp | Rộng | Sâu | Thêm khối |
|---|---|---|---|---|
| A1 | 4, 5 | +0 | +0 | đế đá thấp, một khối chính, một tháp nhỏ hoặc ống khói, một cờ |
| A2 | 6, 7 | +1 | +0 | cánh bên, đuốc và cửa vòm, mái ngói phiến, nền lát |
| A3 | 8, 9 | +2 | +1 | tầng trên hoặc hai tháp góc, lỗ châu mai, cổng chạm, cửa sổ sáng ấm |
| A4 | 10 | +3 | +1 | tháp góc cao, khối trung tâm cao hơn, viền vàng nhạt, cờ hiệu có huy, sân và đài nước hoặc thảm |

Phòng thủ (fence, gate, tower, trap): không đổi footprint; chỉ tăng chiều cao hoặc dày hơn.

Hệ quả cho game (đưa vào danh sách "Chạm logic cũ" ở Phase 0): footprint đổi khi nâng cấp nên phải quyết cách xử lý chỗ trống. Gợi ý: nâng cấp cần đủ chỗ ở các ô lân cận, hiện khung xanh hoặc đỏ để báo đủ hay không; nếu không đủ chỗ thì chặn nâng và nói lý do. Chọn ở Phase 0, hỏi người dùng trong lần AskUserQuestion duy nhất.

### 3.2 Nhà chung (campfire, VẼ TAY)

- A1 (cấp 4, 5): sảnh đá thấp 3x3 ô, mái dốc, hai cột đá trước cửa, cờ bộ lạc.
- A2 (cấp 6, 7): đã có cung điện cấp 7 (6x6) trong `palace_dev.png`; cấp 6 là bản nhỏ hơn cùng ngôn ngữ (5x5).
- Cấp 8 (A3, 7x7), cấp 9 (A3 + tháp, 8x8), cấp 10 (A4, 9x9): lớn dần, thêm tháp hai bên rồi tháp bốn góc, sân lát đá, cờ hiệu vàng ở cấp 10. Kích thước chốt ở Phase 0.

### 3.3 Trại quân (military) VẼ TAY một chi tiết đặc trưng mỗi kind, phần còn lại derive

| Kind | Chi tiết đặc trưng |
|---|---|
| infantry | giá kích và khiên, bãi tập có hình nộm |
| archery | bia tập bắn tròn, giá cung |
| cavalry | chuồng ngựa dài, máng cỏ |
| guardpost | tháp gác nhỏ, bảng treo |
| stable | rào ngựa, đống cỏ khô |
| drill | cọc huấn luyện, cờ hiệu |
| scouttent | lều nhọn, bản đồ treo |
| wartent | lều lớn có cờ chỉ huy |
| supplycamp | xe bò chất hàng, bao tải |

## 4. Công trình chuyên (Trái) và đơn vị chuyên (Ngọn)

### 4.1 Công trình chuyên (derive từ kind gốc, đổi skin)

| Công trình | Từ kind | Dấu hiệu nhận ra |
|---|---|---|
| Hội Quán Trưởng Lão | house | ghế tròn và bàn dài lộ qua cửa, cờ xám |
| Đồn Thu Cống | storage | bao tải xếp bên ngoài, biển cống phẩm |
| Sàn Thương Hội | market | mái vải sọc nhiều màu, cân treo, rương |
| Phòng Hộ Vệ | guardpost | cổng sắt nhỏ, hai lính đứng gác |
| Trạm Liên Lạc | scouttent | cọc cờ nhiều màu, chim bồ câu |
| Trại Kép | wartent | hai lều đối xứng, hai cờ khác màu |
| Đài Chinh Phạt | drill | đài đá có cờ lớn, bản đồ khắc |
| Đền Tưởng Niệm | house | tượng đá nhỏ, nến, hoa |
| Học Viện | lab | kệ sách, đèn, ống nhòm, mái cong |
| Xưởng Mật | workshop | cửa kín, ống khói đen, khóa lớn |

### 4.2 Đơn vị chuyên (một preset rig mỗi đơn vị, VẼ preset không vẽ thân)

| Đơn vị | Armor | Tool / mount | Nhận diện |
|---|---|---|---|
| Cấm quân tuần phòng | `patrol_guard` | giáo + khiên | áo choàng xám, tay cầm đèn |
| Cung thủ ngựa | `horse_archer` | cung ngắn, mount horse | áo nhẹ, mũ nỉ, túi tên bên hông |
| Sát thủ | `assassin` | dao găm hai tay | đen, mũ trùm, không giáp, mảnh |
| Cận vệ thuê | `hired_guard` | kiếm + khiên nhỏ | giáp không đồng bộ, dải vai màu vàng |
| Hiệp sĩ đào ngũ | `defector_knight` | kiếm, mount horse | giáp tối màu, dải áo bị cắt đứt |
| Du kích | `skirmisher` | giáo ngắn, cung | áo xám xanh, lá ngụy trang |
| Kỹ sư chiến trường | `engineer` | búa lớn và túi dụng cụ | mũ bảo hộ, kính bảo hộ |

## 5. Nhân vật có tên (preset rig, tối đa 14)

Mỗi nhân vật: một dòng JSON, một dòng mô tả. Dùng thân người chung, đổi armor, màu, đồ vật.

| Nhân vật | Hình dáng |
|---|---|
| Người giữ lửa | áo choàng da thô, tay cầm đuốc, râu dài, sạm khói |
| Thợ già (thầy) | tạp dề da, búa nhỏ ở đai, gù nhẹ, tóc bạc |
| Thương lái | nón rộng, gùi lớn, túi cân bên hông |
| Sứ giả đồng minh | áo đẹp màu của làng bạn, gậy cờ nhỏ |
| Thám tử | áo choàng nâu xám, mũ trùm, ống nhòm hoặc bản đồ cuộn |
| Sát thủ | dùng preset Sát thủ ở 4.2 |
| Nội gián | giống dân thường nhưng có một vết ngón tay đeo nhẫn lạ |
| Thủ lĩnh làng boss | cao lớn, giáp đẹp, màu thay theo seed làng |
| Tướng của bạn | giáp hạng 8 hoặc 9, áo choàng màu binh chủng, ngựa tùy chọn |
| Cận vệ | giáp guard hạng 8, khiên lớn, đứng gần nhân vật được gán |
| Trưởng lão | áo dài xám, gậy gỗ, tóc bạc dài |
| Nhà sư lang thang | áo cam nâu, chuỗi hạt, bát xin |
| Đứa học việc | thấp hơn, áo vá, tay ôm sách hoặc búa to quá cỡ |
| Thợ rèn | tạp dề, găng da, kìm và búa, mặt đen khói |

## 6. Kiểm tra trước khi giao

- Mọi lính cầm kiếm: ảnh idle có vỏ ở hông, ảnh tấn công có kiếm trong tay và vỏ trống.
- Công trình từ A2 trở lên có nền lát dạng thoi và khối nhà thật (xem 3.1), không phải ảnh dán.
- Mọi preset dùng đúng tên palette (đã khai báo ở `palette_ext.json`), lớp cuối là outline, kích thước và anchor tính từ 32px/ô.
- Một sheet cho mỗi nhóm: lính 4 ảnh, Nhà chung 1 ảnh, trại quân 1 ảnh, chuyên 1 ảnh, nhân vật 1 ảnh. Dừng chỉnh sau tối đa 2 vòng cho mỗi sheet; phần chưa đạt ghi vào `PLAN.md` mục "Art cần vẽ tay thêm".
