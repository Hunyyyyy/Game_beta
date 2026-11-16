# Cây Cốt Truyện Đồ Đá – Rễ, Thân, Nút Thắt, Lá, Trái, Ngọn

Nov 15, 2026 · @Huy

## Mình hiểu ý bạn thế này

Bạn muốn biến các cuộc gặp người lạ rời rạc trong stone.json thành một cái cây: mỗi lựa chọn chỉ để lại dấu, đủ dấu thì nút thắt mới nổ, nút thắt rút ra kết quả khác nhau ở mỗi ván, nhiều kết quả gặp nhau thành kết quả lớn hơn, và cuối cùng ngọn cây quyết định thời trung cổ ra sao.

Mình giữ 11 kịch bản cũ làm các "chặng" của cành (không bỏ câu thoại nào), rồi thêm chặng mới, nút thắt, lá, trái và ngọn. Phần bịa thêm lấy cảm hứng từ lịch sử thế giới; chỗ nào mình phải đoán về game của bạn thì ghi rõ ở mục cuối.

| Tầng | Là gì | Ví dụ trong tài liệu | Số lượng |
| --- | --- | --- | --- |
| Rễ | Thế giới Đồ đá và các bộ tộc quanh làng | Tộc Rìu Đá, Tộc Hang | 4 tộc |
| Dấu | Điểm cộng dồn ngầm sau mỗi lựa chọn | Nhân, Uy, Tín, Lộ, Hợp | 5 dấu |
| Cành | Chuỗi 3 chặng quyết định cùng chủ đề | "Bếp lửa mở" | 6 cành |
| Nút thắt | Sự kiện chỉ nổ khi đủ Dấu, rồi rút ngẫu nhiên | "Đêm không ai ngủ" | 6 nút |
| Lá | Kết quả của nút thắt | "Xóm mới" | 24 lá + 6 lá Biến |
| Trái | Lá từ các thân khác nhau gặp nhau | "Làng Mở" | 10 trái |
| Ngọn | Kết cục Đồ đá, di sản sang trung cổ | "Cố Đô Mở" | 9 ngọn + 1 mặc định |

## Luật của cây

Không lựa chọn nào dẫn thẳng tới kết quả: mỗi lựa chọn chỉ ghi Dấu, và nút thắt chỉ nổ khi Dấu cùng tiến độ đủ điều kiện.

1. **Ghi Dấu.** Mỗi lựa chọn và mỗi deed cộng hoặc trừ vào 5 Dấu (bảng ở mục sau). Người chơi không thấy số, chỉ nghe lời đồn quanh làng, ví dụ "dân mà bảo làng này mềm lòng".
2. **Đi hết chặng.** Một cành có 3 chặng rải trong nhiều ngày, mỗi chặng là một cuộc gặp có 2 đến 4 lựa chọn. Chuỗi lựa chọn tạo ra "dáng cành" (ví dụ Cho ăn, Nhận cả đoàn, Vòng lửa chung). Hai ván cùng tổng Dấu nhưng khác dáng cành sẽ nghiêng về lá khác nhau.
3. **Nút thắt nổ khi đủ ba điều:** đã qua ít nhất 2 trong 3 chặng của cành; tổng các Dấu liên quan vượt ngưỡng của nút; đã tới mốc tiến độ của nút. Nút nổ trễ 2 đến 6 ngày sau khi đủ điều kiện (engine đã có `schedule` với `days` và `maxDelay`). Quá hạn mà vẫn thiếu Dấu thì nổ bản nhạt (một lá mặc định, ít hệ quả) để cây không cụt.
4. **Rút lá.** Mỗi lá có trọng số nền, cộng thêm theo các Dấu nó nghiêng về. Rút bằng seed của ván chơi ghép với id của nút: cùng save thì tải lại ra cùng kết quả, seed khác thì ra kết quả khác.
5. **Lá để lại Cờ và hệ quả**, dùng đúng các effect đang có: `rel`, `give` / `take`, `join`, `raid`, `eventMod`, `schedule`, `flag`.
6. **Trái.** Khi hai lá thuộc hai thân khác nhau cùng còn hiệu lực, một sự kiện Trái được hẹn sau 3 đến 8 ngày. Trái cũng có lựa chọn, rồi rút 1 trong 2 biến thể. Mỗi lá chỉ nuôi tối đa 2 trái, để cây rẽ nhánh thay vì dồn vào một đường.
7. **Ngọn.** Ở Ngày Sương Tan (lúc Nhà chung lên cấp 4 và người chơi hạ hết các làng thủ lĩnh (có cả làng boss), rồi hộp thoại đổi thời đại hiện ra), game chấm các Trái đang có và chọn 1 ngọn chính cùng 1 ngọn phụ. Ngọn chính đổi cốt truyện trung cổ, ngọn phụ đổi hệ số vận hành.

Công thức rút lá (D\_k là giá trị Dấu k, n\_i là trọng số nền của lá i, a\_ik là mức lá i nghiêng về Dấu k, w\_min là sàn để không lá nào biến mất hoàn toàn):

```latex
w_i = \max\left(w_{min},\; n_i + \sum_k a_{ik} D_k\right), \qquad P(i) = \frac{w_i}{\sum_j w_j}
```

### Lá Biến: hạt sạn không ai đoán trước

Mỗi nút thắt có thêm 8% cơ hội rút trúng một lá Biến, không phụ thuộc Dấu. Mỗi lá Biến chỉ xuất hiện tối đa một lần trong một ván.

| Lá Biến | Chuyện gì xảy ra | Hệ quả |
| --- | --- | --- |
| B1 Sao chổi | Một vệt lửa vắt ngang trời bảy đêm | Có Người giữ lửa (Thân III): Tín +2, dân phấn chấn. Không có: dân bỏ việc 2 ngày, 1 người rời đi |
| B2 Bầy thú di cư | Hàng trăm con đi qua thung lũng 5 ngày | Có từ 5 lính hay thợ săn: lương gấp đôi trong 5 ngày. Không đủ: thú giẫm nát ruộng, mất lương |
| B3 Đứa bé bị bỏ lại | Một đứa bé nằm trước cổng làng, không ai nhận (gợi chuyện Romulus và Remus bị bỏ rừng) | Nhận nuôi: Nhân +2, Hợp +1, thêm 1 dân tiềm năng cao (90 trở lên). Từ chối: Nhân −1 |
| B4 Mưa đá | Một trận đá đập nát ruộng và giàn phơi | Mất 25% lương chưa cất; có kho lương thì chỉ mất 10% |
| B5 Mảnh sắt trời | Một thiên thạch rơi xuống đồi, mảnh kim loại đen đập không vỡ (người Ai Cập từng rèn dao từ sắt thiên thạch) | Đặt Cờ `sat_troi`. Nếu sau đó có người thợ giỏi, mở đường tới Trái Kim Loại Trời |
| B6 Tiếng trống từ sương | Ba đêm liền nghe trống từ rìa bản đồ: một bộ tộc xa đang tiến vào thung lũng | Mở một ô sương ở rìa; 30 ngày tới, trọng số mọi lá nghiêng về Uy tăng 10% |

### Nhịp thời gian

Mình chia theo **tiến độ Đồ đá** thay vì số ngày, vì một ván Đồ đá khoảng 3 đến 4 giờ nhưng không đoán trước được, và nó chỉ kết thúc khi Nhà chung lên cấp 4 và người chơi hạ hết các làng thủ lĩnh (có cả làng boss). Tiến độ là trung bình của hai thước: cấp Nhà chung (cấp 1 là 0, cấp 4 là 1) và mức đối đầu với làng boss (chưa chạm mặt là 0, đã thăm dò là 0,5, đã hạ là 1). Vì game khóa cấp 4 cho đến khi hạ hết thủ lĩnh, thước thứ hai gần như là cổng thật: người chơi có thể kẹt ở cấp 3 với tiến độ khoảng 67%, nên các mốc nút đều dồn về dưới 70%. Không có đồng hồ nào ở đây, nên các mốc phần trăm bên dưới chỉ là vị trí trên hai thước đó.

Vì Đồ đá ngắn, **mỗi thân chỉ nổ tối đa một trong hai nút** (nút nào đủ điều kiện trước). Nút còn lại, nếu chưa nổ khi sang trung cổ, trở lại ở đó như một "Chuyện cũ" với 50% hệ quả. Ván Đồ đá thường chỉ chín 1 đến 2 Trái; khi có 0 hoặc 1 Trái, Ngọn chính vẫn chấm được từ một lá mạnh nhất cộng Dấu cao nhất, còn Ngọn phụ có thể để trống. Phần nặng của truyện nằm ở trung cổ.

| Nút thắt | Mở trong khoảng tiến độ | Vì sao đúng lúc này |
| --- | --- | --- |
| I-1 Đêm không ai ngủ | 25 đến 45% | Sau vài lần nhận người lạ |
| III-1 Đường vỏ sò | 30 đến 50% | Sau lần thương lái thứ hai |
| I-2 Tiếng gọi từ sương | 35 đến 55% | Sau khi người chạy trốn đã ở lại |
| II-1 Ngày đòi nợ | 45 đến 65% | Khớp lúc các tộc bắt đầu đòi cống |
| II-2 Đứa trẻ bên kia | 50 đến 70% | Sau khi có chuyện giữ người hay trả người |
| III-2 Mùa đông dài | 55 đến 70% | Mùa đông đứng phía cuối Đồ đá |
| Trái | 70 đến 90% | Khi đã có đủ lá để gặp nhau |
| Ngọn | 100% | Ngày Sương Tan |

## Bảng Dấu

Cây dùng 5 Dấu; các deed đã có trong stone.json giữ nguyên tên, mình chỉ thêm cột nói mỗi deed đẩy Dấu nào.

| Dấu | Ý nghĩa | Hay tăng khi | Hay giảm khi | Phai theo thời gian |
| --- | --- | --- | --- | --- |
| Nhân | Tiếng "làng biết thương người" | Cho ăn, nhận người, trả chộc | Đuổi người, giao người tị nạn | Chậm: 1 điểm mỗi 15 ngày |
| Uy | Nỗi sợ của láng giềng | Phô lính, chống cống, thắng trận | Bị lộ yếu, dọa hụt | Chậm |
| Tín | Chữ tín khi giao thiệp | Tiếp sứ, trả đủ, giữ lời | Trứng lời, đuổi sứ | Chậm |
| Lộ | Người ngoài biết làng giàu hay yếu đến đâu | Cho người lạ xem kho, trả cống, phô yếu | Đóng cửa, dựng tường rào | Chậm |
| Hợp | Độ hòa nhập của người ngoài trong làng | Nhận người, giao việc quan trọng | Tách bếp, trục xuất | Không phai: người đã ở lại thì còn ở lại |

Lộ không xấu cũng không tốt, nó là mức người khác biết về bạn: Lộ cao kéo thương lái lẫn kẻ trộm. Chỉ Hợp không phai, vì đây là thứ duy nhất gắn với con người cụ thể ở trong làng.

### Deed cũ đẩy Dấu nào

| Deed (đã có) | Nhân | Uy | Tín | Lộ | Hợp |
| --- | --- | --- | --- | --- | --- |
| `helped_wanderer` | +1 |  |  |  |  |
| `took_in_wanderer` | +2 |  |  |  | +1 |
| `refused_wanderer` | −1 |  |  |  |  |
| `took_in_thief` |  |  |  |  | +1 |
| `thief_again` |  |  |  | +2 |  |
| `pardoned_thief` | +1 |  |  | +1 |  |
| `punished_thief` | −1 | +1 |  |  |  |
| `hosted_travelers` | +1 |  | +1 | +1 |  |
| `took_refugees` | +2 |  |  | +1 | +2 |
| `fed_refugees` | +1 |  |  |  |  |
| `refused_refugees` | −2 |  |  |  |  |
| `handed_over` | −3 |  | +1 |  |  |
| `paid_pursuers` |  | −1 |  | +1 |  |
| `defied_pursuers` | +1 | +2 | −1 |  |  |
| `hosted_scouts` |  |  | +2 | +1 |  |
| `showed_force` |  | +3 |  |  |  |
| `showed_weakness` |  | −1 |  | +3 |  |
| `drove_off_scouts` |  | +1 | −2 |  |  |
| `paid_tribute` |  | −1 | +1 | +1 |  |
| `refused_tribute` |  | +1 | −1 |  |  |
| `scared_off_tribute` |  | +3 |  |  |  |
| `bluff_failed` |  | −3 |  | +2 |  |
| `bought_peace` |  |  | +1 | +1 |  |
| `bought_time` |  |  |  | +1 |  |
| `defied_ultimatum` |  | +2 |  |  |  |
| `paid_ransom` | +2 |  | +1 |  |  |
| `refused_ransom` | −2 |  |  |  |  |

### Lời đồn thay cho con số

Người chơi không thấy điểm. Khi một Dấu vượt mốc, một dân làng hoặc người lạ nói một câu vào cột Nhật ký trên thanh trên cùng, ví dụ:

- Nhân cao: "Ngoài đường ai cũng kể làng này có bếp lửa lúc nào cũng còn phần cho người lạ."
- Uy cao: "Mấy người Rìu Đá bảo đừng đụng tới làng này."
- Lộ cao: "Có kẻ đếm kho lương của mình từ bên kia suối."
- Tín thấp: "Thương lái đồn mình nói một đằng làm một nằng."
- Hợp cao: "Bữa tối giờ không ai phân biệt đâu là người cũ, đâu là người mới."

## Rễ: thung lũng và các làng quanh đó

Người chơi bắt đầu với 2 người quanh Nhà chung, và mỗi làng láng giềng mượn bóng một nền văn minh có thật để người chơi có thứ mà đoán. Các mốc lịch sử dưới đây là kiến thức nền của mình, không tra lại nguồn, dùng để gợi cảm hứng chứ không dựng lại sử.

