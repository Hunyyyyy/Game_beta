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
| **Dữ liệu và luật thuần** | `constants` `resources` `rng` `calendar` `buildings` `jobs` `tools` `combat` `research` `world` `fog` `path` `model` `formations` `statsys` `progression` | Bảng số, kiểu dữ liệu, hàm thuần. Không import `Sim`, không có trạng thái của ván chơi. Số liệu chính nằm ở `src/data/*.json`. |
| **Hệ thống làng** | `construction` `economy` `works` `houses` `inventory` `commands` `labor` `movement` `villagers` `environment` `notices` | Hành vi. Mỗi hàm nhận `sim` làm tham số đầu. |
| **Hệ thống sinh vật** | `battle` `fauna` `tribes` `army` `scouting` | Chiến đấu, thú, bộ tộc, đội và trận pháp, trinh sát. Cùng kiểu hàm nhận `sim`. |
| **Lưu game** | `codec` (dữ liệu), `save` | `save.ts` đổi `Sim` thành JSON thuần có số phiên bản và ngược lại; `codec.ts` lo `Map`/`Set`/số vô cực và nén chuỗi lặp. Không biết nơi lưu. |
| **Lõi** | `sim.ts` | Giữ toàn bộ trạng thái, chạy `advance`/`tick`, và có một hàm chuyển tiếp cho mỗi thao tác công khai. |
| **Công cụ thử** | `dev.ts` | Menu Dev. Chỉ dùng trong lúc phát triển. |

## Từng hệ thống làm gì

| Tệp | Trách nhiệm | Ví dụ hàm |
|---|---|---|
| `construction` | Đặt, nâng cấp, dời, phá công trình; công trình cho làng thứ gì (chỗ chứa, dân tối đa, tốc độ xây) | `placeBuilding` `upgradeBuilding` `buildingLock` `buildingLimit` `popCap` |
| `economy` | Kho chung: trả chi phí, đổi chác, bữa ăn cuối ngày | `pay` `barter` `feedPot` `eatDay` |
| `works` | Hàng đợi và tiến độ của nhà nghiên cứu, chế tạo, sửa chữa | `queueResearch` `queueCraft` `tickWorks` |
| `houses` | Ai làm việc hoặc ngủ ở nhà nào: đội thợ xây, người trong nhà, người nằm giường | `assignCrew` `assignStaff` `releaseStaff` `sleepIn` `sleepers` |
| `inventory` | Công cụ, vũ khí, giáp: phát, hao mòn, trả kho, lấy, đặt chế | `assignTool` `repairTool` `assignGear` `planTool` |
| `commands` | Lệnh của người chơi: đi, làm, đánh, giữ chỗ, đổi nghề, tuyển và giải ngũ lính | `orderMove` `orderWork` `setJob` `enlist` `discharge` |
| `labor` | Việc hằng ngày: thu hoạch, làm ruộng, mang vác, xây; máy trạng thái của dân | `think` `doWork` `doFarm` `planBuild` |
| `movement` | Đi lại: đường đi, bước chân, chỗ đứng, tư thế vẽ | `pathTo` `moveUnit` `animate` |
| `villagers` | Tạo dân và một ngày của dân: máu, ngủ | `makeVillager` `tickVillager` |
| `defense` | Hàng rào, cổng, chòi canh: mở đóng cổng, phá công trình phòng thủ, cung thủ trên chòi | `toggleGate` `damageWork` `towerBonus` `assignTower` |
| `mounts` | Thú cưỡi: Chuồng thú cưỡi thuần sói, lợn rừng, voi theo đơn (cần nghiên cứu và cấp chuồng), phát cho người như công cụ (`Villager.mount`), người cưỡi đi nhanh và đỡ đòn hơn, lính có thú tính là kỵ binh; lính Trại kỵ thú cưỡi thú theo cấp trại | `queueTame` `tickTame` `assignMount` `mountOf` |
| `training` | Huấn luyện trong nhà của vai trò: người đi luyện một ngày hoặc hơn, tăng 1–5% một chỉ số, chỉ số "đổi lại" giảm (ít hơn nếu bỏ thêm tiền), có sàn theo chỉ số lúc sinh và trần theo cấp nhà; trả lương thực và tiền | `startTraining` `cancelTraining` `trainStep` |
| `siege` | Chiến trận trên mặt đất: vật cản (cây, đá, bụi, nước, công trình), lính phá vật cản, đội đi theo mũi tên theo đường thẳng, dừng khi 6 ô phía trước bị chắn, mục tiêu của mũi tên và việc tự đánh mọi thứ khi mục tiêu mất | `obstacleAt` `arrowMove` `watchMarch` `breakBlock` `breakBrain` `tickTarget` |
| `quests` | Nhiệm vụ hướng dẫn tới Nhà chung cấp 4 (số liệu `data/quests.json`), suy ra từ trạng thái làng nên không lưu thêm gì | `quests` |
| `progression` (lớp dữ liệu) | Kế hoạch phát triển theo cấp Nhà chung và cấp Nhà nghiên cứu (`data/progression.json`) | `fireUnlockLevel` `fireBuildingMax` `labLevelOf` |
| `warplan` | Kế hoạch chiến: nhiệm vụ cho từng đội, thẻ lệnh, kế hoạch phòng thủ, trống báo động | `newPlan` `startPlan` `playCard` `soundAlarm` |
| `roles` | Vai trò gắn với công trình: giao và thu hồi, sức chứa theo cấp công trình | `assignRole` `releaseRole` `roleCapacity` `trimRoles` |
| `notices` | Tin báo cho người chơi về việc sắp tới hoặc đang diễn ra (thiếu ăn cuối ngày, chuẩn bị mùa đông, sói và bộ tộc sắp đánh cần bao nhiêu lính…), tính lại từ trạng thái mỗi lần hỏi, không lưu | `noticesOf` |
| `forecast` | Báo cáo của hội đồng chiến về một kế hoạch: tỉ lệ thắng, cảnh báo, hậu quả, chi tiết theo cấp bản đồ | `forecastPlan` |
| `environment` | Đồng hồ, mùa, thời tiết, tầm nhìn | `tickCalendar` `refreshFog` |
| `rest` | Sức (năng lượng), ngủ, ca làm, đuốc, mệt mỏi tích lũy | `tickEnergy` `shouldSleep` `callUp` `ensureTorch` |

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

