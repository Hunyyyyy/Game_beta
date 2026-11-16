# UPDATE: Di sản mở khóa (mở khóa phụ theo Trái và Ngọn)

Đặt file này ở `docs/UPDATE_di_san_mo_khoa.md`. Nó BỔ SUNG và GHI ĐÈ prompt cũ ở đúng các chỗ nêu trong Phần B. Mọi chỗ khác của prompt cũ giữ nguyên. Phần A là thiết kế; ở Phase 5 hãy chép Phần A thành mục "Di sản mở khóa" cuối `docs/story_tree.md`.

---

## PHẦN A. THIẾT KẾ

### A1. Nguyên tắc (không thương lượng)

1. **Lõi luôn mở theo cấp Nhà chung và nghiên cứu, cốt truyện không bao giờ khóa lõi.** Lõi gồm: 4 binh chủng (foot, archer, cavalry, guard) hạng 4 đến 10 theo dòng đã chốt ở prompt cũ, mọi công trình trong bảng mục C của prompt cũ, mọi tài nguyên cơ bản. Lý do: địch dùng cả bốn binh chủng, thiếu một là hỏng tam giác khắc chế và không đánh nổi.
2. **Di sản chỉ mở "chuyên"**: đơn vị chuyên (đứng cạnh dòng lõi, đánh đổi chứ không mạnh hơn), công trình chuyên, tài nguyên hoặc quyền năng chuyên. Chuyên không bao giờ cần thiết để thắng.
3. **Ngưỡng mở khớp nhịp có sẵn:** Trái mở khi Trái nổ; Ngọn giữa chấm ở Nhà chung cấp 7 nên chuyên của nó dùng được từ cấp 8; Ngọn cuối chấm ở cấp 10. Nếu Ngọn giữa khác Ngọn cuối thì người chơi giữ CẢ HAI chữ ký (cộng dồn).
4. **Con đường sở hữu toàn bộ** = đạt M1 Thống Nhất Giang Sơn, rồi dùng quyền năng "Thư Viện Di Sản" của nó mua từng chữ ký còn thiếu với giá cao. Không có Ngọn nào cho tất cả miễn phí.
5. **Đường bù, không ai bị khóa vĩnh viễn:** mọi chữ ký đều mua được bằng bản vẽ ở Chợ với giá khoảng gấp 3 giá trị chữ ký (kho bản vẽ ngẫu nhiên theo mùa, theo seed). Tùy chọn nếu rẻ: hạ hoặc thu phục làng có đặc sản tương ứng thì nhận bản vẽ đó.
6. **Dấu vẫn ẩn:** màn hình Nhật ký > "Di sản" hiện chuyên đã mở (rõ) và chuyên chưa mở (bóng mờ, chữ "Chưa rõ cách mở"). Không bao giờ ghi chuyên này đến từ Ngọn nào.
7. Chế độ: Dễ thêm 1 bản vẽ chọn tự do khi Ngọn giữa chấm; Thường và Khắc nghiệt giữ nguyên mở khóa (chỉ khác độ đau của lá).
8. Cân bằng chuyên: ngân sách sức mạnh bằng lõi cùng hạng, chi phí huấn luyện +30%, khẩu phần +1. Art: MỘT preset rig (armor + handtool) cho mỗi chuyên, chỉ số nội suy theo hạng = cấp Nhà chung đang có, không vẽ thân mới.

### A2. Trái mở gì (mỗi Trái đúng 1 thứ vừa)

Công trình chuyên làm bằng `tools/art-derive.mjs` từ một kind có sẵn (đổi skin và chức năng), không vẽ tay từ đầu.

