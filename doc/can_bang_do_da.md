# Số đo cân bằng thời đại Đồ đá

## 1. Thời gian, mùa, thời tiết
- 1 ngày game = 20 phút thật (12 phút sáng, 8 phút đêm). 1 mùa = 5 ngày = 100 phút thật; 1 năm = 20 ngày = 6.666666666666667 giờ thật.
- "1 ngày công" = 240 giây công (thời gian xây, chế tạo, nghiên cứu trong JSON tính bằng giây công của một thợ hệ số 1).

| Mùa | Việc ngoài trời | Hái lượm | Ruộng | Thời tiết hay gặp (hệ số làm việc kỳ vọng) |
|---|---|---|---|---|
| Xuân | ×1 | ×0.8 | ×0.9 | làm việc ×0.91, đi lại ×0.94 → tổng ngoài trời ≈ ×0.91 |
| Hạ | ×1.05 | ×1.2 | ×1.2 | làm việc ×0.84, đi lại ×0.91 → tổng ngoài trời ≈ ×0.88 |
| Thu | ×1 | ×1.4 | ×1.4 | làm việc ×0.88, đi lại ×0.94 → tổng ngoài trời ≈ ×0.88 |
| Đông | ×0.8 | ×0 | ×0.25 | làm việc ×0.83, đi lại ×0.90 → tổng ngoài trời ≈ ×0.67 |

## 2. Dân số, lính, thức ăn theo cấp lửa
Dân đầu: 3. Mỗi ngày từ ngày 2 có 1–3 người lạ xin ở (trung bình 2), tới khi đầy sức chứa. Sức chứa = dân lửa + giường nhà dân.

| Lửa | Dân tối đa | Ăn/dân | Ăn/lính | Cần/ngày (40% dân là lính) | Ngày tối thiểu để đủ dân (3 + 2/ngày) |
|---|---|---|---|---|---|
| 1 | 13 | 2 | 3 | 31 | 6 |
| 2 | 46 | 3 | 4 | 156 | 23 |
| 3 | 70 | 4 | 5 | 308 | 35 |
| 4 | 100 | 5 | 6 | 540 | 50 |

Năng suất danh nghĩa một người (ngày 12 phút = 720 giây sáng, tỉ lệ làm việc thật 0.6): gỗ 39.3, đá 25.4, hái quả 10.8, ruộng cấp 1 6.2 mỗi ngày (chưa tính mùa/thời tiết/công cụ; số đo thật xem phần economy).

## 3. Công trình và nâng Nhà chung

| Công trình | mở ở lửa | giới hạn/lửa | Cấp 1..4: tổng chi phí | Xây+nâng đủ 4 cấp (ngày công) | slot cấp 1→4 |
|---|---|---|---|---|---|
| Trại thợ ném | 2 | 1 | wood 111, hide 33, stone 60 | 2.2 | 5/10/15/20 |
| Kho vũ khí | 1 | 1 | wood 119, stone 135 | 2.2 | 0/0/0/0 |
| Nhà thợ xây | 1 | 1 | wood 192, stone 163 | 2.3 | 2/3/3/4 |
| Trại kỵ thú | 2 | 1 | wood 131, hide 52, stone 60 | 2.4 | 5/10/15/20 |
| Bãi tập | 2 | 1 | wood 131, stone 100 | 2.5 | 0/0/0/0 |
| Nông trại | 1 | 1 | wood 106, stone 65 | 2.1 | 3/5/5/5 |
| Hàng rào cọc | 3 | 40/80/120/150/180 | wood 30, stone 7 | 0.6 | 0/0/0/0 |
| Cổng | 3 | 1/2/3/4/5 | wood 33, stone 9 | 0.8 | 0/0/0/0 |
| Trại lính gác | 1 | 1 | wood 131, hide 42, stone 100 | 2.6 | 6/12/18/24 |
| Nhà dân | 2 | 1/3/3/3/3 | wood 143, stone 100 | 2.2 | 5/10/15/20 |
| Chòi thợ săn | 1 | 1 | wood 106, hide 26, stone 36 | 2.1 | 2/3/4/5 |
| Trại chiến binh | 2 | 1 | wood 111, hide 33, stone 60 | 2.2 | 5/10/15/20 |
| Nhà nghiên cứu | 2 | 1 | wood 284, stone 207, hide 20, coin 10 | 2.9 | 1/2/3/4 |
| Xưởng gỗ | 1 | 1 | wood 106, stone 65 | 2.1 | 3/5/5/5 |
| Xưởng đá | 1 | 1 | wood 106, stone 65 | 2.1 | 3/5/5/5 |
| Trại trinh sát (trung cổ) | 2 | 1 | wood 143, hide 44, stone 85 | 2.4 | 2/4/6/6 |
| Chuồng thú cưỡi | 2 | 1 | wood 167, hide 44, stone 115 | 3 | 1/2/3/3 |
| Kho | 1 | 1 | wood 131, stone 48 | 2.1 | 0/0/0/0 |
| Trại hậu cần (trung cổ) | 2 | 1 | wood 185, hide 66, stone 85 | 2.4 | 4/8/12/16 |
| Kho công cụ | 1 | 1 | wood 119, stone 135 | 2.2 | 0/0/0/0 |
| Chòi canh (trung cổ) | 2 | 0/1/2/4/6 | wood 163, stone 34 | 3.2 | 2/3/4/4 |
| Hố chông | 3 | 4/10/18/28/38 | wood 18, stone 9 | 0.5 | 0/0/0/0 |
| Lều họp chiến | 2 | 1 | wood 182, hide 52, stone 135 | 3 | 0/0/0/0 |
| Nhà chế tạo | 1 | 1 | wood 120, stone 163 | 2.7 | 1/2/3/4 |

