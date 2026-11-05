# Đề xuất cân bằng thời đại Đồ đá

Nov 4, 2026 · @Huy

Bản này viết lại cho **ngày game 10 phút (7 phút ngày + 3 phút đêm)**. Với số liệu trong file Word, phá đảo Đồ đá mất tối thiểu 85 ngày game (khoảng 14 giờ ở ngày 10 phút) và nền thức ăn thiếu gần 5 lần, nên đề xuất bộ số để phá đảo trong 17–23 ngày. Mọi con số "đề xuất" là để chơi thử, tính tay từ file Word, `progression.json`, `research.json` và `researchtree.json`; chưa chạy mô phỏng.

## Kết luận

| # | Vấn đề | Đề xuất |
| --- | --- | --- |
| 1 | Thời gian | Ngày 10 phút. Boss chết ngày \~17 nếu chơi hoàn hảo (≈ 2 giờ 50), ngày \~23 nếu chơi tầm 50% (≈ 3 giờ 50) |
| 2 | Thức ăn | Ăn 2/3 cố định, hái lượm 9, nông trại 11,5, săn 17 mỗi người mỗi ngày, kho 400/800/1.500 |
| 3 | Dân và slot | Dân 65 ở ngày 17, Nhà chung cấp 3 (sức chứa 70), không cần cấp 4 ở Đồ đá |
| 4 | Quân | ≤48% dân: \~30 lính ở ngày 17 |
| 5 | Làng thường | 3 làng ở ngày 6, 10, 14 |
| 6 | Công thức sức mạnh | N × (1 + % chỉ số), không dùng (1+p)³ |
| 7 | Nghiên cứu | Giữ nguyên chi phí gốc trong `researchtree.json`; ngân sách \~58 ngày công, đủ cho \~16 dây cấp 1–3 (\~35 ngày công), dư \~24 |
| 8 | Sự kiện | 10 sự kiện, mỗi 1–2 ngày có một áp lực |

## Nhịp chơi mục tiêu

| Mức chơi | Ngày boss chết | Thời gian thật |
| --- | --- | --- |
| Hoàn hảo, không bỏ sót thời gian | 17 | ≈ 2 giờ 50 |
| Tầm 50% hiệu quả | 23 | ≈ 3 giờ 50 |

Hoàn hảo nghĩa là toàn bộ dân không phải lính đều làm việc ở công trình kinh tế, phát triển hoặc chế tạo, và nghiên cứu đúng thứ cần cho trận cuối. Chọn sai nghiên cứu (dồn quá nhiều vào quân thì thiếu thức ăn, dồn kinh tế thì boss thắng) sẽ kéo dài sang ngày 23.

Giả định: tăng tốc đồng hồ mô phỏng thay vì sửa từng số theo ngày, nên số liệu "mỗi người mỗi ngày" dưới đây giữ nguyên so với bản ngày 20 phút. Nếu bạn không tăng tốc, mỗi người làm ít hơn nhiều và mọi số trong bản này phải nhân lại.

## Thức ăn và tài nguyên

Năng suất trung bình mỗi người mỗi ngày (đã tính mùa và thời gian): hái lượm 12 ra khoảng 9, nông trại cấp 2 (14) ra khoảng 11,5, săn (30 × 0,7 khả dụng) ra khoảng 17. Mỗi người ăn 2 (cấp lửa 1) và 3 (cấp lửa 2 trở lên) mỗi ngày, cố định.

### Tham số đề xuất

| Mục | Giá trị |
| --- | --- |
| Mức ăn | 2 (lửa 1), 3 (lửa 2–3) |
| Hái lượm / Nông trại / Săn | 9 / 11,5 / 17 mỗi người mỗi ngày |
| Sức chứa kho thức ăn | 400 / 800 / 1.500 (lửa 1 / 2 / 3) |

### Kiểm tra cân bằng theo mốc

| Ngày | Dân | Cần/ngày | Cấp lửa |
| --- | --- | --- | --- |
| 5 | 13 | 26 | 1 → 2 |
| 9 | 28 | 84 | 2 |
| 13 | 47 | 141 | 2 → 3 |
| 17 | 65 | 195 | 3 |

Ở ngày 17 cần 195 mỗi ngày. Với 12 người nông trại (138) và 6 thợ săn (103) được 241, dư 46 mỗi ngày để tích kho.

### Mùa đông

- Kho thức ăn cần ít nhất \~250 trước mùa đông đầu và \~1.300 trước mùa đông thứ hai (số của bản Word, chưa đo lại).
- Tôi chưa biết mùa đông đầu rơi vào ngày nào trong 17–23 ngày; cần khớp độ dài năm trong game.

### Gỗ, đá, da, coin

- Giữ nguyên chi phí công trình trong file Word; bù bằng nhiều slot hơn (mục 4) và nghiên cứu năng suất cấp 1–3.
- Coin và da vẫn khan: cần ít nhất 2 nguồn thu ổn định (săn cho da, thương nhân ngày 12 đổi coin) vì một dây nghiên cứu cấp 1–3 tốn \~5 coin.