| Trái | Cờ | Mở | Làm từ | Ý nghĩa |
|---|---|---|---|---|
| TM1 Triều Đình | `court` | Hội Quán Trưởng Lão | house | +1 ô cố vấn, giảm bất ổn |
| TM2 Đế Quốc Sắt | `iron_realm` | Đồn Thu Cống | storage | thu tài nguyên định kỳ từ làng đã khuất phục |
| TM3 Cộng Hòa Thương Gia | `merchant_rule` | Sàn Thương Hội | market | đoàn thương lái, kho bản vẽ ở Chợ rộng hơn |
| TM4 Lãnh Chúa Cô Độc | `lonely_lord` | Phòng Hộ Vệ | guardpost | thêm 1 ô cận vệ gán nhân vật |
| TM5 Liên Minh Mong Manh | `fragile_pact` | Trạm Liên Lạc | scouttent | gọi đồng minh viện trợ một lần mỗi mùa |
| TM6 Vương Quốc Chia Đôi | `two_crowns` | Trại Kép | wartent | thêm 1 đội xuất quân song song |
| TM7 Bá Chủ Đầy Mũi Dao | `overlord` | Đài Chinh Phạt | drill | tăng tầm hành quân, dẹp loạn nhanh hơn |
| TM8 Nợ Máu Đời Sau | `blood_debt` | Đền Tưởng Niệm | house | sĩ khí cộng thêm khi đánh kẻ thù đã gây thù |
| TM9 Học Viện Làng | `academy` | Học Viện | lab | +1 ô nghiên cứu song song |
| TM10 Xưởng Bí Mật | `hidden_forge` | Xưởng Mật | workshop | chế một trang bị đặc biệt (chốt ở Phase 0) |

Lá: chỉ tối đa 1 trong 3 lá mỗi nút có trường `grants` cho perk nhỏ (giảm giá, công thức, mặt hàng chợ), không mở công trình hay lính.

### A3. Ngọn mở gì (chữ ký = 1 đơn vị chuyên + 1 quyền năng)

Gợi ý bên dưới, Claude Code chốt tên và chỉ số ở Phase 0 theo hệ đang có (nếu thiếu hệ nào, đổi theo ghi chú).

| Ngọn | Đơn vị chuyên (preset) | Quyền năng |
|---|---|---|
| M1 Thống Nhất Giang Sơn | Cấm quân tuần phòng (foot, đồn trú, tự dẹp loạn nhẹ) | **Thư Viện Di Sản**: mua mọi chữ ký khác, giá cao |
| M2 Liên Bang Các Làng | Cung thủ ngựa (archer + cavalry) | Liên quân: quân đồng minh tới trợ chiến miễn phí khi đồng minh gọi |
| M3 Đế Quốc Sắt | Sát thủ (người chơi huấn luyện được, dùng cho nhiệm vụ ám sát) | Tai mắt: thấy hướng hành quân của làng địch |
| M4 Thành Bang Thương Nhân | Cận vệ thuê (guard, mua bằng Của, không cần huấn luyện) | Hợp đồng lính thuê: lính chuyên nghiệp tức thời |
| M5 Vương Quốc Chia Đôi | Hiệp sĩ đào ngũ (cavalry, tuyển từ phe bên kia) | Hòa giải: dập nổi dậy rẻ hơn |
| M6 Kẻ Bị Phản | Du kích (đánh úp, trinh sát, rẻ) | Nơi ẩn náu: nơi chạy trốn, phục hồi danh tiếng nhanh hơn |
| M7 Tàn Quốc (mặc định) | không có | Kinh nghiệm sống sót: giá bản vẽ ở Chợ giảm 20% |
| M8 Đô Thành Tri Thức | Kỹ sư chiến trường (công thành nếu game có; không thì y sĩ chiến trường) | Nghiên cứu nhanh và rẻ (đã ghi ở M8) |

Ngọn Đồ đá: chỉ mỗi Ngọn cho 1 perk nhỏ ở đầu trung cổ (không đơn vị, không công trình). Điền ở Phase 5 theo bảng Ngọn Đồ đá trong `story_tree.md`.

### A4. Dữ liệu và engine