| Làng (id trong JSON) | Tính cách | Vai trò trong cây | Hình bóng lịch sử |
| --- | --- | --- | --- |
| Suối Nguồn (`spring`) | Thợ đá lửa, hay đi buôn | Thương lái, người lang thang, đoàn người đi đường | Mạng buôn đá obsidian thời Tân thạch quanh Çatalhöyük, và vỏ sò cowrie làm tiền sơ khai |
| Đầm Lầy (`swamp`) | Thợ da, đan lưới, hay sốt rét | Người tị nạn, thương lái lừa đảo, dịch bệnh | Dân nhà sàn ven hồ ở vùng Alps thời Tân thạch |
| Rìu Đá (`axe`) | Chiến binh, chọn thủ lĩnh bằng sức | Do thám, đòi cống, tối hậu thư | Danegeld: nước Anh trả bạc cho người Viking từ năm 991, trả càng nhiều bị đòi càng lớn, đến 1016 Cnut lên ngôi vua |
| Hang Gấu (`cave`) | Sống trong núi, giữ lửa, đói vào mùa đông | Đòi cống, kẻ đuổi theo, lửa thiêng | Đàn đá Göbekli Tepe do dân săn bắt hái lượm dựng khoảng 9500 TCN; các nữ tư tế đền Vesta giữ lửa thiêng cho thành Roma |
| Đồi Cát, Bến Cá, Đỉnh Gió | Chưa có kịch bản gặp người lạ | Làng xa trong lá Biến, Trái và Ngọn | Tùy bạn đặt |

Theo bản tóm tắt game, các làng NPC có bậc yếu, thường, trung và boss, và có bộ tộc đến muộn chiếm lại làng. Cây không thêm một boss mới: đến Ngày Sương Tan, Ngọn quyết định thái độ và sức mạnh của các làng boss và bộ tộc đến muộn: bạn, chủ nợ, hay kẻ thù truyền kiếp. Theo quyết định của bạn, làng boss là làng mạnh nhất và được rút ngẫu nhiên theo seed của mỗi ván, nên mỗi ván boss là một làng khác. Phần Ngọn nói theo vai ("làng boss") và áp lên đúng làng đó.

Ba nguyên tắc kể chuyện:

- Không có người tốt kẻ xấu cố định: cùng một người lạ có thể là ân nhân hay kẻ phản, engine đã có `truth` rút theo seed, cây dùng lại đúng cơ chế đó.
- Mọi lựa chọn đều có giá: mở cửa thì lộ, đóng cửa thì cô lập, trả cống thì yên một mùa rồi bị đòi nhiều hơn.
- Mượn hình bóng, không chiều theo sử: chuyện nào cũng rẽ khỏi đường thật để phục vụ game.

## Thân I: Cửa làng

Thân I hỏi một câu: làng này mở cửa hay đóng cửa với người lạ, và mỗi bên phải trả giá gì. Hình bóng lịch sử: theo truyền thuyết, Romulus mở nơi trú ẩn cho kẻ lưu vong để dựng Roma; Sparta thì đuổi người ngoại quốc (xenelasia), giữ được sự thuần nhất nhưng ít người.

### Cành I.A: Bếp lửa mở

Dùng lại `wanderer`, `newcomers`, `travelers` và thêm một chặng mới.

**Chặng 1. Kẻ lang thang** (`wanderer`). Người đói đến cửa làng. Sự thật ẩn được rút theo seed, dùng cơ chế `truth` và `clues` như `peddler`: đói thật 55%, do thám của Rìu Đá 20% (hỏi nhiều về lính gác), mang bệnh 15% (ho, da vàng), con bỏ nhà 10% (nói được tiếng nhiều làng).

- Cho một bữa ăn: Nhân +1
- Giữ lại làm việc: Nhân +2, Hợp +1
- Đuổi đi: Nhân −1
- Quan sát kỹ trước khi quyết (`reveals`, rel −1): không đổi Dấu, nhưng lộ manh mối, và manh mối đó sẽ đổi trọng số các lá sau này

**Chặng 2. Đoàn người đi đường** (`newcomers` hoặc `travelers`, sự thật: thật thà, trộm, bắt cóc).

- Nhận cả đoàn: Hợp +2, Nhân +1, Lộ +1
- Chỉ nhận một người: Hợp +1
- Cho ăn rồi tiễn: Nhân +1
- Không nhận: Nhân −1, Lộ −1 (đóng cửa thì ít người biết về làng)

**Chặng 3. Bữa tối chung** (mới, hiện khi trong làng có ít nhất 1 người từ ngoài tới). Một người đề nghị nấu chung bữa tối ngoài bãi.

- Vòng lửa chung, ai cũng ngồi chung: Hợp +2, Nhân +1, Lộ +1
- Hai bếp, người cũ một bên, người mới một bên: Hợp −1, Lộ −1
- Giao người mới gác đêm, đặt cược lòng tin: Tín +2, Hợp +1, Lộ +2
- Mời người lạ kể chuyện quanh lửa: Tín +1, Hợp +1. Người kể nói thật nếu thật thà (hé một ô sương trên bản đồ), nói sai nếu là trộm hay do thám (ô sương dẫn tới chỗ trống hoặc bẫy). Chuyện kể là thông tin, và thông tin luôn kèm rủi ro.

#### Nút thắt I-1: Đêm không ai ngủ

Nổ khi: xong ít nhất 2 chặng cành I.A, Hợp cộng Lộ từ 5 trở lên, tiến độ 25 đến 45%.

| Lá | Nghiêng về | Chuyện xảy ra | Hệ quả |
| --- | --- | --- | --- |
| I1-a Xóm mới | Hợp, Nhân, Vòng lửa chung | Đêm đó người mới dựng mái nhà riêng bên rìa làng, gọi là "bếp thứ hai". Làng đông thêm nhưng sinh ra một phé nhỏ có tiếng nói riêng | Thêm 2 chỗ ở, Cờ `xom_moi`, một người thành "trưởng bếp hai" (dùng ở Trái Làng Mở) |
| I1-b Nội gián mở cổng | Lộ, Hai bếp, Giao gác đêm; giảm mạnh nếu đã quan sát kỹ | Người được tin giao gác mở lối. Sáng ra kho lương vơi. Nếu hắn là do thám Rìu Đá, 3 ngày sau có thêm một đợt raid nhỏ | Dùng `act: steal` có sẵn, Cờ `noi_gian`, Tín −1. Nếu đã quan sát kỹ: đổi thành "Bắt quả tang", Uy +1, kẻ đó thành con tin (nối sang Thân II) |
| I1-c Bệnh sốt từ đường xa | Hợp cao, Nhân thấp; hoặc người lạ mang bệnh | Một phần ba dân nằm liệt 6 ngày | Nhân cao: có người tình nguyện chăm, chỉ mất 2 ngày công, Tín +1. Nhân thấp: mất 1 đến 2 người, Cờ `benh_sot` |
| I1-d Người có tài | Nhân, Tín, Chuyện kể quanh lửa | Một người được nhận hóa ra có tay nghề hiếm (thợ đẽo đá, thầy lang, hay người dẫn đường) | Thêm 1 dân tiềm năng cao (90 trở lên), Cờ `nhan_tai`. Nối sang Trái Kim Loại Trời |

### Cành I.B: Bước chân sau lưng

Dùng lại `refugees`, `pursuers` và thêm một chặng mới.

**Chặng 1. Ba người chạy trốn** (`refugees`).

- Nhận cả ba: Nhân +2, Hợp +2, Lộ +1 (35% kẻ đuổi sẽ tới)
- Cho ăn rồi tiễn: Nhân +1
- Từ chối: Nhân −2

**Chặng 2. Kẻ đuổi theo** (`pursuers`, hiện khi kẻ đuổi tới, hoặc khi họ tìm đến hỏi đường sau khi bạn từ chối).

- Giao họ ra: Nhân −3, Tín +1
- Trả lương cho họ rút: Uy −1, Lộ +1
- Không giao: Uy +2, Nhân +1, Tín −1, raid

**Chặng 3. Lời kể của người sống sót** (mới, chỉ hiện nếu đã giữ ít nhất một người). Họ kể vì sao bị đuổi, rút 1 trong 3: trốn cuộc nội chiến của Hang Gấu; tù binh Rìu Đá tẩu thoát; hay kẻ phạm lệ bị chính bộ tộc đuổi.

- Tin và dùng thông tin để mở sương, mở đường: Tín +1, Lộ +1
- Giữ kín: Lộ −1, Hợp +1
- Dâng họ cho làng kia để đổi quan hệ: Nhân −2, Tín +1, quan hệ với làng đó +10

#### Nút thắt I-2: Tiếng gọi từ phía sương

Nổ khi: xong ít nhất 2 chặng cành I.B, Nhân cộng Uy cộng Tín từ 4 trở lên, tiến độ 35 đến 55%.

| Lá | Nghiêng về | Chuyện xảy ra | Hệ quả |
| --- | --- | --- | --- |
| I2-a Kẻ đuổi thành sứ giả | Tín, đã trả hoặc đã giao | Thủ lĩnh nhóm đuổi quay lại một mình, không vũ khí: bên kia muốn nói chuyện | Mở chuỗi trao con tin (Thân II, cành II.B), quan hệ với làng đó +8 |
| I2-b Chiến thắng đầu tiên | Uy, không giao | Bên kia kéo tới trả thù. Nếu có từ 10 lính: bạn thắng, thu vũ khí, Uy +3. Ít hơn: thua, mất lương, Lộ +2 | raid ×1.5, rẽ hai ngả bằng `soldiers>=10` |
| I2-c Tiếng lành đồn xa | Nhân, Hợp | Người được cứu kể lại ở làng cũ: 6 đến 10 người kéo tới xin ở nhờ trong một tuần | `welcome` theo số chỗ còn trống; không đủ chỗ thì phải chọn ai phải đi (quyết định mới) |
| I2-d Người bị bỏ lại trở về | Nhân thấp, Lộ cao, đã giao người | Người từng bị giao quay lại, dẫn kẻ cướp biết kho làng ở đâu | raid vào kho, Cờ `no_mau`. Nối sang Trái Nợ Máu |

## Thân II: Láng giềng

Thân II hỏi: khi kẻ mạnh đòi phần, làng cúi đầu, đánh trả, hay khôn khéo đứng giữa. Hình bóng lịch sử: Danegeld cho thấy cống nạp nuôi lòng tham của kẻ đòi; còn Philip II của Macedon thời trẻ từng làm con tin ở Thebes và học được lối đánh của chính nơi giữ mình, nên con tin có thể là cầu nối chứ không chỉ là món nợ.

### Cành II.A: Kẻ đòi phần

Dùng lại `scout_envoy`, `extortion`, `ultimatum`.

**Chặng 1. Do thám Rìu Đá** (`scout_envoy`).

- Tiếp đàng hoàng, tốn 12 lương: Tín +2, Lộ +1
- Dẫn đi xem lính gác và bẫy: nếu có từ 5 lính thì Uy +3 và họ hoãn tập kích 3 ngày; nếu ít hơn thì Lộ +3, Uy −1 và kẻ địch mạnh thêm 30%
- Đuổi đi: Uy +1, Tín −2

**Chặng 2. Đòi cống** (`extortion`, từ Rìu Đá hoặc Hang Gấu).

- Trả đủ: Uy −1, Tín +1, Lộ +1
- Mặc cả xuống một nửa (rút 50%): thành thì nhẹ gánh, hụt thì Uy −1 và họ quay lại sớm hơn
- Dọa lại bằng hàng lính: từ 10 lính mới ăn thua; thành thì Uy +3, hụt thì Uy −3, Lộ +2
- Từ chối: Uy +1, Tín −1, raid

**Chặng 3. Tối hậu thư** (`ultimatum`).

- Nộp để họ rút hẳn: Tín +1, Lộ +1
- Nộp để họ hoãn vài ngày: Lộ +1
- Thách đánh: Uy +2

#### Nút thắt II-1: Ngày đòi nợ

Nổ khi: xong ít nhất 2 chặng cành II.A, số lần đã phải đối mặt yêu sách từ 3 trở lên, tiến độ 45 đến 65%.

| Lá | Nghiêng về | Chuyện xảy ra | Hệ quả |
| --- | --- | --- | --- |
| II1-a Vòng xoáy cống nạp | Trả cống từ 3 lần, Uy thấp, Lộ cao | Giá đòi tăng ×1.5 sau mỗi lần, dần thành "thuế mùa". Trả thì yên, nhưng mỗi mùa mất khoảng 20% thu nhập (vỏ sò và lương) | Cờ `chu_no`, mở nhiệm vụ "Lật cống" về sau |
| II1-b Làng cứng đầu | Uy cao: dọa lại thành công hoặc phô lính | Rìu Đá quay sang gặm làng khác; tên làng bạn thành cái tên được nể sợ. Thủ lĩnh Rìu gửi lời mời ngồi vào bàn việc vùng | Uy +2, Cờ `uy_danh`; nếu Tín cũng cao thì mở hội nghị ở Trái Cầu Bốn Tộc |
| II1-c Lưỡi rìu chia hai | Tín cao, đã tiếp sứ | Trong Rìu Đá có hai phé: phé chiến muốn đánh, phé hòa muốn buôn. Họ nhờ làng làm bên thứ ba | Quyết định mới: ủng hộ phé chiến (Rìu mạnh lên, quan hệ −), ủng hộ phé hòa (quan hệ +, Rìu yếu), hay đứng ngoài. Cờ `rieu_phe` quyết định thái độ Rìu Đá về sau |
| II1-d Kẻ đòi nợ lớn hơn | Uy thấp, Lộ cao, dọa hụt | Rìu Đá và Hang Gấu bắt tay, một liên quân kéo tới | raid ×2 và giữ lại 1 người (nối sang cành II.B) |

### Cành II.B: Con tin và đường về

Dùng lại `ransom` và thêm hai chặng mới.

**Chặng 1. Người bị giữ** (`ransom`, hiện khi có dân bị bắt: do raid, bắt cóc, hay bắt quả tang nội gián).

- Trả chộc (giá theo mood như cũ): Nhân +2, Tín +1
- Không trả: Nhân −2, quan hệ −6