## Vũ khí và hoạt ảnh chiến đấu

Hoạt ảnh của người cầm vũ khí (chiến binh, thợ săn) tách khỏi hoạt ảnh làm việc và đi **theo kiểu vũ khí**, không theo từng món. Mọi vũ khí cùng kiểu cử động giống nhau: gậy, chùy, rìu, kiếm đều *vung*; giáo, thương *đâm*; cung, nỏ, súng *bắn*; lao *ném*.

```
 weapons.json  "weapons": { "club": { "style": "swing", ... } }
                    │
 weapons.json  "styles":  { "swing": { idle, walk, guard, charge, attack } }   tên hoạt ảnh cho 5 trạng thái
                    │
 anims.json    "swing_idle", "swing_walk", "swing_guard", "swing_charge", "swing_attack"   các khung hình (vẽ bằng trình xem)
                    │
 movement.animate()  →  poseOf(vũ khí, trạng thái)
```

| Trạng thái | Khi nào |
|---|---|
| `idle` | đứng yên, tay cầm vũ khí |
| `walk` | đi bình thường |
| `guard` | đang giao chiến hoặc canh, đứng yên |
| `charge` | đang giao chiến, đang chạy tới |
| `attack` | một đòn đánh; cần trường `hit` (khung hình trúng đòn), game lấy thời điểm gây sát thương từ đó |

Hoạt ảnh `hit` (bị trúng đòn), `run` (bỏ chạy) và `down` (ngã) dùng chung cho mọi người. Giáp luôn được vẽ đè lên thân ở mọi hoạt ảnh. Vũ khí cầm trên tay do `hold` quyết định, không phụ thuộc trường `tool.kind` trong khung (trường đó chỉ để xem thử trong trình xem).

**Thêm một vũ khí cùng kiểu có sẵn** (ví dụ kiếm): thêm vào `weapons` với `"style": "swing"` (số liệu, `cost` nếu chế được), vẽ hình cầm tay trong `src/data/handtools/` và biểu tượng trong `src/data/blueprints/*/tools/`. Không cần hoạt ảnh mới.

**Một vũ khí khác biệt ở một động tác:** thêm `"anims": { "attack": "tên_hoạt_ảnh" }` vào vũ khí đó (rìu đá đang dùng `slash` như vậy).

**Thêm một kiểu mới** (ví dụ súng hay máy bắn đá): thêm vào `styles` với 5 tên hoạt ảnh, vẽ 5 hoạt ảnh đó trong `anims.json`, rồi gán `"style"` cho vũ khí. Với vũ khí bắn, đặt `"projectile"`. Test `npm run test:sim` kiểm: mọi kiểu có đủ 5 hoạt ảnh, mọi vũ khí chỉ tới hoạt ảnh có thật, mọi đòn đánh có khung `hit`.

