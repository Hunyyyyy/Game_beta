# Kiến trúc mô phỏng (`src/sim`)

Mô phỏng là TypeScript thuần: không đụng DOM, không biết giao diện, chạy theo bước cố định (`TICK`) và theo seed.
Mục tiêu của cách chia này: **sửa một hệ thống không làm hỏng hệ thống khác**, và sau này đổi nơi lưu hay đổi engine thì chỉ thay một lớp.

## Các lớp

```
        ui / render / main            chỉ gọi Sim (cửa duy nhất), không import hệ thống nào
              │
            sim.ts   ← lõi: trạng thái + vòng lặp + cửa ngõ (facade)
              │
   ┌──────────┼───────────────┐
 hệ thống   hệ thống        dev.ts
 làng       sinh vật        (công cụ thử)
   │           │
   └─────┬─────┘
       dữ liệu & luật thuần (không biết Sim)
```

| Lớp | Tệp | Việc |
|---|---|---|
| **Dữ liệu và luật thuần** | `constants` `resources` `rng` `calendar` `buildings` `jobs` `tools` `combat` `research` `world` `fog` `path` `model` | Bảng số, kiểu dữ liệu, hàm thuần. Không import `Sim`, không có trạng thái của ván chơi. Số liệu chính nằm ở `src/data/*.json`. |
| **Hệ thống làng** | `construction` `economy` `works` `houses` `inventory` `commands` `labor` `movement` `villagers` `environment` | Hành vi. Mỗi hàm nhận `sim` làm tham số đầu. |
| **Hệ thống sinh vật** | `battle` `fauna` `tribes` | Chiến đấu, thú, bộ tộc. Cùng kiểu hàm nhận `sim`. |
| **Lưu game** | `codec` (dữ liệu), `save` | `save.ts` đổi `Sim` thành JSON thuần có số phiên bản và ngược lại; `codec.ts` lo `Map`/`Set`/số vô cực và nén chuỗi lặp. Không biết nơi lưu. |
| **Lõi** | `sim.ts` | Giữ toàn bộ trạng thái, chạy `advance`/`tick`, và có một hàm chuyển tiếp cho mỗi thao tác công khai. |
| **Công cụ thử** | `dev.ts` | Menu Dev. Chỉ dùng trong lúc phát triển. |

## Từng hệ thống làm gì

| Tệp | Trách nhiệm | Ví dụ hàm |
|---|---|---|
| `construction` | Đặt, nâng cấp, dời, phá công trình; công trình cho làng thứ gì (chỗ chứa, dân tối đa, tốc độ xây) | `placeBuilding` `upgradeBuilding` `buildingLock` `popCap` |
| `economy` | Kho chung: trả chi phí, đổi chác, thức ăn hỏng | `pay` `barter` `syncFood` |
| `works` | Hàng đợi và tiến độ của nhà nghiên cứu, chế tạo, sửa chữa | `queueResearch` `queueCraft` `tickWorks` |
| `houses` | Ai làm việc ở nhà nào: đội thợ xây và người trong nhà | `assignCrew` `assignStaff` `releaseStaff` |
| `inventory` | Công cụ, vũ khí, giáp: phát, hao mòn, trả kho, lấy, đặt chế | `assignTool` `repairTool` `assignGear` `planTool` |
| `commands` | Lệnh của người chơi: đi, làm, đánh, giữ chỗ, đổi nghề | `orderMove` `orderWork` `setJob` |
| `labor` | Việc hằng ngày: thu hoạch, mang vác, xây; máy trạng thái của dân | `think` `doWork` `planBuild` |
| `movement` | Đi lại: đường đi, bước chân, chỗ đứng, tư thế vẽ | `pathTo` `moveUnit` `animate` |
| `villagers` | Tạo dân và một ngày của dân: đói, máu, ngủ | `makeVillager` `tickVillager` |
| `environment` | Đồng hồ, mùa, thời tiết, tầm nhìn | `tickCalendar` `refreshFog` |

## Quy tắc (có kiểm tra tự động: `npm run test:arch`)

