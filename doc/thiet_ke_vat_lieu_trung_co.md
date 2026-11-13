# Thiết kế: vật liệu, công trình và công thức thời Trung cổ

**Trạng thái:** bước 1 đã làm: 12 vật liệu mới đã có trong `src/content/resources.json` (kèm biểu tượng ở `src/ui/resicons.ts`), chỉ hiện khi làng có (kho và đổi chác ẩn hàng chưa có). Chưa có cách kiếm được chúng (mỏ, lò, xưởng chưa làm). Tiền thời Trung cổ là "Đồng xu" đã có sẵn trong `CURRENCY`. **Đợt 1 của bước 3 đã làm (2026-11-11):** Lò luyện, Xưởng mộc, Xưởng thuộc da và dệt (mỗi nhà 3 cấp, mỗi cấp một hình dáng khác: lò đắp đất / sân rèn lò gạch / lò cao; bãi đốt than và cưa hố / nhà gỗ khung lộ / xưởng cưa nước; bãi hố thuộc da / nhà tranh và gác phơi / xưởng nhuộm) đã có (`src/content/buildings/{smelter,carpentry,tannery}/`, hình A1 đến A3, công thức trong `src/data/processing.json`, hệ thống `src/sim/processing.ts`, trang "Chế biến" ở bảng công trình); mở từ thời Trung cổ, tặng 10 thỏi sắt và 10 than khi vào Trung cổ. Giao diện chế biến của ba nhà (`src/ui/forgepane.ts`) bố trí như lò rèn: danh sách công thức bên trái, ô nguyên liệu (đỏ khi thiếu) → mũi tên thời gian → ô sản phẩm, nút +1, +5, Tối đa, hàng đợi dạng thẻ có nút huỷ, và thanh tiến độ của đơn đang chạy ở đầu bảng. **Bước 2 đã làm (2026-11-12):** công trình Mỏ (3 cấp: hầm chống gỗ, hầm xây đá, mỏ có tháp tời; 3, 5, 8 chỗ; hình `src/content/buildings/mine/A1..A3`), nghề `mine`, ô quặng sắt và than ở chân núi (`Tile.Ore`, hình `ore_iron.json` và `ore_coal.json`); quặng đầm lầy và quặng hiếm ở núi xa chưa làm. **Bước 4 đã làm (2026-11-12):** Trại chăn nuôi (3 cấp, 2, 4, 6 chỗ; da và sợi từ cấp 1, gân từ cấp 2, lông vũ từ cấp 3; số liệu ở `src/data/ranch.json`; nghề `herd`; hình `src/content/buildings/ranch/A1..A3`, không vẽ vật nuôi) và nút đổi cây trồng của Ruộng (thức ăn hoặc lanh, lanh cho sợi, chỉ từ thời Trung cổ). **Bước 5 đã làm (2026-11-12), theo số bậc của `ranks.json` (bậc 4 là lính đồng, bậc 5 là lính sắt; "bậc 4, 5, 6" của bảng mục 6 ở trên là bậc 5, 6, 7 của `ranks.json`):** thêm **quặng đồng** (ô quặng thứ ba ở chân núi, 25%) và **thỏi đồng** (Lò luyện cấp 1: 3 quặng đồng + 1 than); công thức chế tạo, giá và thời gian của đồ bậc 4 (kiếm, giáo, cung, giáp đồng) và bậc 5 (kiếm thẳng kèm khiên, cung ghép, giáo kỵ binh, giáo ngắn, giáp xích, giáp da cung thủ, giáp da bọc đinh, giáp tuần đinh) nằm trong `weapons.json` (`cost`, `time`), cần Nhà chế tạo **cấp bằng cấp của đồ**: cấp 4 chế đồ đồng (bậc 4) và công cụ đồng, cấp 5 chế đồ bậc 5 (sắt) và công cụ sắt, cấp 6 chế công cụ thép (`recipeLevel`; hiện Nhà chế tạo mới có đến cấp 4 nên đồ bậc 5 trở lên chưa chế được cho tới khi có cấp 5, 6); đã bỏ `soon` của bậc 4 và 5 trong `ranks.json` nên luyện được ở trại (nghiên cứu mở bậc đã có sẵn). Hình biểu tượng ở `src/data/blueprints/medieval/tools/`. Vũ khí và giáp của bậc 4 trở lên chỉ lính của bậc đó lấy từ kho (thợ săn và dân không lấy). Quặng bạc và vàng đã vẽ (`ore_silver.json`, `ore_gold.json`) nhưng chưa có cơ chế sinh ra hay khai thác; quặng đồng cũng dành để làm tiền sau này. **Phần còn lại trước bậc 6 và 7 đã làm (2026-11-12):** quặng đầm lầy (mạch quặng sắt nhỏ trên ô bùn ven hồ, chứa một nửa, mọc lại chậm: `nodes.json` `swampRespawn`) và **quặng sắt hiếm** (ô quặng xanh ở chân núi xa hơn 70 ô: chỉ thợ của Mỏ **cấp 3** mới khai được); nhánh nghiên cứu: thợ mỏ nhận nghiên cứu Khai thác, người chăn nuôi nhận nghiên cứu Thuần thú (`researchtree.json`); giá nghiên cứu mở bậc 4 đến 7 đòi thêm vật liệu Trung cổ (đồng, sắt, thép, thép cao cấp, da thuộc, vải, gỗ cứng); giá luyện lính Trung cổ bằng đồng xu đặt lại (bộ binh, cung, gác: 20, 35, 60, 100; kỵ: 80, 130, 260, 500); Chợ mua bán quặng đồng và thỏi đồng (chỉ từ Trung cổ). Gỗ thủy tùng vẫn chỉ là hàng nhập (chưa có cơ chế nhập). **Công cụ và khai thác (2026-11-12):** công cụ có thêm bậc 3 đồng, 4 sắt, 5 thép cho rìu, cuốc chim, cuốc, búa (đồng ở Nhà chế tạo cấp 4, sắt cấp 5, thép cấp 6; tốc độ ×1,7, ×2, ×2,4; bền hơn). Mỗi quặng một thời gian đào (than 24 giây, quặng đồng 30, quặng sắt 32, quặng hiếm 54, ở tốc độ 1 với cuốc đủ bậc: `pace.json` `ore`); cuốc thấp hơn bậc của quặng vẫn khai được nhưng chậm hơn (mỗi bậc thiếu nhân tốc độ với 0,7), cuốc cao khai nhanh hơn kể cả quặng dễ. Mỗi thợ mỏ có các ô nhỏ chọn loại quặng mình khai (như chọn bậc ở trại lính). **Cây nghiên cứu Trung cổ (Nhà nghiên cứu cấp 4, 2026-11-12):** trụ Sinh kế và Kỹ nghệ có thêm hàng Trung cổ (mỗi hàng 3 chỉ số năm cấp, rồi một nghiên cứu lớn): Khai thác (cho cả thợ mỏ: kho lớn +30%, thợ mỏ lấy +15% quặng mỗi nhát và chạy nhanh +10%, mang nhiều hơn +60%), Săn (thịt +25%, da và lông +30%), Thuần thú (cho cả người chăn nuôi: trại cho thêm 20% rồi 25% sản phẩm), Xây dựng (xây rẻ 10% rồi 8%), Chế tạo (chế rẻ 10%, lò và xưởng làm nhanh 20%), Nghiên cứu (rẻ 10%). Chợ có thêm ba nghiên cứu (Thương lộ đường dài, Hội thợ rèn, Thương hội lớn: giá tốt hơn, nhiều hàng mỗi ngày hơn, nhiều lượt giá gốc, bớt phí) và hai nghiên cứu Trung cổ cũ chuyển sang cấp 4. Ba tác dụng mới: `mineYield`, `ranchYield`, `processSpeed`. Chi phí đòi sắt, gỗ cứng, da thuộc, vải. **Nhánh riêng cho các nhà mới** (trụ Sinh kế, chỉ hiện từ Trung cổ): Mỏ (cuốc chắc: +12% quặng; hầm có chống: đào nhanh +15%), Lò luyện, Xưởng mộc, Xưởng thuộc da và dệt (làm nhanh +15% rồi +20%), Trại chăn nuôi (+15% rồi +20% sản phẩm). **Nghiên cứu cuối của mỗi phần là +1 chỗ làm cho nhà đó** (Xưởng gỗ, Xưởng đá và Nông trại; Chòi thợ săn; Chuồng thú; Nhà thợ xây; Nhà chế tạo; Nhà nghiên cứu; Mỏ; Lò luyện; Xưởng mộc; Xưởng thuộc da và dệt; Trại chăn nuôi): rẻ nhất là chòi săn (~5500 giây, 300 đồng xu), đắt nhất là Nhà nghiên cứu (8000 giây, 600 đồng xu), mỏ 8500 giây; đều đòi sắt, và thép hoặc vải cho nhà lớn. Số chỗ cộng thêm tính ở một hàm duy nhất `sim.slotsOf(b)` (chỗ theo cấp cộng tác dụng `slots_<nhà>`). Chưa làm: bậc 6 và 7 (cần cấp 5, 6 của Nhà chế tạo và của các công trình cũ).