## Dân số, nhà ở và slot

Dân tăng nhờ người đến xin ở, không nhờ sinh sản. Nhà chung cấp 1 chứa 13, cấp 2 chứa 46, cấp 3 chứa 70 (cấp 4 chứa 100 nhưng không cần ở Đồ đá).

### Người đến xin ở

| Giai đoạn | Người đến mỗi ngày | Dân cuối giai đoạn |
| --- | --- | --- |
| Ngày 1–5 | 2,5 | 13 |
| Ngày 6–11 | 4 | 37 |
| Ngày 12–17 | 4,7 | 65 |

### Slot và giới hạn công trình

| Công trình | Số cái theo cấp lửa 1 / 2 / 3 | Slot mỗi cái 1 / 2 / 3 |
| --- | --- | --- |
| Xưởng gỗ | 1 / 1 / 2 | 4 / 6 / 7 |
| Xưởng đá | 1 / 1 / 2 | 3 / 5 / 6 |
| Nông trại | 1 / 1 / 2 | 3 / 5 / 7 |

- Lính tối đa 48% dân (30/65 ở ngày 17).
- Muốn lên lửa cấp 2 hoặc 3 phải xây xong và nâng mọi công trình đã mở khóa ở cấp đó (xem `progression.json`): đây là khối lượng xây dựng phải tính vào ngày 5 và ngày 13.

### Phân công mẫu ở ngày 17

65 dân, 30 lính, 35 người làm việc, không còn ai rảnh:

| Việc | Người |
| --- | --- |
| Nông trại | 12 |
| Săn | 6 |
| Đốn gỗ | 6 |
| Khai đá | 4 |
| Nghiên cứu | 3 |
| Thợ xây | 2 |
| Thợ chế tạo | 2 |

## Nghiên cứu

Bản trước dựa trên báo cáo Word (486 mục, +3% mỗi mục) nên không khớp cây thật. Theo `researchtree.json`, mỗi chỉ số của mỗi vai trò có **5 cấp** với % cộng cố định, chi phí mỗi cấp nhân 1,5 và thời gian nhân 1,25. Đề xuất giữ nguyên các số này, không giảm hệ số.

### Chi phí một dây

| Phạm vi | Thời gian | Vật liệu |
| --- | --- | --- |
| Cấp 1–3 của một chỉ số | 1,8–2,2 ngày công | \~48 thức ăn, 48 gỗ, 24 đá, 5 da, 5 coin |
| Cấp 1–5 của một chỉ số | 3,8–4,8 ngày công | \~132 thức ăn, 132 gỗ, 66 đá, 13 da, 13 coin |

Một ngày công = 240 giây công. Cấp 4–5 của mỗi chỉ số cần Nhà nghiên cứu cấp 2, và tab Quân sự cũng chỉ mở ở cấp 2.

### Ngân sách đến ngày 17

Mỗi người nghiên cứu làm \~1,53 ngày công mỗi ngày. Với 1 người (ngày 2–4), 2 người (ngày 5–8), 3 người (ngày 9–17) có 38 người-ngày, tức **\~58 ngày công**. Ở mức 50% hiệu quả chỉ tới \~45 trong 23 ngày.

### Phân bổ mẫu

| Nhóm | Nội dung | Ngày công |
| --- | --- | --- |
| Quân | Bộ binh Máu, Sát thương, Thủ cận cấp 1–3; Thợ ném Máu, Sát thương cấp 1–3 | \~10 |
| Công cụ và nghề | Cuốc, rìu: Tốc độ + Sản lượng cấp 1–3; cuốc chim Tốc độ; Hái lượm Làm việc + Sức; Thợ săn Làm việc | \~15 |
| Phát triển | Nhà nghiên cứu, Thợ xây, Thợ chế tạo: Làm việc cấp 1–3 | \~5 |
| Trận pháp | signal, form\_basic, form\_cells\_10, form\_squads\_5 | \~4 |
| Dư | Cấp 4–5 của các dây quan trọng nhất | \~24 |

Ngân sách này đủ cho tất cả nhóm ở trên với cấp 1–3, còn dư \~24 để đào sâu quân hoặc kinh tế tùy cách chơi.

### Hai chỗ cần quyết

- Ghi chú trong `researchtree.json` nói chỉ số **chưa nối vào công thức chiến đấu và làm việc**; cần nối trước khi đo lại hệ số chỉ số của quân (xem `statBonus` trong `sim/research.ts`).
- Cấp Nhà nghiên cứu: `progression.json` chỉ mở nghiên cứu ở cấp 1, 2, 3 và 5; cấp 4 không có gì, nên bỏ hoặc gán thêm nội dung.

## Quân, làng thường và boss