1. Hệ thống làng **không import hệ thống làng khác**. Cần việc của hệ thống khác thì gọi qua `sim.tênHàm(...)`. Nhờ vậy không có vòng phụ thuộc và biết ngay một thay đổi chạm tới đâu.
2. Hệ thống chỉ `import type { Sim }`, không import `Sim` như giá trị.
3. Lớp dữ liệu không biết `Sim`. Hàm nào cần trạng thái ván chơi thì không thuộc lớp này.
4. `src/sim` không đụng giao diện hay trình duyệt (`document`, `window`, `localStorage`…).
5. `ui`, `render`, `main` chỉ dùng `Sim`. Không import trực tiếp một hệ thống.
6. Không tệp nào trong `src/sim` quá 650 dòng. Quá thì tách tiếp.

## Thêm một tính năng

1. Số liệu mới → `src/data/*.json` hoặc bảng trong lớp dữ liệu.
2. Hành vi mới → hàm trong hệ thống phù hợp (bảng trên). Chưa có hệ thống phù hợp thì thêm tệp mới, rồi khai báo nó trong `test/architecture.cjs` và bảng này.
3. Muốn giao diện hoặc test gọi được → thêm một dòng chuyển tiếp trong `sim.ts` (`/** → houses.assignCrew */`).
4. Trạng thái mới của ván chơi → thêm trường vào `Sim` (hoặc vào kiểu trong `model.ts`) và nhớ phần lưu game (xem dưới).
5. Viết test trong `test/sim.test.ts` cho luật mới.

## Lưu game

```
 sim.toSave() / Sim.fromSave()     (src/sim/save.ts: định dạng JSON, có version, có hàm nâng cấp bản cũ)
        │
   Session (src/save/session.ts)   tự lưu đầu mỗi ngày, lưu theo yêu cầu, tiếp tục ván cũ
        │
   SaveStore (src/save/store.ts)   list / load / save / remove: giao diện duy nhất tới nơi lưu
        │
   adapter: IndexedDbStore (trình duyệt) · MemoryStore (test) · sau này: tệp, máy chủ, cầu nối Unity
```

- `sim` chỉ biết `toSave()` và `fromSave()`; không biết adapter nào được cắm. `src/sim` không được import `src/save`.
- **Cài đặt** (tốc độ, lời nhắc xoay ngang) ở `src/save/settings.ts`, tách khỏi bản lưu.
- Địa hình lưu nguyên (nén theo đoạn lặp) chứ không lưu "khác biệt so với bộ sinh bản đồ", để đổi bộ sinh sau này không làm đổi ván cũ.
- **Đổi định dạng:** tăng `SAVE_VERSION`, thêm `MIGRATIONS[phiênBảnCũ]` trong `save.ts`. Bản lưu cũ được nâng từng bậc khi tải.
- **Thêm trạng thái mới vào `Sim`:** phải ghi nó vào `SAVED` hoặc `NOT_SAVED` trong `save.ts`. Test `every field of Sim is saved…` sẽ đỏ nếu quên.
- Test chính: lưu → tải → chạy tiếp 25 phút game phải ra **đúng từng byte** như ván chạy liền (`test/sim.test.ts`).
- Bản lưu là hợp đồng với phía Unity/C# sau này: cùng một JSON, cùng `src/data/*.json`.

## Trạng thái

Mọi thứ thay đổi trong ván chơi nằm trong đối tượng `Sim`. Không tệp nào giữ biến `let` ở cấp tệp (test kiểm tra): trạng thái giấu ngoài `Sim` sẽ lọt khỏi bản lưu và làm hai ván chơi trong cùng một tiến trình ảnh hưởng nhau (đã từng xảy ra với `tribeClock`).
Bộ sinh số ngẫu nhiên là `Rng` (`rng.ts`), đọc và đặt lại được vị trí; dùng `sim.rnd`, `sim.frnd`, `sim.wrnd`, đừng tạo bộ sinh riêng cho thứ thay đổi theo ván.