**Chặng 2. Trao trẻ** (mới). Bên kia đề nghị: gửi một đứa trẻ sang ở một mùa, đổi lấy một đứa trẻ của họ.

- Gửi một đứa trẻ của làng sang: Tín +3, Hợp +1
- Nhận đứa trẻ của họ về nuôi: Hợp +2, Nhân +1, Lộ +1
- Từ chối: Tín −1

**Chặng 3. Mùa học việc** (mới, sau khoảng 15 ngày). Đứa trẻ đến tuổi về hoặc đến tuổi đi.

- Cho về đúng hẹn: Tín +1
- Giữ lại thêm: Hợp +1, Tín −2
- Xin cho ở lại như họ hàng hai bên: Hợp +2, Tín +1 (chỉ hiện nếu cả hai bên đều bày tỏ)

#### Nút thắt II-2: Đứa trẻ bên kia

Nổ khi: xong ít nhất 2 chặng cành II.B, Tín cộng Hợp từ 4 trở lên, tiến độ 50 đến 70%.

| Lá | Nghiêng về | Chuyện xảy ra | Hệ quả |
| --- | --- | --- | --- |
| II2-a Cầu nối | Tín cao, đã gửi người sang | Người trở về nói được tiếng bên kia, mang theo tay nghề: lối đánh của Rìu Đá, cách giữ lửa của Hang Gấu, hay cách chọn đá của Suối Nguồn | Quan hệ +12 với làng đó, thêm 1 dân kỹ năng cao, Cờ `cau_noi` |
| II2-b Đứa trẻ hai làng | Hợp cao, đã nhận trẻ về nuôi | Đứa trẻ lớn trong làng bạn và không muốn về. Bên kia coi đó là món nợ hoặc cớ gây chuyện | Rút 50/50: họ xin cho ở lại như họ hàng (quan hệ +8), hoặc đòi lại bằng vũ lực (raid nhỏ). Cờ `hai_dong_mau` |
| II2-c Con tin chết | Nhân thấp, Lộ cao, hoặc có raid khi con tin đang ở làng | Đứa trẻ ở làng bạn chết (bệnh hay trong một cuộc tập kích). Không ai tin đó là tai nạn | Quan hệ −30 với làng đó, Cờ `no_mau`. Nối sang Trái Nợ Máu |
| II2-d Hội đồng lửa | Tín cao, đã trả chộc hoặc đổi người đàng hoàng | Hai làng thề không đánh nhau một mùa dưới ngọn lửa của một làng thứ ba | 40 ngày không bị làng đó raid, Cờ `hoi_dong_lua` |

## Thân III: Lửa và Đất

Thân III không có kẻ thù, chỉ có của cải và mùa màng, và nó khuếch đại mọi thứ ở hai thân kia. Hình bóng lịch sử: bức tường Jericho thời Tân thạch (khoảng 8000 TCN), đàn đá Göbekli Tepe, ngọn lửa thiêng đền Vesta. Thân này nối thẳng vào Chợ (vỏ sò, hạn mức mỗi ngày), kho lương, bữa ăn chung cuối ngày và mùa đông chậm 0.8× của game.

### Cành III.A: Chợ đường xa

Dùng lại `peddler` và thêm hai chặng mới.

**Chặng 1. Gánh hàng đầu tiên** (`peddler`, thật thà hay lừa đảo theo `truth`).

- Hỏi kỹ rồi mua: Tín +1
- Mua ngay: Tín +1, và nếu là kẻ lừa thì Lộ +1 (họ biết làng dễ tin)
- Chê giá, bỏ đi: Tín −1

**Chặng 2. Món chịu** (mới). Thương lái đề nghị bán chịu một lô vật liệu, hẹn trả bằng vỏ sò sau 10 ngày.

- Mua chịu: Tín +2; trả trễ thì Tín −3
- Trả sòng phẳng: Tín +1
- Từ chối buôn: Tín −1, Lộ −1

**Chặng 3. Đường muối** (mới). Thương lái chỉ đường tới một mỏ muối bên kia đồi và bán bản đồ.

- Cử đoàn 3 người đi 8 ngày: Lộ +1, Tín +1
- Mua bản đồ trước rồi mới quyết: Tín +1 (nếu là kẻ lừa thì bản đồ giả, mất vỏ sò)
- Không đi: Lộ −1

#### Nút thắt III-1: Đường vỏ sò

Nổ khi: xong ít nhất 2 chặng cành III.A, Tín từ 3 trở lên, tiến độ 30 đến 50%.

| Lá | Nghiêng về | Chuyện xảy ra | Hệ quả |
| --- | --- | --- | --- |
| III1-a Chợ cổng làng | Tín cao, thương lái thật | Thương lái ghé định kỳ sau mỗi 6 ngày, dựng sạp ngoài cổng: một phiên chợ nhỏ | Chợ: hạn mức ngày +20%, mỗi lần ghé có 1 món hàng hiếm, Cờ `cho_cong` |
| III1-b Vỏ sò mất giá | Lộ cao, từng bị lừa | Vỏ sò giả tràn vào, ai cũng nghi ai | Chợ: phí +25% và tỉ giá kém trong 15 ngày, Tín −1, Cờ `vo_so_gia` |
| III1-c Mỏ muối | Đã cử đoàn, thương lái thật | Đoàn tìm ra mỏ muối: thịt khô giữ được lâu hơn, nhưng mỏ nằm trên đất tranh chấp | Lương hao trong kho −30%, kéo thêm 1 đợt do thám Rìu Đá, Cờ `mo_muoi` |
| III1-d Thương lái bị cướp | Uy thấp, Lộ cao | Một thương lái bị cướp và chết trên đường quanh làng; các làng đổ lỗi cho nhau | Uy cao: làng nhận giữ đường, thu phí vỏ sò mỗi 6 ngày, Cờ `chu_duong`. Uy thấp: thương lái bỏ vùng, Chợ mất món hàng hiếm trong 20 ngày |

### Cành III.B: Lửa và mùa

Cành này hoàn toàn mới, không có người lạ nào: chỉ có làng và mùa.

**Chặng 1. Kho lương vơi dần** (cuối thu).

- Tích trữ cho mùa đông: Lộ +1 (cả vùng biết làng có tiền)
- Chia đều bữa ăn chung: Nhân +1, Hợp +1
- Đổi bớt lương lấy vũ khí: Uy +1

**Chặng 2. Người giữ lửa.** Một đêm bão tắt lửa Nhà chung, cả làng lạnh một đêm.

- Lập người giữ lửa, luân phiên một người một đêm: Tín +1, Hợp +1
- Mỗi nhà tự giữ lửa nhà mình: Hợp −1
- Giao cho người ngoài khéo giữ: Hợp +2, Lộ +1

**Chặng 3. Vòng đá trên đồi.** Dân đề nghị dựng một vòng đá lớn để "xin mùa".

- Dựng vòng đá (tốn 15 ngày công): Tín +2, Hợp +1
- Dựng tường rào dày quanh làng, dùng hàng rào cọc và cổng: Uy +2, Lộ −2, Hợp −1
- Không dựng gì, giữ công cho việc khác: không đổi Dấu

#### Nút thắt III-2: Mùa đông dài

Nổ khi: xong ít nhất 2 chặng cành III.B, tiến độ 55 đến 70% (rơi vào mùa đông, khi game có bão tuyết).

| Lá | Nghiêng về | Chuyện xảy ra | Hệ quả |
| --- | --- | --- | --- |
| III2-a Mùa đông chia đều | Nhân, Hợp cao, đã chia bữa ăn | Tuyết phủ 12 ngày, ai cũng bớt miếng ăn nhưng không ai bị bỏ lại. Sau này dân kể chuyện đó như một lễ | Không ai chết đói, Nhân +2, Tín +1, mở "Ngày chia" (lễ định kỳ, nâng tinh thần) |
| III2-b Mùa đông giành giật | Lộ cao, Hợp thấp, kho vơi | Lương vơi nhanh, bè phái chia nhau kho, trộm cắp nội bộ; một nhóm đòi tách đi | 3 đến 6 người rời làng (khoảng 15% dân), Cờ `phan_ly`. Nối sang Trái Làng Chia Đôi |
| III2-c Lửa thiêng | Có người giữ lửa, có vòng đá | Người giữ lửa thành thầy tế: chỉ lúc nhóm lửa, ngày dọn kho. Hang Gấu nghe tin và kính trọng | Quan hệ Hang Gấu +10, Cờ `lua_thieng`, gợi mở tri thức nung đất |
| III2-d Tường cứu mạng | Có tường, Uy cao | Một đêm tuyết, bầy sói tràn xuống; tường và cổng chặn được. Nhưng sáng hôm sau một nhóm người xin vào trú bị bỏ ngoài tuyết | Không mất người trong trận sói, Uy +1; nếu có người bị bỏ ngoài: Nhân −2, Cờ `cua_dong`. Nối sang Trái Làng Kín |

## Trái: nhiều lá gặp nhau

Một Trái chỉ sinh ra khi hai lá trở lên từ các thân khác nhau cùng còn hiệu lực, và bạn không thể định trước từ đầu ván vì mỗi lá đều do rút. Trái là cảnh có lựa chọn riêng (lựa chọn này lại ghi Dấu), rồi để lại một Cờ dài hạn mà Ngọn sẽ đọc. Mỗi lá nuôi tối đa 2 Trái, và Trái được hẹn sau 3 đến 8 ngày khi đủ lá.

| Trái | Cần những lá (lấy đủ 2 lá trở lên) | Chuyện xảy ra và quyết định bên trong | Cờ để lại |
| --- | --- | --- | --- |
| T1 Làng Mở | I1-a Xóm mới, I2-c Tiếng lành đồn xa, III2-a Mùa đông chia đều | Ngoài vùng ai cũng biết "đến đó là có chỗ ngồi bên lửa". Hội đồng cũ và xóm mới tranh nhau ai được nói. Chọn: lập hội đồng chung có đại diện xóm mới (Hợp +2, quyết chậm hơn), giữ quyền ở người cũ (Hợp −2, Uy +1), hay bốc thăm (rút ngẫu nhiên) | `lang_mo` |
| T2 Làng Kín | III2-d Tường cứu mạng, I1-b Nội gián mở cổng hoặc I2-d Người bị bỏ lại trở về | Sau khi bị phản và sau đêm tuyết bỏ người ngoài cửa, làng đặt luật: qua cổng phải có người bảo lãnh. Chọn: luật bảo lãnh cho mọi người (Lộ −3, Hợp −2), chỉ đóng với nhóm đã phản (Hợp giữ nguyên), hay hủy luật (Nhân +1, Lộ +2) | `lang_kin` |
| T3 Kẻ Nộp Cống | II1-a Vòng xoáy cống nạp, III1-b Vỏ sò mất giá | Vỏ sò mất giá mà cống vẫn tính theo vỏ sò; người đòi mang cân riêng. Chọn: nộp bằng lương thực (Nhân −1, kho hụt), vay thương lái để nộp (Tín +1, một món nợ lớn), hay nổi dậy (Uy +2, chiến sự) | `ke_nop_cong` |
| T4 Làng Rìu Cứng | II1-b Làng cứng đầu, I2-b Chiến thắng đầu tiên, III2-d Tường cứu mạng | Tiếng thắng bay xa, thanh niên đòi vào lính. Chọn: lập đội lính thường trực (Uy +2, tốn lương mỗi ngày), giữ dân binh khi cần (Hợp +1), hay thuê người ngoài làm lính (Tín −1, Lộ +1) | `rieu_cung` |
| T5 Cầu Bốn Tộc | II2-a Cầu nối, III1-a Chợ cổng làng hoặc III1-d Thương lái bị cướp, II1-c Lưỡi rìu chia hai | Làng thành nơi các làng gặp nhau, vì ai cũng tin người nói được tiếng cả bốn bên. Chọn: họp chợ chung mỗi 15 ngày (Tín +2, Lộ +2), lập luật đường (Uy +2, thu phí), hay giữ riêng (không đổi) | `cau_bon_toc` |
| T6 Đàn Lửa | III2-c Lửa thiêng, II2-d Hội đồng lửa; phụ thêm nếu gặp B1 Sao chổi | Hang Gấu cử người tới nhóm lửa chung ở vòng đá; các làng khác bắt đầu hành hương. Chọn: mở đàn cho mọi làng (Tín +3, Lộ +1), hay giữ đàn cho riêng làng mình (Uy +1, Tín −1) | `dan_lua` |
| T7 Nợ Máu | II2-c Con tin chết, I2-d Người bị bỏ lại trở về (phụ thêm II1-d) | Hai món nợ cùng lúc: một người chết ở làng bạn, một người bị bỏ rơi quay lại dẫn đường cho kẻ cướp. Chọn: tìm cách đền bù (Nhân +2, mất lớn), thề trả thù (Uy +3, Tín −3), hay giấu chuyện (Lộ +2) | `no_mau_sau` |
| T8 Kim Loại Trời | I1-d Người có tài, III1-c Mỏ muối, B5 Mảnh sắt trời | Người thợ đẽo đá giỏi, mỏ muối đã mở đường và mảnh sắt trời nằm trên bàn. Ông thử nung. Chọn: dốc công thử rèn (tốn nhiều công, mở sớm kiến thức kim loại), giữ làm báu vật (Tín +2, danh tiếng), hay đổi cho làng khác (quan hệ +, Lộ +2) | `kim_loai_som` |
| T9 Hai Dòng Máu | II2-b Đứa trẻ hai làng, I2-a Kẻ đuổi thành sứ giả | Hai người lớn lên ở hai làng xin được nên vợ nên chồng. Chọn: cho lấy nhau (Tín +3, Hợp +2), cấm (Tín −2), hay làm lễ nhận họ (Hợp +3) | `hon_uoc` |
| T10 Làng Chia Đôi | III2-b Mùa đông giành giật, I1-c Bệnh sốt hoặc I1-b Nội gián mở cổng | Nhóm người tách đi dựng "làng con" bên kia suối. Chọn: cho đi kèm lương (Nhân +2, làng con thân thiện), đuổi (Nhân −2, Uy +1, làng con thù), hay gài người ở lại theo dõi (Lộ +1, Tín −1) | `lang_con` |