Kiểu `throw` (lao) mới là bản sao của `thrust` để sẵn chỗ; chưa vũ khí nào dùng.

Muốn **đổi cơ chế chiến đấu** (tốc độ ra đòn, thời điểm trúng, tầm, đạn): thời điểm trúng nằm ở `hit` và `fps` của hoạt ảnh `attack`; chu kỳ giữa hai đòn nằm ở `cycle` của vũ khí; luật tính sát thương ở `src/sim/battle.ts`.

## Luồng một trận đánh (kế hoạch tấn công)

1. **Lập kế hoạch** trên bản đồ địch: đội, đội hình, mũi tên, đường rút (`warplan`).
2. **Triển khai trận chiến** (nút trên bản đồ): hội đồng chiến đưa báo cáo (`sim.forecastPlan`), người chơi xác nhận (`sim.startPlan`): bảng kế hoạch đóng lại, game chạy tiếp ở **chế độ chiến tranh** (`body.war`, `src/ui/warbar.ts`): các nút chọn người và công trình ẩn đi, chỉ còn thanh trạng thái và các nút Đánh / Rút. Báo cáo chỉ đọc kế hoạch và bản đồ đang có, không đọc địch thật: tỉ lệ thắng tính theo Lanchester (số lính × √(sát thương × máu)), nhân với khắc binh chủng và công trình phòng thủ khi bản đồ cho biết. Bản đồ cấp càng cao thì báo cáo càng nhiều dòng và `spread` (độ lệch) càng nhỏ: cấp 1 chỉ có dân số ước chừng, cấp 2 thêm công trình, cấp 3 thêm lính từng binh chủng, thủ lĩnh, phần đóng góp từng đội.
3. `plan.stage`: `assemble` (lính đi tới đúng ô của đội hình) → `ready` (đứng chờ; không nhiệm vụ nào chạy) → người chơi chọn `sim.engagePlan` (→ `fight`, các đội đi theo mũi tên và đánh mục tiêu đầu mũi tên) hoặc `sim.withdrawPlan`. Rút **trước khi đánh** (`assemble`/`ready`) là hủy trận: toàn quân đi thẳng về làng (`recall`), không theo đường rút vẽ trên bản đồ địch, rồi kế hoạch trở lại bản nháp để sửa hoặc triển khai lại. Rút **khi đã đánh** (`fight`) là rút lui (`retreat`): mỗi đội lui theo đường rút đã vẽ hoặc về chỗ hẹn, và kế hoạch kết thúc.
3b. **Khóa trận (`sim.warLock`).** Từ lúc một kế hoạch tấn công được triển khai (`status: 'running'`, cho tới khi kết thúc hoặc về bản nháp) không ai đổi được vai trò hay bị bỏ khỏi quân: `assignRole`, `releaseRole`, `setJob`, tuyển và cho nghỉ trinh sát, giao thợ vào nhà, `joinSquad`, `leaveSquad`, `disbandSquad`, `setCommander` và phá trại của vai trò đều bị từ chối (hàm trả `string` thì trả lý do, hàm `void` thì không làm gì). Giao diện làm mờ các nút đó. Nhờ vậy quân số trong kế hoạch không đổi giữa chừng, trừ khi có người chết.
3c. **Kiểm tra lại lúc triển khai.** `startPlan` đọc lại trạng thái lính ngay lúc bấm (không dùng báo cáo đã vẽ từ trước): đội thiếu lính so với ô, đội không có lính, hoặc lính bị thương hay ngủ say hồi sức (không đi được) đều chặn (`✗` trong `reviewPlan`). Trong giai đoạn `assemble`, mỗi giây lính nào chưa tới ô mà không đang đi sẽ được sai đi lại (`regather`); sau 150 giây chưa đủ thì sang `ready` và báo còn bao nhiêu lính chưa tới.
4. Tới cuối mũi tên mà không còn địch trong 12 ô thì đội giữ vị trí, giữ đội hình và đánh mọi thứ xung quanh, không đuổi theo.
5. Tín hiệu và thẻ lệnh chưa dùng trong trận thật; giao diện không còn cho chọn.

**Trận đông (hiệu năng).** Mọi lính được mô phỏng thật, không gom cụm. Ba biện pháp giữ trận mấy trăm người mỗi bên chạy được: (a) lưới ô 8×8 để mỗi lính chỉ xét kẻ địch ở ô gần (`threatCache`, dựng lại mỗi nhịp); (b) lính đang đánh một mục tiêu thì không nhìn quanh mỗi nhịp; (c) ngân sách tìm đường mỗi nhịp (`Sim.pathLeft`, `PATH_BUDGET`): lệnh cho cả đạo quân được tìm đường dần qua vài nhịp thay vì cùng lúc. Cả ba là trạng thái dựng lại, không lưu.

