# Ba Dấu Ấn – Kịch bản chi tiết

Nov 17, 2026 · @Huy

## Cách đọc kịch bản

Mỗi chương chia thành các **cảnh**. Mỗi cảnh là một dãy **nhịp** (beat) chạy từ trên xuống. Mỗi nhịp bắt đầu bằng một thẻ. Claude Code đọc đúng các thẻ này để sinh dữ liệu cảnh và animation, không đoán.

| Thẻ | Nghĩa | Ví dụ |
| --- | --- | --- |
| `[NOI]` | Nơi diễn ra trên bản đồ và điều kiện bắt đầu | sảnh Nhà chung, đầu mùa đông |
| `[CAM]` | Camera: khóa, đẩy, rị, cắt | đẩy vào Lam 1,5 giây |
| `[MOVE]` | Nhân vật di chuyển: ai, đi từ đâu tới đâu, kiểu đi | Khải bước chậm tới bàn |
| `[ANIM]` | Clip animation cụ thể (tên clip nằm trong bảng cuối doc) | Lam: `bow` |
| `[FX]` | Hiệu ứng hình ảnh, âm thanh | chuông ngân, bụi lú bay |
| `[SAY]` | Lời thoại: ai nói, biểu cảm khung chân dung, câu nói | Lam (cười): "..." |
| `[CHOICE]` | Người chơi chọn. Mỗi lựa chọn có đúng câu người chơi nói, phản ứng, hệ quả | A, B, C |
| `[MAP]` | Quyết định trên bản đồ (điều quân, khóa bến, đóng mỏ) | người chơi kéo quân |
| `[SET]` | Đặt cờ, cộng Dấu, đổi tài nguyên | `crack +1`, `Tin +1` |
| `[GOTO]` | Nhảy tới nhịp hoặc cảnh khác | `GOTO 1.3` |

### Quy tắc

- Thẻ `[ANIM]` chỉ dùng các clip có sẵn trong bảng cuối doc. Clip nào chưa có thì ghi vào cột "cần vẽ mới" để Claude Code làm theo ART\_BRIEF.
- `[SAY]` luôn ghi cả **biểu cảm** (bình thường, cười, giận, sợ, mệt). Khung chân dung đổi theo biểu cảm đó.
- Nhiều thẻ cùng nhịp ghi liền nhau chạy **cùng lúc**; xuống dòng mới đánh số nhịp mới chạy **sau khi nhịp trước xong**.
- Mỗi `[CHOICE]` ghi: *câu người chơi nói*, *câu trả lời của nhân vật*, *hành động/animation sau đó*, *`[SET]`*.
- Lựa chọn **nhỏ** (khung thoại) có đồng hồ 3 đến 4 lựa chọn. Lựa chọn **lớn** (bản đồ) luôn có nút "hỏi thêm" trước khi xác nhận, và hiện hệ quả dự kiến.
- Nếu từ khóa Chủ Làng không lựa chọn sau 60 giây, game chọn lựa chọn mặc định (ghi rõ ở mỗi `[CHOICE]` có dấu ★).
- Không được làm đổi trạng thái thế giới thật nếu chưa chạm `[SET]`. Mọi hệ quả đều nằm trong `[SET]`.
- Xen kẽ nhịp chậm (thoại) và nhịp động (di chuyển, hiệu ứng) để cảnh không chỉ là người đứng nói.

### Dấu và cờ

Dấu ẩn: Nhân, Uy, Tín, Lộ, Hợp, Luật, Của. Cờ: `lam_grain`, `khai_guard`, `oath`, `crack` (0 đến 6), `may_dead`, `muc_dead`, `betrayed`, `spy`. Mỗi `[SET]` chỉ ghi số đổi, không ghi tên chấm điểm.

## Chương 1. Mùa đói sau chiến thắng

**Khi nào:** Nhà chung lên cấp 4, ngay sau khi đánh thắng boss thời Đồ đá. **Đặt cờ vào:** không. **Thời lượng:** khoảng 6 phút đọc.

### Cảnh 1.1. Đại sảnh vừa xây xong

- `[NOI]` Sảnh Nhà chung cấp 4, ban ngày, ánh nắng xiên qua cửa sổ gỗ. Bàn dài đá ở giữa. Mùi gỗ mới. Trên bàn là một cuốn sổ da cũ mòn góc.
- `[CAM]` Cắt vào cảnh: khóa toàn sảnh 2 giây, rồi đẩy chậm về Bà Mực ở đầu bàn.
- `[ANIM]` Bà Mực `sit` ở đầu bàn, tay `flip_book` chậm. Dân làng NPC đi qua lại ngoài cửa, đầu cúi, gánh thùng gạo loét xoét. Người chơi (Chủ Làng) `walk` vào từ cửa chính, dừng ở giữa sảnh.
- `[SAY]` Bà Mực (bình thường, không ngặng lật sổ): "Sổ này ghi từ hồi làng còn xin lửa nhà hàng xóm. Chữ xấu, mà con số thì thật. Thật là thế này: hết tháng này, hết gạo."
- `[CHOICE]` Chủ Làng phản ứng:
  - A. "Bà có cách gì không?" → Bà Mực: "Cách thì ta không có. Ta có kinh nghiệm. Kinh nghiệm bảo rằng khi một làng đói mà vừa thắng trận, thế nào cũng có người tới." `[SET] Nhân +1`
  - B. "Đừng làm tôi sợ. Nói thẳng đi." → Bà Mực (cười khẽ): "Nói thẳng thì ta sẽ nói: đừng chạy ra đón. Kẻ nào đón vội thì thường bị nhận làm người nhà luôn." `[SET] Uy +1`
  - C. (im lặng, nhìn sổ) → Bà Mực ngừng lật sổ, ngặng đầu lên: "Anh chị không hỏi? Tốt. Người không hỏi thường tự biết câu trả lời. Hoặc tự giấu chúng." `[SET] Tín +1, Lộ +1`
  - ★ mặc định: A.
- `[ANIM]` Dù chọn gì, Bà Mực `stand` rất chậm, cầm sổ đi ra cửa sổ, nhìn xuống phía sông. Dân NPC ở ngoài dừng lại, cùng nhìn về một hướng.
- `[FX]` Tiếng sáo báo ngoài bến, hai hồi, đục. Nhạc nền dịu xuống còn một nhịp trầm.
- `[GOTO]` 1.2

### Cảnh 1.2. Thuyền ba buồm cập bến