Lá nào không vào Trái nào vẫn để lại hệ quả riêng của nó ("lá rơi"), và vẫn tính vào điểm của Ngọn ở bước sau với trọng số nhỏ.

## Ngọn: kết cục Đồ đá và di sản sang trung cổ

Khi Nhà chung lên cấp 4 và người chơi hạ hết các làng thủ lĩnh (có cả làng boss), game chấm các Trái đang có, chọn 1 Ngọn chính và 1 Ngọn phụ, và hai Ngọn cùng quyết định thời trung cổ bắt đầu ra sao.

Cách chấm: mỗi Ngọn được 3 điểm cho mỗi Trái liên quan, 1 điểm cho mỗi lá rơi liên quan, và thêm nửa điểm cho mỗi Dấu trội hợp với nó. Điểm cao nhất là Ngọn chính; điểm cao nhì nhưng khác họ với Ngọn chính là Ngọn phụ; hòa thì rút theo seed; không có Ngọn thứ hai thì để trống. Chơi mà không có Trái nào thì ra Ngọn mặc định "Làng Vô Danh" (bắt đầu trung cổ chuẩn, không hệ số nào đổi), để cây không bao giờ cụt. 9 Ngọn chính nhân 8 Ngọn phụ cho 72 kết cục khác nhau.

| Ngọn | Đến từ Trái | Cốt truyện ở trung cổ |
| --- | --- | --- |
| N1 Cố Đô Mở | T1 Làng Mở (thêm T9) | Làng thành nơi người ta tìm tới, nhiều giọng, nhiều nghề: thành phố đầu tiên của vùng. Các làng boss coi bạn là nơi để buôn bán hơn là nơi để đánh; bộ tộc đến muộn thường tới làm khách rồi ở lại |
| N2 Pháo Đài Núi | T2 Làng Kín, T4 Làng Rìu Cứng | Làng khép kín sau tường dày, ít bạn, nhiều lính. Làng boss coi bạn là đối thủ khó cắn, chỉ nói chuyện được ở chân tường |
| N3 Triều Cống | T3 Kẻ Nộp Cống | Bạn là chư hầu, mỗi mùa phải nộp. làng boss là chủ nợ, và chuỗi "Lật cống" mở ra: phản kháng, xin hòa, hay gả con tin. Nếu cống không dừng, chủ nợ có thể lên làm vua (như Cnut sau Danegeld) |
| N4 Thương Cảng Vỏ Sò | T5 Cầu Bốn Tộc (thêm T8) | Làng là nơi bốn bên gặp nhau, vỏ sò của bạn thành tiền chuẩn của vùng. Các làng boss là khách hàng lớn; bám vào bạn càng lâu càng khó đánh |
| N5 Đàn Lửa Thiêng | T6 Đàn Lửa (thêm T9) | Làng thành nơi hành hương, có thầy tế, có lễ, có luật. Hang Gấu và các làng quy phục bằng niềm tin, nhưng tranh cãi giáo lý có thể chia rẽ dân |
| N6 Dòng Máu Thù | T7 Nợ Máu | Một làng boss không bao giờ đầu hàng hay chịu nhận làm người chung, mỗi mùa gửi biệt kích. Thù hận thành động cơ quân sự dài hạn |
| N7 Thợ Rèn Đầu Tiên | T8 Kim Loại Trời | Vào trung cổ với tay nghề kim loại sớm hơn hẽt cả vùng. Các làng boss thèm sắt của bạn; bộ tộc đến muộn nhắm vào mỏ |
| N8 Hai Làng Một Gốc | T10 Làng Chia Đôi | Làng con bên kia suối thành một làng NPC độc lập, nói cùng tiếng với bạn. Bạn thành bạn hay thù của chính dân mình, và mục tiêu thống nhất bản đồ có thêm một bước "Hợp nhất" |
| N9 Hôn Ước | T9 Hai Dòng Máu | Một cuộc hôn nhân liên minh khóa bạn với một làng boss: ngoại giao kiểu gia tộc, hiếm nhưng rất bền |
| Mặc định: Làng Vô Danh | Không có Trái | Bắt đầu trung cổ chuẩn, mọi thứ theo luật gốc |

## Ngọn đổi cách game vận hành ở trung cổ

Mỗi Ngọn là một gói hệ số gắn vào các hệ thống game đã có, nên nó đổi cả nút bấm chứ không chỉ đổi lời thoại. Hai quy tắc giữ cho khớp thiết kế hiện tại: Ngọn không chạm vào cấp công trình (cấp vẫn theo Nhà chung), và Ngọn phụ chỉ chạy 50% hệ số của Ngọn chính. Con số dưới đây là đề xuất để bạn chỉnh.

| Ngọn | Đổi cách chơi | Chuỗi sự kiện mở ra |
| --- | --- | --- |
| N1 Cố Đô Mở | Người đến cửa làng mỗi ngày ×1.5, 20% trong số đó có tiềm năng cao; nghiên cứu Binh lực chậm 10% vì hội đồng đông tiếng nói; dịch bệnh dễ xảy ra ×1.5 | Phe phái trong hội đồng mỗi mùa; tộc người mới xin lập xóm riêng |
| N2 Pháo Đài Núi | Hàng rào, cổng, chòi canh, hố chông hiệu quả +15%; Binh lực rẻ 15%; Chợ phí +20% vì ít người buôn; sương dày hơn (do thám nhìn kém 1 ô); raid lẻ ít nhưng mỗi đợt lớn hơn | Chuỗi vây hãm từ làng boss, và cảnh "mở cửa hay chịu đói" khi đứt lương |
| N3 Triều Cống | Mỗi 10 ngày phải nộp một phần thu cho làng boss (đảo chiều cơ chế cống của game: lần này bạn là bên nộp). Đổi lại, làng đó không raid và chặn bộ tộc đến muộn | Nhiệm vụ "Lật cống": thắng một trận, gả con tin, hay xin hòa |
| N4 Thương Cảng Vỏ Sò | Chợ: phí −20%, hạn mức ngày +30%, mở đổi hàng sớm 1 bậc; nghiên cứu Sinh kế rẻ 15%; nhưng raid nhắm vào kho và chợ ×1.3 | Thương đoàn các làng ghé; vụ giá vỏ sò dài hạn |
| N5 Đàn Lửa Thiêng | Thiếu ăn chỉ trừ 10% chỉ số thay vì 20%; dân không bỏ làng; mở nhánh nghiên cứu nhỏ "tín ngưỡng" dưới Sinh kế (lễ, luật) | Hành hương; tranh cãi giáo lý có thể tách dân |
| N6 Dòng Máu Thù | Lính đánh làng thù gây sát thương ×1.1; khóa quà tặng, đầu hàng và nhận làm người chung với làng đó; biệt kích mỗi mùa | Chuỗi quấy rối trên đường hành quân; lời thề truyền kiếp |
| N7 Thợ Rèn Đầu Tiên | Thêm một hàng nghiên cứu đồng và sắt ở nhánh Kỹ nghệ; tốc độ rèn +20%; mỏ dễ tìm hơn nhưng than khan | Bộ tộc đến muộn nhắm vào mỏ; cảnh thợ rèn bị dụ sang làng khác |
| N8 Hai Làng Một Gốc | Thêm một làng NPC "làng con" nói cùng tiếng: nhận làm người chung được, chinh phục được, hay làm đồng minh cho mượn quân | Nhiệm vụ "Hợp nhất"; họ hàng hai bên xin gặp nhau |
| N9 Hôn Ước | Một làng boss thành thông gia: mượn lính của họ không tốn lương, nhưng khi họ gọi thì phải xuất quân; thêm hành động ngoại giao mới | Nhiệm vụ thông gia, đám cưới, tranh chấp thừa kế |
| Mặc định: Làng Vô Danh | Không đổi hệ số nào | Không có chuỗi đặc biệt |

Chuỗi sự kiện trung cổ do Ngọn mở sẽ tạm dừng khi game vào chế độ chiến tranh (nhà đóng băng sự kiện) và tiếp tục khi kết thúc.

## Cây trông ra sao, và ba ván chơi khác nhau

Hình dưới đây cho thấy mọi lựa chọn đổ vào Dấu, Dấu đổ vào 6 cành rồi 6 nút thắt, rồi thu hẹp dần qua lá, trái và ngọn. Ba ván dưới hình dùng cùng một cây: ván 1 và ván 3 chỉ khác nhau ở seed, và ra hai kết cục khác hẳn.

&#91;embedded content: cây Đồ đá · 3 thân, 6 cành, 6 nút thắt, 30 lá, 10 trái, 9 ngọn\]

Đọc từ trên xuống: Dấu đổ vào ba thân, mỗi cành dẫn tới một nút thắt, nút thắt rút lá, lá gặp nhau thành trái, trái hợp thành ngọn.

### Ván 1: Bếp lửa mở (người chơi nhân hậu, seed A)

1. Kẻ lang thang được giữ lại làm việc, đoàn người được nhận cả, bữa tối ngồi chung một vòng lửa. Nhân và Hợp lên cao.
2. Nút I-1 nổ ở khoảng 30% tiến độ. Trọng số nghiêng về Xóm mới và Người có tài; rút ra **Xóm mới**.
3. Ba người chạy trốn được nhận, không có kẻ đuổi tới. Nút I-2 rút ra **Tiếng lành đồn xa**: 8 người kéo tới.
4. Cuối thu chia đều bữa ăn, lập người giữ lửa. Nút III-2 rút ra **Mùa đông chia đều**.
5. Ba lá gặp nhau thành **Trái Làng Mở**; người chơi lập hội đồng chung.

Kết cục: Ngọn chính Cố Đô Mở, Ngọn phụ Thương Cảng Vỏ Sò (nhờ Chợ cổng làng). Trung cổ bắt đầu với dân đông, buôn bán mạnh, nhưng Lộ cao nên raid nhắm vào kho.

### Ván 2: Bức tường (người chơi cứng rắn, seed B)

1. Đuổi kẻ lang thang, không nhận đoàn người. Hợp và Lộ đều thấp, nên nút I-1 quá hạn mà vẫn thiếu Dấu, nổ bản nhạt (một lá mặc định, cây không cụt).
2. Phô lính cho do thám Rìu Đá xem, dọa lại thành công khi đòi cống. Uy lên rất cao. Nút II-1 rút ra **Làng cứng đầu**.
3. Không giao người cho kẻ đuổi, có trên 10 lính. Nút I-2 rút ra **Chiến thắng đầu tiên**.
4. Dựng tường rào dày. Nút III-2 rút ra **Tường cứu mạng**, nhưng một nhóm xin trú bị bỏ ngoài tuyết.
5. Ba lá gặp nhau thành **Trái Làng Rìu Cứng**.

Kết cục: Ngọn chính Pháo Đài Núi, Ngọn phụ để trống. Trung cổ bắt đầu với tường dày, ít bạn, và tiếng đồn lạnh lùng về đêm tuyết.

### Ván 3: Cùng lựa chọn với ván 1, seed C

Mọi quyết định giống hệt ván 1, nhưng hạt giống rút trúng những đường ít khả năng (mỗi lần khoảng 10 đến 15%):

1. Kẻ lang thang thật ra là do thám Rìu Đá, và vì bạn không quan sát kỹ nên không biết. Sự thật ẩn này cộng thêm trọng số cho Nội gián mở cổng.
2. Nút I-1 rút ra **Nội gián mở cổng**: kho vơi, 3 ngày sau một đợt raid nhỏ.
3. Nút I-2 vẫn ra **Tiếng lành đồn xa**, nhưng làng đã thiếu lương mà thêm 8 miệng ăn.
4. Nút III-2 rút ra **Mùa đông giành giật** thay vì chia đều. Một nhóm tách đi.
5. Trái Làng Mở thất bại (chỉ còn 1 trong 3 lá), nhưng Nội gián cộng Mùa đông giành giật đủ để thành **Trái Làng Chia Đôi**.

Kết cục: Ngọn chính Hai Làng Một Gốc. Nhóm tách đi dựng làng con bên kia suối; ở trung cổ đó sẽ là bạn hay thù của chính dân bạn, tùy cách bạn tiễn họ đi.

## Trung cổ I: cây thứ hai mọc từ Ngọn Đồ đá

Khi Nhà chung lên cấp 4 và các làng thủ lĩnh đã bị hạ, cây Đồ đá chốt lại và cây trung cổ bắt đầu. Cây này dùng đúng luật cũ (Dấu, Cành, Nút thắt, Lá, Trái, Ngọn) nhưng khác ở ba điểm.

1. **Dấu cũ được mang sang với 50%** (làm tròn xuống), riêng Hợp giữ nguyên. Thêm hai Dấu mới: **Luật** (làng được cai trị bằng gì: lệ làng, hội đồng hay một người; tăng khi lập luật, xử án công khai, giữ lời hứa; phai 1 điểm mỗi 30 ngày) và **Của** (làng tích trữ và trao đổi ra sao; tăng khi đầy kho, mở chợ, đầu tư mỏ; giảm khi kho cạn hoặc đi cướp; không phai theo ngày).
2. **Tiến độ trung cổ tính theo thế lực**, không theo thời gian chơi. Thước đo là tỉ lệ làng NPC đã bị đánh, thu phục hoặc kết minh trên 7 làng thường lưu sẵn lúc khởi đầu (phải lưu riêng vì làng được nhận làm người chung bị xóa khỏi danh sách; không tính trại cướp, bộ tộc đến muộn và làng phản loạn), trộn với cấp Nhà chung 4 đến 10, nên người chơi nhanh hay chậm cây vẫn chạy đúng thứ tự.
3. **Chế độ chiến tranh đóng băng sự kiện nhà**, nên mọi cành và nút của Thân IV và Thân VI dừng lại khi đang đánh nhau và đếm ngày dừng theo. Ngoại lệ là Thân V (Sắt và máu): chặng của nó diễn ra ngay trong chế độ chiến tranh, còn nút của nó nổ khi người chơi thoát chế độ đó.

