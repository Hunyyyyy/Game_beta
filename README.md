# Làng Đồ Đá — M2.2 (nghề, tài nguyên, công cụ, Xưởng chế tác)

Game xây làng / RTS thời đồ đá, chạy trên trình duyệt. M1 có bản đồ, sương mù, chọn và ra lệnh. M2 thêm kinh tế: dân đốn gỗ, đục đá, hái quả, dựng Kho, biết đói và đi ăn. Mọi vật thể trên bản đồ (cỏ, bùn, nước, cây, đá, bụi quả, gốc cây, đống lửa, Kho, Xưởng chế tác, biểu tượng công cụ) được vẽ từ **bản vẽ JSON** trong `src/data/blueprints/`.

## Chạy

```bash
npm install
npm run build      # tạo dist/index.html (tệp chạy độc lập, mở thẳng bằng trình duyệt)
npm run typecheck  # kiểm tra kiểu
npm run test:sim   # kiểm thử lõi mô phỏng (không cần trình duyệt)
```

Thêm `?seed=123` vào địa chỉ để sinh bản đồ khác.

## Cách chơi

- Chuột trái kéo khung: chọn dân (Shift để thêm).
- Chuột phải lên **cây** → đốn gỗ · lên **đá** → thợ đá · lên **bụi quả** → hái lượm · lên **nền Kho** → thợ xây · lên đất trống → đi tới đó (và thôi làm nghề).
- Hoặc dùng nút nghề trong bảng dân: Rảnh / Đốn gỗ / Thợ đá / Hái lượm / Thợ xây.
- **Xây Kho** (nút hoặc phím B, 10 gỗ): rê chuột chọn chỗ xanh, bấm trái để đặt. Dân đang chọn tự nhận việc xây.
- **Xây Xưởng** (phím X, 15 gỗ) rồi giao một dân làm **Thợ thủ công** (hoặc chuột phải lên Xưởng). Mở bảng **Chế tác** (phím C) để xếp đơn rìu, cuốc chim, cuốc, búa bậc gỗ hoặc đá.
- Dân đốn gỗ, thợ đá, hái lượm, thợ xây tự tới Xưởng nhận công cụ tốt hơn thứ đang cầm.
- P: tạm dừng · 1 2 3: tốc độ 1× 2× 4× · W A S D: camera · lăn chuột hoặc + −: thu phóng.

## Luật M2

| Thứ | Giá trị |
|---|---|
| 1 ngày game | 240 giây (4 phút) |
| Tốc độ đi | 1,6 + 0,1 × Nhanh nhẹn (ô/giây) |
| Tốc độ làm | (0,5 + 0,1 × chỉ số chính) × (1 + 0,2 × cấp), ×0,7 khi đói dưới 25 |
| Chỉ số chính | Gỗ, Đá: Sức mạnh · Thức ăn: Nhanh nhẹn · Xây: Thể lực |
| Thời gian cho 1 đơn vị (hệ số 1) | Gỗ 12 giây · Đá 18 giây · Quả 20 giây |
| Sức mang | 4 gỗ hoặc đá · 10 thức ăn |
| Nguồn | Cây 10 gỗ (cạn thì để lại gốc) · đá 14 · bụi quả 6, mọc lại sau 240 giây |
| Nhà chung | dựng sẵn, chứa 50 mỗi loại |
| Kho | 10 gỗ, 20 giây (hệ số 1), chứa 100 mỗi loại; 4 giai đoạn xây |
| Đói | no tụt 100 mỗi ngày; dưới 50 thì ăn 2 thức ăn (hồi 50); hết ăn thì chết sau khoảng 1,5 ngày |
| Công cụ | Rìu → đốn gỗ · Cuốc chim → đục đá · Cuốc → hái lượm · Búa → xây |
| Bậc công cụ | Tay không: tốc độ ×0,6, sản lượng ×1 · Gỗ: ×1, ×1,25 · Đá: ×1,4, ×1,6 |
| Độ bền | Gỗ 240 giây làm việc, đá 600 giây, hết thì gãy |
| Công thức gỗ | Rìu 3 gỗ (12 giây) · Cuốc chim 4 gỗ (14) · Cuốc 3 gỗ (12) · Búa 3 gỗ (12) |
| Công thức đá | Rìu 2 gỗ + 3 đá (20) · Cuốc chim 2 gỗ + 4 đá (22) · Cuốc 2 gỗ + 2 đá (18) · Búa 2 gỗ + 3 đá (18) |
| Xưởng chế tác | 15 gỗ, 30 giây (hệ số 1); thợ thủ công làm theo Trí tuệ; nguyên liệu trừ khi thợ nhận đơn, hoàn lại nếu bỏ giữa chừng |
| Cấp nghề | 0–5, mỗi nghề có tiềm năng 1–3 sao quyết định tốc độ lên cấp |