(Bản nháp ban đầu:) Chưa có dòng code nào theo bản này. Mọi số liệu là **đề xuất**, chỉnh sau bằng `src/data/*.json`, `src/content/` và `npm run economy`. Dựa trên: `doc/thiet_ke_bac_linh.md` (bậc lính), bảng trang bị lịch sử bạn đưa, và các quyết định: không có ma thuật, tiền là **đồng**, mỏ ở núi và đầm lầy, có công trình chăn nuôi, nhà chế tạo chỉ chế tạo.

## 0. Giá công trình (2026-11-12)
- Công trình của tài nguyên mới (Mỏ, Lò luyện, Xưởng mộc, Xưởng thuộc da, Trại chăn nuôi): **cấp 1 chỉ tốn vật liệu cũ** (gỗ, đá), đắt hơn trước khoảng ×1,5. **Cấp 2 và 3 đòi thêm vật liệu mới** (thỏi sắt, than, gỗ cứng; cấp 3 thêm thép, da thuộc, vải) và vật liệu cũ cũng tăng ×1,5.
- Công trình cũ lên **cấp 4 (Gạch ngói, trung cổ)** đòi thêm khoảng 10 đến 25 thỏi sắt và gỗ cứng; trại lính thêm da thuộc; Chòi canh và Cổng thêm thép. **Nhà chính giữ giá cũ**: nó là cửa vào thời Trung cổ (tặng 10 sắt, 10 than), đòi vật liệu trung cổ ở đó sẽ kẹt.
- Cấp 5 và 6 của công trình cũ làm sau, cùng bước 5 và 6 (cần thép, thép cao cấp). Số liệu nằm ở `levels.ancient[].cost` của từng `building.json`. Khi nâng cấp, bảng xác nhận liệt kê thêm chỗ làm, kho, tốc độ, công thức hoặc sản phẩm mới mở.