Nâng Nhà chung (chi phí riêng) và điều kiện: mọi nhà đã mở khóa phải có ít nhất 1 cái đạt cấp đó, nhóm sản xuất đạt cấp đó.

| Lên cấp | Chi phí lửa | Công lửa (ngày công) | Các nhà cần có (mỗi loại ≥1 ở cấp trước) | Tổng nhà+nâng tối thiểu để đủ điều kiện | Công (ngày công) |
|---|---|---|---|---|---|
| 1→2 | wood 100 | 0.5 | 10 loại: Kho vũ khí, Nhà thợ xây, Nông trại, Trại lính gác, Chòi thợ săn, Xưởng gỗ, Xưởng đá, Kho, Kho công cụ, Nhà chế tạo | wood 170, hide 4 | 2.4 |
| 2→3 | food 100, wood 250, stone 200, hide 50, coin 30 | 1 | 18 loại: Trại thợ ném, Kho vũ khí, Nhà thợ xây, Trại kỵ thú, Bãi tập, Nông trại, Trại lính gác, Nhà dân, Chòi thợ săn, Trại chiến binh, Nhà nghiên cứu, Xưởng gỗ, Xưởng đá, Chuồng thú cưỡi, Kho, Kho công cụ, Lều họp chiến, Nhà chế tạo | wood 1070, hide 99, stone 260, coin 10 | 12.9 |
| 3→4 | food 800, wood 500, stone 400, hide 200, coin 100 | 2 | 21 loại: Trại thợ ném, Kho vũ khí, Nhà thợ xây, Trại kỵ thú, Bãi tập, Nông trại, Hàng rào cọc, Cổng, Trại lính gác, Nhà dân, Chòi thợ săn, Trại chiến binh, Nhà nghiên cứu, Xưởng gỗ, Xưởng đá, Chuồng thú cưỡi, Kho, Kho công cụ, Hố chông, Lều họp chiến, Nhà chế tạo | wood 1755, hide 179, stone 838, coin 10 | 26 |
| 4→5 | food 1200, wood 800, stone 700, hide 300, coin 200 | 3 | 21 loại: Trại thợ ném, Kho vũ khí, Nhà thợ xây, Trại kỵ thú, Bãi tập, Nông trại, Hàng rào cọc, Cổng, Trại lính gác, Nhà dân, Chòi thợ săn, Trại chiến binh, Nhà nghiên cứu, Xưởng gỗ, Xưởng đá, Chuồng thú cưỡi, Kho, Kho công cụ, Hố chông, Lều họp chiến, Nhà chế tạo | wood 2577, hide 302, stone 1837, coin 10 | 44.8 |

Tổng tối thiểu lên lửa 4 (nhà ở các cấp 1..3 theo lần lượt, tính chồng nhiều lần nhà nâng — thực tế nâng tiếp nên chi phí tích lũy bằng tổng bảng ở dòng L=3 + chi phí lửa): xem dòng 3→4.