## Vai trò và công trình

Đống lửa trại chỉ cho xem tổng số dân và việc đang làm; **không giao việc ở đó**. Mỗi vai trò thuộc một công trình (`ROLES` trong `jobs.ts`), giao và thu hồi bằng `sim.assignRole` / `sim.releaseRole` (giao diện ở `src/ui/rolepane.ts`, tab trong bảng công trình):

| Vai trò (đồ đá → cổ đại) | Công trình (đồ đá → cổ đại) |
|---|---|
| Chiến binh → Bộ binh | Trại chiến binh → Trại bộ binh (`infantry`) |
| Kỵ thú → Kỵ binh | Trại kỵ thú → Trại kỵ binh (`cavalry`) |
| Thợ ném → Cung thủ | Trại thợ ném → Trại cung thủ (`archery`) |
| Trinh sát | Trại trinh sát (`scouttent`) |
| Hái lượm → Nông dân | Nông trại (`farmhouse`) |
| Thợ săn | Chòi thợ săn (`huntlodge`) |
| Đốn gỗ → Tiều phu | Xưởng gỗ (`lumberyard`) |
| Thợ đá → Thợ mỏ | Xưởng đá (`quarry`) |

- Mỗi công trình **chỉ xây một cái**; `slots` của cấp công trình là số người tối đa của vai trò. Phá công trình thì người vượt chỗ mất vai trò (`trimRoles`).
- Tên đổi theo thời kỳ (`names` của công trình, `ROLES[..].names`), ý nghĩa giữ nguyên. Thêm thời kỳ mới thì thêm tên, không đổi `id`.
- Binh chủng của lính là `Villager.arm`, do trại quyết định; trại thợ ném chỉ trang bị vũ khí bắn, hai trại kia chỉ vũ khí cận chiến. Lính cưỡi thú (`cavalry`) được tính là kỵ binh trong `armOf` (mọi chỗ tính khắc chế dùng `armOf`, không dùng `armOfWeapon` trực tiếp cho lính của ta). Lính ngủ trong trại của mình.
- Làng khởi đầu có sẵn Nông trại, Xưởng gỗ, Xưởng đá (`placeStarters`) để hai người đầu tiên có việc. Các công trình còn lại mở bằng nghiên cứu hoặc có sẵn từ đầu.
- `setJob` vẫn là lệnh thô (test, menu Dev); giao diện chỉ dùng `assignRole`.

## Trinh sát

Logic ở `src/sim/scouting.ts`, giao diện ở `src/ui/scoutpane.ts` (dùng trong Trại trinh sát và Lều họp chiến).

1. **Tìm thấy làng** (`Sighting`, `sim.sightings`): bất kỳ dân hoặc lính nào đi qua cách trại một làng chưa ai biết dưới 14 ô thì mang tin trong đầu; về tới lửa trại (hoặc vào nhà) còn sống thì tin vào danh sách, chỉ ghi "cách đây N ô về phía X". Chết giữa đường thì tin mất, người khác thấy lại được.
2. **Cấp bản đồ** theo nghiên cứu: `scout` cấp 1, `scout2` cấp 2, `scout3` cấp 3. Chuyến đi luôn vẽ cấp cao nhất đã nghiên cứu, không chọn cấp thấp hơn.
3. **Trinh sát là một vai trò như lính** (`job: 'scout'`, không có kỹ năng nghề): tuyển và cho nghỉ ở **Trại trinh sát** (`scouttent`) bằng `assignRole(ids, 'scout')` / `releaseRole`. `slots` của cấp lều là số trinh sát tối đa. Trinh sát không vào nhà làm việc, nút nghề không đổi được họ, và không thể cho nghỉ khi đang đi chuyến. Chỉ trinh sát mới được cử.
4. **Tỉ lệ vẽ đủ chi tiết** (`drawChance`): tổng điểm (`scoutSkill`: Nhanh nhẹn + Thể lực + Trí tuệ, chia 18) của những người **về tới nhà**, chia cho mức cần (`scoutsNeeded`: cấp + 1, thêm 1 cho mỗi 8 lính địch), tối đa 95%. Dưới 2 người thì là 0: một mình không bao giờ vẽ đủ. Trượt thì bản đồ "hở" (`gaps`), hiện thiếu người và vật. Kinh nghiệm và nghiên cứu sẽ cộng vào `scoutSkill` sau.
5. **Thời gian** (`surveyTime`): thám thính dài theo cấp, chia cho `1 + 0,35 × (số người − 1)`. Đi và về là đi bộ thật nên không rút ngắn.
6. Giao diện hỏi trước `sim.planScout(ids, tribe)` (tỉ lệ, thời gian, lý do không đi được) rồi mới gọi `sim.startScout(ids, tribe)`.

