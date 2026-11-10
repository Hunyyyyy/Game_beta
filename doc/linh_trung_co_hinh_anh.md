# Lính thời Trung cổ: hình và động tác (Đợt 1 cấp 1, Đợt 2 cấp 2, Đợt 3 cấp 3)

Hình và động tác của ba lính cấp 1, **đã nối vào game, chỉ ở thời Trung cổ** (thời Đá giữ nguyên). Lính trông theo đồ họ mang: kiếm thẳng (`arming_sword`, có khiên), cung ghép (`composite_bow`), giáo kỵ binh (`lance`) và giáp `footman`, `archer`, `rider` (đều bậc 4, khai ở `weapons.json`). Chưa có công thức chế tạo: hiện có qua nút dev "Đầy quân + đồ cao nhất + đuốc" hoặc "Tập hợp quân đầy ô" (ở thời Trung cổ hai nút này phát bộ đồ mới). Kỵ binh của Trại kỵ thú cưỡi **ngựa** (`horse` trong `mounts.json`) từ cấp trại 4 trở lên, tức các cấp Trung cổ.

## Đợt 2: bậc 2 (đã vẽ, chưa luyện được trong game)
| Lính | Giáp | Cầm | Ghi chú |
|---|---|---|---|
| Hộ vệ hoàng gia | `armors/guard` (giáp tấm toàn thân, mũ kín có chùm lông xanh, đai vàng) | đại kiếm `greatsword` + khiên tháp `shields/tower` (đã bỏ búa chiến cho bậc này; hình búa `warhammer` vẫn còn trong `handtools` để dành) | dùng lại động tác `shield_*` |
| Cung tiễn hoàng gia | `armors/marksman` (brigandine đỏ sẫm đóng đinh, mũ sắt hở mặt có vành, bao tên) | trường cung `longbow` | dùng lại động tác `shoot_*` |
| Kỵ binh hoàng gia | `armors/royalrider` (giáp tấm, áo choàng xanh, mũ kín có chùm lông) | trường thương `heavy_lance` | ngựa bọc giáp `horse_armored` (giáp thân, cổ, đầu, vải phủ xanh viền vàng), cả hướng trước và sau; dùng lại `rider_*` |

Dữ liệu: `weapons.json` (rank 5), `ranks.json` (bậc 5, `soon`), `mounts.json` (`warhorse`), `bodies.json` (`horse_armored`), `medieval_units.json` (ba lính, xem ở trang xem trước). Bậc 5 chưa có công thức chế đồ nên chỉ có qua dev.

## Đợt 3: bậc 3 (đã vẽ, chưa luyện được trong game)
Tên và dáng theo danh sách đầu, **không hiệu ứng sáng hay phép**: giáp tấm trắng ngà viền vàng.

| Lính | Giáp | Cầm | Ghi chú |
|---|---|---|---|
| Dũng sĩ thánh giáo | `armors/templar` (giáp tấm trắng ngà, mũ kín đỉnh phẳng, áo choàng trắng chữ thập đỏ) | kiếm thánh giáo `knight_sword` + khiên `shields/aegis` (trắng, viền vàng, chữ thập đỏ) | động tác `shield_*` |
| Lính bắn tỉa | `armors/sniper` (mũ sallet có đuôi che gáy, áo da xanh sẫm cổ xích, bao tên) | **nỏ hợp kim** `alloy_crossbow` (báng gỗ sẫm, cánh thép đầu vàng) | động tác mới `xbow_*`: mang nỏ, ngắm, bắn giật, hạ nỏ, lên dây, nâng lại |
| Thánh kỵ sĩ | `armors/paladin` (giáp tấm trắng ngà, mũ có chùm lông trắng, áo choàng chữ thập đỏ) | thương `paladin_lance` (cán trắng, cờ chữ thập đỏ) | ngựa `horse_silver` (trắng, giáp bạc, vải phủ trắng viền vàng), cả hướng trước và sau; thú cưỡi `silverhorse` |

Dữ liệu: `weapons.json` (rank 6), `ranks.json` (bậc 6, `soon`), `mounts.json` (`silverhorse`), `bodies.json` (`horse_silver`), `medieval_units.json` (ba lính).

## Xem
`npm run viewer`, rồi mở `dist/medieval-viewer.html`. Trang chạy lặp 5 động tác (đứng yên, đi bộ, chạy bộ, tấn công, phòng thủ) cho từng lính, có chỉnh cỡ, tốc độ, quay trái, nền. Ô "Đòn thay thế" cho kỵ binh chém kiếm thay vì đâm giáo.