## 4. Nghiên cứu (thời đại Đồ đá; chưa tính nhóm chiến tranh trung cổ)
| Nhóm | số mục | chi phí | công (ngày công) | cấp Nhà nghiên cứu cần |
|---|---|---|---|---|
| foot | 40 | food 1064, wood 1064, stone 528, hide 104, coin 311 | 32.5 | 1/2 |
| cavalry | 40 | food 1064, wood 1064, stone 528, hide 104, coin 311 | 32.5 | 1/2 |
| archer | 40 | food 1064, wood 1064, stone 528, hide 104, coin 311 | 32.5 | 1/2 |
| club | 15 | food 399, wood 399, stone 198, hide 39, coin 57 | 13 | 1/2 |
| spear | 15 | food 399, wood 399, stone 198, hide 39, coin 57 | 13 | 1/2 |
| mace | 15 | food 399, wood 399, stone 198, hide 39, coin 57 | 13 | 1/2 |
| sling | 15 | food 399, wood 399, stone 198, hide 39, coin 57 | 13 | 1/2 |
| bow | 15 | food 399, wood 399, stone 198, hide 39, coin 57 | 13 | 1/2 |
| axe | 15 | food 399, wood 399, stone 198, hide 39, coin 57 | 11.3 | 1/2 |
| pick | 15 | food 399, wood 399, stone 198, hide 39, coin 57 | 11.3 | 1/2 |
| hoe | 15 | food 399, wood 399, stone 198, hide 39, coin 57 | 11.3 | 1/2 |
| hammer | 10 | food 266, wood 266, stone 132, hide 26, coin 38 | 7.5 | 1/2 |
| wood | 25 | food 665, wood 665, stone 330, hide 65, coin 255 | 19.2 | 1/2 |
| stone | 25 | food 665, wood 665, stone 330, hide 65, coin 255 | 19.2 | 1/2 |
| food | 25 | food 665, wood 665, stone 330, hide 65, coin 255 | 19.2 | 1/2 |
| hunt | 25 | food 665, wood 665, stone 330, hide 65, coin 255 | 19.2 | 1/2 |
| tame | 25 | food 665, wood 665, stone 330, hide 65, coin 255 | 19.2 | 1/2 |
| build | 15 | food 399, wood 399, stone 198, hide 39, coin 164 | 12 | 1/2 |
| craft | 15 | food 399, wood 399, stone 198, hide 39, coin 164 | 12 | 1/2 |
| research | 15 | food 399, wood 399, stone 198, hide 39, coin 164 | 12 | 1/2 |
| guard | 10 | food 266, wood 266, stone 132, hide 26, coin 38 | 8.2 | 1/2 |
| towerman | 10 | food 266, wood 266, stone 132, hide 26, coin 38 | 8.2 | 1/2 |
| fence | 5 | food 133, wood 133, stone 66, hide 13, coin 19 | 4.1 | 1/2 |
| gate | 5 | food 133, wood 133, stone 66, hide 13, coin 19 | 4.1 | 1/2 |
| trap | 10 | food 266, wood 266, stone 132, hide 26, coin 38 | 8.2 | 1/2 |
| tower | 10 | food 266, wood 266, stone 132, hide 26, coin 38 | 8.2 | 1/2 |
| tier:foot | 1 | food 200, wood 120, hide 20, coin 20 | 5 | 3 |
| tier:cavalry | 1 | food 200, wood 120, hide 20, coin 20 | 5 | 3 |
| tier:archer | 1 | food 200, wood 120, hide 20, coin 20 | 5 | 3 |
| tier:club | 1 | wood 100, stone 60, hide 10, coin 15 | 3.8 | 3 |
| tier:spear | 1 | wood 100, stone 60, hide 10, coin 15 | 3.8 | 3 |
| tier:mace | 1 | wood 100, stone 60, hide 10, coin 15 | 3.8 | 3 |
| tier:sling | 1 | wood 100, stone 60, hide 10, coin 15 | 3.8 | 3 |
| tier:bow | 1 | wood 100, stone 60, hide 10, coin 15 | 3.8 | 3 |
| tier:wood | 1 | food 150, wood 100, stone 40, coin 15 | 4.2 | 3 |
| tier:stone | 1 | food 150, wood 100, stone 40, coin 15 | 4.2 | 3 |
| tier:food | 1 | food 150, wood 100, stone 40, coin 15 | 4.2 | 3 |
| tier:hunt | 1 | food 150, wood 100, stone 40, coin 15 | 4.2 | 3 |
| tier:tame | 1 | food 150, wood 100, stone 40, coin 15 | 4.2 | 3 |
| tier:build | 1 | wood 100, stone 60, hide 10, coin 20 | 4.2 | 3 |
| tier:craft | 1 | wood 100, stone 60, hide 10, coin 20 | 4.2 | 3 |
| tier:research | 1 | wood 100, stone 60, hide 10, coin 20 | 4.2 | 3 |