## Nhịp thời gian

Một ngày game là 20 phút thật (`DAY_LENGTH = 1200` giây): 12 phút ban ngày, 8 phút ban đêm. Có hai loại thời gian, để chỉnh riêng:

| Việc | Đơn vị | Chỉnh ở đâu |
|---|---|---|
| **Thu hoạch** (gỗ, đá, hái lượm) | giây thật ở tốc độ 1×, cho một đơn vị, dân hệ số 1,0 | `src/data/pace.json` (`gather`, và `bare` = tay không so với có công cụ) |
| **Xây, chế tạo, sửa, nghiên cứu, hao mòn công cụ, kinh nghiệm** | "giây công": 240 giây công = 1 ngày công, dù ngày dài bao lâu | `buildings.ts` (thời gian xây từng cấp), `tools.ts` (thời gian chế), `weapons.json`, `research.json` |

Giây công trôi với tỷ lệ `PACE.work` (`WORK_DAY / DAY_LENGTH`), nên một ngôi nhà tốn nửa ngày công vẫn tốn nửa ngày dù đổi độ dài ngày. Giao diện hiện chúng bằng ngày (`workDays`).

**Mùa và thời tiết** làm chậm việc ngoài trời (đốn gỗ, đục đá, hái lượm, xây; danh sách `outdoor` trong `pace.json`): hệ số `work` trong `weather.json` (nắng 1, sương 0,95, mưa nhẹ 0,85, mưa to 0,7, giông 0,6, bão 0,45, tuyết 0,6) nhân với `work` trong `seasons.json` (đông 0,8, hạ 1,05). Hái lượm còn nhân thêm `gather` theo mùa. Việc trong nhà (chế tạo, nghiên cứu, sửa) không bị ảnh hưởng. Hệ số `speed` của thời tiết chỉ ảnh hưởng tốc độ đi.

Mốc hiện tại (dân tay không, trời nắng, 12 phút ban ngày): khoảng 32 gỗ, 28 đá, hơn 80 thức ăn; 15 gỗ đầu tiên mất khoảng 3 đến 4 phút. Test `how long gathering takes` giữ các mốc này.

**Nghề chỉ đổi ở công trình của nó.** Chuột phải lên cây, đá, bụi quả, công trường hay thú không bao giờ đổi nghề của ai: người đã có đúng nghề thì đi tới chỗ đó, người khác bị bỏ qua (`orderWork`, `orderAttack`, `orderLoot` trả về số người nhận lệnh). Duy nhất một ngoại lệ: trước khi có Nhà thợ xây thì ai được chuột phải lên nền của nó sẽ dựng nó. Mọi vai trò (chiến binh, trinh sát, hái lượm, thợ săn, đốn gỗ, thợ đá) giao và thu hồi ở công trình của vai trò đó, xem mục *Vai trò và công trình*. Nhà dân và các trại, như mọi công trình mới, phải nghiên cứu rồi mới xây được.

**Ban đêm:** mọi người ngủ và lệnh lúc đó chờ đến sáng, trừ chiến binh. Dân bạn chọn làm chiến binh hoặc ra lệnh cho chiến binh vào ban đêm thì dậy trực tới sáng (`keepWatch` trong `commands.ts`).

## Thức ăn

Dân không có thang "no". Làng ăn chung một bữa vào cuối mỗi ngày game (`economy.eatDay`, gọi khi đổi ngày trong `tickCalendar`, trước khi người mới tới). Số liệu ở `src/data/food.json`.

