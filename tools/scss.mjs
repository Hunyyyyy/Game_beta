// Biên dịch một tệp SCSS thành chuỗi CSS để nhúng vào trang HTML (game và hai trang xem thử đều là một tệp chạy độc lập).
import * as sass from 'sass';

export function scss(file) {
  // charset:false: CSS nằm trong thẻ <style>, không cần dòng @charset
  return sass.compile(file, { style: 'expanded', charset: false }).css;
}