## 1. Nguyên tắc
- **Công trình khai thác giữ việc khai thác** (Xưởng gỗ, Xưởng đá, Chòi thợ săn không đổi). **Chế biến là công trình riêng.** **Nhà chế tạo chỉ chế tạo đồ.**
- Mỗi bậc là một bước tiến vật liệu: bậc 1 sắt, bậc 2 thép, bậc 3 thép cao cấp và hàng nhập.
- Đồ mềm (da, sợi, gân) từ **vật nuôi và ruộng**, không phải mỏ, đúng lịch sử.
- Hàng hiếm (quặng sắt hiếm, gỗ thủy tùng) là thứ **khó kiếm**: đi xa, đánh nhau, buôn bán.

## 2. Vật liệu mới (12)
Cột "HUD" dùng `whenOwned` như xương, mỡ: chỉ hiện khi đang có, nên thanh tài nguyên không rối.

| Id | Tên | Loại | Nguồn |
|---|---|---|---|
| `iron_ore` | Quặng sắt | thô | Mỏ ở chân núi; **quặng đầm lầy** ở ô bùn (ít, mọc lại chậm) |
| `coal` | Than | thô | Mỏ than ở chân núi; **đốt gỗ** ở Xưởng mộc (than củi) |
| `rare_ore` | Quặng sắt hiếm | thô | Mỏ ở **núi xa** (ngoài vùng làng, gần làng boss) |
| `fiber` | Sợi | thô | **Ruộng lanh**; len từ Trại chăn nuôi |
| `sinew` | Gân | thô | Trại chăn nuôi; thợ săn |
| `yew` | Gỗ thủy tùng | thô, hiếm | **Chỉ hàng nhập**: trao đổi, cống nạp, boss |
| `iron` | Thỏi sắt | chế biến | Lò luyện |
| `steel` | Thép | chế biến | Lò luyện |
| `fine_steel` | Thép cao cấp | chế biến | Lò luyện (cần quặng hiếm) |
| `leather` | Da thuộc | chế biến | Xưởng thuộc da và dệt |
| `cloth` | Vải | chế biến | Xưởng thuộc da và dệt |
| `hardwood` | Gỗ cứng | chế biến | Xưởng mộc |