- **Khẩu phần:** mỗi dân 2, mỗi lính (`job === 'fight'`) 3 thức ăn ở lửa trại cấp 1, tăng 1 mỗi cấp lửa (`rationAt`). Tổng cần = `economy.foodNeed`.
- **Phần ăn của lửa trại (`Sim.foodPot`):** thức ăn thu về được dồn vào đây trước cho đến khi đủ bữa kế (`economy.feedPot`, mỗi nhịp), dư mới ở lại kho. Thanh tài nguyên hiện kho + phần ăn.
- **Thiếu ăn:** cuối ngày lấy từ phần ăn rồi tới kho. Phần thiếu chia cho phần cần ra tỉ lệ thiếu; `Sim.foodPenalty = maxPenalty (20%) × tỉ lệ thiếu`, hiệu lực cả ngày kế rồi tính lại ở bữa sau, đủ ăn thì về 0.
- **Áp vào dân của ta:** `statValue` nhân `1 − foodPenalty` cho mọi chỉ số trừ `hp` (di chuyển, sức mạnh, hai phòng thủ, tốc độ làm việc, trí tuệ, sức). Máu tối đa không đổi, nhưng tốc độ hồi máu nhân `1 − foodPenalty` (`tickVillager`). Tốc đánh: `swingCycle` chia thêm `1 − foodPenalty` (giữ nguyên nhanh nhẹn như trước khi bị phạt để không tính hai lần).
- Dân bộ tộc không ăn theo luật này.

## Sức, ngủ, ca làm và đuốc

Mọi con số ở `src/data/rest.json`; logic ở `src/sim/rest.ts`.

- **Sức (`energy`, 0 đến 100)** tụt khi làm, hồi khi ngủ. Một ngày làm nặng tốn khoảng 40 đến 50 điểm, ca đêm khoảng 30. Mỗi nghề có hệ số riêng (`jobWeight`: đốn gỗ, đục đá nặng nhất, nghiên cứu nhẹ nhất). Dân khỏe (Sức khỏe, Thể lực), máu cao thì tụt chậm và hồi nhanh.
- **Dưới 20%** dân phải đi ngủ và **không gọi dậy được** tới 50% (hoặc 60% nếu ngã xuống ngủ khi dưới 10%). Trên 20% đang ngủ thì lệnh của người chơi gọi dậy được.
- **Chiến binh** đánh tới cùng, bất kể sức; xong trận mà sức dưới 10% thì ngủ dài tới 60%.
- **Ngủ đêm** hồi khoảng 60 điểm mỗi đêm, ngủ ngày một nửa, nhân với chỗ nằm (`sleepAt` trong `rest.json`). Hết sức hay tới giờ ngủ, dân đi bộ tới giường: dân thường tới **Nhà dân** (`house`, hồi ×1), chiến binh tới **Lều chiến binh** (`barracks`, hồi ×1); cấp nhà cao hơn nhân thêm `craftSpeed`. Vào giường là vào trong nhà (`inside`, `phase: sleep`): biến khỏi bản đồ, hiện thành danh sách trong nhà, không có hình ngủ. Chưa có nhà hoặc hết giường (`slots`) thì ngủ trên đất cạnh đống lửa, hồi chỉ ×0,6. Có địch tới gần thì người trong nhà bị đánh thức và ra ngoài.
- **Ca làm** (`shift`: ban ngày, ban đêm, cả ngày lẫn đêm) do người chơi đặt cho từng dân, mặc định ban ngày. Lệnh giao việc lúc ngoài ca gọi dân dậy nếu họ đủ sức (ban đêm cần đuốc).
- **Làm việc ban đêm cần đuốc** (cầm tay trái, cháy hết sau 10 phút, vẫn còn thì trả lại kho lúc sáng) và chỉ đạt **70%** hiệu suất; lính canh đêm không cần đuốc. Đuốc làm ở Nhà chế tạo (bản vẽ có sẵn từ đầu), phát tay hoặc tự cấp cho ca đêm từ kho. Người cầm đuốc thấy xa 6 ô và tỏa sáng.
- **Chống bóc lột:** làm đêm tích lũy `strain` (mệt mỏi). Strain hạ sức tối đa và làm hồi sức chậm, giảm dần khi ngủ đêm; làm ca đêm liên tục thì không kịp hồi.

## Số lượng công trình và ruộng

Công trình mở từ menu (thợ xây, kho, chế tạo, nghiên cứu, sửa đồ, kho công cụ, kho vũ khí) chỉ có **một** cái. Nhà dân, Lều chiến binh và Ruộng có `perFire` trong `buildings.ts`: số cái tối đa theo cấp Nhà chung 1 đến 4, cộng dồn qua mọi đống lửa (`buildingLimit`). Cấp tối đa của mỗi cái vẫn theo `levelCapByFire`. Giường tính trên mọi nhà cùng loại (`bedsIn`, `freeBed` chọn nhà gần nhất còn giường).