### Ngọn Đồ đá làm nghiêng cây trung cổ

Ngọn Đồ đá không chỉ đổi luật chơi (đã nêu ở phần trên) mà còn là hạt giống của cây mới: cho Dấu khởi đầu, đẩy một thân lên đầu hàng và đổi trọng số của vài lá.

| Ngọn Đồ đá | Dấu khởi đầu thêm | Thân được ưu tiên | Lá bị nghiêng |
| --- | --- | --- | --- |
| N1 Cố Đô Mở | Luật +1, Hợp +1 | IV Ngai | Hội đồng trưởng lão +40% |
| N2 Pháo Đài Núi | Uy +1, Luật +1 | V Sắt và máu | Cuộc vây dai dẳng +40%, Chiến thắng nhanh -30% |
| N3 Triều Cống | Của +1, Uy -1 | IV Ngai | Ngai vay mượn mở (làng boss giữ một nửa quyền của bạn) |
| N4 Thương Cảng Vỏ Sò | Của +2 | VI Kho và mỏ | Chợ lớn trong năm đói +50% |
| N5 Đàn Lửa Thiêng | Luật +2 | IV Ngai | Ngai giáo quyền mở, Một người cầm đầu -20% |
| N6 Dòng Máu Thù | Uy +1, Lộ +1 | V Sắt và máu | Món nợ máu mở trong Hiệp ước trước thành |
| N7 Thợ Rèn Đầu Tiên | Của +1, Uy +1 | VI Kho và mỏ | Mỏ và lò +40%, Lò nổ +10% |
| N8 Hai Làng Một Gốc | Hợp +2 | IV Ngai | Hai ngai chung mở, Ngai bị chia -30% |
| N9 Hôn Ước | Luật +1, Hợp +1 | IV Ngai và V | Ngai qua hôn nhân mở |
| Làng Vô Danh (mặc định) | không có | không thân nào | mọi trọng số bằng nhau |

Có hai điều cần nhớ. Một là bảng này chỉ đổi trọng số và mở thêm lá, nó không bao giờ khoá hẳn một đường, nên người chơi vẫn có thể đi ngược chiều với di sản của mình, chỉ khó hơn. Hai là Ngọn phụ Đồ đá chỉ áp dụng một nửa các điểm Dấu và lá nghiêng ở trên, giống quy tắc 50% đã dùng cho luật chơi.

### Nhịp trung cổ: cấp Nhà chung 4 đến 10 và các loại lính

Không đợi được thời gian chơi, nên trung cổ được chia theo **cấp Nhà chung**. Theo game, Đồ đá là cấp 1 đến 3, cấp 4 là lúc trung cổ bắt đầu, và bạn muốn đi tới cấp 10. Mỗi cấp là một hồi của truyện. Hạng lính tối đa bằng cấp Nhà chung (hạng 4 đến 7 đã có, hạng 8 đến 10 làm mới), và việc mở loại lính vẫn do nghiên cứu Binh lực quyết định.

| Cấp | Hồi truyện | Nút mở | Lính mở (đề xuất) | Luật vận hành mới |
| --- | --- | --- | --- | --- |
| 4 | Chiếc ghế đầu tiên | IV-1 Ai ngồi ghế | Dân binh giáo (hạng 4, đồng) | Hội đồng, luật làng |
| 5 | Kho và tri thức | VI-1 Năm không mùa hè, VIII-1 Ngọn đèn đêm | Cung thủ, nỏ thủ, thám tử (hạng 5) | Chợ lớn, mỏ, nạn đói, perk nghiên cứu |
| 6 | Sắt và máu | V-1 Con đường chinh phạt, V-2 Hiệp ước trước thành | Kỵ binh nhẹ, lính công thành (hạng 6) | Trận và tù binh trong chế độ chiến tranh |
| 7 | Bạn và thù | VII-1 Con dao sau lưng, VII-2 Lệnh triệu tập. Ngọn giữa chấm | Cận vệ, sát thủ (hạng 7) | Nhiệm vụ bảo vệ và ám sát, lòng trung thành ẩn |
| 8 | Ngai đã vững | VII-3 Khi ngai đã vững (khi đã bá chủ) | Hiệp sĩ trọng giáp, lính đánh thuê (hạng 8) | Làng phụ thuộc, chiến dịch dẹp loạn |
| 9 | Hội thiên hạ | Chuỗi chiến dịch lớn (nhiều làng cùng lúc), không có nút mới | Lính tinh nhuệ hạng 9 mọi binh chủng | Quân đoàn nhiều mặt trận |
| 10 | Giang sơn | Chấm Ngọn cuối; chuỗi thống nhất | Pháo thủ (hỏa thương, đại bác tay), đội cận vệ vương (hạng 10) | Chiến dịch cuối cùng, kết cục |

### Mỗi loại lính được truyện dùng ở đâu

| Loại lính | Vai trong truyện | Nút hoặc lá liên quan |
| --- | --- | --- |
| Dân binh giáo | Lính nền; lính "đi vắng" khi đồng minh triệu tập | VII2-a, IV1-b |
| Cung thủ, nỏ thủ | Giữ tường, chịu cuộc vây dài | V1-b, Vây hãm ở Ngọn N2 |
| Thám tử | Tai mắt, gián điệp, trao mật thư | Cành V.B, V2-b |
| Kỵ binh nhẹ | Chiến thắng chớp nhoáng và dẹp loạn nhanh | V1-a, VII3-a |
| Lính công thành | Cuộc vây dai dẳng | V1-b |
| Cận vệ | Bảo vệ người chủ chốt; có thể bị mua chuộc | Cành VII.B, VII1-c, nhiệm vụ phụ Bảo vệ |
| Sát thủ | Ám sát, cũng là mối đe dọa từ làng thù | VII1-b, nhiệm vụ phụ Ám sát |
| Hiệp sĩ trọng giáp | Lực lượng đế quốc, nỗi sợ | TM2, Ngọn M3 |
| Lính đánh thuê | Mua bằng Của; có thể bị phe khác mua lại | TM3, Ngọn M4, VII1-c |
| Pháo thủ, đội cận vệ vương | Quân cuối của chuỗi thống nhất | Ngọn M1, M3 |

Quy tắc chống ép buộc: **cốt truyện không mở khóa lính**, việc đó do nghiên cứu Binh lực làm. Một lá cần một loại lính thì kiểm điều kiện (`soldiers>=...` hoặc lấy theo loại); người chơi chưa có thì lá chạy bản thay thế (ví dụ dân binh thay kỵ binh) để truyện không bị cụt.

## Trung cổ II: Thân IV, Ngai

Thân này hỏi một câu: khi làng đã đông và giàu, ai là người có quyền quyết định? Bóng lịch sử mượn từ Viện Nguyên lão La Mã, Hội đồng Lớn của Venezia, Đại Hội Kurultai của người Mông Cổ, Đại Hiến chương 1215 và cuộc chia đôi đế quốc Frank ở Verdun năm 843.

### Cành IV.A, Người cầm lửa già đi

1. **Chặng 1, cơn bệnh.** Người đứng đầu làng ngã bệnh. Hai người nổi lên: một chiến binh được lính quý, một người giỏi xử việc được dân tin. Bạn giao quyền tạm cho chiến binh (Uy +2), cho người xử việc (Tín +2, Luật +1) hay chia việc cho cả hai (Hợp +2, nhưng hai người sẽ cãi nhau ở chặng sau).
2. **Chặng 2, lời thề trước lửa.** Mùa đói nhẹ đến. Ai được ăn trước? Bạn bắt hai người thề công khai (Luật +1, Tín +1), để mỗi người tự lo cho phe mình (Hợp -1, Uy +1), hoặc đổi lấy lời thề bằng một phần kho (Của -1, Hợp +1).
3. **Chặng 3, chiếc gậy.** Người đứng đầu qua đời hoặc trao gậy. Bạn công bố người kế vị ngay (Uy +1), để làng bỏ phiếu bằng que gỗ (Luật +2, Hợp +1), hoặc giấu tin một thời gian (Lộ -1, tiếng đồn lan sớm).

### Cành IV.B, Lệ làng thành luật

1. **Chặng 1, vụ tranh đất đầu tiên.** Hai nhà cãi nhau về một mảnh ruộng. Bạn xử theo lệ cũ truyền miệng (Tín +1), nhờ người cao tuổi phân xử (Luật +1, Hợp +1), hoặc nhờ một làng ngoài làm trọng tài (Lộ +1, Luật +1, nhưng làng kia nhớ ơn).
2. **Chặng 2, bảng luật.** Có người đề nghị khắc luật lên phến đá. Bạn khắc và dựng giữa làng (Luật +2, Tín +1), chỉ giữ luật trong trí nhớ của người già (Uy +1), hoặc khắc nhưng chỉ cho một nhóm biết đọc (Luật +1, Uy +1, Hợp -1).
3. **Chặng 3, kẻ quyền thế phạm luật.** Người được lính quý phạm chính điều luật bạn mới dựng. Xử công bằng (Luật +2, Uy -1), miễn cho (Uy +1, Luật -2, Tín -1) hoặc đày êm bằng cách đền bù (Của -1, Luật +1).

### Nút IV-1, Ai ngồi ghế

Nút nổ khi đủ ba điều: Nhà chung từ cấp 4, đã qua ít nhất hai chặng của mỗi cành, và Luật + Uy + Hợp từ 4 trở lên. Quá hạn mà thiếu Dấu thì nổ bản nhạt (lá IV1-d).

| Lá | Rút nhiều khi | Chuyện xảy ra | Cờ và hệ quả |
| --- | --- | --- | --- |
| IV1-a Hội đồng trưởng lão | Luật, Hợp, Tín cao | Mười hai người lớn tuổi ngồi quanh lửa để quyết mọi việc lớn | Cờ `council`: mọi quyết định lớn trễ 1 ngày (`shiftDays`), nhưng sự kiện nhà hiếm khi bị hủy giữa chừng; bắt đầu chiến tranh cần 1 ngày bỏ phiếu |
| IV1-b Một người cầm đầu | Uy cao, Luật thấp | Một người nắm cả gậy lẫn kiếm, quyết định nhanh | Cờ `strongman`: quyết định nhanh, `powerMul` của sự kiện tăng; mỗi mùa có sự kiện Kẻ bất mãn, một nhóm nhỏ rời làng hoặc âm mưu |
| IV1-c Ngai bị chia | Hợp thấp, hai phe ngang nhau | Hai phe mỗi bên có một người kế vị | Cờ `split_throne`: khoảng 20% lính rời đi dựng một làng NPC cùng gốc (bộ tộc đến muộn); về sau họ là bạn hay thù tùy cách bạn tiễn |
| IV1-d Ngai rỗng (lá nhạt) | quá hạn, thiếu Dấu | Không ai dám ngồi, nhất người nhiếp chính tạm | Cờ `regency`: 30 ngày không được mở chiến tranh, nhưng không mất gì thêm |

Mỗi lá có một quyết định nhỏ để người chơi chỉnh hướng. Ví dụ ở IV1-a: mở rộng hội đồng cho cả phụ nữ và thợ thủ công (Hợp +2, Luật +1) hay giữ mười hai trưởng lão như cũ (Luật +2, Hợp -1). Ở IV1-b: thoả hiệp chia bớt quyền cho hai người thiện chí (Luật +1) hay dập tắt tiếng nói phản đối (Uy +2, Tín -2).

## Trung cổ III: Thân V, Sắt và máu

Thân này chạy ngay trong chế độ chiến tranh. Mỗi chặng là một lựa chọn hiện ra giữa trận, còn nút thắt nổ khi bạn thoát chế độ đó về làng, nên người chơi thấy hậu quả của cách mình đánh. Bóng lịch sử: cuộc chịnh phạt Khwarezm của người Mông Cổ, cuộc vây Constantinople năm 1453 (cổng Kerkoporta bị bỏ ngỏ), chính sách đồng hóa tù binh của La Mã, và chiến thắng đắt giá của Pyrrhus.

### Cành V.A, Lệnh xuất quân

1. **Chặng 1, chọn mục tiêu.** Đánh một làng yếu gần bên (Uy +2), một làng giàu xa hơn (Của +1, Lộ +1, dễ lộ quân), hay kẻ thù cũ đã nợ bạn (Uy +1, Tín +1, và mở sẵn Dấu nợ máu).
2. **Chặng 2, cách đánh.** Tấn công thẳng ngay (Uy +2, lính chết nhiều), chặn đường lương và chờ (Của +1, Luật +1, tốn thời gian), hay chờ mùa đông để họ đói (Tín +1, nhưng bạn cũng đói).
3. **Chặng 3, tù binh và chiến lợi phẩm.** Giết để gây sợ (Uy +2, Tín -2), đòi tiền chuộc (Của +2, dùng cơ chế `ransom` có sẵn), hay nhận làm dân (`takeIn`, Hợp +2, Luật +1, nhưng có kẻ ngầm phản).

### Cành V.B, Tiếng thì thầm sau tường

1. **Chặng 1, người lạ đề nghị làm tai mắt.** Nhận họ làm thám tử (Lộ +2, Tín -1), bắt và tra hỏi (Uy +1, Luật +1), hay mua lại họ làm kẻ hai mặt (Của -1, Lộ +1, nguy cơ bị phản).
2. **Chặng 2, sứ giả xin hòa.** Nhận hòa ngay (Tín +1, Hợp +1), ép thêm điều khoản (Uy +1, Của +1, để lại hận), hay từ chối và bắt sứ giả (Uy +1, Tín -2).
3. **Chặng 3, cánh cổng bỏ ngỏ.** Một kẻ phản bội bên trong hứa mở cổng đêm. Tin và đi (Lộ +1, có thể thắng lớn hoặc bị bắt), thử bằng một toán nhỏ trước (Luật +1), hay từ chối vì sợ bẫy (Tín +1, mất cơ hội).

### Nút V-1, Con đường chinh phạt

Nổ khi người chơi thoát chế độ chiến tranh sau khi đi ít nhất hai chặng cành V.A và Uy từ 3 trở lên. Quá hạn mà chưa đủ thì nổ lá nhạt V1-d.