Có sẵn, dùng lại: gỗ, đá, thức ăn, da, xương, mỡ, lông vũ (nay cũng từ Trại chăn nuôi), **tiền đồng** (xem mục 8).

## 3. Công trình mới
Cơ chế chung: mỗi công trình chế biến là một nhà có người làm và hàng đợi, nhận nguyên liệu, trả sản phẩm, công thức nằm trong dữ liệu của từng nhà (như Nhà chế tạo). Công trình mới đặt ở `src/content/buildings/<kind>/` và mở từ thời Trung cổ.

| Công trình | Việc | Cấp (chỗ làm) |
|---|---|---|
| **Mỏ** | Thợ mỏ ra mạch quặng khai thác: quặng sắt, than, quặng hiếm | 3 cấp (3, 5, 8). Cấp 3 mới ra tới núi xa |
| **Lò luyện** | Xem công thức dưới | 3 cấp (2, 3, 4): cấp 1 sắt, 2 thép, 3 thép cao cấp |
| **Xưởng mộc** | Gỗ → gỗ cứng; gỗ → than | 2 cấp |
| **Xưởng thuộc da và dệt** | Da → da thuộc; sợi → vải | 2 cấp |
| **Trại chăn nuôi** | **Có người làm thì tự sản xuất** (không cần vẽ thú): da, sợi (len), gân, lông vũ (ngỗng) | 3 cấp: cấp 1 da và sợi, cấp 2 thêm gân, cấp 3 thêm lông vũ |

Trại chăn nuôi: sản lượng mỗi ngày tỉ lệ số người và cấp, có **sức chứa** như các nhà sản xuất khác để khỏi tích vô hạn.
**Ruộng lanh:** thêm lựa chọn cây trồng cho Ruộng (thức ăn hoặc lanh), cho ra sợi.

## 4. Công thức chế biến (đề xuất)
| Nhà | Công thức | Thời gian |
|---|---|---|
| Lò luyện cấp 1 | 3 quặng sắt + 1 than → 1 thỏi sắt | 30 s |
| Lò luyện cấp 2 | 2 thỏi sắt + 1 than → 1 thép | 60 s |
| Lò luyện cấp 3 | 2 quặng hiếm + 2 than + 1 thỏi sắt → 1 thép cao cấp | 120 s |
| Xưởng mộc | 3 gỗ → 1 gỗ cứng | 40 s |
| Xưởng mộc | 4 gỗ → 1 than | 30 s |
| Xưởng thuộc da | 2 da → 1 da thuộc | 30 s |
| Xưởng thuộc da | 3 sợi → 1 vải | 30 s |