- Quân (bộ binh, kỵ, cung, lính gác, lính chòi): 143 mục, food 4324, wood 4084, stone 1848, hide 424, coin 1069, 128.9 ngày công.
- Kinh tế + công cụ: 225 mục, food 5985, wood 5985, stone 2970, hide 585, coin 1976, 173.2 ngày công.
- Tất cả: 486 mục, food 13852, wood 14162, stone 6884, hide 1362, coin 3654, 443.8 ngày công. Nhà nghiên cứu: 1/2/3/4 người/cấp, craftSpeed 1/1/1/1 → thời gian thật = ngày công ÷ (số nhà nghiên cứu × craftSpeed × hiệu suất mùa/đêm).

## 5. Chế tạo (công cụ, vũ khí, giáp, đuốc)
| Id | Loại | Chi phí | Thời gian (ngày công) |
|---|---|---|---|
| axe1 | axe | wood 3 | 0.1 |
| axe2 | axe | wood 2, stone 3 | 0.2 |
| pick1 | pick | wood 4 | 0.1 |
| pick2 | pick | wood 2, stone 4 | 0.2 |
| hoe1 | hoe | wood 3 | 0.1 |
| hoe2 | hoe | wood 2, stone 2 | 0.2 |
| hammer1 | hammer | wood 3 | 0.1 |
| hammer2 | hammer | wood 2, stone 3 | 0.2 |
| torch1 | torch | wood 2 | 0.1 |
| club1 | club | wood 2 | 0.1 |
| spear1 | spear | wood 5 | 0.1 |
| mace2 | mace | wood 20, stone 10 | 0.4 |
| sling1 | sling | wood 5, hide 3, stone 5 | 0.3 |
| bow1 | bow | wood 30, hide 10, feather 3 | 0.4 |
| hide1 | hide | hide 30 | 0.4 |
| bone2 | bone | hide 30, bone 20 | 0.7 |

Nhà chế tạo: craftSpeed 1/1/1/1, 1/2/3/4 thợ theo cấp.
- 20 lính (giáo + giáp da + đuốc): wood 140, hide 600; 11.8 ngày công thợ (chia cho số thợ × craftSpeed).
- 40 lính (giáo + giáp da + đuốc): wood 280, hide 1200; 23.7 ngày công thợ (chia cho số thợ × craftSpeed).
- 60 lính (giáo + giáp da + đuốc): wood 420, hide 1800; 35.5 ngày công thợ (chia cho số thợ × craftSpeed).
- 100 lính (giáo + giáp da + đuốc): wood 700, hide 3000; 59.2 ngày công thợ (chia cho số thợ × craftSpeed).