| Lá | Rút nhiều khi | Chuyện xảy ra | Cờ và hệ quả |
| --- | --- | --- | --- |
| V1-a Chiến thắng chớp nhoáng | Uy cao, đánh thẳng | Cả một thời gian dài không ai dám đối mặt | Cờ `terror`: các làng yếu tự đồng ý cống nạp (`welcome`), nhưng làng boss đổi thái độ sang thù địch |
| V1-b Cuộc vây dai dẳng | Luật cao, chặn lương | Hai mùa đóng trại, kho cạn dần | Cờ `siege_wear`: Của -2, nhưng khi thành đổ thì được toàn bộ kho của họ |
| V1-c Tù binh thành dân | Hợp cao, nhận tù binh | Người bại trận học cách sống cùng bạn | Cờ `assimilated`: +dân, nghiên cứu Kỹ nghệ rẻ hơn, nhưng một phần nhỏ âm thầm phản |
| V1-d Chiến thắng đắt giá (lá nhạt) | quá hạn | Thắng, nhưng chỉ còn nửa số lính | Cờ `pyrrhic`: -lính, nhưng được danh tiếng; làng boss chỉ bớt kính nể |

### Nút V-2, Hiệp ước trước thành

Nổ khi đã qua ít nhất hai chặng cành V.B và Lộ + Tín từ 3 trở lên. Nút này có thể nổ trước V-1 vì chuyện mật đến nhanh hơn chuyện quân.

| Lá | Rút nhiều khi | Chuyện xảy ra | Cờ và hệ quả |
| --- | --- | --- | --- |
| V2-a Hòa ước giả | Tín thấp, ép thêm điều khoản | Một bên ký để có thời gian chậm rãi | Cờ `broken_treaty`: trên đường đi thỉnh thoảng bị raid bất ngờ, Tín không phục hồi trong một mùa |
| V2-b Gián điệp trong thành | Lộ cao, đã dùng thám tử | Tai mắt bạn gài sẵn một kẻ ở sâu | Cờ `inside_man`: lần sau đánh làng đó sức mạnh địch giảm (`powerMul` thấp), nhưng người này có thể bị bắt và khải |
| V2-c Liên minh bất đắc dĩ | Hợp, Tín cao, đã nhận hòa | Hai kẻ thù cùng chống một kẻ mạnh hơn | Cờ `grudging_ally`: một làng địch trở thành đồng minh hạn chế, không tấn công được nhưng có thể mòi lấy bạn |
| V2-d Cổng mở ban đêm | đã tin kẻ phản bội | Thành đổ gọn nhờ một cánh cổng | Cờ `night_gate`: lần đánh sau cả làng lính không dám tin ai lạ, nhưng danh tiếng được nâng |

Mỗi lá cũng có một quyết định nhỏ. Ví dụ ở V1-a: tha cho cả dân thành để gây thiện cảm (Tín +2, Uy -1) hay thiêu hủy một phần thành để gây sợ (Uy +2, Tín -2).

## Trung cổ IV: Thân VI, Kho và mỏ

Thân này là chuyện bụng và sắt: làng đã đông thì phải trả giá cho việc đông. Bóng lịch sử: kho thuế Joseph ở Ai Cập, đại nạn đói 1315 đến 1317 ở châu Âu, mỏ bạc Kutná Hora, và năm 1816 không có mùa hè sau khi núi lửa Tambora phun.

### Cành VI.A, Mỏ và lò

1. **Chặng 1, vệt quặng đầu tiên.** Thợ thăm dò thấy quặng sâu trong núi. Đào ngay bằng dân làng (Của +1, Uy +1, nhiều người ốm), thuê người ngoài đào (Của +1, Lộ +1), hay để dành cho đời sau (Tín +1, chậm phát triển).
2. **Chặng 2, thợ giỏi.** Một thợ rèn giỏi xin vào làm. Giữ độc quyền (Uy +1, Của +1, ít người biết nghề), dạy cả làng (Hợp +1, Luật +1, nghề lan nhanh), hay bán thợ cho làng khác lấy lún (Của +2, Tín -1).
3. **Chặng 3, lò lớn.** Xây lò trung tâm gần làng (an toàn, Luật +1), xây lò sát mỏ (Của +1, dễ bị cướp, Lộ +1), hay chia thành nhiều lò nhỏ (Hợp +1, chậm hơn).

### Cành VI.B, Kho đầy kho cạn

1. **Chặng 1, mùa gặt dư thừa.** Cất hết vào kho chung (Luật +1, Của +1), đổi bớt lấy hàng ngoại (Của +2, Lộ +1), hay tổ chức yến tiệc lớn (Hợp +2, Của -1).
2. **Chặng 2, người vay.** Nhiều nhà xin vay lương vụ sau. Cho vay không lãi (Tín +2, Của -1), cho vay có lãi (Của +1, Tín -1, nợ dồn), hay từ chối (Luật +1, Hợp -1).
3. **Chặng 3, biển người đến chợ.** Chợ đông hẳn lên (dùng `shop` và vỏ sò sẵn có). Giảm phí cho cả chợ (Hợp +1, Của +1), tăng phí để thu nhiều (Của +2, Tín -1), hay đặt hạn mức mỗi nhà (Luật +2, Uy +1).

### Nút VI-1, Năm không mùa hè

Nổ khi Nhà chung từ cấp 5, đã qua ít nhất hai chặng mỗi cành, và Của + Luật từ 4. Đây là nút ác nhất trong cây: một năm không nắng, mùa gặt hỏng, và làng phải chọn ai được ăn.

| Lá | Rút nhiều khi | Chuyện xảy ra | Cờ và hệ quả |
| --- | --- | --- | --- |
| VI1-a Kho đầy qua năm đói | kho đầy, Luật cao | Kho chung cứu cả làng | Cờ `granary_saved`: không ai chết đói, làng được kính, nhưng sang năm kho trống và dễ bị nhắm |
| VI1-b Nạn đói chia đôi | kho cạn, Của cao nhưng chỉ trong tay ít người | Người giàu có ăn, người nghèo đói | Cờ `famine_split`: một phần dân bỏ đi hoặc nổi dậy, dẫn tới chuỗi dẹp loạn ở Thân VII |
| VI1-c Mỏ mở đúng lúc | Vệt quặng đã đào, lò sẵn | Bán quặng lấy lương từ ngoài | Cờ `mine_rescue`: đổi quặng lấy lương, nhưng các làng ngoài biết bạn có mỏ và thèm nhòm ngó |
| VI1-d Chợ chết (lá nhạt) | quá hạn | Thương lái không dám đến | Cờ `dead_market`: chợ đóng một mùa, vỏ sò mất giá |

Khi nút này nổ, người chơi luôn phải đứng trước một quyết định không có đường đẹp. Ví dụ ở VI1-b: chia đều lương còn lại (Hợp +2, ai cũng đói), ưu tiên lính và thợ (Uy +2, Hợp -2) hay mở cửa xin lương của làng boss (Tín +1 nhưng để lại món nợ sẽ bị đòi ở Thân VII).

## Trung cổ V: Thân VII, Bạn và thù

Các thân trên cho người chơi thứ để xây. Thân này cho họ thứ để **trả giá**. Mục tiêu cố ý làm người chơi khó chịu: giúp ai cũng có thể bị phản, đồng minh có thể đòi máu, và làm bá chủ thì phải dẹp loạn mãi. Bóng lịch sử: Brutus đâm Caesar, nhóm Hashshashin ở Alamut, vệ binh Praetorian bán ngôi vàng cho người trả giá cao, Hiệp ước Westphalia, và các cuộc khởi nghĩa nông dân sau nạn đói.

### Quy luật riêng của thân này

- **Thân này chỉ mở khi** người chơi đã qua nút đầu tiên của Thân IV, V hoặc VI, vì nó cần vốn liếng để phản bội.
- **Mọi hạt giống đều lấy từ các cờ đã cắm.** Ai từng được giúp, ai từng bị ép, ai bị bỏ đói, chính họ trở thành kẻ phản hoặc bạn. Không có NPC phản bội ngẫu nhiên.
- **Luôn có dấu hiệu báo trước** (một lời đồn, một người vắng mặt), nhưng không luôn đủ để ngăn.
- **Mỗi lá đau đều có một lối thoát**, chỉ là đắt hơn, để người chơi cảm thấy mình bị phạt bởi quyết định của chính mình, không phải bị ép vô lý.

### Cành VII.A, Lời thề đồng minh

1. **Chặng 1, một lời thề giúp nhau.** Một làng (bạn đã tiễn hoặc đã giúp) xin liên minh. Nhận trọn (Hợp +2, Tín +1, gắn lời thề), nhận có điều kiện (Luật +1, Tín +1), hay từ chối (Uy +1, Hợp -1).
2. **Chặng 2, một lời triệu tập.** Đồng minh bị đánh và gọi bạn mang quân. Mang đủ quân (Tín +2, chịu tổn thất), mang nửa quân (Tín +0, Uy -1), hay viện lý do không đi (Tín -2, Hợp -1).
3. **Chặng 3, cái giá của làng bạn.** Trong lúc quân bạn vắng, có kẻ nhòm ngó làng. Giữ lại một đội canh (Luật +1, cả hai mặt trận yếu), dồn hết ra trận (Uy +1, nhà trống), hay xin đồng minh giữ làng hộ (Tín +1, để họ vào tận nhà bạn).

### Cành VII.B, Bàn tay trong bóng tối

1. **Chặng 1, người lạ xin phục vụ.** Một người trẻ giỏi đánh nhưng không rõ gốc xin làm cận vệ. Nhận ngay (Uy +1, Lộ -1, dễ bị giài), thử thách bằng một việc nguy hiểm (Tín +1, có thể mất người), hay từ chối (Luật +1).
2. **Chặng 2, một lời mời từ bên ngoài.** Một làng địch trả vàng để bạn trông ra ngoài một đêm. Từ chối (Tín +2, Hợp +1), nhận nhưng làm nghịch (Lộ +2, nguy cơ trả thù), hay báo lại cho kẻ định hại (Tín +1, Của +1).
3. **Chặng 3, người được giao canh giấc.** Bạn cử một người tin cậy giữ tính mạng mình (Tín +1), lập đội cận vệ nhiều người (Luật +1, Của -1) hoặc tự bảo vệ và ít khi ra ngoài (Uy -1, Lộ -1).

### Nút VII-1, Con dao sau lưng

Nổ khi Nhà chung từ cấp 7, đã qua ít nhất hai chặng cành VII.B, và có một cờ đã gây thù (`terror`, `broken_treaty`, `famine_split` hoặc `split_throne`).

| Lá | Rút nhiều khi | Chuyện xảy ra | Cờ và hệ quả |
| --- | --- | --- | --- |
| VII1-a Kẻ phản bội từ làng | `famine_split` hoặc `split_throne` | Một người quen đâm bạn khi đã có ngôi | Cờ `betrayed_inside`: mất một nhân vật chủ chốt và một đội lính; phải chọn đày ra hay xử tử |
| VII1-b Sát thủ từ làng thù | `terror` hoặc `broken_treaty` | Một nhát dao nhắm vào bạn hoặc người thân | Cờ `assassin_hit`: một nhân vật bị thương hoặc chết, mở nhiệm vụ truy tìm kẻ mưu sát |
| VII1-c Cận vệ phản chủ | đã nhận cận vệ lạ | Người canh cửa là kẻ đã được mua | Cờ `turned_guard`: kho bị mở, một phi vụ bị cướp |
| VII1-d Chỉ là lời đồn (lá nhạt) | quá hạn | Không ai ra tay, nhưng ai cũng nghi ngờ nhau | Cờ `paranoia`: Tín và Hợp khó hồi, nhưng không mất người |

### Nút VII-2, Lệnh triệu tập

Nổ khi đã qua ít nhất hai chặng cành VII.A và có một đồng minh (`grudging_ally` hoặc lời thề ở chặng 1).

| Lá | Rút nhiều khi | Chuyện xảy ra | Cờ và hệ quả |
| --- | --- | --- | --- |
| VII2-a Chiến dịch chung | Tín cao, đã nhận lời thề | Đồng minh kéo bạn vào một cuộc chinh phạt xa | Cờ `joint_war`: bắt buộc đưa quân đi, chia chiến lợi phẩm, không đi sẽ mất Tín nặng |
| VII2-b Đồng minh đòi nợ | đã xin lương hoặc quân | Một món ơn cũ được đem ra đòi | Cờ `debt_called`: phải trả bằng của, người hoặc quyền đi lại |
| VII2-c Đồng minh quay mặt | Uy cao, Tín thấp | Kẻ bạn cũ sợ bạn quá mạnh | Cờ `ally_turns`: đồng minh thành thù; một mặt trận mới |
| VII2-d Lời thề lật lờng (lá nhạt) | quá hạn | Hai bên cuối cùng cũng không đủ sức giúp nhau | Cờ `oath_faded`: liên minh tự tan, không mất gì thêm |

### Nút VII-3, Khi ngai đã vững

Nút này chỉ nổ khi người chơi **đã thành bá chủ** (phụ thuộc hoặc đánh bại phần lớn các làng NPC lân cận). Người chơi thắng, nhưng phải ngồi trên một ngai dễ vỡ: các làng phụ thuộc nổi dậy, và người chơi phải mang quân dẹp loạn.

| Lá | Rút nhiều khi | Chuyện xảy ra | Cờ và hệ quả |
| --- | --- | --- | --- |
| VII3-a Khởi nghĩa làng bị ép | `terror` hoặc nộp cống nặng | Các làng phụ thuộc ngồi dậy, một làng cầm đầu | Cờ `rebellion`: một chuỗi chiến dịch dẹp loạn; cứ thắng thì làng khác nhìn vào |
| VII3-b Quân mình phe cánh | `grudging_ally` hoặc `split_throne` | Một tướng của bạn tự xưng chủ | Cờ `general_revolt`: đội lính đông nhất chia hai, bạn phải chọn trả giá hay đàm phán |
| VII3-c Làng cũ kéo đến | `famine_split` | Dân đói đổ về xin ăn | Cờ `refugee_tide`: nuôi hay đóng cửa, cả hai đều để lại vết |
| VII3-d Thái bình giả (lá nhạt) | quá hạn | Không ái dám nổi dậy | Cờ `quiet_realm`: một mùa yên, nhưng lính sinh lười |

