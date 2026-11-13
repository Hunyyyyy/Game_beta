# Hành quân và Bãi tập (thời Trung cổ)

Tài liệu mô tả cách lập quân ở Bãi tập và cách cả đội quân hành quân. Code: `src/sim/legion.ts`, số liệu: `src/data/legion.json`, giao diện: `src/ui/marchpane.ts` (tab "Hành quân" của Bãi tập) và `src/ui/controller.ts` (bấm đất để ra lệnh).

Phạm vi: **chỉ phần hành quân**. Chưa có chiến đấu, chưa có đội (`army.ts`) và chưa có kế hoạch chiến tranh (`warplan.ts`) gắn vào đội quân này.

## 1. Bãi tập làm gì

Bãi tập không còn luyện trận pháp (độ thuần thục đã tắt: `tickTraining` thoát ngay, `trainSquad` trả về thông báo chuyển sang tab "Hành quân"). Giờ nó là nơi **lập quân và cho quân hành quân**.

Điều kiện: thời Trung cổ (`sim.era === 'ancient'`) và đã dựng Bãi tập. Chế độ dev `freeBuild` bỏ qua cả hai.

## 2. Hai khái niệm: khu quân sự và ô lính

| | Khu quân sự (`MilZone`) | Ô lính (`MilCell`) |
|---|---|---|
| Kích thước | `zoneSize` × `zoneSize` ô đất (30×30) | `cellSize` × `cellSize` ô đất (5×5) |
| Vẽ ở đâu | Tâm khu đặt tại điểm bấm trên bản đồ | Bấm vào một khu, ô đặt quanh điểm bấm |
| Số lượng | Nhiều khu, không chồng nhau | Nhiều ô, không chồng nhau |
| Thuộc tính | Vị trí, kích thước | Thuộc một khu, có một loại lính (`arm`) |

### Khu quân sự
- Khi lập (`createZone`), **dọn ngay** cây, đá, bụi và thú trong khu. Sau đó trong khu không mọc gì, không sinh thú, không xây được gì (`inZone`).
- Không lập được khi: khu vượt ra ngoài bản đồ; chồng lên khu khác; còn ô chưa khám phá (sương mù); có công trình (của ta hay của làng khác) trong khu.
- Xóa khu (`removeZone`) cũng xóa mọi ô lính trong khu.

### Ô lính
- Phải nằm **trọn trong một khu**, không chồng ô khác, không có nước/núi/vật cản.
- Mỗi ô có một loại lính: bộ binh, cung thủ hoặc kỵ binh (đổi loại hoặc xóa bằng `setCellArm`).
- Mỗi ô chứa tối đa `cellSize²` lính (25), cách nhau 1 ô đất.

## 3. Tập trận (`assemble`)

Bấm "Tập trận" để gom quân vào các ô.

1. Bị từ chối nếu đang có chiến tranh (`warLock`), hoặc chưa có ô lính nào.
2. Gỡ đội quân cũ (`disband`) rồi chọn lại từ đầu.
3. **Lính được chọn:** lính của người chơi, `job = 'fight'`, không phải lính gác, không đang đóng chốt (`post < 0`), còn sống, không bị gục, không đang đi trinh sát.
4. **Chia theo loại:** mỗi loại lính xếp vào các ô cùng loại theo thứ tự id (lính id nhỏ vào ô id nhỏ). Hết ô thì lính thừa ở yên chỗ cũ.
5. Mỗi lính nhận một **chỗ** (`slots[id] = {dx, dy}`): độ lệch so với tâm đội, tính từ vị trí của chỗ trong ô. **Tâm đội** là trung bình vị trí các chỗ.
6. Lệnh của người chơi cao nhất: lính bỏ giường, bỏ việc, bỏ trại, xóa nhiệm vụ và giao tranh đang dở (`exitBuilding`, `resetTask`, `clearCombat`).
7. Đặt `legion.on = true`, `assembling = true`.

### Giai đoạn tập trung
- Lính xa chỗ hơn 3 ô đi theo đường (tìm đường như người thường); gần hơn thì bước thẳng tới chỗ, trượt dọc vật cản.
- Tới chỗ (cách dưới 0,3 ô) thì đứng yên, mặt quay theo hướng đội.
- Xong khi **tất cả** đã vào chỗ, hoặc đã quá `assembleSeconds` (180 giây) và ít nhất 90% đã vào chỗ. Khi đó `assembling = false` và quân sẵn sàng hành quân.

## 4. Hành quân

### Ra lệnh (`legionMove`)
Bấm hoặc chuột phải lên đất khi đã chọn đội quân. Bị từ chối nếu chưa có đội quân, quân còn đang tập trung, đội không còn ai, hoặc không có đường tới.