## 6. Kẻ thù: quy mô quân theo cấp lửa của người chơi
Số lính/dân của mỗi làng cố định theo cấp trại của nó (random lúc tạo thế giới); SỨC MẠNH tổng được co giãn theo cấp lửa của ta bằng % chỉ số cho từng lính (làng mạnh lên qua % chỉ số, không thêm lính). Giá trị 1 lính ta = giá trị khi nghiên cứu hết chỉ số mở được ở Nhà nghiên cứu cấp = cấp lửa (không tính vũ khí/giáp).
| Lửa ta | Dân tối đa ta | Trần quân ta | Giá trị 1 lính ta | Làng | cấp trại | lính | dân | mục tiêu quân | %chỉ số/lính | số lính ta cần để ngang |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 13 | 12.8 | 1.6 | Suối Nguồn | 4 | 24 | 16 | 0.6 | +-70% | 1 |
| 1 | 13 | 12.8 | 1.6 | Rìu Đá | 4 | 24 | 16 | 2.8 | +-51% | 2 |
| 1 | 13 | 12.8 | 1.6 | Đầm Lầy | 4 | 24 | 16 | 2 | +-56% | 2 |
| 1 | 13 | 12.8 | 1.6 | Hang Gấu | 2 | 9 | 7 | 1.3 | +-48% | 1 |
| 1 | 13 | 12.8 | 1.6 | Đồi Cát **BOSS** | 4 | 38 | 26 | 817.8 | +178% | 501 |
| 2 | 46 | 51.1 | 1.9 | Suối Nguồn | 4 | 24 | 16 | 2.6 | +-53% | 2 |
| 2 | 46 | 51.1 | 1.9 | Rìu Đá | 4 | 24 | 16 | 11.1 | +-23% | 6 |
| 2 | 46 | 51.1 | 1.9 | Đầm Lầy | 4 | 24 | 16 | 7.8 | +-31% | 5 |
| 2 | 46 | 51.1 | 1.9 | Hang Gấu | 2 | 9 | 7 | 5.1 | +-17% | 3 |
| 2 | 46 | 51.1 | 1.9 | Đồi Cát **BOSS** | 4 | 38 | 26 | 3658.6 | +358% | 1976 |
| 3 | 70 | 228.7 | 5.4 | Suối Nguồn | 4 | 24 | 16 | 9.5 | +-27% | 2 |
| 3 | 70 | 228.7 | 5.4 | Rìu Đá | 4 | 24 | 16 | 41.2 | +20% | 8 |
| 3 | 70 | 228.7 | 5.4 | Đầm Lầy | 4 | 24 | 16 | 29 | +7% | 6 |
| 3 | 70 | 228.7 | 5.4 | Hang Gấu | 2 | 9 | 7 | 19 | +28% | 4 |
| 3 | 70 | 228.7 | 5.4 | Đồi Cát **BOSS** | 4 | 38 | 26 | 5226.5 | +416% | 960 |
| 4 | 100 | 326.7 | 5.4 | Suối Nguồn | 4 | 24 | 16 | 13.6 | +-17% | 3 |
| 4 | 100 | 326.7 | 5.4 | Rìu Đá | 4 | 24 | 16 | 58.9 | +35% | 11 |
| 4 | 100 | 326.7 | 5.4 | Đầm Lầy | 4 | 24 | 16 | 41.5 | +20% | 8 |
| 4 | 100 | 326.7 | 5.4 | Hang Gấu | 2 | 9 | 7 | 27.2 | +45% | 5 |
| 4 | 100 | 326.7 | 5.4 | Đồi Cát **BOSS** | 4 | 38 | 26 | 6271.8 | +449% | 1152 |

Chỗ lính tối đa của ta ở cấp 4: bộ binh/cung/kỵ/gác = 20/20/20/24 = 84; mỗi làng thu nạp/tiêu diệt thêm 5 chỗ cho MỖI trại.

### Sự kiện theo lịch (events.json)
| Id | Loại | Ngày | Mùa/năm | Quân | Ban đêm | Báo trước |
|---|---|---|---|---|---|---|
| wolves_summer_1 | beasts (wolf) | 4–5 | Xuân năm 1 | 2 | ngày | 2 ngày |
| wolves_summer_2 | beasts (wolf) | 9–10 | Hạ năm 1 | 4 | ngày | 3 ngày |
| wolves_summer_3 | beasts (wolf) | 15–16 | Thu năm 1 | 6 | đêm | 3 ngày |
| axe_scout | raid (axe) | 12–14 | Thu năm 1 | 4 | ngày | 2 ngày |
| wolves_winter | beasts (wolf) | 23–27 | Xuân năm 2 | 6 | đêm | 1 ngày |
| bear_autumn | beasts (bear) | 19–20 | Đông năm 1 | 1 | đêm | 1 ngày |
| swamp_raid | raid (swamp) | 27–31 | Hạ năm 2 | 6 | đêm | 0 ngày |
| axe_war | raid (axe) | 33–37 | Thu năm 2 | 14 | ngày | 1 ngày |

## 7. Đo bằng trận thật (sim không giao diện, 3 seed; quân ta dịch tới sát trại địch)
Điều kiện: lửa cấp 4, mọi trại lính đầy, đồ cao nhất đồ đá (chùy/giáo/cung + giáp xương). "Nghiên cứu hết" = mọi mục chỉ số quân đã xong. Mỗi làng thu nạp/tiêu diệt thêm 15 chỗ lính (5 chỗ × 3 trại). Mỗi ô: số seed thắng / tổng · số lính ta chết trung bình.