Mỗi dân có 5 chỉ số ngẫu nhiên 3–10 (Sức khỏe, Sức mạnh, Nhanh nhẹn, Trí tuệ, Thể lực). Hiện Sức khỏe và Trí tuệ chưa tác động tới nghề nào.

## Chỗ đứng khi tương tác

Đi lại dùng đủ 4 hướng, nhưng mọi tương tác (đốn gỗ, đục đá, hái, cuốc, xây, chế tác, dỡ hàng, lấy công cụ) luôn ở dạng nhìn ngang. Mỗi cây, đá, bụi quả có 2 chỗ đứng: bên trái và bên phải, cùng hàng với gốc, cách tâm 0,5–0,6 ô. Mỗi công trình cũng có chỗ đứng ở hai bên mép dưới.

Dân đi tới một ô tiếp cận rồi trượt vào chỗ đứng. Ô tiếp cận ưu tiên: ngay cạnh, chéo dưới, chéo trên, rồi chính giữa dưới/trên. Vì thế cây nằm giữa hai cây khác vẫn chặt được miễn còn một ô trống nào quanh nó; hai dân cùng cây thì mỗi người một bên. Cây bị vây kín cả 8 ô thì không ai giữ chỗ, dân báo không có đường và chuyển sang cây khác.

## Giản lược có chủ ý

- Công cụ cũ bị bỏ lại khi nhận công cụ mới, không trả về kho.
- Búa dùng cho Thợ xây (có búa thì xây nhanh hơn, tay không thì chậm); thợ thủ công luôn dùng búa đá, không cần; chưa có nghề nông nên cuốc chỉ phục vụ hái lượm, đào củ.

- Kho chứa theo tổng: mọi công trình đã xong cộng lại thành một sức chứa chung cho mỗi loại.
- Chi phí trừ ngay khi đặt nền; chưa có hủy nền để hoàn trả.
- Dân ăn thẳng từ kho, không đi tới kho; thức ăn chưa hư.
- Chưa có mùa, sợi, củi, hay sinh thêm dân.
- Bùn chỉ là đất ven nước (không làm chậm), bụi quả chỉ là nguồn thức ăn.

## Cấu trúc

```
src/
  sim/            Lõi mô phỏng thuần TypeScript, không đụng DOM
    constants.ts  Ô, bản đồ, tầm nhìn, độ dài ngày
    resources.ts  Gỗ, đá, thức ăn, sức mang
    jobs.ts       Nghề, chỉ số chính, kinh nghiệm
    buildings.ts  Nhà chung, Kho
    world.ts      Sinh bản đồ, nguồn tài nguyên, bụi mọc lại
    fog.ts        Sương mù
    path.ts       A* 8 hướng
    tools.ts      Công cụ, bậc chất lượng, công thức chế tác
    sim.ts        Dân, AI nghề, kho, xây dựng, chế tác, đói, lệnh
  blueprint/      Bộ vẽ JSON (engine.js) và cầu nối TypeScript
  data/blueprints/  Bản vẽ JSON: grass, mud, water, tree_round, tree_pine, rock, bush, stump, campfire, storage, workshop, tool_axe, tool_pick, tool_hoe, tool_hammer
  data/anims.json   Hoạt ảnh dân: idle, walk, carry_walk, chop, mine, dig, gather, build, craft
  data/anims/*.json Mỗi hoạt ảnh một file, dán thẳng vào trang demo dân được
  character/rig.js  Vẽ dân bằng code
  render/         Vẽ đất, vật thể xếp theo y, ban đêm, sương mù
  ui/controller.ts  Chuột, bàn phím, đặt công trình
  main.ts         HUD, bảng dân, bản đồ nhỏ
  styles/         Giao diện viết bằng SCSS: main.scss gọi các phần (tokens, base, hud, panels, war, overlays, compact); `npm run build` biên dịch rồi nhúng vào dist/index.html
test/             sim.test.ts (lõi), ui.cjs, tools.cjs và mobile.cjs (Playwright)
```

Giao diện: sửa `src/styles/*.scss` (không viết CSS trong `index.html`). Bo góc và màu cố định nằm ở `_tokens.scss`, kiểu dùng lại ở `_mixins.scss`. Hai trang xem thử trong `tools/` có SCSS riêng ở `tools/styles/`, build bằng `npm run viewer`.

Sửa một bản vẽ trong `src/data/blueprints/*.json` rồi build lại là hình trong game đổi theo. Có thể dán JSON vào trang "Bản vẽ vật thể" để xem trước.

## Việc tiếp theo (M3)

Sợi và củi, mùa và thức ăn hư, thêm dân (sinh nở), nhà ở, săn bắn, ruộng hạt (dùng cuốc), mùa đông.