Ruộng: người chơi chọn ai vào làm (`houses.assignField`, như các nhà làm việc); họ làm bên trong, thức ăn về thẳng kho (`labor.tickFarms`), và `Villager.post` ghi ruộng họ được giao. Dân Hái lượm không được giao thì chỉ hái bụi quả. Một ruộng một người làm; cấp ruộng nhân tốc độ (`craftSpeed`); mùa nhân bằng `farm` trong `seasons.json`; thời gian cho một đơn vị ở `pace.json` (`gather.farm`). Muốn cân bằng lại thì chạy `npm run economy`: đo dân làm ra bao nhiêu mỗi ngày game và so ruộng của từng cấp lửa với nhu cầu ăn.

## Quân chủng và phòng thủ (M6.1, M6.2)

`formations.ts` (lớp dữ liệu) + `data/units.json`: ba quân chủng bộ, cung, kỵ. Vũ khí tầm xa làm ra cung thủ, còn lại là bộ binh; kỵ thú chưa có trong game nhưng bảng khắc chế đã sẵn. `battle.armMultiplier` nhân hệ số vào mỗi đòn: bộ binh đánh cung ×1,5, cung đánh kỵ ×1,5, kỵ đánh bộ ×1,5, ngược lại ×0,67. Cung thủ bị áp sát trong 2 ô bắn yếu một nửa; đứng cạnh chòi canh thì bắn mạnh ×1,25 và xa thêm 2 ô.

`defense.ts` (hệ thống làng): `fence`, `gate`, `tower` trong `buildings.ts` có `hp` mỗi cấp, đặt từng đoạn (`repeat`), số lượng tối đa theo cấp lửa (`perFire`). Hàng rào và cổng đóng chiếm ô (`world.occ`) nên chặn đường mọi người; cổng mở thì trống ô (`setOcc` biết). Kẻ tập kích không tìm được đường tới đích trong vài giây thì quay sang phá đoạn rào gần nhất (`tribes.siegeBrain`, `noteStuck`). Cung thủ lên chòi bằng `Villager.post` và neo đứng cạnh chòi.

Công cụ Dev cho thử chiến đấu: `dev.combatReady` (mở hết), `raiseArmy`, `defenseLine`, `garrisonTowers`, `enemyWave`.

## Chiến lược (M6.3 đến M6.8)

- `army.ts`: đội (`Squad`), trận pháp (hàng ngang, vòng tròn, mũi nhọn, sừng bò, rải quân, phục kích; số liệu `data/formations.json`), độ thuần thục luyện ở Bãi tập, `attackFactor` và `takenFactor` (nhân vào mỗi đòn trong `battle.ts`, bị chặn ở ×3,5), cụm (`clusters`, vẽ cờ cụm và giảm hình khi trận lớn), và nhật ký trận (`tickBattle`, `noteBattle`).
- `scouting.ts`: cử trinh sát, rủi ro chết từng người, bản đồ ba cấp có tuổi (mất 10% mỗi ngày), bản đồ hở khi thiếu người.
  `tribeIntel` đổi bản đồ thành thứ để vẽ: khu trại và 24 ô quanh nó, mỗi cấp chỉ lộ phần của mình (cấp 1 vị trí, số dân ước chừng, hướng vào; cấp 2 địa hình, công trình, bóng người; cấp 3 lính từng quân chủng, kho, thủ lĩnh). Người trên bản đồ đứng đúng chỗ trinh sát thấy lúc họ tới (`ScoutMap.seen`, chụp ở đầu pha quan sát, cấp 2 trở lên); sau đó họ đi đâu cũng không đổi bản đồ. Bản đồ hở bỏ bớt người; hàm chỉ đọc, không tiêu số ngẫu nhiên. Bản đồ cũ (chưa có `seen`) vẫn hiện làng như hiện tại. Bản lưu phiên bản 8: nhiệm vụ có `deploy` (các ô), `path`, `retreat`, `leg`. Giao diện vẽ ở `ui/planmap.ts` (trang Kế hoạch tấn công liệt kê các bản đồ đã có, bấm vào thì mở toàn màn hình: bản đồ kéo và zoom được, bảng bên cạnh để lập đội và kế hoạch, bấm điểm trên bản đồ để chọn mục tiêu; bản đồ kèm đội của ta và mục tiêu từng nhiệm vụ qua `missionTarget`). Công trình của bộ tộc nằm trong `Tribe.props`; hiện mới có lửa và kho, hàng rào/chòi/cổng sẽ tự hiện trên bản đồ cấp 2 khi bộ tộc có.