- File mới `src/data/story/unlocks.json` (KHÔNG đặt tên `legacy`, tên đó đã dùng cho "Chuyện cũ"). Mỗi mục: `key`, `kind` (unit | building | perk | research), `from` (danh sách `fruit:TMx` hoặc `tip:Mx`), `sources` (story | blueprint | library), `blueprintCost`, `core: false`.
- Hàm duy nhất `isUnlocked(key)`: đúng nếu `from` đã nổ trong trạng thái truyện (đã được lưu), HOẶC `key` nằm trong `SAVED.unlocksBought` (bản vẽ hoặc Thư Viện Di Sản). Không tạo trạng thái mới nào khác.
- `unlocksBought: string[]` là field mới trong `SAVED`: gộp vào ĐÚNG MỘT lần tăng `SAVE_VERSION` và một migration đã có ở Phase 1, không bump lần hai.
- Cổng kiểm tra: màn huấn luyện, `construction.ts` (danh sách xây được), cây nghiên cứu, cửa hàng Chợ. Mỗi cổng dùng `isUnlocked`, không rải điều kiện riêng.
- Kẻ địch dùng chuyên không cần mở khóa (cần chuyên nào thì có chuyên đó).
- Mô phỏng: `tools/simStory.mjs` in thêm dòng "Di sản" cho mỗi ván.

### A5. Kiểm tra bắt buộc thêm vào `checkStory`

- Không mục `unlocks.json` nào có `core: true` hoặc trỏ tới khóa lõi.
- Mỗi Trái có đúng 1 mục mở; mỗi Ngọn (trừ M7) có đúng 1 đơn vị và 1 quyền năng; M7 chỉ có quyền năng.
- Mọi mục có ít nhất một nguồn thực sự đạt được (story hoặc blueprint).
- Test đơn vị: với `unlocksBought` rỗng và không cờ truyện nào, vẫn huấn luyện được 4 binh chủng hạng 4 đến 10 và xây được mọi công trình lõi.
- Mô phỏng 200 seed: in tỷ lệ seed mở được từng chữ ký bằng truyện. Cảnh báo nếu chữ ký nào dưới 5% hoặc trên 60%.

---

## PHẦN B. SỬA PROMPT CŨ (ghi đè đúng các chỗ này)

1. **Mục 2E, dòng "Cốt truyện không mở khóa lính."** thay bằng: "Cốt truyện chỉ mở chuyên theo `docs/UPDATE_di_san_mo_khoa.md`, không bao giờ mở lõi."
2. **Mục 2B (cận vệ, sát thủ):** giữ nguyên; thêm: sát thủ người chơi huấn luyện được chỉ khi có chữ ký M3; cận vệ thuê chỉ khi M4 hoặc mua bản vẽ. Nhiệm vụ phụ vẫn là đường chính để dùng sát thủ.
3. **Phase 0:** thêm vào `PLAN.md` mục "Chạm logic cũ" bốn cổng ở A4 và danh sách 7 đơn vị chuyên với chỉ số đề xuất; thêm vào lần AskUserQuestion duy nhất: giá bản vẽ cơ sở, vai trò M8 (công thành hay y sĩ), có làm đường "chiếm làng lấy bản vẽ" không.
4. **Phase 1:** thêm `unlocks.json` rỗng có schema, `isUnlocked`, `unlocksBought` (cùng migration), các kiểm tra A5.
5. **Phase 2:** tạo 7 preset đơn vị chuyên, mặc định khóa (`unlockedBy`), có chỉ số theo A1.8.
6. **Phase 3:** tạo 10 công trình chuyên bằng `art-derive` từ kind gốc, mặc định khóa.
7. **Phase 4:** nối bản vẽ vào Chợ và nhiệm vụ phụ "mua bản vẽ" (thưởng một bản vẽ ngẫu nhiên, vẫn độc lập với cốt truyện).
8. **Phase 5:** điền `unlocks.json` theo A2 và A3, perk Ngọn Đồ đá, màn Nhật ký > Di sản, in bảng tỷ lệ chữ ký trong báo cáo.
9. **Mục 3 (quyết định đã chốt):** thêm "Mở khóa phụ theo Trái và Ngọn: chỉ chuyên, lõi luôn mở, M1 là đường sở hữu toàn bộ, có đường bù bằng bản vẽ."