## 5. Mỏ trong thế giới
- **Ô quặng ở chân núi**: quặng sắt và than rải theo rìa núi, hiện khi đã khám phá. Ô cạn dần như ô đá.
- **Quặng đầm lầy:** ở ô bùn, **ít và mọc lại chậm** (đúng lịch sử), đủ cho bậc 1.
- **Quặng hiếm:** chỉ ở núi xa. Cần mỏ cấp 3 và đường tới đó (đánh nhau, mở rộng).
- Cần sửa phần sinh thế giới (`world.ts`) và cách vẽ ô mới.

## 6. Tên lính và trang bị theo bậc
**Tên bậc và loại trang bị theo danh sách đầu tiên của bạn** (Bộ binh, Hộ vệ hoàng gia, Dũng sĩ thánh giáo; Cung thủ, Cung tiễn hoàng gia, Lính bắn tỉa; Kỵ binh, Kỵ binh hoàng gia, Thánh kỵ sĩ). Bảng lịch sử chỉ cho **vật liệu**. Mọi phần "ma thuật" (phát sáng, phù văn, nước thánh, linh thú) **bỏ**: bậc 3 chỉ giữ tên và dáng (giáp tấm trắng ngà hoặc mạ bạc, không hiệu ứng), làm bằng **thép cao cấp**. Mỗi bậc một vũ khí để luyện (ranks.json), giáp và khiên là phần thêm.

| Bậc | Lính | Trang bị | Vật liệu (đề xuất) |
|---|---|---|---|
| 4 | **Bộ binh** | mũ cối sắt, giáp xích, găng da; kiếm thẳng (hoặc giáo ngắn); khiên gỗ bọc viền sắt (**đã vẽ**) | kiếm: 3 thỏi sắt. Giáp xích: 6 thỏi sắt, 2 da thuộc. Khiên: 2 gỗ cứng, 1 thỏi sắt, 1 da thuộc |
| 5 | **Hộ vệ hoàng gia** | giáp tấm toàn thân gia cố; đại kiếm hai tay hoặc búa chiến phá giáp; khiên tháp thép | đại kiếm: 4 thép, 1 gỗ cứng. Giáp tấm: 8 thép, 3 da thuộc, 2 vải. Khiên tháp: 3 thép, 2 gỗ cứng |
| 6 | **Dũng sĩ thánh giáo** | giáp tấm bất hoại; đại búa; khiên gia cường (không phép) | búa: 3 thép cao cấp, 2 gỗ cứng. Giáp: 10 thép cao cấp, 3 vải. Khiên: 4 thép cao cấp, 2 gỗ cứng |
| 4 | **Cung thủ** | giáp da nhẹ, bao tên đeo hông; cung ghép, dao găm; tên đầu sắt (**đã vẽ**) | cung: 2 gỗ cứng, 3 gân, 3 lông vũ, 1 thỏi sắt. Giáp da: 3 da thuộc, 1 vải |
| 5 | **Cung tiễn hoàng gia** | giáp da bọc thép (brigandine), mũ sắt hở mặt; trường cung hoặc nỏ nặng; tên xé giáp | cung: 1 thủy tùng, 2 gân. Nỏ: 2 thép, 2 gỗ cứng, 2 gân. Giáp: 4 da thuộc, 2 thép |
| 6 | **Lính bắn tỉa** | giáp da cao cấp hoặc xích nhẹ, mũ sắt nhẹ; trường cung thủy tùng nặng hoặc nỏ hợp kim | cung: 2 thủy tùng, 3 gân, 1 thép cao cấp. Nỏ: 3 thép cao cấp, 2 gỗ cứng, 2 gân. Giáp: 4 thỏi sắt, 3 da thuộc |
| 4 | **Kỵ binh** | giáp da bọc đinh, yên da, giáp da ngực ngựa; giáo đâm gỗ gia cường, kiếm ngắn (**đã vẽ**) | giáo: 2 thỏi sắt, 3 gỗ cứng. Giáp: 4 da thuộc, 2 thỏi sắt |
| 5 | **Kỵ binh hoàng gia** | giáp tấm đầy đủ có huy hiệu; trường thương, kiếm thép luyện; giáp ngựa toàn thân, yên mạ vàng | thương: 3 thép, 3 gỗ cứng. Giáp tấm: 8 thép, 3 da thuộc, 2 vải. Giáp ngựa: 6 thép, 3 da thuộc |
| 6 | **Thánh kỵ sĩ** | giáp thánh không gỉ; thương và kiếm thánh (bằng thép cao cấp, không phép); giáp ngựa mạ bạc | thương: 3 thép cao cấp, 3 gỗ cứng. Kiếm: 3 thép cao cấp. Giáp tấm: 10 thép cao cấp, 3 vải. Giáp ngựa: 8 thép cao cấp, 3 vải |