**Điểm bấm là giữa hàng đầu của đội hình**, không phải tâm:
- Hướng đi: so độ lệch X và Y từ tâm tới điểm bấm; trục nào lệch nhiều hơn là trục đi. Dấu của độ lệch cho biết phía nào là **hàng đầu**.
- Khoảng cách từ tâm tới hàng đầu (`reach`) là độ lệch xa nhất của các chỗ về phía đó.
- Đích của **tâm** = điểm bấm lùi lại `reach` theo trục đi. Ví dụ bấm xuống dưới: hàng dưới cùng đứng ở điểm bấm, tâm dừng cách phía trên đúng nửa chiều sâu đội hình.
- Tìm đường cho tâm như thể tâm là một người (`pathTo`). Đường tìm được là các ô liên tiếp; tâm đi vòng vật cản theo đường đó.
- Tốc độ cả đội (`speed`) = **trung vị** tốc độ của các lính (tính cả hệ số cưỡi ngựa), cập nhật mỗi giây.

### Mỗi tick (`tickLegion`)
- **Đội hình không xoay.** Mỗi lính giữ nguyên độ lệch `(dx, dy)` so với tâm. Tâm đi dọc đường; chỗ của lính = tâm + độ lệch. Nhờ đó cả đội tịnh tiến, các cột đi song song theo đường thẳng.
- `theta` chỉ là **hướng mặt** (góc hướng đi hiện tại của tâm), không ảnh hưởng chỗ đứng.
- Lính bước tới chỗ của mình với tốc độ đội, nhân hệ số đuổi kịp tối đa `catchup` (1,5) nếu đang tụt lại xa; gặp vật cản thì trượt từng ô dọc theo.
- Lính chết thì bị xóa khỏi `slots`; hết lính thì đội giải tán.

### Hình ảnh khi đi (chống nhấp nháy)
- Khi đội đang đi (còn đường), **mọi lính giữ animation đi bộ liên tục** và hướng mặt, hướng bước theo hướng chung của đội. Không tính hướng từ các điều chỉnh nhỏ của từng lính, vì sẽ nhảy giữa đi nghiêng và đi thẳng.
- Chỉ lính tụt lại hơn 1,5 ô (đang chạy đuổi) mới quay mặt theo hướng chạy của riêng mình.
- Đội đã dừng: lính vào đúng chỗ thì đứng yên, mặt theo hướng đội.

## 5. Số liệu (`src/data/legion.json`)

| Khóa | Giá trị | Ý nghĩa |
|---|---|---|
| `zoneSize` | 30 | Cạnh khu quân sự (ô đất) |
| `cellSize` | 5 | Cạnh ô lính (ô đất); mỗi ô chứa `cellSize²` lính |
| `catchup` | 1,5 | Lính tụt lại đuổi nhanh tối đa bấy nhiêu lần tốc độ chung |
| `assembleSeconds` | 180 | Quá thời gian này, đủ 90% lính vào chỗ là coi như xong tập trung |

Các khóa `turnRate` và `turnSlow` (quay đội hình, giảm tốc khi rẽ) đã bỏ vì đội hình không còn xoay.

## 6. Dữ liệu và lưu game

Trạng thái nằm trên `Sim`: `zones`, `cells`, `legion`.

```
Legion { on, assembling, since, clock, cx, cy, theta, theta0, speed, path, slots }
```

- `cx, cy`: tâm đội. `path`: các ô còn phải đi. `slots`: độ lệch từng lính so với tâm.
- `theta0` không còn tác dụng, giữ lại để save cũ vẫn đọc được (không cần nâng `SAVE_VERSION`).

## 7. Công cụ dev (tab Dev của menu)

- **Tập hợp quân đầy ô** (`fillPlan`): tạo thêm lính (đồ tốt nhất + đuốc, bỏ qua sức chứa trại) cho đủ mọi ô trong kế hoạch rồi gọi Tập trận. Lính tự do đã có được tính vào, không tạo thừa.
- **Dọn sạch quanh khu quân sự** (`clearAroundZones`): xóa cây, đá, bụi và thú trong khu và 40 ô quanh khu, để thử hành quân không bị cản. Công trình giữ nguyên.

## 8. Quy tắc cần nhớ

- Lệnh của người chơi luôn cao nhất: Tập trận lấy lính ra khỏi giường, việc, trại.
- Chiến tranh (`warLock`) chặn việc lập quân lại.
- Chưa có: chiến đấu của đội quân, gắn với đội/kế hoạch chiến tranh, né nhau giữa các lính khi đội đổi hướng gấp.