- `warplan.ts`: kế hoạch tấn công (mỗi đội một nhiệm vụ: đội hình vẽ trên bản đồ `deploy` (3 đến 15 ô vuông, mỗi ô một lính, `drawFormation` ra các ô theo kiểu trận khi kéo từ điểm chọn tới con trỏ; `deploySquad` chỉ ghi các ô: lập kế hoạch chưa cần lính, lính đưa vào đội sau), mũi tên đi `path` từng điểm, đường rút `retreat`, thái độ, giờ xuất phát hoặc đội phải giao chiến trước hoặc tín hiệu, điều kiện rút; `withdrawAt` 0 là không rút; tọa độ là ô thật của bản đồ chiến. `routeTime` tính thời gian đi từng đoạn theo tốc độ của người chậm nhất, trận pháp và thời tiết. Nhiệm vụ không có `path` vẫn đi theo `objective` như cũ), thẻ lệnh (giới hạn theo cấp Lều họp chiến), mẫu phòng thủ và trống báo động.
- `siege.ts`: chiến trận trên mặt đất (`data/siege.json`). `obstacleAt` nói ô nào bị chắn bởi gì (cây, đá, bụi quả: phá được; nước, công trình của làng: không; công trình của địch: là mục tiêu, phá bằng đòn đánh). Lính phá vật cản bằng `Villager.breaks` (`startBreaking`, `breakBrain` được `brainPlayer` gọi): cây, đá, bụi chịu tổng công của các lính đứng đó, rất nhanh và không cho tài nguyên; công trình địch (`Tribe.props[].hp`) chịu đòn theo vũ khí (`damageProp`). Khi triển khai, ô đội hình nằm dưới cây hoặc đá thì lính của ô đó tự phá rồi vào chỗ; vật cản trên mũi tên do đội hậu cần phá: trong kế hoạch có mũi tên, đội không có mũi tên là đội hậu cần (`isLogistics`, chỉ cần có lính). Lúc triển khai `listClears` ghi mọi cây, đá, bụi trong hành lang 2 ô quanh các mũi tên vào `Plan.clears`, lính hậu cần phá lần lượt cái gần nhất (`crewClears`) rồi về chỗ cũ; quân chỉ sẵn sàng khi xong, không có đội hậu cần còn lính thì kế hoạch báo `✗`, và nếu họ chết hết giữa chừng thì quân vẫn vào vị trí, đội nào bị chắn thì dừng và người chơi bấm phá. Nước và công trình của làng thì không phá được (phải uốn mũi tên). Đội hậu cần không ra trận. Khi đánh, đội đi mũi tên theo đường thẳng (`arrowMove`, `FightState.strict`: không tự tìm đường): hai lần mỗi giây `watchMarch` xem 6 ô phía trước từng lính, nếu bị chắn thì cả đội dừng (`Mission.state = 'blocked'`, `Mission.block`), người chơi bấm "Phá vật thể" (`breakBlock`, cử n lính). Mũi tên chỉ vào một mục tiêu (`Mission.target`, đặt bằng `setMissionTarget`, đầu mũi tên cố định): tới nơi, lính tự tìm mục tiêu (`targetNow`); mục tiêu mất thì lính đánh mọi thứ quanh đó; mục tiêu đã dời quá `driftMax` khỏi chỗ trong kế hoạch thì đội đứng ở cuối mũi tên, giữ đội hình, đánh những gì ở gần (`tickTarget`).
- Thắng, thua: thắng khi làng địch không còn lính, lửa đã tắt và mọi công trình đã sập (`Plan.result = 'won'`, rồi làng xin hàng); thua khi ta hết lính hoặc rút lui (`'lost'`). Làng bị đánh không đầu hàng giữa chừng (`checkSurrender` bỏ qua). Lính trong đội không ngủ và không mệt khi đang có trận (`rest.shouldSleep`). Mọi công trình của làng có máu (`buildings.maxHp`) và có thể bị đánh.
- `simwar.ts`: nửa chuyển tiếp của `Sim` cho phần chiến, trộn vào `Sim` để `sim.ts` không quá 650 dòng.
- Chòi canh: cung thủ vào trong (như nhà làm việc) và bắn ra; hố chông là công trình đặt từng cái.
- Vũ khí và giáp mòn theo số đòn (`wearGear`): hết bền thì mất hẳn một nửa số lần, nửa kia hỏng và chủ nhân tự mang tới Nhà sửa chữa. Dân hết máu thì chết hẳn, không còn trạng thái ngã.
- Chưa làm: mô phỏng theo cụm thay cho mô phỏng từng người, kỵ thú, hỏa công, dụ thú, cắt đường lương, tù binh, gián điệp, NPC tự xây rào và đặt bẫy.