Cấp Nhà chế tạo cần: bậc 4 cấp 4, bậc 5 cấp 5, bậc 6 cấp 6 (cơ chế `recipeLevel` sẵn có). Lính luyện ở trại như bảng bậc lính, giá bằng **đồng**. Vì tên và trang bị theo danh sách đầu, **hình đã vẽ cho bậc 4 vẫn đúng** (bộ binh kiếm + khiên, cung ghép, kỵ giáo + kiếm ngắn); chỉ kỵ binh cần thêm khiên nhỏ nếu bạn muốn.

## 7. Thứ tự làm (mỗi bước build được)
1. **Vật liệu và dữ liệu:** 12 vật liệu mới vào `resources.json`; bảng công thức.
2. **Thế giới và mỏ:** ô quặng (núi, đầm lầy), công trình Mỏ, vai trò thợ mỏ.
3. **Cơ chế chế biến chung** + Lò luyện, Xưởng mộc, Xưởng thuộc da và dệt.
4. **Trại chăn nuôi** và Ruộng lanh.
5. **Công thức đồ bậc 4**, mở luyện bậc 4 (bỏ `soon`), đổi tên tiền thành đồng, đặt lại giá.
6. Bậc 5 và 6, hàng nhập (thủy tùng, quặng hiếm qua trao đổi và boss).

Bước 1 đến 5 đủ để chơi được ba lính cấp 1 Trung cổ đã vẽ.

## 8. Tiền đồng
Giữ **một tài nguyên tiền**, đổi tên và biểu tượng theo thời đại (vỏ sò thành đồng). Khi sang Trung cổ, tiền đang có đổi **1:1**. Đặt lại giá nghiên cứu, luyện lính, đổi chác cho Trung cổ (lớn hơn nhiều) và bảng đổi chác cho vật liệu mới.

## 9. Việc phải vẽ
Năm công trình mới (Mỏ, Lò luyện, Xưởng mộc, Xưởng thuộc da và dệt, Trại chăn nuôi), ô quặng (núi, bùn), biểu tượng 12 vật liệu. **Không vẽ vật nuôi.**

## 10. Chưa chốt
- Giá đồng thực tế và đổi chác (sau khi có khung).
- Sản lượng Trại chăn nuôi và hạn mức chứa.
- Cách cấp "bộ đồ khởi đầu" khi sang Trung cổ để người chơi không kẹt (ví dụ một ít thỏi sắt hoặc quặng).
- Bậc 5 và 6: nhiều món cần hình vẽ mới (rìu chiến cán dài, pike, nỏ, giáp tấm...).