Xem nhanh một bảng ảnh PNG, không cần trình duyệt: `node tools/art-preview.mjs <spec.json> <ra.png>`. Spec là `{ "scale": 4, "rows": [ { "anim": "shield_run", "tool": { "tier": 4, "shield": "heater" }, "armor": "footman" } ] }`; một hàng có thể thêm `mount` (loài thú, clip, gear), `lift`, `dx` để cho người ngồi lên thú.

## Các lính (src/data/medieval_units.json)
| Lính | Giáp | Cầm | Động tác |
|---|---|---|---|
| Bộ binh | `armors/footman` (mũ sắt có sống mũi, áo giáp xích, áo choàng đỏ, ủng da) | kiếm `arming_sword` + khiên `shields/heater` | `shield_idle/walk/run/guard/charge/attack` |
| Cung thủ | `armors/archer` (mũ trùm, áo da, bao tên sau lưng) | cung `composite_bow` | `shoot_idle/walk/guard/charge/attack` có sẵn + `shoot_run` mới |
| Kỵ binh | `armors/rider` (mũ sắt, da bọc đinh, kiếm ngắn đeo hông) | giáo `lance`, kiếm `shortsword` | `rider_idle/walk/run/guard/charge/attack` (đâm) và `rider_slash` (chém) |

Ngựa: loài `horse` trong `animals/bodies.json` (thân `horse`, động tác ở `animals/anims/horse.json`), yên cương (yên, chăn, dây ngực, dây cương) khai trong `gear`.

## Cái gì đổi trong bộ vẽ
- **Khiên (tay trái):** `src/data/shields/*.json`, vẽ bằng chuỗi ký tự; khung động tác bật bằng `"shield": { "on": true, "pose": "rest|guard", "dx", "dy" }`; chọn khiên qua `tool.shield`.
- **Giáp vẽ bằng chuỗi ký tự:** một lớp giáp có thể là `{ ox, oy, legend, rows }`; thêm lớp `back` (sau lưng, như bao tên) và `over` (trên thân, như vỏ kiếm).
- **Giáp phủ cả chi:** `wraps.arm.full` (tay áo, găng) và `legs` (quần, ủng) trong file giáp.
- **Bậc dụng cụ mới:** `handtools/tiers.json` có thêm 4 sắt, 5 thép, 6 thánh.
- **Ngựa:** `animal-rig.js` thêm kiểu `horse` (bờm, đuôi, móng, chân hai đoạn) và yên cương `gear` (cả giáp ngựa `plate` cho cấp sau).

## Cái gì đổi trong game
- `weapons.json`: kiểu `sword_shield` và `rider_lance`, ba vũ khí và ba giáp mới (có trường `shield`).
- `mounts.json` và `jobs.ts`: loài `horse`; Trại kỵ thú cấp 4 trở lên cưỡi ngựa (trước là voi); `dx` là độ lệch chỗ ngồi.
- `renderer.ts`: lính cưỡi dùng động tác ngồi `rider_*` khi đánh và lao (ngựa phi khi `rider_charge`). Khi đi lên hoặc xuống màn hình, ngựa và người ngồi được vẽ nhìn từ phía trước hoặc phía sau (`views` của loài `horse` trong `bodies.json`, hai lớp: phần sau lưng người và phần đè lên người như đầu, cổ hoặc mông). Sói, heo, voi vẫn chỉ có hướng bên hông. Giáp kỵ binh nhuộm xanh xám để nổi trên ngựa nâu.
- `movement.ts`, `model.ts`, `sprites.ts`: khiên đi theo vũ khí trong `Hold`.

## Hướng nhìn trước và sau
Vũ khí cầm tay giờ cũng vẽ ở hướng nhìn thẳng và nhìn từ sau (`drawToolFacing` trong `rig.js`): hình bên hông được ép lại, chiều ngang giữ nguyên, chiều dài chỉ còn phần đứng thẳng (giáo giơ lên là một đường dài, giáo chĩa vào người xem chỉ thấy mũi). Nhìn từ sau, thứ cầm chĩa ra phía trước thì bị thân che. Khiên nhìn từ sau là mặt lưng trơn (`restBack`, `guardBack`).

## Chưa làm
- Công thức chế tạo, vật liệu (quặng sắt, thỏi sắt...), nghiên cứu mở khóa, và chỉ số của khiên (hiện chỉ để vẽ).
- Thử trong game thật: chỉ kiểm bằng dữ liệu và xem trước.
- Cấp 2 và cấp 3 (giáp tấm, hiệu ứng sáng của thánh kỵ sĩ).
