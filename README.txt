# IRIS Digital Studio — bản cập nhật lưu sản phẩm bằng Cloudflare D1

## Có gì trong ZIP
- `index.html`: frontend IRIS đã nối danh sách và thao tác quản trị vào Worker API. Không còn dùng `localStorage` làm nguồn dữ liệu sản phẩm.
- `worker.js`: Cloudflare Worker API đọc/ghi sản phẩm vào D1, hỗ trợ thêm/sửa/xóa và kiểm tra Admin Token.
- `README.txt`: hướng dẫn triển khai.

## BẮT BUỘC trước khi dùng
Worker code sử dụng bảng riêng `iris_products` để không đụng vào bảng `products` hiện tại. Khi khách truy cập `/api/products` lần đầu, nếu bảng mới chưa có dữ liệu, Worker tự tạo 8 sản phẩm khởi đầu và lưu chúng vào D1. Việc này chỉ seed khi `iris_products` đang rỗng.

## 1. Cập nhật Worker
1. Cloudflare Dashboard → Workers & Pages → mở Worker `iris-digital-api`.
2. Mở phần Edit code.
3. Thay toàn bộ mã Worker hiện tại bằng nội dung `worker.js` trong ZIP.
4. Bấm Deploy.
5. Vào Worker → Settings → Bindings, xác nhận có binding:
   - Type: D1 database
   - Variable name: `DB`
   - Database: `iris-digital-db`
6. Vào Worker → Settings → Variables and Secrets, tạo/kiểm tra **Secret** có tên `ADMIN_TOKEN`. Giá trị là một token bí mật do bạn tự đặt. Không đặt token này trong HTML và không gửi token cho khách hàng. Nếu secret hiện chỉ có ở Pages project thì vẫn phải thêm riêng vào Worker.

## 2. Kiểm tra API
Mở:
- https://iris-digital-api.contactfor-irisdigital.workers.dev/health
- https://iris-digital-api.contactfor-irisdigital.workers.dev/api/products

API products lần đầu có thể mất vài giây vì Worker tạo bảng và thêm 8 sản phẩm khởi đầu. Kết quả mong đợi là JSON có `success: true` và danh sách sản phẩm.

## 3. Cập nhật website
1. Mở GitHub repository đang kết nối với Cloudflare Pages.
2. Thay file `index.html` hiện tại bằng `index.html` trong ZIP.
3. Commit changes và chờ Cloudflare Pages deploy xong.
4. Mở https://iris-digital-shop.pages.dev/ rồi tải lại trang.

## 4. Đăng nhập quản trị
1. Trên website mở “Khu vực quản trị”.
2. Nhập email quản trị bất kỳ bạn sử dụng để nhận diện và nhập đúng giá trị Secret `ADMIN_TOKEN` vào trường Admin Token.
3. Các thao tác thêm/sửa/xóa sẽ gọi Worker và lưu vào D1. Khách hàng ở trình duyệt khác sẽ đọc danh sách công khai từ cùng D1.

## Lưu ý
- Ảnh xem trước được lưu dạng data URL trong D1 và giới hạn 1,5 MB theo giao diện. Với cửa hàng lớn, nên chuyển ảnh sang Cloudflare R2.
- `ADMIN_TOKEN` là cơ chế xác thực đơn giản dùng cho cửa hàng nhỏ; không dùng chung token với người khác. Ai có token có thể quản lý sản phẩm.
- API chỉ cho phép CORS từ `https://iris-digital-shop.pages.dev`. Nếu dùng domain riêng, cần thêm domain đó vào `Access-Control-Allow-Origin` trong `worker.js`.
- Đơn hàng, cổng thanh toán, đăng nhập khách hàng và biểu mẫu hỗ trợ không được triển khai bởi bản cập nhật này.