### Đánh BOSS (cấp trại 3 hoặc 4 tùy seed)
| Làng đã chiếm | Quân ta | Nghiên cứu hết | Không nghiên cứu |
|---|---|---|---|
| 0 | 84 | 0/6 · chết 57 | 0/6 · chết 60 |
| 2 | 114 | 3/3 · chết 36 | 0/3 · chết 90 |
| 4 | 144 | 3/3 · chết 23 | 0/3 · chết 120 |
| 6 | 174 | 3/3 · chết 17 | 0/3 · chết 149 |
| 8 | 204 | 3/3 · chết 17 | 0/3 · chết 164 |

### Đánh làng thường (quân ta 84, lửa 4)
| Làng | cấp trại | nghiên cứu hết: chết / thời gian | không nghiên cứu: chết / thời gian |
|---|---|---|---|
| Hang Gấu | 2 | 0 / 36s | 1 / 129s |
| Hang Gấu | 4 | 0 / 48s | 2 / 87s |
| Rìu Đá | 4 | 0 / 44s | 6 / 96s |
| Suối Nguồn | 1 | 0 / 21s | 0 / 43s |
| Suối Nguồn | 4 | 0 / 43s | 2 / 89s |
| Đầm Lầy | 1 | 0 / 22s | 0 / 32s |
| Đầm Lầy | 4 | 0 / 51s | 1 / 92s |

**Kết luận từ trận thật**
- Làng thường: 84 lính thắng dễ dù chưa nghiên cứu (chết 0–6, xong trong 20–130 giây game). Không cần nghiên cứu để đánh làng thường.
- Boss: 84 lính thua dù nghiên cứu hết (chết ~55–60 trên 84). Cần ≥ ~114 lính + nghiên cứu hết mới thắng (chết ~20–66). Không nghiên cứu thì dù 204 lính vẫn thua. Nghiên cứu chỉ số quân là điều kiện bắt buộc để hạ boss.
- Công thức "sức mạnh" trong difficulty.json (mục tiêu quân của boss ≈ 6.300 so với trần quân người chơi ≈ 327 ở lửa 4, tức ~19 lần) không phản ánh kết quả trận: trận thật thắng với ~114–144 lính, nên `boss.power` = 16 đã được chỉnh theo thử trận như ghi chú trong file.

## 8. Những gì CHƯA đo được (cần bot chơi hoặc quyết định thiết kế)
- **Thời gian từ đầu tới khi hạ boss, số mùa, thiệt hại dân, số dân mới**: cần một bot chơi theo luồng (xây → nâng → nghiên cứu → đánh làng thường → thu nạp → đánh boss). Chưa có bot nên chưa có số thật; dưới đây chỉ là cận dưới theo bảng.
- **Cận dưới theo dân số**: dân đầu 3, +1–3 người/ngày (TB 2) → đủ 100 dân mất ≥ 50 ngày (≈ 2,5 năm game ≈ 17 giờ thật). Muốn ≥114 lính + dân làm việc (≥ ~170 dân) cần thêm chỗ từ làng thu nạp (mỗi làng cấp 4 thêm 40 chỗ) và thêm người đến: ≥ ~85 ngày ≈ 4 năm game.
- **Nghiên cứu**: hết nhóm quân (143 mục) = 129 ngày công; với Nhà nghiên cứu cấp 4 (4 người) ≈ 32 ngày + ảnh hưởng mùa/thời tiết; hết toàn bộ đồ đá (486 mục) = 444 ngày công.
- **Chế tạo**: 114 lính × (vũ khí + giáp) ≈ 70–90 ngày công thợ (bảng 5), chia cho số thợ (tối đa 4 ở cấp 4).
- **Thức ăn**: bảng 2 cho thấy cần ~540 thức ăn/ngày ở lửa 4 (100 dân, 40% lính), trong khi năng suất danh nghĩa mỗi người mỗi ngày chỉ khoảng 11 (hái quả), 6 (ruộng cấp 1), 30 (săn), và mùa đông hái lượm = 0. Có vẻ nền kinh tế thức ăn thiếu rất nhiều, nhưng `npm run economy` hiện trả 0 cho ruộng (Ruộng không còn `buildable`) và mô phỏng làng cấp 4 của mình cho thức ăn âm gần −200/ngày, nên chưa kiểm chứng được. Cần đo đúng trước khi cân bằng.
- **Thiệt hại từ sự kiện** (sói, đột kích 4/6/14 người): nhỏ so với 84 lính, nhưng chưa đo bằng số.

