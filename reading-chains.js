'use strict';
const READING_CHAINS = [
  {
    id: 'hat-gao',
    title: 'Hạt gạo đi từ ruộng ra thị trường',
    description: 'Theo bốn bước thay đổi trong quản lý sản xuất và lưu thông.',
    steps: [
      {id:'vn-khoan-100-1981', note:'Khoán sản phẩm được mở rộng tới nhóm lao động và người lao động trong hợp tác xã.', ref:'https://xaydungchinhsach.chinhphu.vn/chinh-phu-duoi-su-lanh-dao-cua-dang-80-nam-hanh-trinh-vi-nuoc-vi-dan-119250828100946942.htm'},
      {id:'vn-doi-moi-1986', note:'Những thử nghiệm trước đó được đặt trong quá trình đổi mới quản lý kinh tế rộng hơn.', ref:'https://www.fao.org/4/ag089e/AG089E08.htm'},
      {id:'vn-khoan-10-1988', note:'Quyền tự chủ của hộ nông dân được mở rộng, tạo thêm động lực sản xuất.', ref:'https://www.fao.org/4/ag089e/AG089E08.htm'},
      {id:'vn-xuat-khau-gao-1989', note:'Cải cách sản xuất đi cùng thay đổi giá cả và lưu thông, góp phần mở rộng khả năng xuất khẩu.', ref:'https://www.fao.org/4/ag089e/AG089E08.htm'}
    ]
  },
  {
    id: 'van-mieu',
    title: 'Từ Văn Miếu đến những tên người trên bia đá',
    description: 'Ba mốc để phân biệt nơi thờ tự, nơi đào tạo và việc ghi danh người đỗ.',
    steps: [
      {id:'vn-van-mieu-1070', note:'Triều Lý dựng Văn Miếu, gắn với thờ tự và việc học của hoàng thái tử.', ref:'https://dsvh.gov.vn/di-tich-lich-su-va-kien-truc-nghe-thuat-van-mieu-quoc-tu-giam-2953'},
      {id:'vn-quoc-tu-giam-1076', note:'Sáu năm sau, Quốc Tử Giám được lập. Đây là một thiết chế có chức năng đào tạo.', ref:'https://dsvh.gov.vn/di-tich-lich-su-va-kien-truc-nghe-thuat-van-mieu-quoc-tu-giam-2953'},
      {id:'vn-bia-tien-si-1484', note:'Nhiều thế kỷ sau, bia tiến sĩ được dựng để ghi danh. Niên đại khoa thi và năm dựng bia có thể khác nhau.', ref:'https://www.unesco.org/en/memory-world/stone-stele-records-royal-examinations-le-and-mac-dynasties-1442-1779'}
    ]
  },
  {
    id: 'doc-lap-my',
    title: 'Từ một sắc thuế đến nền độc lập được công nhận',
    description: 'Năm bước qua phản đối thuế, trừng phạt, tuyên bố và hòa ước.',
    steps: [
      {id:'am-stamp-act-1765', note:'Thuế trên giấy tờ và ấn phẩm làm nổi lên tranh chấp về quyền đánh thuế thuộc địa.', ref:'https://www.parliament.uk/about/living-heritage/evolutionofparliament/legislativescrutiny/parliament-and-empire/parliament-and-the-american-colonies-before-1765/the-stamp-act-and-the-american-colonies-1763-67/'},
      {id:'am-tiec-tra-boston-1773', note:'Tranh chấp với chính quyền Anh tiếp tục trong cuộc phản đối chính sách về trà.', ref:'https://www.nationalarchives.gov.uk/education/teaching-resources/boston-tea-party/'},
      {id:'am-coercive-acts-1774', note:'Quốc hội Anh đáp trả vụ phá trà bằng các biện pháp trừng phạt Massachusetts.', ref:'https://www.loc.gov/collections/continental-congress-and-constitutional-convention-from-1774-to-1789/articles-and-essays/timeline/1773-to-1774/'},
      {id:'am-tuyen-ngon-doc-lap-1776', note:'Giữa chiến tranh, các thuộc địa tuyên bố tách khỏi Anh. Sự công nhận từ phía Anh còn ở phía trước.', ref:'https://www.archives.gov/milestone-documents/declaration-of-independence'},
      {id:'am-treaty-paris-1783', note:'Sau chiến tranh, Anh công nhận nền độc lập của Hoa Kỳ trong hòa ước.', ref:'https://www.archives.gov/milestone-documents/treaty-of-paris'}
    ]
  },
  {
    id: 'ghi-lai-hinh-anh',
    title: 'Giữ một hình ảnh, rồi làm hình ảnh chuyển động',
    description: 'Ba mốc trong những quá trình phát triển của nhiếp ảnh và điện ảnh.',
    steps: [
      {id:'culture-niepce-1827', note:'Niépce tìm cách giữ lại hình quang học trên vật liệu. Niên đại của hiện vật được đọc như một khoảng.', ref:'https://www.hrc.utexas.edu/niepce-heliograph/'},
      {id:'culture-daguerre-1839', note:'Daguerre tiếp nối công việc với Niépce; quy trình mang tên ông được công bố công khai năm 1839.', ref:'https://gallica.bnf.fr/selections/fr/html/photographies-acces-par-procede'},
      {id:'eu-lumiere-1895', note:'Về sau, những kỹ thuật ghi và chiếu hình chuyển động tạo trải nghiệm xem phim chung. Điện ảnh được phát triển qua nhiều nhà phát minh.', ref:'https://www.bfi.org.uk/sight-and-sound/features/origins-cinema-early-inventors-pioneers'}
    ]
  },
  {
    id: 'len-mat-trang',
    title: 'Từ Sputnik đến những bước chân trên Mặt Trăng',
    description: 'Bốn mốc về cạnh tranh không gian, tổ chức nghiên cứu và chương trình Apollo.',
    steps: [
      {id:'eu-sputnik-1957', note:'Liên Xô phóng Sputnik, làm chính sách không gian trở thành vấn đề cấp bách ở Mỹ.', ref:'https://www.nasa.gov/history/65-years-ago-sputnik-ushers-in-the-space-age/'},
      {id:'am-nasa-1958', note:'Mỹ thành lập NASA để tổ chức hoạt động hàng không và không gian dân sự.', ref:'https://www.nasa.gov/history/sputnik/sputorig.html'},
      {id:'am-apollo-8-earthrise-1968', note:'Trong chương trình Apollo, con người bay quanh Mặt Trăng trước khi thực hiện nhiệm vụ đổ bộ.', ref:'https://www.nasa.gov/learning-resources/for-kids-and-students/what-was-the-apollo-program-grades-5-8/'},
      {id:'am-apollo-11-1969', note:'Các chuyến thử nghiệm tiếp tục qua Apollo 9 và 10; Apollo 11 thực hiện hạ cánh và đưa phi hành đoàn trở về.', ref:'https://www.nasa.gov/learning-resources/for-kids-and-students/what-was-the-apollo-program-grades-5-8/'}
    ]
  },
  {
    id: 'internet-va-web',
    title: 'Từ nối máy tính đến nối những trang thông tin',
    description: 'Ba mốc để thấy Internet và Web được xây dựng ở những lớp khác nhau.',
    steps: [
      {id:'am-arpanet-1969', note:'Hai máy ở UCLA và SRI thử kết nối qua ARPANET, một tiền thân quan trọng của Internet.', ref:'https://www.lk.cs.ucla.edu/internet_first_words.html'},
      {id:'eu-www-1989', note:'Trên hạ tầng Internet đã có, Berners-Lee đề xuất liên kết tài liệu bằng hệ thống siêu văn bản.', ref:'https://home.cern/science/computing/the-birth-of-the-web'},
      {id:'eu-web-public-domain-1993', note:'CERN đưa phần mềm Web vào phạm vi công cộng, giúp các nhóm khác có thể sử dụng và phát triển.', ref:'https://home.cern/science/computing/the-birth-of-the-web'}
    ]
  },
  {
    id: 'chu-roi-va-y-tuong',
    title: 'Chữ rời và những ý tưởng đi xa',
    description: 'Đặt kỹ thuật in ở Triều Tiên cạnh bước phát triển tại châu Âu và việc phổ biến luận đề Luther.',
    steps: [
      {id:'ea-jikji-1377', note:'Triều Tiên có bản Jikji in bằng chữ rời kim loại năm 1377. Đây là một truyền thống in sớm cần được nhìn nhận riêng.', ref:'https://www.bnf.fr/en/jikji-treasure-world-printing'},
      {id:'eu-gutenberg-1455', note:'Gần tám thập kỷ sau, xưởng Gutenberg hoàn thành bản Kinh Thánh nổi tiếng tại Mainz. Mốc sau không chứng minh sự truyền kỹ thuật trực tiếp từ Jikji.', ref:'https://www.loc.gov/exhibits/bibles/the-gutenberg-bible.html'},
      {id:'eu-luther-1517', note:'Trong bối cảnh nghề in châu Âu lan rộng, các bản in giúp cuộc tranh luận của Luther vượt khỏi phạm vi đại học.', ref:'https://www.loc.gov/resource/gdcwdl.wdl_07497/'}
    ]
  }
];