Ví dụ quyết định trong lá VII3-a: dẹp thẳng tay rồi đày dân sang vùng khác (Uy +3, Tín -3, Hợp -2), đàm phán giảm cống (Tín +2, Uy -1, Của -1) hay phân tán quân, giao làng cũ cho người bạn tin (Luật +2, nhưng có thể lại sinh ra một kẻ phản khác).

## Trung cổ V-b: Thân VIII, Tri thức

Thân này viết thuần bằng kể chuyện rồi cộng hay trừ perk nghiên cứu có sẵn (`researchSpeed`, `craftSpeed`), không cần hệ mới. Bóng lịch sử: thư viện Alexandria bị cháy, Nhà Trí Tuệ ở Baghdad, đại học Bologna, và bí mật nghề đúc chuông của các giấy thợ thủ công.

### Cành VIII.A, Người thầy đầu tiên

1. **Chặng 1, thợ già xin ở nhờ.** Giữ làm thầy của cả làng (Hợp +1, Luật +1), giữ riêng cho thợ giỏi (Của +1, Uy +1), hay trao đổi người học việc để chuyển bí quyết (Của +1, Tín +1).
2. **Chặng 2, cuốn sổ đầu tiên.** Khắc lên gỗ (Luật +1, Tín +1), truyền miệng (Hợp +1, Lộ -1), hay giấu kín (Uy +1, Lộ -1).
3. **Chặng 3, ai được học.** Con người có quyền (Uy +1), người giỏi nhất (Của +1), hay ai đăng ký cũng được (Hợp +2, Luật +1).

### Cành VIII.B, Sổ sách và bí quyết

1. **Chặng 1, bản vẽ lạ.** Thương lái mang bản vẽ máy mới. Mua (Của -1, Lộ +1), chép lén (Tín -1, Của +1), hay từ chối (Luật +1).
2. **Chặng 2, xưởng riêng.** Lập xưởng sau tường (Của +1, Lộ -1), mở xưởng cho khách (Hợp +1, Lộ +1), hay nhập vào công trình chung (Luật +1).
3. **Chặng 3, kẻ dò bí quyết.** Canh nghiêm (Uy +1, Của -1), giăng bẫy (Lộ +1, Tín -1), hay cho xem bản giả (Tín -2, Lộ +2).

### Nút VIII-1, Ngọn đèn đêm

Nổ khi Nhà chung từ cấp 5, đã qua ít nhất hai chặng mỗi cành, và Của + Luật + Hợp từ 5. Quá hạn mà thiếu Dấu thì nổ lá nhạt VIII1-d.

| Lá | Rút nhiều khi | Chuyện xảy ra | Cờ và hệ quả |
| --- | --- | --- | --- |
| VIII1-a Trường làng | Luật, Hợp cao | Con em mọi nhà được học chữ và nghề | Cờ `school`: perk `researchSpeed` tăng, để lại nhiều người biết chữ |
| VIII1-b Bí quyết độc quyền | Uy, Của cao | Một xưởng riêng giữ nghề | Cờ `secret_craft`: perk `craftSpeed` tăng, nhưng sát thủ và gián điệp đến tìm |
| VIII1-c Sách cháy | Tín thấp, Luật thấp | Một đêm lửa nhấn chìm nơi cất sổ | Cờ `lost_books`: perk `researchSpeed` giảm trong một mùa, không mất nhánh đã nghiên cứu |
| VIII1-d Đèn lụi (lá nhạt) | quá hạn | Không ai ghi, không ai dạy | Không đổi gì |

### Trái và Ngọn thêm cho thân này

| Mục | Công thức | Ghi chú |
| --- | --- | --- |
| TM9 Học Viện Làng | VIII1-a + VI1-a | Quyết định: mở cửa cho cả dân hay chỉ cho con quan (Hợp +2 hay Uy +2). Cờ `academy` |
| TM10 Xưởng Bí Mật | VIII1-b + VII1-c | Kẻ phản chủ đã lấy đi bí quyết: truy đuổi hay đổi nghề (Uy +1, Lộ +1 hay Của +1, Tín -1). Cờ `hidden_forge` |
| M8 Đô Thành Tri Thức (Ngọn) | TM9 + (TM1 hoặc TM3) | Nghiên cứu nhanh và rẻ hơn, nhưng gián điệp từ mọi làng luôn dò la; lối ra là mở cửa hay giữ kín tri thức |
| M6 Kẻ Bị Phản (thêm cách chấm) | TM4 + (TM8 hoặc TM10) | TM10 cũng có thể dẫn tới M6 |

Vì VI1-a đã nuôi TM1, và bây giờ thêm TM9, nên VI1-a đủ hai Trái. VII1-c nuôi TM4 và TM10, cũng đủ hai.

## Nhiệm vụ phụ do nhân vật giao

Nhiệm vụ phụ **tách hẳn khỏi cây cốt truyện**. Làm thì có thưởng, không làm thì thôi, không ghi Dấu, không cắm cờ, không nuôi lá, trái hay ngọn nào. Mục đích của chúng là cho người chơi thêm việc để làm giữa các mốc truyện, và là nơi thử tính năng mới (lính, sát thủ, cận vệ) mà không chạm tới cốt truyện.

### Luật của nhiệm vụ phụ

1. **Độc lập hoàn toàn với cây.** Bỏ hay thất bại không bị phạt. Chỉ mất cơ hội lấy phần thưởng. Điều duy nhất được đổi là quan hệ (`rel`) với chính người giao, theo hệ sẵn có của game.
2. **Độ dài vừa phải.** Mỗi nhiệm vụ có 2 đến 3 bước, làm xong trong khoảng 10 đến 20 phút chơi, hạn 1 đến 3 ngày game hoặc không hạn. Không có chuỗi dài.
3. **Mỗi nhiệm vụ có một lựa chọn chính**: hai cách làm, mỗi cách một phần thưởng khác (nhanh và rẻ, hoặc chậm và chắc). Không có đúng sai đạo đức nặng.
4. **Tối đa 3 nhiệm vụ cùng lúc**, và người giao hiện ít, để không át Nhật ký.
5. **Tùy chọn**: một phần tư nhiệm vụ có sự thật ẩn (`truth` và `clues` như trong stone.json), người giao có thể nói thứ khác với thực tế.

### Loại nhiệm vụ, ai giao và thưởng gì

| Loại | Ai giao | Việc phải làm | Phần thưởng |
| --- | --- | --- | --- |
| Hộ tống | Thương lái, sứ giả | Đưa một người qua vùng có thú hoặc cướp | Vỏ sò, vật liệu hiếm |
| Bảo vệ | Người giữ lửa, sứ giả | Giữ an toàn một người hoặc một chỗ trong 1 đến 2 ngày | Lính tạm, vật phẩm |
| Ám sát | Người bí ẩn | Hạ một mục tiêu mà không để lộ | Vỏ sò nhiều, mở thương lái đen |
| Cứu con tin | Làng yếu | Đưa người về an toàn | Quan hệ với làng đó, lương thực |
| Dẹp cướp | Làng yếu, dân của bạn | Đưa quân đánh một nhóm cướp | Vật liệu, lính tạm |
| Trao mật thư | Thám tử | Đem một lá thư đến đúng người | Mở một ô sương trên bản đồ |
| Hòa giải | Trưởng lão | Đứng giữa hai nhà đang cãi nhau | Vỏ sò, vật liệu |
| Tìm vật cũ | Thợ già, nhà sư | Đi tìm một món bị thất lạc | Bản vẽ nghiên cứu nhỏ |

### Ví dụ: Hộ tống thương lái muối (3 bước)

1. Thương lái xin được đưa qua đèo. Bạn chọn đường tắt (nhanh, dễ gặp thú, thưởng 1 vỏ sò lô) hay đường vòng (chậm, an toàn, thưởng chắc chắn).
2. Giữa đường gặp một nhóm cướp. Đánh (cần lính, thêm thưởng) hay trả tiền qua đường (mất một ít, ít rủi ro).
3. Đến nơi, thương lái trả thưởng tùy cách bạn đã đi.

Những cảnh như "truy tìm kẻ mưu sát" hay "dẹp loạn làng phụ thuộc" là **chặng cốt truyện** nằm trong cành, không phải nhiệm vụ phụ, để hai hệ không lẫn nhau.

## Trung cổ VI: Trái và Ngọn, những kết cục không dễ chịu

Cây trung cổ có bảy nút (IV-1, V-1, V-2, VI-1, VII-1, VII-2, VII-3), 28 lá (thêm Thân VIII ở mục sau thành 8 nút và 32 lá), cộng bốn lá Biến chung rút với 8% mỗi nút: dịch hạch theo thương lái, kỵ binh thảo nguyên, nhà sư lang thang gieo lời, và đám cháy kho lớn. Lá không nuôi Trái nào (như V1-c, V2-b, VII2-b) vẫn để lại cờ và sinh nhiệm vụ phụ, checkStory chỉ cảnh báo chứ không báo lỗi. Ở đây từng Trái vẫn là hai lá từ hai thân khác nhau gặp nhau, và mỗi lá nuôi nhiều nhất hai Trái.

### 10 Trái trung cổ (TM9, TM10 ở Thân VIII)

| Trái | Công thức lá | Quyết định trong trái | Cờ để lại |
| --- | --- | --- | --- |
| TM1 Triều Đình | IV1-a + VI1-a | Cho phép thợ thủ công vào hội đồng hay giữ ở trưởng lão (Hợp +2 hay Luật +2) | `court` |
| TM2 Đế Quốc Sắt | V1-a + IV1-b | Dùng nỗi sợ để thu cống hay công bố ân xá để đỡ thù (Uy +2 hay Tín +2) | `iron_realm` |
| TM3 Cộng Hòa Thương Gia | IV1-a + VI1-c | Để thương gia cầm quyền hay giữ quyền trong tay làng (Của +2 hay Luật +2) | `merchant_rule` |
| TM4 Lãnh Chúa Cô Độc | IV1-b + (VII1-a hoặc VII1-c) | Tin tưởng một người hay trị cả người thân (Uy +2, Hợp -2 hay Tín +1, Uy -1) | `lonely_lord` |
| TM5 Liên Minh Mong Manh | VII2-a + V2-c | Giữ liên minh dù đau hay bỏ người bạn (Tín +2 hay Uy +1, Tín -2) | `fragile_pact` |
| TM6 Vương Quốc Chia Đôi | IV1-c + VI1-b | Chọn một bên trong nội chiến hay đứng giữa (Uy +1, Hợp -2 hay Hợp +1, Uy -1) | `two_crowns` |
| TM7 Bá Chủ Đầy Mũi Dao | (V1-a hoặc V1-b) + VII3-a | Dẹp đến cùng hay đàm phán từng làng (Uy +2, Tín -2 hay Tín +2, Uy -1) | `overlord` |
| TM8 Nợ Máu Đời Sau | V2-a + (VII2-c hoặc VII1-b) | Trả đũa hay để máu chảy tiếp (Uy +1, Lộ +1 hay Tín +1, Hợp -1) | `blood_debt` |

### 8 Ngọn trung cổ (M8 ở Thân VIII)

Ngọn chấm bằng đúng quy tắc của cây Đồ đá: một Ngọn chính tính theo cờ và Dấu, thêm một Ngọn phụ. Khác ở chỗ **Ngọn trung cổ chấm hai lần**: khi Nhà chung lên cấp 7 (mốc giữa) và ở cấp 10 (cuối), và kết cục giữa có thể bị đảo ngược nếu người chơi đổi cách.

| Ngọn | Mọc từ | Người chơi sẽ thấy khó chịu ở đâu | Lối ra |
| --- | --- | --- | --- |
| M1 Thống Nhất Giang Sơn | TM7 + đã đánh hoặc thu phục toàn bộ làng boss | Thắng rồi vẫn không được yên: mỗi làng vừa thu phục lại nổi dậy một lần, phải mang quân dẹp mãi | Thiết lập chế độ quản lý làng phụ, chia quyền để giảm loạn |
| M2 Liên Bang Các Làng | TM5 + TM3 | Luôn bị gọi mang quân cho đồng minh, không đi thì mất Tín | Chỉ cần giữ đủ Tín để không được gọi quá thường |
| M3 Đế Quốc Sắt | TM2 + TM7 | Dân sợ, họ không trách nhưng các mưu sát liên tục nhắm vào bạn | Đôi khi ân xá một làng để dập chấn |
| M4 Thành Bang Thương Nhân | TM3 + TM1 | Tiền mua được đồng minh nhưng cũng mua được lưỡi dao nhắm vào bạn | Giữ cận vệ riêng, trả giá cao hơn |
| M5 Vương Quốc Chia Đôi | TM6 + TM4 | Một nửa làng, một nửa người quen, phải chọn bên nào | Đàm phán hợp nhất sau một mùa, mất một ít cả hai |
| M6 Kẻ Bị Phản | TM4 + TM8 | Mất người tin nhất, mất một làng, phải làm lại từ một thứ đã bị mất | Có một nơi để chạy tới, nhưng phải giành lại danh tiếng |
| M7 Tàn Quốc (mặc định) | không đủ Trái | Không ai ghi tên bạn, không ai nhớ bạn | Sống tiếp theo sự kiện nhạt, không đổi luật chơi |

Ngọn **không phải game over**. Mỗi Ngọn trên đều là một trạng thái dài hạn mở ra một lối chơi mới, vừa thưởng vừa phạt, nên người chơi khó chịu nhưng không bị chặn đường. Mốc chấm giữa cũng là lý do để bá chủ M1 hay Đế Quốc Sắt M3 có thể sụp và chuyển thành Kẻ Bị Phản M6 nếu người chơi để một mùa phản bội xảy ra.

## Bản đồ phát triển game: mỗi nút thắt đòi tính năng gì

