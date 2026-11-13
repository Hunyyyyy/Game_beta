# Giao diện Nhà nghiên cứu: spec cho bản sửa

File tham chiếu: `research-ui.html` (mở bằng trình duyệt, tương tác được). Mọi giá trị CSS, cấu trúc DOM và logic trạng thái nằm trong file đó. Đọc nó trước, tài liệu này chỉ giải thích ý đồ.

## Vấn đề của bản hiện tại

1. Chiều dọc quá tốn: mỗi chỉ số là một khối đen cao 36px, mỗi hàng cao hơn 200px. Năm nhánh không vừa chiều ngang, ba hàng không vừa chiều dọc, nên phải cuộn cả hai hướng.
2. Màn hình chọn ba trụ gần như trống, chỉ có ba ô lớn.
3. Mọi thứ cùng một màu đen, không phân biệt được khóa, sẵn sàng, đã mở.
4. Chữ điều kiện (cần Thuần heo rừng) nhỏ, màu vàng trên nền tối, khó đọc.
5. Không thấy chi phí trước khi bấm.

## Cấu trúc mới

Cửa sổ chia dọc: header, thanh việc đang làm, tab ba trụ, thân, thanh chi tiết.

- Bỏ màn hình chọn trụ. Ba trụ là tab, có icon, có số bước nhảy đang sẵn sàng. Ở góc phải tab là nút Cổng thời đại (ba hình thoi, mỗi hình là một đỉnh trụ).
- Thân chia hai cột: danh sách nhánh bên trái (176px), đường đi của nhánh đang chọn bên phải.
- Mỗi nhánh có ba thẻ hàng đặt ngang, nối bằng mũi tên. Thẻ hàng gồm tiêu đề (`HÀNG 1`, số cấp đã có), ba nút chỉ số, một nút bước nhảy.
- Cuối danh sách nhánh có ô Đỉnh trụ.
- Thanh chi tiết dưới cùng: tên, mô tả, điều kiện còn thiếu, chi phí, thời gian và nút Nghiên cứu. Chạm một nút chỉ chọn nó, bấm Nghiên cứu mới trừ tài nguyên.

## Màu và trạng thái

Màu nền theo khung hiện có: giấy da `#e3d5a6`, viền nâu `#8a6b39` và `#4e3a20`, chữ `#3a2a14`, nền tối cho nút đã mở `#2a211a` với chữ vàng `#e0b04a`. Màu nhấn theo trụ, chỉ dùng cho chữ, viền, hình thoi và nút sẵn sàng:

| Trụ | Màu |
|---|---|
| Binh lực | `#a53c25` |
| Sinh kế | `#47661f` |
| Kỹ nghệ | `#28607f` |

| Trạng thái của bước nhảy | Cách vẽ |
|---|---|
| Khóa | viền đứt, nền giấy da tối, chữ nâu nhạt, biểu tượng khóa |
| Sẵn sàng | nền màu trụ, chữ kem, bóng dưới 3px, vòng sáng nhấp nháy chậm |
| Đã mở | nền tối, chữ kem, nhãn và dấu ✓ màu vàng |

Nút chỉ số: nền giấy da, viền nhạt. Có cấp thì viền và nền ngả màu trụ (dùng `color-mix`). Đủ cấp thì nền đậm hơn. Mỗi cấp là một hình thoi `9×9px` xoay 45°, đầy là đã đạt.

Nhãn khóa chéo là viên thuốc nhỏ màu của trụ kia (`cần Thuần heo rừng`), thêm dấu ✓ và nền đặc khi đã đạt.

## Hai cỡ cửa sổ

- Máy tính (746×541): cách bố trí đầy đủ như trên.
- Điện thoại ngang (cao khoảng 360px): header 32px, thanh việc 22px, tab thấp hơn, danh sách nhánh chỉ còn tên và số bước nhảy trên một dòng (hình thoi ẩn, "sẵn sàng" thành chấm màu), ẩn tiêu đề nhánh, ẩn dòng chi phí và mô tả trong thanh chi tiết, nhãn khóa chéo nằm một dòng cắt bằng dấu ba chấm. Trong game, áp bằng `@media (max-height: 480px)`; file mẫu dùng thuộc tính `data-size="phone"` để mô phỏng.
- Cửa sổ hẹp (dưới 620px rộng): dùng container query. Danh sách nhánh thành dải ngang phía trên, ba thẻ hàng cuộn ngang có `scroll-snap`.

Chiều cao ở cỡ điện thoại vẫn có thể cuộn nhẹ trong vùng `.lane`. Đó là chủ ý: vùng thân là phần duy nhất được cuộn.

## Dữ liệu và quy tắc cần nối vào game

- Tên ngắn của chỉ số (hiện trên nút) dùng trường `short` trong `researchtree.json`. Tên đầy đủ hiện ở thanh chi tiết. Nút kỹ thuật một cấp cũng cần một tên ngắn (khoảng 12 ký tự), xem bảng `TS` trong file mẫu.
- Chi phí và thời gian của chỉ số lấy từ `stats[...].cost` và `time`. Chi phí bước nhảy lấy từ `rankTiers` (hàng 1 và 2) và `finalTier` (hàng 3). File mẫu dùng chung ba mức này cho cả ba trụ, cần chỉnh lại riêng cho Sinh kế và Kỹ nghệ.
- Điều kiện bước nhảy: tổng cấp chỉ số trong hàng đạt `ceil(tổng cấp tối đa * 2/3)`, hàng trước đã xong, cấp Nhà nghiên cứu đủ, và các khóa chéo đã đạt (`cross: ["craft.build.1"]`, định dạng `trụ.nhánh.hàng`).
- Đỉnh trụ cần bước nhảy hàng 3 của `ceil(số nhánh * 0.6)` nhánh. Cổng thời đại cần đỉnh của cả ba trụ.
- Mỗi lần chỉ nghiên cứu một thứ. Khi đang bận, nút Nghiên cứu đổi thành "Đang bận".

## Việc cần làm

1. Dựng lại component theo cấu trúc trên, dùng đúng token màu và kích thước từ file mẫu.
2. Thay màn hình chọn trụ bằng thanh tab.
3. Thêm thanh chi tiết và bước xác nhận Nghiên cứu.
4. Thêm hai điểm ngắt: `max-height: 480px` và container query 620px.
5. Giữ nguyên logic nghiên cứu, hàng đợi và `statBonus` đang có. Chỉ đổi lớp hiển thị.