- `[NOI]` Bến sông phía tây, bờ đá dốc. Sương mỏng.
- `[CAM]` Rị chậm theo một chiếc thuyền ba buồm đang lái vào bến, rồi dừng ở mũi thuyền.
- `[ANIM]` Thủy thủ NPC `unload` từng bao gạo và muối lên bờ, xếp thành hàng sáu mươi bao. Lam bước lên từ mũi thuyền, đội nón lụa, áo xanh, tay cầm cuốn sổ nhỏ.
- `[MOVE]` Lam `walk` từ mũi thuyền lên bờ, dừng cách Chủ Làng ba bước (Chủ Làng đã được đưa ra bến tự động).
- `[ANIM]` Lam `bow` rất nhẹ (gật đầu, không cúi sâu), rồi `look_around` bến một vòng như đang định giá.
- `[SAY]` Lam (cười): "Diệp Lam. Tôi nghe làng thắng trận mà kho thì thua. Tôi mang gạo tới. Không phải cho không đâu, tôi là người buôn, nhưng giá tôi lấy sẽ làm anh chị ngạc nhiên đấy."
- `[CHOICE]` Chủ Làng:
  - A. "Ngạc nhiên theo hướng nào?" → Lam: "Theo hướng rẻ. Tôi cần một chỗ để người ta tin tôi trả giá thật. Làng anh chị vừa thắng, ai cũng muốn biết làng này thương lượng ra sao." `[SET] Tín +1`
  - B. "Chị muốn gì đổi lại?" → Lam (đùa, lắc đầu): "Anh chị hỏi thẳng quá. Thôi được, tôi thích. Tôi muốn một con đường vào đất này, và một cái tên để người ta tin." `[SET] Uy +1, Lộ +1`
  - C. "Tôi không cần gạo của chị." → Lam (nhìn kho trống phía sau Chủ Làng, không nói gì ba nhịp, rồi): "Vâng. Thế thì tôi sẽ đợi ở đây. Đợi là việc tôi giỏi." ` [SET] Uy +2,  `lam\_grain\` vẫn mở nhưng giá +20%
  - ★ mặc định: A.
- `[FX]` Sáu mươi bao gạo xuống bờ tạo thành một dãy; chim sông bay lên.
- `[GOTO]` 1.3

### Cảnh 1.3. Đoàn quân xuống đồi

- `[NOI]` Dốc đồi phía bắc, đất đỏ. Trời hơi đục.
- `[CAM]` Khóa trên đỉnh dốc, nhìn xuống làng. Một đoàn hai mươi người hiện dần ra, giáp cũ, không cờ xí.
- `[MOVE]` 20 lính `walk` thành hàng hai, bước đều. Khải Cốt đi đầu, Tướng Đồng đi sau bả vai.
- `[ANIM]` Khải `walk_slow`, tay đặt trên chuôi kiếm ở hông (kiếm trong vỏ, `sheath`). Đồng `look_around`, cảnh giác.
- `[FX]` Tiếng giáp va vào nhau, đều. Khi đoàn quân dừng, toàn cảnh yên lặng, chỉ còn tiếng gió.
- `[SAY]` Khải (không biểu cảm, nhìn thẳng): "Khải Cốt. Doanh Sắt ở phía bắc hết quặng, hết lương, hết chủ. Quân của ta cần một nơi để ở. Đổi lại ta giữ biên cho làng. Ta nghe nói bọn cướp núi hay xuống đây."
- `[SAY]` Bà Mực (vừa đến, giọng ngọt như hỏi giờ): "Ông nghe từ ai?"
- `[ANIM]` Khải liếc Bà Mực, không đổi mặt. Đồng `arms_cross`.
- `[SAY]` Khải: "Từ chính bọn cướp. Chúng đã đi qua doanh ta hai lần, hỏi đường tới đây."
- `[CHOICE]` Chủ Làng:
  - A. "Quân ông đông thế, tôi nuôi được không?" → Khải (cứng): "Ta không đến để xin ăn. Ta đến để làm việc." `[SET] Tín +1`
  - B. "Người của ông hỏi đường tới đây, vậy là ông biết họ đến từ đâu?" → Khải (hơi nhìn lại Chủ Làng, lần đầu có ý): "Phía đông đỉnh núi. Ta có định dẫn lính lên đó, nhưng có bản đồ thì mới đi." `[SET] Nhân +1, Hợp +1` (mở gợi ý màn khám phá sớm)
  - C. "Ông mang lính vào làng, tôi phải được thuộc áo cho họ trước." → Khải (nhìn đồng, nhìn Chủ Làng): "Nguồn lính ăn bằng áo, không phải bằng lời. Nhưng ta đồng ý." `[SET] Uy +1`
  - ★ mặc định: A.
- `[ANIM]` Khải `salute` một nhịp, rất gọn, rồi quay đầu nhìn về phía bến, nơi Lam đang đứng.
- `[GOTO]` 1.4

### Cảnh 1.4. Hai kẻ lạ đối mặt, trước cửa sảnh

- `[NOI]` Sân đá trước đại sảnh. Một bên là gạo và muối của Lam đã chuyển lên, một bên là hai mươi lính Khải xếp hàng.
- `[CAM]` Khóa rộng trước, hai nhóm người hai bên, Chủ Làng ở giữa. Rồi cắt cận giữa Lam và Khải.
- `[MOVE]` Lam đi tới, Khải đi tới, cả hai dừng cách Chủ Làng hai bước, Lam ở trái, Khải ở phải.
- `[SAY]` Lam (cười, hỏi Khải): "Quân của ông ăn bao nhiêu một ngày?"
- `[SAY]` Khải (không nhìn Lam): "Hơn kho cô chứa được."
- `[SAY]` Lam (quay sang Chủ Làng, tay chỉ hai phía): "Vậy thì chúng ta cần nhau rồi. Ông ấy có sức, tôi có gạo. Anh chị ngồi giữa, mỗi bên có cái để cho. Đỡ phải chọn."
- `[ANIM]` Bà Mực (đứng sau Chủ Làng) `lean_in`, thì thầm, chỉ Chủ Làng nghe: "Đỡ phải chọn là cái bẫy đẹp nhất người ta hay đặt. Nhưng đói thì vẫn là đói."
- `[CAM]` Đẩy nhẹ vào mặt Chủ Làng (khung chân dung hiện lên), nhạc dừng.
- `[CHOICE LỚN]` **Nhận ai?** Có nút "hỏi thêm" (bấm sẽ đọc thêm lời của Lam, Khải và Bà Mực).
  - A. **Nhận cả hai** (con đường chính). Câu người chơi: "Cả hai người đều ở lại. Tôi sẽ không để ai phải chọn giữa ba chúng ta." → Lam (cười, nhưng mắt nhìn Khải): "Anh chị lạc quan thật." Khải (gật đầu một nhịp): "Ta sẽ quen dần." `[SET] lam_grain=true, khai_guard=true, Nhân +1, Hợp +1`
  - B. **Chỉ nhận Lam.** Câu người chơi: "Tôi nhận gạo của chị. Còn quân, ông cứ ở ngoài biên." → Khải (nhìn lâu, không giận): "Ta ở ngoài biên. Nhưng ta không đi." Tướng Đồng nghiến răng. Quân Khải `walk` ra cửa làng, dựng trại cách 200m. `[SET] lam_grain=true, khai_guard=false, Tín +1`; Khải sẽ quay lại ở chương 2 với giá cao hơn.
  - C. **Chỉ nhận Khải.** Câu người chơi: "Tôi nhận quân của ông. Gạo thì chúng tôi tự lo." → Lam (cười, nhưng tay nắm chặt cuốn sổ): "Vâng. Tôi sẽ quay lại khi anh chị cần gạo." Thuyền Lam rời bến, chỉ để lại một phần nhỏ gạo. `[SET] lam_grain=false, khai_guard=true, Uy +1`; Lam sẽ quay lại ở chương 2 với giá cao hơn.
  - ★ mặc định: A.
- `[FX]` Chim sông bay lên, chuông nhỏ ở sảnh ngân một hồi, không ai chạm vào.
- `[ANIM]` Bà Mực `write` vài dòng vào sổ, rồi khép sổ lại.
- `[SET]` Mở nút IV-1. Kết thúc chương 1.

#### Nhịp dự phòng cho chương 1

Nếu hiệu ứng hoặc khung chân dung chưa sẵn, cảnh vẫn chạy được bằng hộp thoại văn bản và hiện đúng thứ tự `[SAY]`, `[CHOICE]`, `[SET]`. Mọi `[ANIM]` thiếu clip đều rơi về `idle`.

## Chương 2. Đúc ấn

**Khi nào:** sau chương 1, Nhà chung cấp 4 đến 5 (mở khi xây xong phòng ấn). **Đặt cờ vào:** `oath`, `seal_word`, `spy` (theo seed, người chơi không thấy). **Thời lượng:** khoảng 8 phút đọc.

**Biến thể theo chương 1:** nếu `khai_guard=false`, Khải quay lại ở cảnh 2.1 với yêu cầu cao hơn (xem ghi chú cảnh). Nếu `lam_grain=false`, Lam quay lại tương tự. Nếu cả hai bị từ chối ở chương 1 thì không thể (chương 1 không cho chọn cả hai lối này).

### Cảnh 2.1. Hai món quà

- `[NOI]` Sảnh Nhà chung, sáng sớm, ba ngày sau chương 1 (hiển thị chữ "Ba ngày sau").
- `[CAM]` Khóa toàn sảnh, rồi chia đôi màn hình: Lam bên trái, Khải bên phải.
- `[ANIM]` Tiểu Phong (13 tuổi, áo vải xanh quá rộng) `walk` nhanh vào sảnh, vừa đi vừa `look_around`, dừng ngay trước bàn, `bow` quá sâu rồi loạng choạng. Mây (áo giáp da, buộc vải trên tay) bước vào chậm, `guard_stand` ở góc sảnh, mắt quét mọi lối ra.
- `[SAY]` Lam (cười, nhẹ): "Đây là Tiểu Phong. Nó giỏi chữ, giỏi tính, hơi nhiều chuyện. Tôi tặng anh chị làm học việc. Nó sẽ học nhanh hơn anh chị tưởng."
- `[SAY]` Tiểu Phong (hốt hảng, nói nhanh): "Dạ em chào ngài Chủ Làng. Em biết viết, biết cộng, biết phân biệt muối biển với muối mỏ, anh đừng hỏi sao em biết, em không phải nghề này mới học..."
- `[SAY]` Mây (không nhìn cậu bé): "Cậu im đi."
- `[ANIM]` Tiểu Phong `shrug`, ngậm miệng nhưng mắt vẫn cười.
- `[SAY]` Khải (gật đầu về phía Mây): "Cô ta tên Mây. Cận vệ. Ta cho người, không cho lời hứa. Mây theo người nào thì người đó sống lâu hơn."
- `[SAY]` Mây (nhìn thẳng Chủ Làng, lần đầu): "Ngài ra lệnh, tôi được việc. Không ra lệnh, tôi đứng."
- `[CHOICE]` Chủ Làng tiếp quà thế nào:
  - A. "Cảm ơn, tôi nhận cả hai. Nhưng tôi sẽ dùng họ như dùng người của làng, không phải người của hai vị." → Lam (cười, không phản đối): "Thế cũng được." Khải (giọng trầm): "Thì tốt." `[SET] Nhân +1, Tín +1`
  - B. "Tôi nhận. Đường mà dân làng đi qua phòng ấn sẽ có mắt hai người này." → Lam và Khải nhìn nhau một nhịp. Tiểu Phong nét mặt. `[SET] Lộ +1, Uy +1` (hai vị cảnh giác hơn)
  - C. "Tôi sẽ giữ họ, nhưng chỉ ở những nơi không có bí mật." → Mây (khô khan): "Ngài đa nghi đúng mức." Lam (cười khẽ): "Một Chủ Làng biết nghi là một Chủ Làng sống lâu." `[SET] Luật +1, Tín -1`
  - ★ mặc định: A.
- `[SET]` Thêm Mây và Tiểu Phong vào dân làng (thực thể có cờ `mission` riêng nếu đang chạy màn sân khấu). Chọn seed `spy` ∈ {may, phong}, không hiển thị.
- `[NOI phụ – nếu khai_guard=false]` Khải bước vào cùng lúc, không mang giáp. Khải: "Ta đứng ngoài ba ngày rồi. Ta không quen đứng ngoài. Ta xin vào, và ta xin chịu giá cao hơn hồi trước." `[SET] Quân hỗ trợ chi phí +20%`.
- `[NOI phụ – nếu lam_grain=false]` Lam quay lại bến, cuốn sổ trong tay. Lam: "Tôi đã qua bãi đất của anh chị ba ngày, nhìn dân anh chị làm đói. Tôi sẽ giữ giá như cũ, nhưng lần sau anh chị đừng từ chối tôi nữa." `[SET] Giá gạo +20%`.
- `[GOTO]` 2.2

### Cảnh 2.2. Bà Mực đề nghị bản ước

- `[NOI]` Sảnh Nhà chung, buổi trưa. Bàn dài trống, chỉ đặt ba tờ giấy da.
- `[CAM]` Đẩy chậm từ cửa sảnh tới bàn. Khải và Lam ngồi hai đầu bàn, Chủ Làng ở giữa.
- `[ANIM]` Bà Mực `stand`, tay vẽ một vòng tròn trên mặt bàn bằng đầu ngón. Tiểu Phong đứng sau Lam, Mây đứng sau Chủ Làng.
- `[SAY]` Bà Mực: "Ở làng này, từ trước tới giờ, lời hứa nói miệng là đủ. Hết chiến tranh, người ta bắt đầu cãi nhau về chuyện ai đã hứa gì. Các vị đã ở đây ba ngày. Đã có ba tranh chấp về chỗ ngủ và một tranh chấp về con bò."
- `[SAY]` Tiểu Phong (chèn): "Con bò đó là của em! À không, thật ra nó không phải của em, nó thuộc về cả làng..."
- `[SAY]` Mây: "Cậu im." Tiểu Phong: "Dạ." (`[ANIM]` cậu cúi đầu, nhưng lén liếc Bà Mực.)
- `[SAY]` Bà Mực (hạ giọng, không đổi nhịp): "Bản ước gọi là Ước Tam Ấn. Ba bên cùng đóng dấu lên một tờ giấy, nói rõ ai được hưởng gì, ai phải giúp ai, ai bị phạt nếu bội ước. Cô Lam giữ ấn của Bến. Ông Khải giữ ấn của Doanh. Còn Chủ Làng thì chưa có ấn."
- `[ANIM]` Lam `laugh` nhẹ: "Thật ra tôi đã thấy một ấn để sẵn trên bàn bà rồi." Bà Mực `point` vào một khối đá trống trơn đặt giữa bàn: "Đúng. Nhưng chưa khắc."
- `[GOTO]` 2.3

### Cảnh 2.3. Chữ trên ấn

- `[NOI]` Giữa sảnh, cùng cảnh 2.2, ánh sáng chuyển sang vàng chậm.
- `[CAM]` Đẩy vào khối đá trống, rồi quay sang Chủ Làng.
- `[SAY]` Bà Mực: "Ta sẽ khắc cho. Mất ba ngày thợ đá. Chữ gì?"
- `[SAY]` Chủ Làng (khung thoại, không lựa chọn): "Chữ gì cũng được?"
- `[SAY]` Bà Mực: "Chữ gì cũng được, nhưng nhớ là nó sẽ nằm dưới mọi bản ước làng này ký trong trăm năm tới. Đừng khắc tên mình. Tên mình chết cùng mình. Khắc cái mình muốn làng này còn lại."
- `[ANIM]` Lam `lean_back` trên ghế, đầu nghiêng: "Tôi đề nghị chữ 'Chợ'. Một làng giàu thì không ai dám đụng." Khải (`slam_table` nhẹ một cái): "Chữ 'Quân'. Một làng mạnh thì không cần giàu." Bà Mực (`flip_book`, không ngặng): "Ta đề nghị cả hai im. Anh chị chọn."
- `[CHOICE LỚN]` **Chữ trên Chiếc Ấn Chung.** Hiển thị bốn biểu tượng đá trên bàn.
  - A. **Chung** (cân bằng). Câu người chơi: "Chữ 'Chung'. Ba bên, không bên nào lấn." → Lam (gật đầu, cười nhẹ): "Một chữ an toàn." Khải (không đổi mặt): "Chữ tốt nếu giữ được." `[SET] seal_word=chung, Nhân +1, Hợp +1`
  - B. **Chợ** (thiên về Bến). Câu người chơi: "Chữ 'Chợ'. Làng phải biết thuê, biết bán." → Lam (mắt sáng lên, cười): "Tôi không ngờ." Khải (im 3 nhịp, rồi): "Ta sẽ nhớ." `[SET] seal_word=cho, Lam thân +, Khải xa +, crack +1 (làm đầu ở chương 3)`
  - C. **Quân** (thiên về Doanh). Câu người chơi: "Chữ 'Quân'. Làng phải biết tự vệ." → Khải (gật, lần đầu có nụ cười nhỏ): "Được." Lam (nghiêng đầu, không cười): "Rõ rồi." `[SET] seal_word=quan, Khải thân +, Lam xa +, crack +1`
  - D. **Trống** (không khắc). Câu người chơi: "Để trống. Mỗi lần ký, tôi sẽ tự quyết." → Bà Mực (chậm rãi, nhìn Chủ Làng một lúc lâu): "Khó hơn. Nhưng ta hiểu." `[SET] seal_word=trong, Luật +1, Uy +1`
  - ★ mặc định: A.
- `[ANIM]` Bà Mực `write` chữ đã chọn lên mặt đá bằng mực, thợ đá NPC (không lời) `chisel` ba nhịp. Nhấn mạnh ở nhịp thứ ba: cái ấn được đội lên, ánh vàng.
- `[FX]` Tiếng đục đá dồn dập, bụi đá rơi, rồi một tiếng "cạch" trầm.
- `[GOTO]` 2.4

### Cảnh 2.4. Lễ ký

- `[NOI]` Sảnh, chiều muộn. Đèn lồng bật, ánh vàng ấm. Dân làng đứng hai bên bàn dài.
- `[CAM]` Khóa toàn sảnh, rồi ba góc cận: tay Lam, tay Khải, tay Chủ Làng.
- `[ANIM]` Lam `stamp` ấn của Bến (vòng đồng khắc thuyền) lên góc trái tờ giấy. Khải `stamp` ấn của Doanh (đinh sắt đen vuông) lên góc phải. Chủ Làng `stamp` Ấn Chung ở giữa, người chơi bấm nút để đóng.
- `[FX]` Mỗi lần đóng, tiếng dấu nặng và đục, nghe như đóng cửa kho. Sáp đỏ nóng chảy rồi đông, khói mỏng. Dân làng vỗ tay rất nhỏ, không vội.
- `[SET]` `oath = true`. Mở nút mới "Ước Tam Ấn" nối IV-1 và V-1.
- `[GOTO]` 2.5

### Cảnh 2.5. Lam nói riêng

- `[NOI]` Hiên sau sảnh, đêm. Trăng lớn trên mặt sông phía xa.
- `[CAM]` Khóa ổn định, hai người ở hai bên khung.
- `[MOVE]` Lam `walk` tới, không mang sổ. Đứng cạnh Chủ Làng, cùng nhìn ra sông.
- `[SAY]` Lam (giọng thấp, không cười): "Tôi muốn nói một điều mà Khải sẽ không nói. Tôi tặng anh chị Tiểu Phong. Khải đã cho anh chị Mây. Chúng ta đều làm một việc giống nhau: gửi người của mình vào nhà anh chị."
- `[SAY]` Lam: "Trong hai đứa nhỏ đó có một đứa không thuộc về chúng tôi. Tôi không biết là ai. Khải cũng không biết. Cả hai chúng tôi đều thấy lạ, nhưng không ai dám nói với người kia vì sợ bị nghi. Tôi nói với anh chị vì anh chị là người duy nhất không có lý do gì để nói dối tôi. Bây giờ."
- `[ANIM]` Lam `look_around` nhanh sau lưng, rồi quay lại. Bên dưới sân, Mây `guard_stand` ở cổng; Tiểu Phong đuổi một con gà qua sân, cãi nhau với nó.
- `[CHOICE]` Chủ Làng trả lời:
  - A. "Tôi sẽ để ý cả hai. Không nói với Khải." → Lam (gật, chậm): "Đúng kiểu anh chị. Tôi sẽ không hỏi thêm." `[SET] Tín +1 với Lam, Lộ +0`
  - B. "Chị có bằng chứng không, hay chỉ là linh cảm?" → Lam (cười khẽ, sợ sệt): "Một con số tôi không đếm được. Tôi chỉ biết là phần thừa trong kho của tôi bị thiếu một ít, mỗi lần Tiểu Phong đến gần." (gợi ý: nếu `spy=phong` thì đây là dấu vết thật; nếu `spy=may` thì đây là lạc hướng) `[SET] Lộ +1`
  - C. "Tôi sẽ nói với Khải ngay." → Lam (bước lùi, trắng mặt): "Đừng. Nói bây giờ thì cả hai chúng tôi cùng mất mặt." `[SET] Tín -1, Uy +1` (nếu người chơi nhấn tiếp, Khải nghe chính xuất trong 2 phút, `crack +1`)
  - ★ mặc định: A.
- `[ANIM]` Lam `bow` nhẹ, quay vào sảnh. Chủ Làng đứng một mình nhìn xuống sân. Mây `look_up` về phía hiên, rồi `look_away`.
- `[CAM]` Lùi dần, nhìn toàn cảnh đại sảnh sáng đèn.
- `[SET]` `crack` giữ nguyên trừ khi có +1 ở trên. Kết thúc chương 2.

## Chương 3. Mùa đông của sắt và muối

**Khi nào:** Nhà chung cấp 5 đến 6, sau khi ký Ước Tam Ấn. **Đặt cờ vào:** `crack` (0 đến 6), `land_split`, `secret_lam`, `secret_khai`. **Thời lượng:** khoảng 7 phút đọc.

### Cảnh 3.1. Mùa đông đầu tiên không đói

- `[NOI]` Toàn làng, tuyết mỏng phủ mái. Kho đầy hơn bao giờ hết.
- `[CAM]` Rị chậm qua từng khu: bến (Lam), mỏ (Khải), sảnh, rồi quay lại bến. 10 giây, không thoại, nhạc nhẹ.
- `[ANIM]` Dân NPC `carry` gạo, cười nói với nhau. Lính Khải `walk` tuần tra dọc tường mới đắp. Trẻ con chạy qua dưới chân ngựa. Một hồi chuông nhỏ ở sảnh.
- `[SAY]` Dân làng (hai giọng NPC nói chuyện cùng lúc, có phụ đề): "Hai cánh tay của làng mình đây. Một bên cho ăn, một bên cho sống."
- `[GOTO]` 3.2

### Cảnh 3.2. Bà Mực nhận xét

- `[NOI]` Phòng ấn sau sảnh, chụp đèn dầu. Bàn nhỏ, hai người ngồi, Chủ Làng và Bà Mực.
- `[ANIM]` Bà Mực `write` chép sổ chậm, chấm mực. Chủ Làng `sit`, cùng chép phần mình.
- `[SAY]` Bà Mực (không ngặng viết): "Cánh tay nào cũng muốn có cái đầu. Ta sống đủ lâu để biết: người cho mình hai bàn tay luôn có lý do. Chỉ là ta chưa biết lý do đó là gì."
- `[CHOICE]` Chủ Làng:
  - A. "Bà nghĩ họ có ý gì xấu?" → Bà Mực (ngừng bút, ngẩng lên): "Xấu thì không. Chỉ là mỗi người đang muốn làng này là của mình một chút. Nghe có vẻ chẳng sao, cho đến khi hai chút đó chạm nhau." `[SET] Lộ +1`
  - B. "Tôi cần họ cả hai. Đừng làm tôi nghi." → Bà Mực (thở dài): "Nghi là bổn phận của người đứng đầu bàn. Ta không bảo anh chị ghét họ, ta bảo anh chị đừng nhắm mắt." `[SET] Luật +1, Tín +1`
  - C. (im lặng, viết tiếp) → Bà Mực (mỉm cười): "Tay anh chị chép đẹp hơn anh chị nói." `[SET] Nhân +1`
  - ★ mặc định: A.
- `[GOTO]` 3.3

### Cảnh 3.3. Hai mảnh đất giáp nhau

- `[NOI]` Sân sảnh, buổi sáng. Bản đồ làng trải trên bàn đá ngoài trời, hai vùng sáng lên (vùng cạnh bến, vùng cạnh mỏ), giáp nhau ở một dải đất hẹp.
- `[CAM]` Đẩy từ trên cao xuống bản đồ rồi về ba người.
- `[MOVE]` Lam và Khải cùng `walk` tới bàn từ hai phía. Khải tới trước một bước. Tướng Đồng `arms_cross` đứng sau Khải.
- `[SAY]` Lam (cười, tay vẽ lên bản đồ): "Tôi xin một mảnh đất cạnh bến để dựng kho. Chỉ bấy nhiêu thôi."
- `[SAY]` Khải (không đổi mặt): "Đất đó tôi ngó lâu rồi. Lam, cô đừng nhân lúc tôi đi tuần mà xin."
- `[SAY]` Lam (cười, nhưng chậm lại): "Tôi xin công khai mà. Tôi không nhân lúc nào hết. Chỉ là tôi may mắn hơn ông thôi, vì tôi biết đếm."
- `[SAY]` Khải: "Cô biết đếm cái gì?"
- `[SAY]` Lam: "Biết đếm xem ông đi tuần mấy ngày một tháng."
- `[ANIM]` Tướng Đồng `step_forward`, tay chạm chuôi kiếm, gầm gừ: "Ăn nói kiểu gì..." Khải `hand_up_stop` không nhìn lại. Cả sân im. Dân NPC ngừng công việc, quay nhìn.
- `[SAY]` Khải (rất chậm, rất nhỏ): "Lam. Nếu cô còn làm thế một lần nữa thì ta sẽ ngừng coi cô là bạn."
- `[SAY]` Lam (không còn cười): "Ông có coi tôi là bạn thật không?"
- `[CHOICE LỚN] [MAP]` **Chia dải đất giáp nhau.** Người chơi kéo ranh giới trên bản đồ. Có nút "hỏi thêm" (hai bên trình bày lại). Có đồng hồ 60 giây.
  - A. **Cho Lam.** Câu người chơi: "Mảnh này cạnh bến, chị Lam dựng kho ở đó là hợp lý." → Lam (gật, nhìn Khải một giây): "Cảm ơn." Khải (không nói gì, rồi): "Thì được." Tướng Đồng `spit`. `[SET] land_split=lam, crack +1, Tín Lam +1, Khải -1`
  - B. **Cho Khải.** Câu người chơi: "Mảnh này giáp mỏ, ông Khải dựng lò rèn là hợp lý." → Khải (gật, dài): "Ta nhớ." Lam (cười, nhưng không còn đẹp): "Người buôn thì luôn nhớ giá." `[SET] land_split=khai, crack +1, Tín Khải +1, Lam -1`
  - C. **Chia đôi.** Câu người chơi: "Chia đôi, cả hai dựng một nửa. Tôi sẽ giữ phần giữa cho làng." → Lam (thở dài): "Thế là không ai lợi cả." Khải: "Thế là không ai mất cả." Cả hai nhìn Chủ Làng, không hài lòng nhưng chấp nhận. `[SET] land_split=half, crack +0, Luật +1, Tín cả hai -0` (không ai +, không ai -)
  - D. **Giữ cho làng.** Câu người chơi: "Đất này không thuộc ai hết. Tôi sẽ dùng cho làng." → Lam và Khải cùng im. Lam (nhẹ): "Thế là anh chị không tin chúng tôi." Khải (gật chậm): "Ta không trách. Nhưng ta nhớ." `[SET] land_split=village, crack +2, Uy +1, Lộ +1`
  - ★ mặc định khi hết giờ: C.
- `[ANIM]` Sau lựa chọn, hai người quay lưng nhau, không còn đứng cạnh nhau ở bàn. Lam `walk` về phía bến, Khải `walk` về phía mỏ. Chủ Làng đứng lại một mình nhìn bản đồ.
- `[MAP]` Vùng đất được đánh dấu trên bản đồ theo `land_split`. Nếu cho Lam, đặt sẵn khung Kho Lam. Nếu cho Khải, đặt sẵn khung Lò Rèn. Nếu chia đôi, mỗi bên 50%. Nếu giữ cho làng, hiện khung trống dành cho công trình Chủ Làng chọn.
- `[GOTO]` 3.4

### Cảnh 3.4. Hai bí mật trong đêm

- `[NOI]` Phòng ấn, nửa đêm. Một ngọn nến. Gió lồng vào khe cửa.
- `[CAM]` Khóa, chỉ thấy Chủ Làng ngồi và hai cánh cửa. Nhạc dừng.
- `[MOVE]` Lam vào trước, đặt cuốn sổ lên bàn, `sit` ở ghế đối diện. Khải vào sau ba nhịp, không ngồi, đứng quay lưng, nhìn ra cửa sổ tối.
- `[SAY]` Lam (giọng thấp, không cười): "Mùa thu năm ngoái, khi làng còn đói, tôi đã âm thầm gom gạo ở các vùng bên dưới và giữ lại. Tôi mua đất rẻ cạnh bến, rồi bán lại gạo cho làng này để có tiền mua thêm. Tôi không làm gì trái luật, nhưng nếu dân biết, họ sẽ không thích tôi."
- `[SAY]` Khải (quay lưng, không đổi giọng): "Anh trai ta là chỉ huy cũ của Doanh. Hắn bán lương của lính cho thương nhân. Ta xử hắn. Lính thấy ta chém anh ruột mà không chớp mắt, nên họ nghe lời ta. Họ không biết đêm đó ta không ngủ."
- `[ANIM]` Lam cúi đầu. Khải `sheath` kiếm lại một lần dù kiếm vẫn ở trong vỏ (thói quen khi căng). Hai người không nhìn nhau.
- `[CHOICE]` Chủ Làng phản ứng (chọn 1 với Lam, 1 với Khải, theo thứ tự):
  - **Với Lam:** A. "Tôi sẽ giữ kín điều này." (Lam: "Cảm ơn. Tôi sẽ không quên." `[SET] secret_lam=kept, Tín Lam +2, Lộ -0`) B. "Chị phải nói với dân." (Lam: "Vâng. Nhưng đừng ép tôi sớm quá." `[SET] secret_lam=public_pending, Luật +1, Tín Lam -1`) C. "Chị đã dùng nỗi đói của làng để kiếm lời." (Lam im 3 nhịp. `[SET] secret_lam=used, Tín Lam -2, crack +1`)
  - **Với Khải:** A. "Ông đã làm đúng với doanh của ông." (Khải: "Ta không cần ai biện hộ." `[SET] secret_khai=kept, Tín Khải +2`) B. "Ông có hối hận không?" (Khải quay lại nhìn, chậm: "Có. Mỗi đêm. Nhưng hối hận không ăn được." `[SET] secret_khai=asked, Nhân +1`) C. "Người đã giết anh ruột thì không đáng tin." (Khải nhìn Chủ Làng rất lâu. `[SET] secret_khai=judged, Tín Khải -2, crack +1`)
  - ★ mặc định: A và A.
- `[ANIM]` Cả hai rời phòng không chào nhau. Lam `walk` ra trước, Khải `walk` ra sau, dừng ở cửa một nhịp nhìn Lam đi, rồi mới đi.
- `[SET]` Nếu tổng `crack` sau cảnh ≥ 3 thì chuyển "vết rạn nặng" (`crack_heavy=true`) sẽ chỉnh thoại chương 5.
- `[GOTO]` 3.5

### Cảnh 3.5. Bà Mực chốt chương

- `[NOI]` Phòng ấn, đêm sâu, cùng cảnh 3.2.
- `[SAY]` Bà Mực (thở dài, không ngặng): "Họ đang tranh nhau làm bạn thân của anh chị. Đấy là lúc nguy hiểm nhất. Tình bạn mà phải tranh thì không còn là tình bạn."
- `[FX]` Nến tắt phụt. Nhạc ngừng. Màn hình đen 2 giây. Kết thúc chương 3. Mở nút VI-1 và VIII-1.

## Chương 4. Cái Bóng

**Khi nào:** Nhà chung cấp 6 đến 7, khi làng có lễ hội mùa gặt (tự kích hoạt khi đủ điều kiện nông nghiệp). **Đặt cờ vào:** `trust_target`, `may_dead` (chỉ Khắc nghiệt), `crack`. **Thời lượng:** khoảng 8 phút đọc.

### Cảnh 4.1. Đêm hội mùa gặt

- `[NOI]` Đại sảnh cấp 6, treo đèn lồng, bàn kê dài ra cả sân. Dân đông hơn bao giờ hết, có trẻ con, có chó, có nhạc sáo.
- `[CAM]` Khóa rộng từ gác cao, rồi xuống ngang tầm người, đi theo Tiểu Phong chạy qua bàn.
- `[ANIM]` Tiểu Phong `run` với một mâm bánh, dừng trước Chủ Làng, `shrug` với người trong khung. Mây `guard_stand` ngay sau lưng Chủ Làng, không ngồi, không ăn.
- `[SAY]` Tiểu Phong (nói liền, không ngắt): "Anh Chủ Làng, anh ăn thử cái này đi, chị Lam bảo nướng theo công thức phương nam, em biết công thức đó đấy, đừng hỏi sao em biết..."
- `[SAY]` Mây (không nhìn cậu bé): "Cậu biết nhiều quá."
- `[SAY]` Tiểu Phong (ngừa mặt): "Biết nhiều thì tốt chứ sao!"
- `[SAY]` Mây: "Không phải lúc nào cũng tốt."
- `[ANIM]` Tiểu Phong `shrug`, chịu thua, `run` đi tiếp.
- `[CHOICE]` Chủ Làng có một nhịp ngắn với Mây:
  - A. "Cô không ăn gì à?" → Mây (nhìn Chủ Làng một lúc): "Khi đang làm việc thì không." `[SET] Nhân +1`
  - B. "Đứng ở đó mỏi chân lắm. Ngồi đi." → Mây (không đổi tư thế): "Ngồi thì thấp hơn." `[SET] Uy +1, Nhân +0`
  - C. (không nói gì) → Mây `look_around`, mắt dừng ở xà nhà. `[SET] Lộ +1`
  - ★ mặc định: A.
- `[GOTO]` 4.2

### Cảnh 4.2. Con dao

- `[NOI]` Cùng sảnh. Động tác nhanh, ánh đèn rơi xuống bàn.
- `[CAM]` Đẩy chậm vào mặt Mây khi cô ngừng `look_around` ở một điểm trên xà nhà. Rồi cắt: xà nhà, một bóng người (không phải đèn, không phải mái).
- `[ANIM]` Mây không hét. Cô `step_forward` một bước, đứng chắn giữa Chủ Làng và bóng tối, tay trái `block_pose`.
- `[FX]` Nhạc dừng hoàn toàn. Âm thanh ù ù của máu trong tai. Slow-motion 1 giây.
- `[ANIM]` Sát thủ (NPC, áo tối, khăn che miệng) `assassin_dash` từ xà nhà xuống, hai dao ngắn cầm ngược. Không để lại bóng mờ khi ra đòn. Con dao bên phải `assassin_stab` vào vai Mây, không vào cổ Chủ Làng.
- `[ANIM]` Mây không kêu. Cô `kneel` từ từ, tay bóp vào chỗ máu.
- `[SAY]` Mây (rất nhỏ): "Bắt nó. Đừng để nó chạy."
- `[FX]` Tiếng la hét mới nổ ra, nhạc sáo đứt, ly rơi, dân chạy.
- `[MOVE]` Lính Khải chặn ba phía. Sát thủ `assassin_dodge` hai lần, nhưng bị chặn ở cổng trước. Hắn dừng lại, ngó hai bên, rồi `assassin_vanish` (tự cắt họng, tàn thành khói mỏng như đã quy ước) trước khi ai kịp hỏi.
- `[ANIM]` Trên thân hắn rơi ra hai vật: một chiếc nhẫn đồng khắc hình thuyền (ấn của Bến), một cái đinh sắt đen vuông (ấn của Doanh). Camera `zoom_in` từng vật.
- `[GOTO]` 4.3

### Cảnh 4.3. Ai đứng sau

- `[NOI]` Cổng sảnh, đên bật tất cả. Lính đứng vòng. Tướng Đồng đứng đầu.
- `[SAY]` Tướng Đồng (quát, `point` vào Lam): "Cô chủ bến! Nhẫn của cô đây! Cô muốn giết Chủ Làng để chiếm làng!"
- `[SAY]` Lam (không hạ giọng, không chạy): "Đinh của ông cũng có đây. Ông dùng đúng lúc Chủ Làng có người của ông đứng cạnh để rồi đổ lên đầu tôi. Tôi không ngu đâu, tướng quân, ông cũng không ngu. Vì vậy cái đã khổ đổ là ai kia ngu hơn cả hai ta."
- `[ANIM]` Khải bước vào, nhặt chiếc đinh sắt lên `inspect` rồi nhặt chiếc nhẫn.
- `[SAY]` Khải (chậm): "Đinh này làm thật. Nhưng đúc sai một đường sới. Ta người thô, ta nhận ra. Thợ của ta không bao giờ đúc như vậy."
- `[SAY]` Lam (nhặt nhẫn, xoay): "Nhẫn này cũng không phải thợ của tôi. Bản khắc chìm quá sâu. Thợ của tôi không bao giờ khắc sâu như vậy."
- `[CAM]` Cận hai người, họ nhìn nhau, lần đầu có cùng một ý nghĩ và không ai muốn nói trước. Nhạc dừng. Ánh đèn dồn vào Chủ Làng.
- `[CHOICE LỚN]` **Tin ai?** (tên biến: `trust_target`)
  - A. **Tin Khải** (cho Lam bị thẩm vấn). Câu người chơi: "Tôi tin Khải. Lam, chị ở lại sảnh cho tới khi xong việc." → Lam (cười, không đẹp): "Vâng. Tôi sẽ ở. Đồng hồ của anh chị đã chạy." `[SET] trust_target=khai, crack +1, Tín Khải +1, Tín Lam -1`
  - B. **Tin Lam** (cho Khải bị thẩm vấn). Câu người chơi: "Tôi tin Lam. Khải, ông giữ quân yên trong doanh." → Khải (không đổi mặt): "Ta hiểu." Tướng Đồng nghiến răng. `[SET] trust_target=lam, crack +1, Tín Lam +1, Tín Khải -1`
  - C. **Không ai.** Câu người chơi: "Tôi không tin ai trong hai người. Tôi sẽ tự kiểm tra." → Cả hai im. Lam (nhẹ): "Đây là chỗ anh chị đúng." Khải (không phản ứng). `[SET] trust_target=none, Luật +1, Lộ +1, crack +0`
  - ★ mặc định: C.
- `[GOTO]` 4.4

### Cảnh 4.4. Phòng thuốc ba đêm

- `[NOI]` Phòng thuốc nhỏ gần sảnh, đèn dầu, giường đơn. Mây nằm bất động, vai quấn vải máu.
- `[CAM]` Khóa trên góc cao nhìn xuống giường, rồi cận mặt Mây. Thộn thời gian: ba lần cái bóng cửa sổ dịch trên tường.
- `[MOVE]` Chủ Làng `walk` vào, `sit` cạnh giường. Tiểu Phong đứng ở cửa, không dám vào, tay ôm một bình nước.
- `[ANIM]` Tiểu Phong nói nhỏ: "Em chỉ muốn nói... chị ấy thật sự không cần phải chặn con dao đó. Chị ấy cả nguời, có thể đứng cạnh thôi..." Tiểu Phong `look_down`.
- `[CHOICE]` **Thuốc quý.** Chủ Làng có thể dùng một liều thuốc quý (tốn 30 vàng hoặc một món dược liệu hiếm) để chắc chắn cứu Mây.
  - A. Dùng thuốc quý. Câu người chơi: "Dùng hết. Đừng tiếc gì cả." → Tiểu Phong (thở phào): "Cảm ơn anh." Mây qua khỏi chắc chắn. `[SET] tài nguyên -30 vàng, Nhân +2, may_dead=false`
  - B. Không dùng. Câu người chơi: "Cho cô ấy tự qua. Nếu cần thì ta không tiếc." → Tiểu Phong nhìn Chủ Làng không tin nổi. `[SET] tài nguyên +0, Nhân -1`. **Ở chế độ Dễ và Thường: Mây qua khỏi. Ở chế độ Khắc nghiệt: Mây chết trong đêm, `may_dead=true`, và cảnh 4.5 đổi sang biến thể chết.**
  - ★ mặc định: A (nếu đủ tài nguyên), nếu không đủ thì nút A bị khóa và chỉ còn B.
- `[GOTO]` 4.5

### Cảnh 4.5. Sáng hôm sau

**Biến thể Mây sống:**

- `[NOI]` Phòng thuốc, ánh sáng sáng, cửa sổ mở.
- `[ANIM]` Mây `sit_up` trên giường, tay bị treo. Chủ Làng `sit` cạnh giường cả đêm.
- `[SAY]` Mây (nhìn Chủ Làng, khô khan): "Ngài sống là được."
- `[ANIM]` Mây nhắm mắt, quay mặt về tường, vì đã nói xong.
- `[SET]` `crack` giữ nguyên. Mở chuỗi sát thủ (nút VII-1).

**Biến thể Mây chết (chỉ Khắc nghiệt):**

- `[NOI]` Phòng thuốc, trời xám. Cửa sổ đóng.
- `[ANIM]` Chủ Làng `sit` cạnh giường. Tấm vải trắng phủ lên Mây. Tiểu Phong đứng ở cửa, không nói gì, `look_down`.
- `[SAY]` Tiểu Phong (rất nhỏ): "Chị ấy không nói gì trước lúc đi. Chỉ bảo em chăm ngài."
- `[FX]` Chuông nhỏ ở sảnh ngân một hồi chậm. Đèn trong phòng tắt.
- `[SET]` `may_dead=true`, `crack +1`, `Nhân -1`. Mở chuỗi sát thủ nhưng không còn Mây ở sảnh những chương sau. Kẻ cài seed `spy` vẫn giữ (nếu là `may` thì Tiểu Phong thay vị trí tường thuật ở chương 7, xem ghi chú chương 7).
- Kết thúc chương 4.

## Chương 5. Hội nghị Ba Ấn

**Khi nào:** Nhà chung lên cấp 7 (giữa Ngọn, chấm điểm). **Đặt cờ vào:** `ruling_mine`, `crack`. **Thời lượng:** khoảng 8 phút đọc.

### Cảnh 5.1. Đại sảnh mở rộng

- `[NOI]` Sảnh cấp 7, gấp đôi trước, có hành lang, gác chéo, phòng riêng để giữ ấn.
- `[CAM]` Quay chậm từ cửa vào, dừng ở ghế đầu bàn để trống. Khải `sit` bên trái, Lam `sit` bên phải, giữa hai người có một khoảng trống.
- `[ANIM]` Mây (nếu còn sống) `guard_stand` ở chỗ cũ, tay vẫn buộc vải, đứng thẳng hơn trước. Tiểu Phong đứng sau Lam, không nói một lời.
- `[NOI phụ – nếu crack_heavy]` Lam và Khải không nhìn nhau dù ngồi gần. Tướng Đồng đứng sau Khải, tay luôn trên chuôi kiếm.
- `[SAY]` Chủ Làng (khung thoại): "Từ đầu các người đã nói rằng muốn giúp. Bây giờ tôi cần biết đúng ra là giúp để làm gì."
- `[GOTO]` 5.2

### Cảnh 5.2. Hai lời trình bày

- `[CAM]` Cắt qua lại hai người, không đẩy vào ai quá lâu.
- `[SAY]` Khải (nặng, chậm): "Ta muốn làng có quân mạnh để không ai dám đụng. Ta không thiết quốc gia, quốc gia chỉ là cái tên. Ta thiết những người trên mặt đất này còn sống vào mùa xuân."
- `[SAY]` Lam (nhẹ, chậm rãi): "Tôi muốn làng giàu để không ai cần ra trận. Một làng có tiền thì mua được hòa bình. Còn một làng chỉ có quân thì sớm muộn cũng phải tìm ai đó để đánh."
- `[SAY]` Khải: "Cô nói nghe như quân của tôi là mối họa."
- `[SAY]` Lam (không cười): "Ông chỉ nghĩ thế đấy. Tôi nói thật, thì không đúng."
- `[ANIM]` Bà Mực `knock_table` nhẹ một cái bằng đầu gậy. Tiếng gõ nhỏ nhưng cả hai im.
- `[SAY]` Bà Mực: "Hai người nói rất hay. Ta nghe cả hai, và ta nhận ra một điều: mỗi người đều nói 'làng' nhưng ý là 'tôi'. Đúng không?"
- `[ANIM]` Không ai trả lời. Lam `look_down`. Khải `look_away`. Bà Mực `stand`, `walk_slow` vào phòng ấn.
- `[GOTO]` 5.3

### Cảnh 5.3. Ấn Chung

- `[NOI]` Sảnh, ánh sáng chuyển vàng nhẹ.
- `[MOVE]` Bà Mực `walk_slow` ra, hai tay ôm một chiếc hộp gỗ cũ, đặt giữa bàn.
- `[SAY]` Bà Mực: "Đây là Ấn Chung. Ta khắc từ hồi chào đón hai người, nhưng ta chưa trao. Ta chờ xem Chủ Làng có đủ làng để giữ nó không. Giờ thì đủ rồi. Ấn này có quyền đóng lên bất cứ bản ước nào, kể cả bản ước của hai vị đây."
- `[SAY]` Khải (cau mày): "Bà đừng đặt quyền đó vào tay người chưa biết mình đứng về phía nào."
- `[SAY]` Bà Mực: "Chính vì chưa biết mới nên đặt. Người biết rồi thì đã thành người của ai đó rồi."
- `[CAM]` Đẩy vào chiếc hộp, nắp mở, một ánh sáng đục phát ra từ chiếc ấn đá có chữ đã chọn ở chương 2.
- `[FX]` Nhạc dâng cao, rồi dừng.
- `[GOTO]` 5.4

### Cảnh 5.4. Phán quyết mỏ sắt

- `[NOI]` Sảnh, bàn trống. Bản đồ hiện lên bàn, có mỏ sắt cạnh bến được đánh dấu đỏ.
- `[SAY]` Khải: "Mỏ này phải do quân giữ. Sắt là máu của lính."
- `[SAY]` Lam: "Con đường sắt chạy qua bến của tôi. Nếu tôi không giữ được con đường thì sắt đó không ra khỏi làng."
- `[CHOICE LỚN] [MAP]` **Phán quyết mỏ sắt.** Người chơi dùng Ấn Chung đóng lên bản phán quyết (hoạt ảnh `stamp` và tiếng dấu trầm).
  - A. **Cho Khải giữ mỏ, Lam giữ đường.** Câu người chơi: "Khải giữ mỏ, Lam giữ đường vận chuyển. Hai bên phải cùng làm, không ai được lấy cả." → Cả hai không hài lòng nhưng chấp nhận. `[SET] ruling_mine=split, crack +0, Luật +1, Của +1`
  - B. **Cho Khải toàn bộ.** Câu người chơi: "Mỏ thuộc Doanh. Con đường cũng do Doanh mở." → Khải (gật chậm). Lam (nhìn xuống bàn, không nói). `[SET] ruling_mine=khai, crack +1, Uy +1, Tín Khải +1, Tín Lam -1`
  - C. **Cho Lam toàn bộ.** Câu người chơi: "Mỏ và đường đều vào Bến. Doanh nhận lương, không nhận mỏ." → Lam (cười nhẹ, nhưng mắt nhìn Khải). Khải (không cử động, có rất nhiều thứ đang để trong mắt). `[SET] ruling_mine=lam, crack +1, Của +1, Tín Lam +1, Tín Khải -1`
  - D. **Giữ mỏ cho làng.** Câu người chơi: "Mỏ này thuộc làng. Cả hai được phần theo nhu cầu, không theo yêu cầu." → Khải và Lam cùng nhìn Chủ Làng, rồi nhìn nhau. Lần đầu có cùng một ý nghĩ. `[SET] ruling_mine=village, crack +2, Uy +1, Lộ +1`
  - ★ mặc định khi hết giờ: A.
- `[ANIM]` Sau phán quyết, cả hai `stand` không chào. Lam cúi đầu rất nhẹ rồi đi. Khải `salute` một nhịp ngắn rồi đi.
- `[SET]` Đồng thời **chấm điểm Nọn giữa** (cấp 7), cộng dồn Dấu Luật/Của. M7 là đích mặc định, M1 bị đóng lại nếu `crack ≥ 4` tại đây.
- `[GOTO]` 5.5

### Cảnh 5.5. Bà Mực nói riêng

- `[NOI]` Sảnh, vắng. Một mình Bà Mực và Chủ Làng. Chiều muộn.
- `[ANIM]` Bà Mực `sit`, đặt Ấn Chung lên bàn trước mặt Chủ Làng.
- `[SAY]` Bà Mực: "Anh thấy đấy. Đây mới là giữa vòng. Nút thắt chỉ đến khi hai bên bắt đầu đòi anh bỏ bên kia."
- `[CHOICE]` Chủ Làng hỏi:
  - A. "Bà biết trước điều đó sẽ đến?" → Bà Mực: "Ta biết mọi thứ sẽ đến. Chỉ là ta không biết khi nào. Ta đã ghi hết vào sổ. Nhưng chữ đẹp đến mấy thì cũng không đỡ được một nhát dao." `[SET] Lộ +1`
  - B. "Bà có đề nghị gì không?" → Bà Mực (mỉm cười, nhìn Chủ Làng lâu): "Chuẩn bị. Không phải cho trận đánh. Cho lúc anh phải cúi đầu." `[SET] Luật +1`
  - C. (im lặng) → Bà Mực (nhẹ): "Thì được." Nhạc dịu xuống. `[SET] Nhân +1`
  - ★ mặc định: A.
- `[FX]` Đèn lồng lắc nhẹ, bóng của Chủ Làng dài ra trên tường. Kết thúc chương 5.

## Chương 6. Đêm hai lời thề

**Khi nào:** Nhà chung lên cấp 8. **Đặt cờ vào:** `betrayed` ∈ {lam, khai, both, none}, `muc_dead`. **Thời lượng:** khoảng 12 phút đọc. Đây là chương kết hợp thoại sự kiện với quyết định chiến lược trên bản đồ.

**Nếu `may_dead=true`:** mọi dòng ghi "Mây" trong chương này được thay bằng Tiểu Phong (cậu đứng ở chỗ Mây trước đây, không có kiếm) hoặc bỏ nếu vô nghĩa.

### Cảnh 6.1. Hai lá thư

- `[NOI]` Sảnh, nửa đêm. Đại sảnh đã lên cấp 8: có lầu, cổng thành, chuông đúc bằng sắt Khải và đồng Lam, đổ chung một khuôn.
- `[CAM]` Khóa ngoài cổng thành, đèn lồng, sương trên mặt sông. Hai kỵ sĩ (một từ bến, một từ đồi) phi tới cùng lúc từ hai phía khung hình, dừng trước cổng.
- `[ANIM]` Hai kỵ sĩ `dismount`, `bow` sâu, dâng thư bằng hai tay. Chủ Làng `walk` ra cổng, nhận từng lá thư, sáp còn ấm.
- `[FX]` Chuông sảnh ngân hai hồi, nhịp dồn. Màn hình tối dần.
- `[SAY]` Thư của Lam (giọng đọc nội tâm, âm Lam): "Bến đã bị Doanh Sắt chặn một chuyến thuyền muối. Theo Ước Tam Ấn, hành động đó là bội ước. Tôi yêu cầu Chủ Làng làm đúng điều lệ ghi: bẻ ấn của Doanh."
- `[SAY]` Thư của Khải (giọng đọc, âm Khải): "Ba toa lương của Doanh đã bị người của Bến đánh táo giá ở cửa khẩu. Theo Ước Tam Ấn, đó là bội ước. Ta yêu cầu Chủ Làng bẻ ấn của Bến."
- `[ANIM]` Chủ Làng cầm cả hai lá thư, `look_down`. Camera `zoom_in` vào hai lá thư cạnh nhau.
- `[GOTO]` 6.2

### Cảnh 6.2. Điều khoản không ai đứng giữa

- `[NOI]` Sảnh, Chủ Làng ngồi. Bà Mực `sit` cạnh, rất lâu không nói.
- `[SAY]` Bà Mực: "Ta phải nói thật. Ước này ta viết từ đầu, và có một điều ta đã không nói: không có điều khoản nào cho kẻ đứng giữa. Đúng vậy. Một lời thề ba bên, khi hai bên kiện nhau, thì bên thứ ba phải chọn. Không chọn, cả hai sẽ cùng phạt."
- `[CHOICE]` Chủ Làng phản ứng:
  - A. "Bà viết như vậy từ trước?" → Bà Mực: "Đúng. Ta tin rằng một người không dám chọn thì không xứng giữ Ấn Chung." `[SET] Lộ +1`
  - B. "Bà đã chờ đêm này." → Bà Mực (nhẹ): "Ta chờ đêm này từ lâu rồi. Ta chỉ không nghĩ nó sẽ đau đến thế." `[SET] Tín Bà Mực +1`
  - C. (không nói, nhìn hai lá thư) → Bà Mực: "Đã đọc thì đừng đọc lại. Chữ không đổi đâu." `[SET] Luật +1`
  - ★ mặc định: B.
- `[CAM]` Quay lên trần, rồi xuống bản đồ chiến lược. Hiện bốn nút lựa chọn trên bản đồ.
- `[GOTO]` 6.3

### Cảnh 6.3. Bốn lối rẽ

- `[CHOICE LỚN] [MAP]` **Chọn một trong bốn hành động trên bản đồ.** Không có lựa chọn đứng ngoài. Mỗi lựa chọn vừa là lời nói, vừa là một thao tác thật (điều quân, khóa bến, đóng mỏ, mở kho). Có nút "hỏi thêm" trước khi xác nhận và hiện hệ quả dự kiến. Không có đồng hồ (không phải câu hỏi được phép bỏ qua).
  - A. **Phản Lam** (bẻ ấn của Bến) → `[GOTO] 6.A`
  - B. **Phản Khải** (bẻ ấn của Doanh) → `[GOTO] 6.B`
  - C. **Phản cả hai** → `[GOTO] 6.C`
  - D. **Giữ cả hai** (Bà Mực tự hiến) → `[GOTO] 6.D` (chỉ hiện nếu `trust` với Bà Mực ≥ 1 ở chương trước; nếu không, nút xám, nhưng vẫn chọn được nếu người chơi nhấn giữ)

### Cảnh 6.A. Phản Lam

- `[MAP]` Người chơi kéo quân Khải ra đứng chặn bến sông; khóa bến. Tàu của Lam không ra vào được nữa.
- `[CAM]` Khóa trên cao nhìn xuống bến: lính Khải `walk` thành hàng chặn lối thuyền. Sương dày. Chủ Làng gửi một lá thư ngắn (không đọc nội dung).
- `[MOVE]` Lam `walk` một mình đến cổng thành bằng đường sông, mặc bộ áo xanh như ngày đầu. Dừng ngoài cổng.
- `[SAY]` Lam (nhẹ, không cười): "Tôi đã tính trước cả rồi. Lúc ông ấy dập thuyền tôi, tôi biết có người sẽ phải chọn. Tôi chỉ không biết là anh chị. Tôi hy vọng là không phải anh chị."
- `[CHOICE]` Chủ Làng:
  - A. "Tôi xin lỗi." → Lam (giơ một tay lên, rất nhẹ): "Đừng. Đừng xin lỗi. Tôi là người buôn. Tôi hiểu giá cả. Anh chị không mua được lòng tôi bằng lời xin lỗi. Anh chị đã bán nó, và tôi sẽ nhớ giá." `[SET] Tín Lam -3`
  - B. "Tôi không xin lỗi. Tôi chọn điều tôi cho là đúng." → Lam (nhìn lâu, gật rất nhẹ): "Câu đó dễ chịu hơn." `[SET] Uy +1, Tín Lam -3`
  - C. (im lặng) → Lam quay lưng đi. `[SET] Tín Lam -3, crack +1`
  - ★ mặc định: A.
- `[ANIM]` Mây `guard_stand` bên Chủ Làng, tay vẫn nắm chuôi kiếm. Khi Lam quay lưng đi, Mây thầm: "Người đó vừa cho chúng ta một đường chết êm."
- `[ANIM]` Khải `walk` tới, `clap_shoulder` Chủ Làng mạnh như vỗ vào bức tường.
- `[SAY]` Khải: "Ta không nói cảm ơn. Nhưng ta nhớ."
- `[SET]` `betrayed=lam`. Thông tin hệ quả: Bến Bạc ngừng giao thương, mất nguồn muối và hàng ngoại. Quân Khải +20% sức mạnh. `[GOTO]` Chương 7.

### Cảnh 6.B. Phản Khải

- `[MAP]` Người chơi mở cửa cấp muối cho thuyền Lam và đóng cửa mỏ. Khóa chốt sắt của Khải.
- `[CAM]` Bình minh. Mỏ đóng cửa, chốt sắt đóng lại. Bụi đá lắng.
- `[MOVE]` Khải `walk` một mình, không giáp, đến cổng thành. Đứng rất lâu trước cổng.
- `[SAY]` Khải: "Ta chặt từng người của Doanh này. Đều là bọn lính mất chủ. Ta không giỏi nói. Nhưng ta biết thế nào là bị bán."
- `[CHOICE]` Chủ Làng:
  - A. "Ông có muốn đánh không?" → Khải: "Ta muốn. Nhưng lính của ta đã thề phục tuùng ấn này. Ta mà đánh thì tụi nó thành quân nổi loạn. Ta để chúng ta đứng ngoài, không phải vì sợ." `[SET] Tín Khải -1, Nhân +1`
  - B. "Tôi xin lỗi." → Khải (gật chậm, không nói gì). `[SET] Tín Khải -2`
  - C. "Ông đừng đặt tên cho việc này." → Khải quay đi. `[SET] Tín Khải -3, crack +1`
  - ★ mặc định: A.
- `[ANIM]` Mây (nếu còn sống) `step_forward`, nhìn thẳng Khải. Mây: "Ngài giết một người. Người đó không phải anh em. Ngài hệ nhận cái đau rồi, đúng không?" Khải không đáp, `turn_away`, `walk_slow` bãi bậc.
- `[SAY]` Mây (nhẹ, không đợi trả lời): "Tôi ở lại. Không phải vì ngài. Vì ngài là người duy nhất từng hỏi tôi có sợ không."
- `[SET]` `betrayed=khai`. Doanh Sắt rút hai phần ba quân, mỏ đóng; Bến Mở giao thương mạnh nhất. `[GOTO]` Chương 7.

### Cảnh 6.C. Phản cả hai

- `[MAP]` Người chơi đóng cả bến lẫn mỏ, rút quyền quân khỏi hai phía. Cả hai thế lực mất mọi đặc quyền.
- `[CAM]` Đại sảnh đóng cửa. Cận bàn: hai chiếc ấn bị bẻ đôi, mảnh rơi lên mặt đá. Sáng sớm, ánh sáng xám.
- `[SAY]` Chủ Làng (trong phòng họp đóng kín): "Cả hai đều đúng một phần. Và cả hai đều có bàn tay trong chuyện này. Tôi không muốn là người của ai nữa."
- `[SAY]` Lam (chậm): "Anh chị muốn cả hai chúng tôi đều là kẻ thù."
- `[SAY]` Khải (không thời gian ngạc nhiên): "Hay một ngôi làng một mình. Ta không nghĩ anh đủ gan."
- `[ANIM]` Bà Mực `walk_slow` rút về góc phòng, nhìn một làng mà bà không còn nhìn ra.
- `[CHOICE]` Chủ Làng:
  - A. "Tôi sẽ giữ làng một mình." → Lam và Khải cùng `bow`, rồi rời đi hai hướng. `[SET] Uy +2, Luật +1`
  - B. "Tôi sẽ không phản bội cả hai. Tôi sẽ phạt chính mình." → Hai người nhìn nhau, không hiểu. `[SET] Nhân +1, Tín cả hai -1`
  - ★ mặc định: A.
- `[SET]` `betrayed=both`. Cả Doanh Sắt lẫn Bến Sông đều rút. Làng cô đơn nhưng tự do, các kẻ thù bên ngoài để mắt đến. `[GOTO]` Chương 7.

### Cảnh 6.D. Giữ cả hai, Bà Mực tự hiến

- `[MAP]` Người chơi không bẻ ấn nào; giữ nguyên bến và mỏ, gọi hội đồng.
- `[SAY]` Chủ Làng (đứng giữa sảnh, tay giữ Ấn Chung): "Tôi không phản ai. Ai muốn phạt bội ước thì phải bắt đầu từ tôi."
- `[SAY]` Bà Mực (giọng già nhưng rõ từng chữ): "Ai bước tới đây đều phải bước qua ta trước."
- `[SAY]` Lam: "Bà đừng đùa."
- `[SAY]` Bà Mực: "Ta chưa bao giờ đùa với con số, cô Lam ạ."
- `[MOVE]` Bà Mực `walk` ra giữa sảnh, cầm trong tay một quả đấm mực, không phải vũ khí.
- `[SAY]` Bà Mực: "Lời thề đã bị dối. Ta dối nó. Hai tấm ấn giả kia là do ta ra lệnh khắc, để thử xem hai người sẽ làm gì. Ta đã thấy rồi. Giờ để ta nhận tội."
- `[ANIM]` Cả sảnh nhìn bà như nhìn một điều không thể có. Tướng Đồng `draw` kiếm nửa chừng, Khải `hand_up_stop`.
- `[FX]` Chuông ngoài cổng ngân, chuông của chính họ. Chủ Làng quay đầu nhìn chuông; khi quay lại, Bà Mực đã `walk_slow` ra cổng, đi xuống phía bến sông, không ai ngăn.
- `[CAM]` Cắt sang bến: chiếc hũ mực đổ trên bậc đá, chiếc gậy dựa vào cột đê. Không thấy Bà Mực. Nhạc dừng.
- `[CHOICE]` Chủ Làng có thể chọn để người tìm Bà Mực hay không (không đổi kết quả):
  - A. "Gửi lính đi tìm." → Khải: "Ta sẽ gửi. Nhưng ta nghi ngờ." `[SET] Nhân +1`
  - B. "Để bà ấy đi." → Lam (rất nhỏ): "Anh chị nhận ra đúng lúc." `[SET] Luật +1`
  - ★ mặc định: A.
- `[SET]` `betrayed=none`, `muc_dead=true`, `crack` không tăng. Người chơi đánh mất người hiểu làng nhất. `[GOTO]` Chương 7.

## Chương 7. Sau tiếng chuông

**Khi nào:** Nhà chung lên cấp 9. **Đặt cờ vào:** `hacmanh_fate` ∈ {caught, freed, land\_sold}, `spy_fate`, `muc_fate`. **Thời lượng:** khoảng 10 phút đọc.

### Cảnh 7.1. Kẻ đến một mình

- `[NOI]` Cổng thành, đêm. Chuông ngân, không phải báo địch.
- `[CAM]` Khóa ngoài cổng. Một người đứng đó, hai tay trống, không cận vệ, đội chiếc nón rộng vành.
- `[SAY]` Hắc Mãnh (cúi đầu nhẹ): "Tôi là Hắc Mãnh. Tôi xin được phép vào. Tôi không mang đao, không mang cung, chỉ mang một ít sự thật. Anh chị cứ khóa tôi lại sau khi nghe xong, tôi không phàn nàn."
- `[CHOICE]` Cho vào hay không:
  - A. "Vào đi. Nhưng tay ông phải luôn để ở chỗ tôi thấy." → Hắc Mãnh `bow`: "Rất công bằng." `[SET] hacmanh_in=true`
  - B. "Không. Nói ngoài cổng." → Hắc Mãnh (mỉm cười): "Được, đỡ mất công dọn ghế." Cảnh 7.2 chuyển ra ngoài cổng, thay vì trong sảnh. `[SET] hacmanh_in=false, Lộ +1`
  - ★ mặc định: A.
- `[GOTO]` 7.2

### Cảnh 7.2. Sự thật của Hắc Mãnh

- `[NOI]` Sảnh (hoặc ngoài cổng nếu `hacmanh_in=false`). Hắc Mãnh `sit` ở cuối bàn dài, rót một chén nước như ở nhà mình.
- `[SAY]` Hắc Mãnh (bình thường): "Tôi sẽ nói ngắn. Hai tấm ấn giả ở đêm hội mùa gặt không phải do ai đúc. Chúng là ấn thật, lấy cắp từ hai người chủ ấn khi họ ngủ gật trên thuyền, trên doanh trại. Người đã lấy là đứa trẻ mà ngài nuôi dưới mái đại sảnh này."
- `[NOI phụ – theo seed spy]` **Nếu `spy=phong`:** Hắc Mãnh nhìn Tiểu Phong (cậu đứng ở cuối sảnh, mặt tái đi). **Nếu `spy=may`:** Hắc Mãnh nhìn Mây (nếu còn sống; nếu đã chết thì Hắc Mãnh nói "Mây đã chặn con dao vì ngài, nhưng cô ấy đã giúp tôi trước đó. Tôi không cần nói thêm").
- `[SAY]` Hắc Mãnh (rất nhanh): "Không phải lỗi đứa trẻ. Tôi đã gặp nó từ nhỏ, tôi nói với nó rằng nó đang bảo vệ chủ khỏi hai kẻ nguy hiểm hơn. Nó tin tôi vì nó muốn tin ai đó. Tôi chỉ gieo một hạt giống. Tất cả phần còn lại là hai người của anh chị tự mọc ra."
- `[CHOICE]` Chủ Làng:
  - A. "Ông muốn gì?" → Hắc Mãnh (không chút xấu hổ): "Tôi muốn một làng yếu. Làng mạnh thì tốn kém, phải vây, phải đánh. Làng yếu thì chỉ cần mua. Tôi đến để đề nghị mua cái phần mà bên thua để lại. Hai mỏ, một bến. Giá rất công bằng." `[SET] Lộ +1`
  - B. "Ông đã dùng một đứa trẻ để đâm sau lưng chúng tôi." → Hắc Mãnh: "Tôi dùng một người biết mình đang làm gì. Đừng làm đứa trẻ thành nạn nhân để đỡ thấy mình đúng." `[SET] Uy +1`
  - C. (im lặng, nhìn Bà Mực/chỗ Bà Mực) → `[GOTO]` 7.3
  - ★ mặc định: A.
- `[GOTO]` 7.3

### Cảnh 7.3. Lời thú nhận của Bà Mực

**Nếu Bà Mực còn sống (lối A, B, C):**

- `[NOI]` Sảnh. Bà Mực `sit` ở cuối phòng, nãy giờ im lặng.
- `[SAY]` Bà Mực (rất nhỏ): "Anh ấy nói đúng một nửa. Nửa còn lại là do ta."
- `[ANIM]` Chủ Làng quay sang. Bà Mực thở dài như người đặt xuống một gánh nặng.
- `[SAY]` Bà Mực: "Ta biết có kẻ đang đứng sau họ. Ta không biết là Hắc Mãnh, nhưng ta biết có ai đó. Và ta biết một điều nữa: nếu hai người kia cứ dệt nhau lâu hơn, cả hai sẽ nuốt chửng làng mà anh chị không hề hay. Nên ta dựng cái bẫy cho họ sập sớm, khi anh chị còn đủ sức chọn. Ta viết cái điều khoản không có người đứng giữa. Ta dối anh chị một điều lớn: ta nói đó là luật của Tam Ấn. Thật ra đó là luật của ta."
- `[CHOICE]` Chủ Làng:
  - A. "Bà đã nhìn tôi bị ép vào thế. Ở đúng đêm đó." → Bà Mực: "Đúng. Ta không xin tha. Ta chỉ nói: nếu làm lại, ta vẫn làm, và ta không tự tha thứ được điều đó." `[SET] muc_fate=confessed, Lộ +1, Nhân -0`
  - B. "Tôi tha cho bà." → Bà Mực (rất khẽ): "Đừng tha. Hay là để lại cho ta nhớ." `[SET] muc_fate=forgiven, Nhân +1`
  - C. "Bà phải rời khỏi làng." → Bà Mực (gật): "Ta sẽ đi. Và sổ này ta sẽ để lại." `[SET] muc_fate=exiled, Luật +1, Nhân -1`
  - ★ mặc định: A.

**Nếu Bà Mực đã chết (lối D):**

- `[NOI]` Sảnh. Một ống thư chét dưới chiếc hũ mực đổ được Tiểu Phong mang vào.
- `[SAY]` Tiểu Phong: "Em tìm thấy cái này dưới hũ mực. Em không dám mở trước."
- `[ANIM]` Chủ Làng `open_letter`. Thư hiện chữ bà viết, giọng đọc âm Bà Mực.
- `[SAY]` Bà Mực (giọng đọc): "Ta dựng cái bẫy, anh chị ạ. Ta dối anh chị và dối hai người. Ta tin nếu ta không ra tay sớm, cả hai sẽ nuốt chửng làng. Ta xin lỗi, dù không mong anh chị tha. Anh chị sẽ làm được những điều ta không làm được."
- `[SET]` `muc_fate=letter`, `Lộ +1`, `Nhân +1`. Hắc Mãnh tự dùng giấy đó để nhận lại lời cuối.

### Cảnh 7.4. Quyết định xử Hắc Mãnh

- `[CAM]` Hắc Mãnh nhấp nước, đặt chén xuống rất nhẹ.
- `[SAY]` Hắc Mãnh: "Vậy là cả hai ta đều có phần. Bây giờ anh chị có thể đánh tôi, hoặc trả giá. Nhưng nhớ: làng đã cạn sức rồi. Bên nào anh chị cũng đã bỏ."
- `[CHOICE LỚN] [MAP]` Xử Hắc Mãnh và kẻ cài:
  - A. **Bắt Hắc Mãnh.** Lính được lệnh vây sảnh. Hắc Mãnh `stand` chậm, hai tay giơ lên. Hắn: "Tôi biết trước." `[SET] hacmanh_fate=caught, Uy +2, Luật +1`
  - B. **Thả.** Câu người chơi: "Ông đi. Đừng quay lại." Hắc Mãnh: "Tôi sẽ quay lại, nhưng không phải sớm." `[SET] hacmanh_fate=freed, Nhân +1, Lộ -1, mở sự kiện trả đũa ở Ngọn sau`
  - C. **Bán đất cho ông ta.** Câu người chơi: "Hai mỏ, một bến. Tôi sẽ bán." Hắc Mãnh mỉm cười. `[SET] hacmanh_fate=land_sold, tài nguyên +100 vàng, mất hai vùng đất, Uy -2, Lộ -2`
  - ★ mặc định: A.
- `[CHOICE]` Xử kẻ cài (Tiểu Phong hoặc Mây theo `spy`):
  - A. "Anh/cô ở lại. Tôi cần biết bạn đã bị ép thế nào." → Kẻ cài khóc, ngồi xuống. `[SET] spy_fate=stay, Nhân +2, Tín -1`
  - B. "Rời khỏi làng." → Kẻ cài cúi đầu, `walk_slow` ra cổng. `[SET] spy_fate=exile, Luật +1, Nhân -1`
  - C. "Giam lại." → Lính dẫn đi. `[SET] spy_fate=jail, Uy +1, Nhân -2`
  - ★ mặc định: A.
- `[SET]` `crack` được chốt cuối cùng cho chương 8. Mở nút VII-3 và V-2.
- `[GOTO]` Chương 8.

## Chương 8. Chiếc ấn cuối

**Khi nào:** Nhà chung lên cấp 10. **Thời lượng:** khoảng 4 phút cho mỗi kết cục.

### Cảnh 8.0. Sảnh trước bình minh (chung cho mọi kết cục)

- `[NOI]` Đại điện cấp 10: cổng thành ba lớp, sảnh có cột đá, phòng ấn có đủ ba khóa. Bình minh sắp lên, ánh sáng xanh nhạt.
- `[CAM]` Quay chậm từ trên cao xuống sảnh, dừng ở bàn dài. Ấn Chung đặt giữa bàn.
- `[ANIM]` Chủ Làng `walk` vào sảnh một mình, dừng trước Ấn Chung. Một bản ước cuối cùng trải trên bàn.
- `[SAY]` Chủ Làng (khung thoại, không lựa chọn): "Làng ngày xưa còn xin lửa nhà hàng xóm. Giờ có người từ xa đến xin ngồi dưới mái nhà này."
- `[SET]` Game tính Ngọn cuối theo bảng điều kiện dưới, chọn **một** kết cục, rồi `[GOTO]` cảnh tương ứng.

| Kết cục | Ngọn | Điều kiện (ưu tiên từ trên xuống) |
| --- | --- | --- |
| Một Ấn | M1 | `crack` ≤ 1, `betrayed=none`, Lam và Khải còn, Mây còn sống |
| Ấn Chữ | M8 | Luật + Của cao, Bà Mực được nhớ tên (`muc_fate` là confessed, forgiven hoặc letter) |
| Ấn Sắt | M3 | `betrayed=lam`, Tín Khải ≥ 0 |
| Ấn Chợ | M4 | `betrayed=khai`, Tín Lam ≥ 0 |
| Kẻ Bị Phản | M6 | `betrayed=both` |
| Ba Ấn | M2 | `crack` 2 đến 3, cả hai thế lực còn, `betrayed=none` |
| Ấn Nứt | M5 | `crack` ≥ 4 và cả hai vẫn còn |
| Tàn Quốc | M7 | mặc định khi không điều kiện nào ở trên được đáp ứng |

### Cảnh 8.1. Một Ấn (M1)

- `[NOI]` Sảnh, ánh sáng bình minh tràn vào. Lam và Khải ngồi hai đầu bàn. Lam đến đúng giờ, mặc bộ áo xanh. Khải đến sớm hơn một canh.
- `[SAY]` Chủ Làng (lựa chọn duy nhất, không đồng hồ): "Tôi có một đề nghị. Không phải bản ước mới. Tôi muốn hai vị đóng cùng một chiếc ấn, Ấn Chung, chứ không phải của riêng ai."
- `[SAY]` Lam (nhẹ): "Thế thì tôi mất gì?" (chậm 3 nhịp) "À. Tôi mất cái thói quen đếm."
- `[SAY]` Khải (gần như cười): "Cô sẽ đếm lại. Ở đây."
- `[ANIM]` Ba bàn tay cùng đặt lên Ấn Chung. Mây đứng sau Chủ Làng, lần đầu gạt tay khỏi chuôi kiếm.
- `[FX]` Tiếng dấu đóng lần này trong, không đục. Chim bay ra khỏi xà nhà.
- `[SET]` Mở Ngọn M1: Thư Viện Di Sản + cấm quân tuần phòng.

### Cảnh 8.2. Ấn Chữ (M8)

- `[NOI]` Phòng ấn cũ, giờ là học viện. Trên bức tường là bản khắc tên Bà Mực, không phải tên Chủ Làng.
- `[ANIM]` Trẻ con ngồi hai hàng, `write` trên bảng. Tiểu Phong (nếu ở lại) `point` lên bảng, dạy chữ.
- `[SAY]` Tiểu Phong (nếu ở lại, với lớp học): "Bà ấy dạy chúng con rằng chữ đẹp mấy cũng không đỡ được một nhát dao. Rồi bà ấy viết thêm một dòng: nhưng chữ giữ được tên người đã mất."
- `[FX]` Chuông nhỏ ngân, tiếng trẻ cười xa.
- `[SET]` Mở Ngọn M8: Kỹ sư chiến trường, y sĩ.

### Cảnh 8.3. Ấn Sắt (M3)

- `[NOI]` Doanh trại lớn, sạch sẽ, kỷ luật. Chợ sông vắng, muối đắt.
- `[ANIM]` Khải `walk` đến Chủ Làng, giao một thanh kiếm mới rèn (`handoff_sword`).
- `[SAY]` Khải: "Ta để một điều kiện. Đừng bao giờ để ta phải chĩa thanh này vào người trong làng."
- `[SAY]` Chủ Làng (lựa chọn duy nhất): "Tôi hứa."
- `[SAY]` Khải: "Đừng hứa. Ta không tin lời hứa, ta chỉ tin người nào làm được. Làm đi."
- `[SET]` Mở Ngọn M3: Sát thủ.

### Cảnh 8.4. Ấn Chợ (M4)

- `[NOI]` Bến đông đúc, nhà kho nối nhau từ bờ sông đến tận cổng thành.
- `[ANIM]` Lam `walk` đến, cầm cuốn sổ, dừng trước Chủ Làng.
- `[SAY]` Lam: "Tôi sẽ có cận vệ cho anh chị. Thông minh hơn lính nhiều. Tốn kém hơn nữa."
- `[SAY]` Chủ Làng (lựa chọn duy nhất): "Chị tính giá sự an toàn của tôi à?"
- `[SAY]` Lam: "Tôi tính giá mọi thứ. Đó là cách tôi nghe được mình đang quan tâm."
- `[SET]` Mở Ngọn M4: Cận vệ thuê.

### Cảnh 8.5. Kẻ Bị Phản (M6)

- `[NOI]` Sảnh, đêm khuya. Làng cô đơn, không gạo từ bến, không sắt từ mỏ.
- `[MOVE]` Lam `walk` tới cửa sảnh một mình, không mang gì. Dừng ở ngưỡng cửa.
- `[SAY]` Lam (mặt không còn cười): "Tôi không đến để tha. Tôi đến để nói rằng anh chị đã làm đúng một việc: anh chị không chọn bên nào. Tôi ghen tị với điều đó hơn là tôi ghét."
- `[ANIM]` Lam `bow` rất nhẹ rồi quay đi. Đèn sảnh tắt từng cái.
- `[SET]` Mở Ngọn M6: Du kích.

### Cảnh 8.6. Ba Ấn (M2)

- `[NOI]` Bàn họp ba phía. Lam, Khải và Chủ Làng, mỗi người giữ một ấn.
- `[SAY]` Khải (cứng): "Đây không phải hòa bình."
- `[SAY]` Lam (gật đầu): "Đúng. Đây là một hợp đồng. Hợp đồng thì bền hơn hòa bình."
- `[ANIM]` Ba ấn đặt thẳng hàng trên bàn. Không ai chạm vào ấn của người kia.
- `[SET]` Mở Ngọn M2: Cung thủ ngựa.

### Cảnh 8.7. Ấn Nứt (M5)

- `[NOI]` Sảnh, chiều. Hai ấn đều còn, chỉ là Ấn Chung bị rạn một đường ở giữa.
- `[ANIM]` Một hiệp sĩ của Khải `walk` tới, giáp bụi đường, `kneel` trước Chủ Làng.
- `[SAY]` Hiệp sĩ: "Tôi không muốn phải bỏ ai. Nhưng cái điều ngài dạy về danh dự, ngài không làm được. Ngài sống được, nhưng danh dự thì chết rồi."
- `[ANIM]` Hiệp sĩ `stand`, `salute`, `walk` ra cổng. Không ai ngăn.
- `[SET]` Mở Ngọn M5: Hiệp sĩ đào ngũ.

### Cảnh 8.8. Tàn Quốc (M7)

- `[NOI]` Sảnh vắng, ấn Chung còn trên bàn. Không ai ngồi quanh.
- `[CAM]` Quay chậm quanh bàn, những chiếc ghế trống.
- `[SAY]` Chủ Làng (không lựa chọn): "Tôi giữ được làng. Còn thì không còn gì để giữ."
- `[FX]` Chuông ngoài cổng ngân một hồi. Không ai trả lời. Màn hình đen.
- `[SET]` Không mở gì, Ngọn M7 mặc định.

## Bảng clip animation cần dùng

Mọi thẻ `[ANIM]` trong kịch bản đều lấy tên từ bảng này. Cột "Có sẵn?" để Claude Code đối chiếu với `src/data/anims.json` và rig hiện tại; clip nào thiếu thì vẽ mới theo `ART_BRIEF.md`.

| Clip | Ai dùng | Ghi chú | Có sẵn? |
| --- | --- | --- | --- |
| `idle`, `walk`, `walk_slow`, `run` | mọi người | dùng clip sẵn | có |
| `bow` | Lam, Tiểu Phong, kỵ sĩ | cúi người, nhẹ hoặc sâu | cần kiểm tra |
| `sit`, `stand` | mọi người | ngồi bàn dài | cần kiểm tra |
| `flip_book`, `write`, `stamp` | Bà Mực, Lam, Khải, Chủ Làng | tay cầm sổ, bút, ấn | cần vẽ mới |
| `talk_gesture`, `point`, `shrug`, `laugh`, `arms_cross`, `lean_in`, `lean_back` | mọi người | cử chỉ khi nói | cần vẽ mới |
| `slam_table`, `knock_table` | Khải, Bà Mực | đập, gõ bàn | cần vẽ mới |
| `salute`, `hand_up_stop`, `clap_shoulder` | Khải, Đồng | quân lễ, ra hiệu | cần vẽ mới |
| `look_around`, `look_down`, `look_up`, `look_away` | mọi người | đổi hướng mắt, đầu | cần vẽ mới |
| `guard_stand`, `step_forward`, `block_pose` | Mây, lính Khải | tư thế cận vệ | có (theo lính) |
| `draw`, `sheath` | Khải, Đồng, Mây | rút, ra vỏ kiếm | có (ART\_BRIEF 2b) |
| `kneel`, `sit_up` | Mây, hiệp sĩ | quỳ, ngồi dậy khi bị thương | cần vẽ mới |
| `carry`, `unload`, `chisel`, `inspect`, `dismount`, `open_letter`, `handoff_sword` | NPC, Chủ Làng | hành động vật thể | cần vẽ mới |
| `assassin_dash`, `assassin_stab`, `assassin_dodge`, `assassin_vanish` | sát thủ | theo `gen-assassin-anims.py` | có (đã viết) |

## Bảng cờ và biến

| Tên | Kiểu | Giá trị | Đặt ở |
| --- | --- | --- | --- |
| `lam_grain`, `khai_guard` | bool | true, false | 1.4 |
| `oath`, `seal_word` | bool, enum | chung, cho, quan, trong | 2.3, 2.4 |
| `spy` | enum | may, phong (theo seed, ẩn) | 2.1 |
| `crack` | int | 0 đến 6 | 2.3, 3.3, 3.4, 4.3, 5.4, 6.x |
| `land_split` | enum | lam, khai, half, village | 3.3 |
| `secret_lam`, `secret_khai` | enum | kept, public\_pending, used; kept, asked, judged | 3.4 |
| `trust_target` | enum | lam, khai, none | 4.3 |
| `may_dead` | bool | chỉ Khắc nghiệt | 4.4, 4.5 |
| `ruling_mine` | enum | split, khai, lam, village | 5.4 |
| `crack_heavy` | bool | `crack` ≥ 3 sau 3.4 | 3.4 |
| `betrayed` | enum | lam, khai, both, none | 6.3 |
| `muc_dead` | bool | lối D | 6.D |
| `hacmanh_in`, `hacmanh_fate` | bool, enum | caught, freed, land\_sold | 7.1, 7.4 |
| `spy_fate`, `muc_fate` | enum | stay, exile, jail; confessed, forgiven, exiled, letter | 7.3, 7.4 |
