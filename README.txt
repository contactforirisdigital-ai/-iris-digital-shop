IRIS Digital Shop — bản sửa luồng đăng nhập quản trị

Nội dung:
- index.html: gọi POST /api/admin/login thay vì mở thẳng trang quản trị khi chỉ nhập nội dung bất kỳ.
- Nếu API trả lỗi hoặc mật khẩu sai, trang không chuyển vào khu vực quản trị.
- Gửi cookie cùng nguồn và không lưu mật khẩu trong trình duyệt.

Cách dùng:
1. Giải nén ZIP.
2. Dùng index.html thay thế file index.html trong GitHub repository.
3. Commit changes trên nhánh main.
4. Chờ Cloudflare Pages deploy thành công rồi kiểm tra đăng nhập.

Lưu ý bảo mật:
Bản sửa này chỉ khắc phục luồng đăng nhập ở giao diện. Để bảo vệ hoàn chỉnh, mọi thao tác quản trị và API dữ liệu phải kiểm tra session ở phía máy chủ; chỉ sửa giao diện không đủ để bảo vệ dữ liệu.