Sức mạnh thật dùng công thức **số quân × (1 + % chỉ số)**, đã khớp với kết quả mô phỏng boss. Mục tiêu quân trong file Word dùng (1+p)³ nên đòi quá nhiều quân; nên sửa lại thành công thức này. Ngưỡng thắng từ mô phỏng: R = sức mình / sức địch ≥ 0,95. Thương vong khoảng 30% / 16% / 10% / 10% khi R = 0,96 / 1,21 / 1,46 / 1,71.

### Sức mạnh của mình theo ngày

| Ngày | Dân | Quân | Hệ số chỉ số | Sức mạnh |
| --- | --- | --- | --- | --- |
| 5 | 13 | 3 | 1,17 | 4 |
| 7 | 20 | 5 | 1,20 | 6 |
| 9 | 28 | 9 | 1,25 | 11 |
| 11 | 37 | 14 | 1,30 | 18 |
| 13 | 47 | 19 | 1,33 | 25 |
| 15 | 56 | 25 | 1,37 | 34 |
| 17 | 65 | 30 | 1,40 | 42 |

### Làng thường

Ba làng, sức địch đặt để thắng với R khoảng 1,4 (thương vong \~10–16%) nếu theo đúng nhịp, và thua nếu bỏ bê quân.

| Làng | Ngày | Sức địch | R |
| --- | --- | --- | --- |
| 1 | 6 | \~3 | \~1,4 |
| 2 | 10 | \~10 | \~1,4 |
| 3 | 14 | \~21 | \~1,4 |

Sức địch của làng nên scale theo cấp Nhà chung của người chơi, không theo ngày cố định.

### Boss

Boss cố định +155% chỉ số (hệ số 2,55). Với 30 quân ở hệ số 1,40 (sức 42), đặt boss khoảng 14 con (sức \~36), R ≈ 1,18, thương vong \~16%. Ngưỡng thua là sức 34 (R = 0,95), tức \~24 quân ở hệ số 1,40, nên thiếu quân hoặc bỏ nghiên cứu quân đều thua.

### Số đợt tấn công

3 đợt làng cộng 1 trận boss ở ngày 17. Quái ban đêm (xem mục sau) là áp lực phụ, không tính vào số đợt.

## Sự kiện

Mười sự kiện, rải đều để mỗi giai đoạn có một áp lực riêng. Số tác động là đề xuất để bạn chỉnh khi đo. Đêm 3 phút đủ cho một trận quái nhỏ.

| Ngày | Sự kiện | Tác động đề xuất |
| --- | --- | --- |
| 2 | Thú dữ đêm | Sói lảng vảng ban đêm, cần 1–2 lính ở lửa |
| 3 | Mưa lớn | Hái lượm −20% trong 1 ngày |
| 4 | Người lạ xin vào làng | +2 dân nếu còn chỗ ở |
| 6 | Làng 1 tấn công | Xem mục quân |
| 8 | Đàn thú di cư | Săn +30% trong 2 ngày |
| 10 | Làng 2 tấn công | Xem mục quân |
| 12 | Thương nhân ghé qua | Đổi da/coin lấy thức ăn, gỗ, đá |
| 14 | Làng 3 tấn công | Xem mục quân |
| 15 | Dịch bệnh nhẹ | Giảm 10% dân nếu chưa đủ thức ăn |
| 16 | Đội thám tử boss | Gợi ý sức boss, không sát thương |

Sự kiện không cần làm người chơi thua; chỉ nên làm thua khi họ bỏ qua dấu hiệu cảnh báo từ trước ít nhất một ngày.

## Mâu thuẫn cần bạn quyết

- Công thức sức mạnh: file dùng (1+p)³, mô phỏng cho thấy N×(1+p). Đề xuất theo mô phỏng.
- Tỉ lệ quân: file có nơi 45%, nơi 48% dân. Đề xuất thống nhất 48%.
- Cây nghiên cứu thật chỉ có 5 cấp mỗi chỉ số, không phải 486 mục: toàn bộ phần chi phí và % trong báo cáo Word cần đối chiếu lại.
- Chỉ số nghiên cứu chưa nối vào công thức chiến đấu, nên hệ số 1,40 là mục tiêu cần xác nhận lại sau khi nối.
- `npm run economy` đang hỏng với nông trại nên phần thức ăn dựa vào tính tay.

## Cần đo thêm

1. Chạy mô phỏng 17–23 ngày với bảng số ở các mục trên để kiểm tra dân, quân và thức ăn mỗi ngày.
2. Sửa `npm run economy` cho nông trại để đo lại năng suất thức ăn thật.
3. Đo khối lượng xây dựng cần để lên lửa cấp 2 (ngày 5) và cấp 3 (ngày 13).
4. Xác nhận độ dài năm/mùa đông so với 17–23 ngày.
5. Xác nhận có tăng tốc đồng hồ mô phỏng hay không (nếu không, mọi số "mỗi ngày" phải nhân lại).