Cây trung cổ được viết trước để **kéo phát triển game theo sau**: mỗi tính năng dưới đây được một nút hoặc một nhiệm vụ đòi, nên bạn biết làm gì trước. Cột "Đã có" dựa vào bản tóm tắt game bạn gửi; những gì bản tóm tắt không nêu mình ghi "chưa thấy", cần bạn xác nhận.

| Tính năng | Cần cho | Đã có? | Ưu tiên |
| --- | --- | --- | --- |
| Hệ Dấu, cờ, rút lá theo seed, lưu trong save kèm migration | toàn bộ cây | Chưa. Có sẵn `SAVE_VERSION` và migration để gắn vào | 0 (nền) |
| Máy chạy cành, chặng, nút, lá, quá hạn rút lá nhạt | toàn bộ cây | Chưa. Dùng lại `talk`, `deed`, `eventMod`, `schedule` | 0 |
| Hội thoại nhiều pha (P2 đến P5) | các chặng có 3 lựa chọn | Đang là khoảng trống đã biết trong bản tóm tắt | 0 |
| Nhật ký ghi từng lá | mọi nút | Có (Journal) | 1 |
| Nhiệm vụ phụ có người giao, hạn, sự thật ẩn | mục Nhiệm vụ phụ | Một phần (có quests, chưa có `truth` cho quest) | 1 |
| Chợ, vỏ sò, phí, hạn mức | Thân III, VI | Có | 1 |
| Sổ nợ (món chịu, vay lương, đòi nợ đồng minh) | Thân III, VI, VII-2 | Chưa thấy | 2 |
| Thống kê kho lương, nạn đói theo mùa | Nút VI-1 | Chưa thấy | 2 |
| Nhân vật có tên, có lòng trung thành ẩn | Thân VII | Chưa thấy | 3 |
| Lính tiến bộ: cận vệ, sát thủ, thám tử | Thân V, VII | Chưa thấy | 3 |
| Nhiệm vụ hộ tống và bảo vệ (giữ một người sống trong thời gian) | Thân VII, mục Nhiệm vụ phụ | Chưa thấy | 3 |
| Ám sát và độ lộ (Lộ) | Thân VII | Chưa thấy | 3 |
| Móc sự kiện trong và sau chế độ chiến tranh | Thân V | Chế độ chiến tranh có, chưa có móc | 3 |
| Làng phụ thuộc, chiến dịch dẹp loạn, hệ chinh phạt bản đồ | Nút VII-3, Ngọn M1 | Chưa thấy | 4 |
| Chấm Ngọn giữa và cuối, đảo ngược Ngọn | Ngọn trung cổ | Chưa | 4 |
| `checkStory` (kiểm id treo, ngõ cụt) và máy mô phỏng chạy headless in truyện dạng chữ theo seed | mọi giai đoạn | Chưa | 0, làm ngay để thử truyện |

### Lộ trình đề xuất theo giai đoạn

1. **Giai đoạn 0, nền.** Làm máy Dấu, cờ, rút lá, lưu save, `checkStory` và máy mô phỏng. Chưa có nội dung mới nào trong game, chỉ có kiểm chứng được truyện bằng chữ.
2. **Giai đoạn 1, đồ đá chạy thật.** Đưa Thân I đến III vào game bằng stone.json đã có, cộng các nhiệm vụ phụ đơn giản như hộ tống.
3. **Giai đoạn 2, trung cổ không cần phát triển mới.** Thân IV và VI chạy được chỉ bằng các hệ đã có cộng sổ nợ và thống kê kho.
4. **Giai đoạn 3, người và dá.** Làm nhân vật có tên, cận vệ, sát thủ, ám sát, hộ tống và móc chiến tranh, rồi mở Thân V và Thân VII-1, VII-2.
5. **Giai đoạn 4, ngôi vững.** Làng phụ thuộc, dẹp loạn, chấm Ngọn giữa và cuối, mở nút VII-3 và Ngọn M1.

Thứ tự này có ý đồ: mỗi giai đoạn đều có thể phát hành độc lập, và bạn không phải đợi xong lính, sát thủ mới thấy cây chạy.

## Cách đưa vào JSON nhiều file nối nhau, và những điểm cần bạn quyết

Bạn muốn nhiều file nối nhau để sinh ra cốt truyện. Cây này hợp với cách đó vì mỗi tầng (Dấu, Cành, Nút, Lá, Trái, Ngọn) là một loại dữ liệu riêng, và chỉ nối với nhau bằng id.

### Cấu trúc thư mục đề xuất

```
src/data/story/
  index.json              danh sách file, thứ tự nạp, phiên bản
  marks.json              5 Dấu đồ đá + Luật, Của trung cổ, tốc độ phai
  world/roots.json        Rễ: làng, tộc, bóng lịch sử
  stone/
    threads.json          cành và chặng (I.A, I.B, II.A, ...)
    knots.json            nút, điều kiện nổ, quá hạn, lá nhạt
    leaves.json           lá, hệ quả, quyết định trong lá
    wild.json             lá Biến (B1 đến B6)
    fruits.json           10 trái
    tips.json             9 ngọn + mặc định
    legacy.json           ngọn đổi luật chơi trung cổ ra sao
  medieval/
    threads.json knots.json leaves.json wild.json fruits.json tips.json
  quests/
    side_quests.json      nhiệm vụ phụ và người giao
    from_flags.json       cờ của cây sinh nhiệm vụ nào
```

Mọi liên kết dùng id có tiền tố: `thread:`, `knot:`, `leaf:`, `fruit:`, `tip:`, `quest:`, `flag:`. Thêm một lá mới chỉ là thêm một dòng trong `leaves.json` và một dòng trọng số trong nút tương ứng.

### Mẫu một nút (cú pháp cần đối chiếu lại với stone.json thật)

```json
{
  "id": "knot:I-1",
  "name": "Đêm không ai ngủ",
  "fedBy": ["thread:I.A"],
  "when": {
    "progress": ">=0.25",
    "chapters": { "thread:I.A": ">=2" },
    "marks": "nhan + hop >= 4"
  },
  "timeoutProgress": 0.5,
  "fallback": "leaf:I1-nhat",
  "wildChance": 0.08,
  "leaves": [
    { "leaf": "leaf:I1-a", "base": 3, "affinity": { "nhan": 0.5, "hop": 0.4 } },
    { "leaf": "leaf:I1-b", "base": 2, "affinity": { "loc": 0.5 } },
    { "leaf": "leaf:I1-c", "base": 2, "affinity": { "tin": -0.3 } },
    { "leaf": "leaf:I1-d", "base": 2, "affinity": { "nhan": 0.4 } }
  ]
}
```

Một lá thì ghi hệ quả bằng chính các hiệu ứng đã có (`flag`, `rel`, `join`, `raid`, `eventMod`, `schedule`), thêm `journal` để ghi vào Nhật ký và `feedsFruit` để biết nó nuôi trái nào.

### Hai công cụ nên làm trước cả nội dung

1. **`checkStory`** kiểm tra id treo (nút gọi lá không có), lá không nút nào rút được, nút không bao giờ nổ, lá nuôi quá hai trái, trái không mọc ra Ngọn nào, và cờ dùng mà chưa ai cắm.
2. **Máy mô phỏng** (`tools/simStory.js --seed 12345`) chạy cây không cần mở game và in ra câu chuyện dạng chữ cho từng seed và bộ lựa chọn. Đây là cách nhanh nhất để bạn đọc thử hàng trăm hoàn cảnh và thấy cây có ra đúng "nhiều nhánh nhiều lá" không.

Khi game chạy, Dấu, cờ, lá đã rút và trái đã chín đều nằm trong save (tăng `SAVE_VERSION`, có migration cho save cũ). Chế độ chiến tranh tạm dừng Thân IV và VI, riêng Thân V chạy trong chiến tranh.

### Các quyết định đã chốt

| Điểm | Quyết định của bạn | Áp vào cây thế nào |
| --- | --- | --- |
| Dấu | Ẩn | Không hiện số. Dấu chỉ lộ qua lời đồn và cách NPC đối xử với bạn |
| Làng boss | Làng mạnh nhất, rút ngẫu nhiên theo seed | Mỗi ván boss là một làng khác; Ngọn áp lên đúng làng đó |
| Độ dài Đồ đá | 3 đến 4 giờ, kết thúc khi Nhà chung cấp 4 và hạ boss | Không dùng thời gian. Tiến độ lấy từ cấp Nhà chung và mức đối đầu boss |
| Trao đứa trẻ | Giữ nguyên, đây chỉ là truyện | Cành II.B không đổi |
| Người giữ lửa | Đưa vào game | Vai mới ở Thân III |
| Mức khó chịu | Tùy chế độ | Xem bảng dưới |
| Nhiệm vụ phụ | Độc lập, chỉ để lấy thưởng, vừa đủ dài | Đã viết lại mục Nhiệm vụ phụ |
| Trọng tâm | Trung cổ là chính | Đồ đá rút gọn: mỗi thân 1 nút, nút còn lại thành Chuyện cũ ở trung cổ |

### Mức khó chịu theo chế độ

Mỗi lá "đau" (phản bội, sát thủ, cận vệ phản chủ, dẹp loạn) có cờ `hard: true` trong JSON, và chế độ chơi chỉnh trọng số của chúng. Không cần viết hai bộ truyện.

| Chế độ | Lá "đau" | Dấu hiệu báo trước | Dẹp loạn |
| --- | --- | --- | --- |
| Dễ | Tắt, thay bằng lá nhạt (VII1-d, VII3-d) | Rõ | Nút VII-3 chỉ nổ một chuỗi ngắn |
| Thường | Bật, trọng số gốc | Có nhưng không luôn đủ để ngăn | Chuỗi vừa |
| Khắc nghiệt | Bật, trọng số +50%, nhắm vào nhân vật chủ chốt | Ít | Chuỗi nối tiếp, mỗi làng thu phục có thể nổi dậy lại |

Tên chế độ thật trong game có thể khác, bạn đổi lại cho khớp.

### Những điểm còn mở

1. **Hai thước tiến độ** (cấp Nhà chung và mức đối đầu boss) cần được thử trên game thật, vì các mốc phần trăm của nút đang là con số đề xuất.
2. **Thước thế lực trung cổ** tính "làng bị đánh, thu phục, kết minh" trên tổng số làng, cần bạn xác nhận có đủ dữ liệu trong game.
3. **Trung cổ là trọng tâm** nên mình đã thêm thân Tri thức (VIII), viết thuần bằng kể chuyện cộng perk nghiên cứu. Thân Tín ngưỡng hoãn cho đến khi game có công trình hay nhánh nghiên cứu cho nó; trong lúc đó Ngọn N5 Đàn Lửa Thiêng tạm tắt và điểm của nó chảy sang N1 Cố Đô Mở.

### Đã đối chiếu với code (phần Đồ đá)

Bạn đã đối chiếu tài liệu với `construction.ts`, `encounterdata.ts` và `save.ts`. Kết quả và cách tài liệu đã chỉnh theo:

1. **Cổng cấp 4.** Game chặn nâng Nhà chính lên cấp 4 cho đến khi hạ hết các làng thủ lĩnh, kể cả thủ lĩnh phản bội. Tài liệu giờ nói "hạ hết thủ lĩnh", còn "làng boss" trong cây vẫn là làng thủ lĩnh mạnh nhất rút theo seed. Các mốc nút Đồ đá đã dồn về dưới 70% vì người chơi có thể kẹt ở cấp 3 (khoảng 67%).
2. **Mẫu số thế lực trung cổ** phải tự lưu: 7 làng thường lúc khởi đầu, vì làng được nhận làm người chung bị xóa khỏi `sim.tribes`. Không tính trại cướp, bộ tộc đến muộn và làng phản loạn. Tử tố dùng `sim.conquered`, `sim.conquests`, quan hệ, triều cống, nhận người chung và đồng minh.
3. **Dấu tính từ danh sách `deeds` đã có**, không thêm trạng thái lưu cho Dấu. Mỗi deed đã có ngày và làng, cú pháp `deed.<key>@30d` cho cửa sổ ngày. Cần một bảng trọng số Dấu cho từng deed (bảng deed và Dấu ở mục Bảng Dấu). Dấu phai dần làm được bằng cửa sổ ngày, riêng Hợp không phai làm được bằng cửa sổ vô hạn. Luật và Của trung cổ cần thêm deed mới.
4. **Cờ dài hạn là trạng thái mới.** `flag.<name>` hiện chỉ sống trong một cuộc nói chuyện. Cờ của lá, trái, ngọn (như `xom_moi`, `lang_mo`) cần thêm field vào `SAVED`, tăng `SAVE_VERSION` và viết migration.
5. **Hệ thoại nhiều pha (P2 đến P5)** vẫn chưa làm. Các chặng có 3 lựa chọn trở lên nên đợi phần này.
6. **Khớp sẵn:** chế độ chiến tranh đóng băng bộ gặp gỡ, Nhật ký và Chợ đã có nên nối lá vào hai hệ này rẻ.
7. **Phải làm mới hoàn toàn:** máy chạy cành, nút, lá, rút lá có trọng số theo seed, `checkStory` và máy mô phỏng.
8. **Thân Tín ngưỡng hoãn**, vì game chưa có công trình, vai trò hay nhánh nghiên cứu cho nó. Thân Tri thức khớp với hệ nghiên cứu (3 trụ, các perk như `researchSpeed`, `craftSpeed`).

Hai lưu ý. Thứ nhất, việc đối chiếu mới chỉ xong phần Đồ đá; **phần trung cổ (gồm cả giả định cấp Nhà chung 4 đến 10 và danh sách lính) chưa được đối chiếu với code**. Thứ hai, CLAUDE.md yêu cầu hỏi trước khi sửa logic cũ, nên các chỗ cây chạm vào logic cũ (bảng deed, cờ lưu save) cần bạn đồng ý từng chỗ.

Bước tiếp theo hợp lý là sinh các file JSON thật theo cấu trúc trên và viết máy mô phỏng in truyện dạng chữ theo seed.
