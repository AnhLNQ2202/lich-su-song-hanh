'use strict';
const $ = id => document.getElementById(id);
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const yearText = year => year < 0 ? Math.abs(year) + ' TCN' : String(year);
const personDates = p => p.lifeLabel || ((p.cb||p.cd?'Khoảng ':'')+yearText(p.b)+' – '+(p.d==null?'nay':yearText(p.d)));
const personAge = (p,year) => p.timeBasis==='activity' ? 'Chưa xác định tuổi' : (p.cb?'Khoảng ':'')+(year-p.b-(p.b<0&&year>0?1:0))+' tuổi';
const milestoneYear = p => (p.ck||p.timeBasis==='activity'?'Khoảng năm ':'Năm ')+yearText(p.k);
const fold = text => String(text).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/đ/g,'d');
const labels = {sl:'Lát cắt', ev:'Sự kiện', np:'Nhân vật', pd:'Thời kỳ', gb:'Sự kiện toàn cầu'};
const regions = new Map(LANES.map(region => [region.id, region.name]));
const catalog = new Map();
function register(source, kind, lane) {
  const year = source.y ?? source.b ?? source.s;
  const title = kind === 'sl' ? source.t.replace(/^[^:]+:\s*/, '').replace(/^./u,c=>c.toLocaleUpperCase('vi')) : source.full || source.t || source.n;
  const entry = {source, kind, lane, year, title, id:source.id};
  entry.search = fold([title, yearText(year), source.who, source.role, source.topic, regions.get(lane)].filter(Boolean).join(' '));
  catalog.set(entry.id, entry);
  return entry;
}
const slices = TL_SLICES.map(item => register(item,'sl')).sort((a,b)=>a.year-b.year);
for (const block of TL_DATA) {
  block.events.forEach(item => register(item,'ev',block.lane));
  block.periods.forEach(item => register(item,'pd',block.lane));
}
for (const block of TL_PEOPLE) block.people.forEach(item => register(item,'np',block.lane));
GLOBAL.forEach(item => register(item,'gb'));
const all = [...catalog.values()].sort((a,b)=>a.year-b.year);
const events = all.filter(item => item.kind === 'ev');
const sliceAnchors = new Map();
const highlights = new Map();
for (const slice of slices) {
  const candidates=(slice.source.ev||[]).map(id=>catalog.get(id)).filter(e=>e?.kind==='ev');
  candidates.sort((a,b)=>Math.abs(a.year-slice.year)-Math.abs(b.year-slice.year) || Number(b.lane==='vn')-Number(a.lane==='vn'));
  const anchor=candidates[0];
  if(!anchor)continue;
  sliceAnchors.set(slice.id,anchor);
  if(!highlights.has(anchor.id)) highlights.set(anchor.id,[]);
  highlights.get(anchor.id).push(slice);
}
function highlightHTML(item) {
  return (highlights.get(item.id)||[]).map(slice=>'<details class="event-highlight" id="highlight-'+slice.id+'"><summary><span class="edition">Nhìn rộng ra</span><strong>'+escapeHTML(slice.title)+'</strong><span class="expand-hint">Mở câu chuyện cùng thời +</span></summary><div class="highlight-copy">'+paragraphs(slice.source.d)+'<div class="highlight-events">'+(slice.source.ev||[]).filter(id=>id!==item.id&&catalog.has(id)).map(id=>'<a href="'+href(catalog.get(id))+'">'+escapeHTML(catalog.get(id).title)+' →</a>').join('')+'</div>'+articleSources(slice.source)+'</div></details>').join('');
}

let current, comparisons = [], limit = 50;
const library = $('library');
const href = item => '#' + encodeURIComponent(item.id);
const timeline = all.filter(entry => entry.kind === 'ev' || entry.kind === 'gb');
// The visual timeline uses a reference year, including approximate and disputed dates.
// In a shared year, compare the first month/day specified by the source.
function withinYear(entry) {
  const date = entry.source.date || '';
  const day = date.match(/(?:^|\D)(\d{1,2})(?:\s*[–-]\s*\d{1,2}|\s+rạng\s+\d{1,2})?\/(\d{1,2})(?!\d)/);
  if (day) return Number(day[2]) * 32 + Number(day[1]);
  const month = date.match(/tháng\s+(\d{1,2})/i) || date.match(/(?:^|\D)(\d{1,2})(?:[–-]\d{1,2})?\/\d{4}/);
  if (month) return Number(month[1]) * 32;
  if (/^Cuối 1944/.test(date)) return -1;
  if (/^Cuối năm/i.test(date)) return 12 * 32;
  return 0;
}
timeline.sort((a,b) => a.year - b.year || withinYear(a) - withinYear(b));
const eventIds = new Set(timeline.map(entry => entry.id));
const readKey = 'lsh.read.';
const finished = new Set();
try {
  for (const entry of timeline) if (localStorage.getItem(readKey + entry.id)) finished.add(entry.id);
} catch { /* Keep progress for the session when storage is unavailable. */ }
function refreshProgress() {
  const next = timeline.find(entry => !finished.has(entry.id));
  const count = finished.size + ' / ' + timeline.length + ' mục đã đọc';
  $('home-progress').textContent = count + ' · Tiến độ trên trình duyệt này';
  $('resume-events').href = href(timeline[0]);
  $('resume-events').textContent = 'Bắt đầu đọc →';
  $('tracking').hidden = !current || !eventIds.has(current.id);
  if ($('tracking').hidden) return;
  const read = finished.has(current.id);
  $('progress-label').textContent = count;
  $('mark-read').textContent = read ? '✓ Đã đọc' : 'Đánh dấu đã đọc';
  $('mark-read').setAttribute('aria-pressed', String(read));
  $('next-unread').hidden = !next || next === current;
  if (next) $('next-unread').href = href(next);
  document.querySelectorAll('[data-chain-read-count]').forEach(node=>{
    const chain=READING_CHAINS.find(c=>c.id===node.dataset.chainReadCount);
    node.textContent=chain.steps.filter(step=>finished.has(step.id)).length+' / '+chain.steps.length+' bài đã đọc';
  });
}
function markRead() {
  const id = current.id;
  if (finished.has(id)) finished.delete(id);
  else finished.add(id);
  try {
    if (finished.has(id)) localStorage.setItem(readKey + id, '1');
    else localStorage.removeItem(readKey + id);
  } catch { /* Progress still works in the current page. */ }
  refreshProgress();
}
$('mark-read').onclick = markRead;
window.addEventListener('storage', event => {
  if (event.key === null) finished.clear();
  else if (event.key.startsWith(readKey)) {
    const id = event.key.slice(readKey.length);
    if (!eventIds.has(id)) return;
    if (event.newValue) finished.add(id); else finished.delete(id);
  } else return;
  refreshProgress();
  if (library.open) results();
});

function sliceNotes(item) {
  const related = comparisonItems(item).sort((a,b) => Math.abs(a.year-item.year) - Math.abs(b.year-item.year));
  return ['why','alt'].map(field => {
    const entry = related.find(e => e.source[field]);
    if (!entry) return '';
    const title=(field==='why'?entry.source.consequencesTitle:entry.source.altTitle)||noteTitle(entry.id,field);
    return '<section class="story-note">'+(title?'<h2>'+escapeHTML(title)+'</h2>':'')+
      paragraphs(entry.source[field])+'<a class="note-source" href="'+href(entry)+'">'+escapeHTML(entry.title)+' →</a></section>';
  }).join('');
}
function peopleAt(item) {
  const year = item.source.k ?? item.year;
  const named = [item.title,item.source.who,item.source.d].filter(Boolean).join(' ');
  return all.filter(e => e.kind === 'np' && e !== item && e.year <= year && (e.source.d ?? Infinity) >= year)
    .sort((a,b) => Number(named.includes(b.title))-Number(named.includes(a.title)) || Math.abs(a.source.k-year)-Math.abs(b.source.k-year));
}
function personTrail(entry, year) {
  const p=entry.source;
  const names=[entry.title,entry.title.split(' (')[0],...entry.title.split(/[–—]/)].map(n=>fold(n.trim())).filter(n=>n.length>3);
  const linked=events.filter(e=>e.year>=p.b&&e.year<=(p.d??2026)&&e.source.who&&names.some(n=>fold(e.source.who).includes(n))).sort((a,b)=>a.year-b.year);
  const rows=[{year:p.k,title:p.n+' '+p.act}];
  for(const e of linked)if(!rows.some(r=>r.year===e.year&&fold(r.title).includes(fold(e.title))))rows.push({year:e.year,title:e.title,entry:e});
  rows.sort((a,b)=>a.year-b.year);
  return '<details class="person-trail"><summary>Theo dấu '+escapeHTML(entry.title)+'</summary><p class="summary">Các dấu mốc có trong thư viện, tính từ năm '+yearText(year)+'.</p><ol>'+rows.map(row=>{
    const delta=row.year-year-(row.year>0&&year<0?1:row.year<0&&year>0?-1:0);
    const distance=delta===0?'Cùng năm':Math.abs(delta)+' năm '+(delta<0?'trước':'sau');
    return '<li><span>'+yearText(row.year)+' · '+distance+'</span>'+(row.entry?'<a href="'+href(row.entry)+'">'+escapeHTML(row.title)+'</a>':'<strong>'+escapeHTML(row.title)+'</strong>')+'</li>';
  }).join('')+'</ol></details>';
}
function lifeScene(entry, year) {
  const p=entry.source;
  const difference=p.k-year;
  const action = p.ck||p.timeBasis==='activity' ? milestoneYear(p)+', ' : difference===0 ? 'Ngay năm này, ' : difference>0 ? difference+' năm sau, ' : -difference+' năm trước, ';
  return '<div class="person-scene"><a class="person-bio-link" href="'+href(entry)+'"><span class="scene-age">'+escapeHTML(personAge(p,year))+' · '+escapeHTML(regions.get(entry.lane))+'</span>'+
    '<strong>'+escapeHTML(entry.title)+'</strong><span>'+escapeHTML(p.role)+'</span>'+
    '<p>'+escapeHTML(action+p.n+' '+p.act+'.')+'</p><small>'+escapeHTML(personDates(p))+' · Tìm hiểu thêm →</small></a>'+personTrail(entry,year)+'</div>';
}
function storyPeople(item) {
  if(item.kind==='np')return '';
  const people=peopleAt(item).slice(0,3);
  const year=item.source.k??item.year;
  return people.length ? '<section class="people-in-story"><h2>Những nhân vật cùng thời</h2><p class="summary">Vào năm '+yearText(year)+'</p>'+people.map(e=>lifeScene(e,year)).join('')+'</section>' : '';
}
function showPeople() {
  const year=current.source.k??current.year, alive=peopleAt(current);
  $('portraits').innerHTML='<h2>Những nhân vật ở mốc '+yearText(year)+'</h2>'+
    (alive.length?alive.map(e=>lifeScene(e,year)).join(''):'<p>Thư viện chưa có tiểu sử ở mốc này.</p>')+
    '<button class="secondary-path" id="all-people">Tra cứu mọi nhân vật →</button>';
  $('all-people').onclick=()=>{openLibrary('search');$('kind').value='np';results();};
}
const surpriseQuestions = [
  {
    "ask": "Thứ gì đã góp phần cứu tháp Eiffel khỏi việc bị tháo dỡ?",
    "choices": [
      "Trạm liên lạc vô tuyến",
      "Trạm báo hiệu hàng hải bằng đèn",
      "Trung tâm tổng đài điện thoại của Paris"
    ],
    "correct": 0,
    "why": "Tháp vốn dự kiến tồn tại 20 năm. Các thí nghiệm khoa học và đặc biệt vai trò liên lạc vô tuyến giúp công trình có lý do để được giữ lại.",
    "id": "eu-eiffel-1889",
    "ref": "https://www.toureiffel.paris/en/news/130-years/why-was-eiffel-tower-kept",
    "key": "eu-eiffel-1889",
    "theme": "architecture"
  },
  {
    "ask": "Trước khi Mario xuất hiện, Nintendo khởi nghiệp bằng thứ gì?",
    "choices": [
      "Sản xuất bài hanafuda",
      "Chế tạo đồ chơi gỗ",
      "Chế tạo máy trò chơi cơ khí"
    ],
    "correct": 0,
    "why": "Nintendo làm bài hanafuda ở Kyoto từ năm 1889, nhiều thập kỷ trước khi hãng bước vào trò chơi điện tử.",
    "id": "culture-nintendo-1889",
    "ref": "https://www.nintendo.com/us/about/",
    "key": "culture-nintendo-1889",
    "theme": "games"
  },
  {
    "ask": "Cleopatra sống gần chuyến Apollo 11 hơn hay gần thời xây Đại Kim tự tháp Giza hơn?",
    "choices": [
      "Gần chuyến Apollo 11 hơn",
      "Gần thời xây Đại Kim tự tháp hơn",
      "Hai khoảng thời gian gần như bằng nhau"
    ],
    "correct": 0,
    "why": "Cleopatra qua đời năm 30 TCN. Từ đó đến Apollo 11 năm 1969 là khoảng 2.000 năm, còn Đại Kim tự tháp đã được xây trước thời bà khoảng 2.500 năm.",
    "id": "wa-np-cleopatra",
    "ref": "https://www.slam.org/collection/constituents/33528/",
    "key": "wa-np-cleopatra",
    "theme": "chronology"
  },
  {
    "ask": "Khi các kim tự tháp Giza đã được xây, tình hình của voi ma mút ra sao?",
    "choices": [
      "Vẫn có quần thể sống trên đảo ở Bắc Băng Dương",
      "Chỉ còn quần thể sống trên lục địa châu Âu",
      "Đã tuyệt chủng ở mọi nơi từ nhiều thiên niên kỷ trước"
    ],
    "correct": 0,
    "why": "Một quần thể voi ma mút ở Wrangel tồn tại tới khoảng 4.000 năm trước, muộn hơn thời xây các kim tự tháp Giza. Không phải mọi quần thể đều tuyệt chủng cùng lúc.",
    "id": "wa-kim-tu-thap-giza-2560tcn",
    "ref": "https://www.nhm.ac.uk/discover/were-all-mammoths-woolly.html",
    "key": "wa-kim-tu-thap-giza-2560tcn",
    "theme": "chronology"
  },
  {
    "ask": "Trong công việc ở Langley trước thời máy tính điện tử phổ biến, “computer” là tên gọi của ai?",
    "choices": [
      "Những người thực hiện phép tính và xử lý số liệu",
      "Những người thiết kế phần cứng máy tính",
      "Những người lập trình máy tính điện tử"
    ],
    "correct": 0,
    "why": "Trước khi máy tính điện tử phổ biến, những nhóm người, trong đó có nhiều phụ nữ, thực hiện các phép tính phục vụ nghiên cứu hàng không tại Langley. NASA gọi họ là human computers.",
    "id": "am-langley-computers-1935",
    "ref": "https://www.nasa.gov/history/langleys-computers-1935-1970/",
    "key": "am-langley-computers-1935",
    "theme": "science"
  },
  {
    "ask": "Hai bản Pokémon đầu tiên tại Nhật có cặp màu nào?",
    "choices": [
      "Đỏ và xanh lá",
      "Đỏ và xanh dương",
      "Vàng và bạc"
    ],
    "correct": 0,
    "why": "Red và Green ra mắt tại Nhật ngày 27/2/1996. Red và Blue quen thuộc với nhiều người chơi quốc tế thuộc đợt phát hành sau.",
    "id": "culture-pokemon-1996",
    "ref": "https://www.pokemon.co.jp/game/other/gb-rg/",
    "key": "culture-pokemon-1996",
    "theme": "games"
  },
  {
    "ask": "Bản Jikji năm 1377, sớm hơn Kinh Thánh Gutenberg gần 80 năm, được in bằng kỹ thuật nào?",
    "choices": [
      "Sắp các con chữ rời đúc bằng kim loại",
      "Khắc nguyên từng trang lên ván gỗ",
      "Sắp các con chữ rời làm bằng đất nung"
    ],
    "correct": 0,
    "why": "Bản Jikji năm 1377 dùng chữ rời kim loại. Dễ nhầm với bản Jikji khắc gỗ năm 1378, hoặc kỹ thuật chữ rời đất nung xuất hiện ở Trung Quốc trước đó. BnF hiện giữ quyển hai của bản in kim loại năm 1377.",
    "id": "ea-jikji-1377",
    "ref": "https://www.bnf.fr/en/jikji-treasure-world-printing",
    "key": "ea-jikji-1377",
    "theme": "printing"
  },
  {
    "key": "roman-food",
    "theme": "daily-life",
    "ask": "Nếu đến một bữa ăn ở La Mã cổ đại, nguyên liệu nào bạn sẽ không thấy?",
    "choices": [
      "Cà chua",
      "Hành",
      "Đậu lăng"
    ],
    "correct": 0,
    "why": "Cà chua có nguồn gốc châu Mỹ, chưa có trong bếp La Mã cổ đại. Một nguyên liệu quen thuộc của ẩm thực Ý ngày nay không có nghĩa nó đã hiện diện ở Ý thời cổ.",
    "ref": "https://www.getty.edu/news/what-did-ancient-romans-eat/"
  },
  {
    "key": "ancient-sculpture-color",
    "theme": "art",
    "ask": "Những tượng cẩm thạch Hy Lạp và La Mã nay thường trắng. Ban đầu, nhiều tượng trông thế nào?",
    "choices": [
      "Được tô màu, đôi khi rất rực rỡ",
      "Luôn để trắng như lúc vừa tạc",
      "Được phủ toàn bộ bằng một lớp đá đen"
    ],
    "correct": 0,
    "why": "Các bảo tàng tìm thấy dấu vết màu trên nhiều tượng cổ. Phong hóa, thời gian chôn vùi và cả việc làm sạch đã làm mất màu, khiến ta dễ tưởng nghệ thuật cổ điển vốn chỉ có màu trắng.",
    "ref": "https://www.metmuseum.org/ja/essays/polychromy-of-roman-marble-sculpture"
  },
  {
    "key": "benin-material",
    "theme": "craft",
    "ask": "Các phù điêu Benin thường được gọi chung là “Benin Bronzes”. Nhiều tấm phù điêu thực ra làm bằng gì?",
    "choices": [
      "Đồng thau, hợp kim đồng–kẽm",
      "Đồng thanh, hợp kim đồng–thiếc",
      "Sắt được mạ một lớp đồng"
    ],
    "correct": 0,
    "why": "Tên gọi chung “Benin Bronzes” có thể gây nhầm: nhiều tấm phù điêu cung đình được đúc bằng đồng thau. Hồ sơ hiện vật của British Museum ghi rõ chất liệu này.",
    "ref": "https://www.britishmuseum.org/collection/object/E_Af1898-0115-27"
  },
  {
    "key": "rosetta-parallel-decree",
    "theme": "language",
    "ask": "Điều gì khiến chữ Hy Lạp trên đá Rosetta trở thành chiếc chìa khóa đọc chữ Ai Cập cổ?",
    "choices": [
      "Cùng một sắc lệnh được ghi bằng nhiều hệ chữ",
      "Phần Hy Lạp là một bảng từ điển Ai Cập–Hy Lạp",
      "Mỗi hình tượng Ai Cập đều có một chữ Hy Lạp ngay bên cạnh"
    ],
    "correct": 0,
    "why": "Cùng một sắc lệnh xuất hiện bằng hai ngôn ngữ và ba hệ chữ. Học giả đọc được phần tiếng Hy Lạp, nhờ vậy họ có một văn bản đã hiểu nghĩa để lần sang phần chữ Ai Cập.",
    "ref": "https://heritage.bnf.fr/bibliothequesorient/jean-francois-champollion-1790-1832-0",
    "id": "wa-da-rosetta-1799"
  },
  {
    "key": "silk-roads-network",
    "theme": "trade",
    "ask": "Hình dung nào gần với Con đường Tơ lụa trong lịch sử nhất?",
    "choices": [
      "Một con đường lát đá liền mạch giữa hai kinh đô",
      "Một mạng tuyến đường nối các chợ, ốc đảo và thành phố",
      "Một lộ trình cố định mà mỗi đoàn buôn phải đi hết"
    ],
    "correct": 1,
    "why": "Một kiện hàng có thể qua tay nhiều thương nhân, đi từng chặng giữa các ốc đảo và thành phố. Chỉ riêng hành lang Trường An – Thiên Sơn đã có nhiều tuyến nối nhau.",
    "ref": "https://whc.unesco.org/en/list/1442/"
  },
  {
    "key": "earthrise-lunar-orbit",
    "theme": "space",
    "ask": "Bức Earthrise nổi tiếng, với Trái Đất nhô lên trên đường chân trời Mặt Trăng, được chụp từ đâu?",
    "choices": [
      "Một trạm tự động đứng trên bề mặt Mặt Trăng",
      "Một kính thiên văn bay quanh Trái Đất",
      "Tàu Apollo 8 đang bay quanh Mặt Trăng"
    ],
    "correct": 2,
    "why": "William Anders chụp bức ảnh từ cửa sổ Apollo 8 vào đêm Giáng sinh 1968. Trái Đất như đang mọc vì chính con tàu đang vòng qua Mặt Trăng.",
    "ref": "https://science.nasa.gov/resource/apollo-8s-iconic-earthrise/",
    "id": "am-apollo-8-earthrise-1968"
  },
  {
    "key": "apollo13-lunar-module-lifeboat",
    "theme": "space",
    "ask": "Vì sao bộ phận vốn dành để đáp xuống Mặt Trăng lại cứu sống phi hành đoàn Apollo 13?",
    "choices": [
      "Cả ba chuyển sang đó để dùng điện và dưỡng khí",
      "Nó mang theo bồn oxy dự phòng để thay bồn đã hỏng",
      "Tấm chắn nhiệt của nó được dùng để trở về Trái Đất"
    ],
    "correct": 0,
    "why": "Sau sự cố bồn oxy, phi hành đoàn cần giữ điện cho mô-đun chỉ huy để còn trở về Trái Đất. Mô-đun đổ bộ Aquarius trở thành nơi ở tạm, cung cấp điện và hỗ trợ sự sống.",
    "ref": "https://www.nasa.gov/news-release/nasa-commemorates-50th-anniversary-of-apollo-13-a-successful-failure/"
  },
  {
    "key": "longitude-time-difference",
    "theme": "navigation",
    "ask": "Một chiếc đồng hồ chạy chính xác giúp thủy thủ biết tàu ở phía đông hay phía tây bằng cách nào?",
    "choices": [
      "Đo thời gian từ lúc Mặt Trời mọc đến khi lặn",
      "So giờ địa phương với giờ ở kinh tuyến chuẩn",
      "Đo khoảng cách thời gian giữa hai lần thủy triều lên"
    ],
    "correct": 1,
    "why": "Khi Mặt Trời đứng cao nhất ở chỗ con tàu, thủy thủ đối chiếu giờ địa phương với đồng hồ vẫn giữ giờ ở kinh tuyến chuẩn. Trái Đất quay khoảng 15 độ mỗi giờ, nên chênh lệch một giờ tương ứng với khoảng 15 độ kinh độ.",
    "ref": "https://www.rmg.co.uk/stories/time/what-longitude"
  },
  {
    "key": "penicillin-bacterial-clear-zone",
    "theme": "medicine",
    "ask": "Điều gì trên một đĩa nuôi vi khuẩn đã khiến Alexander Fleming chú ý năm 1928?",
    "choices": [
      "Vi khuẩn tập trung thành vòng dày quanh một đám nấm",
      "Môi trường nuôi cấy đổi màu đều khắp đĩa",
      "Vi khuẩn không phát triển ở vùng quanh đám nấm mốc"
    ],
    "correct": 2,
    "why": "Đĩa nuôi tụ cầu bị lẫn nấm mốc. Ngay sát đám nấm có một vòng trống, trong khi xa hơn vi khuẩn vẫn mọc. Vòng trống ấy dẫn Fleming đến chất ông đặt tên là penicillin.",
    "ref": "https://www.nobelprize.org/prizes/medicine/1945/fleming/biographical/",
    "id": "eu-penicillin-1928"
  },
  {
    "key": "jenner-milkmaids-cowpox",
    "theme": "medicine",
    "ask": "Quan sát nào ở những người vắt sữa đã gợi hướng nghiên cứu đậu mùa cho Edward Jenner?",
    "choices": [
      "Người đã mắc đậu bò dường như ít mắc đậu mùa",
      "Người mắc đậu mùa thường nổi nốt đầu tiên ở bàn tay",
      "Người trong cùng trại bò thường phát bệnh cùng một ngày"
    ],
    "correct": 0,
    "why": "Từ lâu người ta đã nhận thấy một số người từng mắc đậu bò dường như tránh được đậu mùa. Năm 1796, Jenner dùng vật liệu lấy từ một tổn thương đậu bò để thử ý tưởng về khả năng bảo vệ chéo ấy.",
    "ref": "https://www.cdc.gov/smallpox/about/history.html",
    "id": "eu-jenner-1796"
  },
  {
    "key": "snow-cholera-shared-water",
    "theme": "medicine",
    "ask": "Trong đợt dịch tả ở London năm 1854, John Snow lần theo mối liên hệ nào giữa nhiều người bệnh?",
    "choices": [
      "Họ cùng làm việc trong các xưởng thuộc da",
      "Họ lấy nước uống từ cùng một máy bơm",
      "Họ mua thực phẩm ở cùng một quầy chợ"
    ],
    "correct": 1,
    "why": "Địa chỉ người tử vong tập trung quanh máy bơm ở phố Broad. Hỏi người dân lấy nước ở đâu giúp Snow nối những chấm trên bản đồ với một nguồn phơi nhiễm cụ thể.",
    "ref": "https://www.londonmuseum.org.uk/collections/london-stories/john-snow-cholera-broad-street-pump/",
    "id": "eu-soho-broad-street-1854"
  },
  {
    "key": "abu-simbel-block-relocation",
    "theme": "heritage",
    "ask": "Người ta đã cứu các đền Abu Simbel khỏi vùng nước dâng do đập Aswan bằng cách nào?",
    "choices": [
      "Dựng đê bao rồi bơm nước khỏi khu đền",
      "Nâng nguyên khối từng ngôi đền bằng hệ kích",
      "Cắt đền thành khối rồi lắp lại ở vị trí cao hơn"
    ],
    "correct": 2,
    "why": "Hai ngôi đền đá được cắt ra thành hơn một nghìn khối rồi dựng lại ở vị trí cao hơn. Bởi vậy khách tham quan vẫn thấy cả mặt tiền lẫn các gian thờ, dù địa điểm ban đầu đã chìm dưới nước.",
    "ref": "https://whc.unesco.org/en/story-abu-simbel/",
    "id": "wa-di-doi-abu-simbel-1964"
  },
  {
    "key": "star-wars-hidden-fortress-viewpoint",
    "theme": "cinema",
    "ask": "Cặp robot hay cãi nhau C-3PO và R2-D2 gợi nhớ đến bộ đôi nào trong phim The Hidden Fortress của Kurosawa?",
    "choices": [
      "Hai nông dân đi cùng một công chúa và một tướng quân",
      "Hai vệ binh được cử áp giải một tù nhân qua biên giới",
      "Hai samurai tranh nhau phần thưởng của một lãnh chúa"
    ],
    "correct": 0,
    "why": "Trong phim của Kurosawa, hai nông dân hay cãi nhau bị cuốn vào chuyện của một công chúa và một tướng quân. Đầu phim Star Wars, người xem cũng bước vào cuộc phiêu lưu qua hai bạn đồng hành luôn cãi cọ.",
    "ref": "https://www.starwars.com/news/akira-kurosawa-star-wars-influence",
    "id": "culture-star-wars-1977"
  },
  {
    "key": "donkey-kong-popeye-concept",
    "theme": "games",
    "ask": "Trong ý tưởng ban đầu dẫn đến Donkey Kong, Shigeru Miyamoto từng muốn dùng nhân vật hoạt hình nào?",
    "choices": [
      "Pinocchio",
      "Popeye",
      "Peter Pan"
    ],
    "correct": 1,
    "why": "Miyamoto kể rằng ông từng hình dung trò chơi với Popeye và những nhân vật cùng bộ truyện. Donkey Kong cuối cùng có dàn nhân vật riêng, còn Nintendo về sau mới làm một trò chơi mang tên Popeye.",
    "ref": "https://iwataasks.nintendo.com/interviews/wii/nsmb/0/0/"
  },
  {
    "key": "olympic-art-medals",
    "theme": "sport",
    "ask": "Ở Olympic đầu thế kỷ XX, một người có thể giành huy chương nhờ thành tích nào sau đây?",
    "choices": [
      "Viết một công trình nghiên cứu khảo cổ",
      "Phát minh một thiết bị y tế",
      "Thiết kế một công trình kiến trúc về thể thao"
    ],
    "correct": 2,
    "why": "Tại Stockholm năm 1912, một đồ án sân vận động đã đoạt huy chương vàng. Kiến trúc khi ấy là một trong các nội dung thi nghệ thuật Olympic, cùng với văn học, âm nhạc, hội họa và điêu khắc.",
    "ref": "https://www.olympics.com/ioc/news/a-meeting-of-muscles-and-minds"
  },
  {
    "key": "newcomen-mine-drainage",
    "theme": "industry",
    "ask": "Trước khi hơi nước gắn với hình ảnh tàu hỏa, động cơ Newcomen được phát triển để giải quyết việc gì?",
    "choices": [
      "Bơm nước ra khỏi các hầm mỏ",
      "Kéo toa hành khách giữa hai thành phố",
      "Vận hành máy dệt trong xưởng vải"
    ],
    "correct": 0,
    "why": "Càng đào sâu, thợ mỏ càng phải đối phó với nước ngập. Động cơ của Newcomen kéo bơm đưa nước lên mặt đất từ đầu thế kỷ XVIII, trước khi hình ảnh đầu máy xe lửa trở nên quen thuộc.",
    "ref": "https://www.nms.ac.uk/discover-catalogue/the-newcomen-engine-and-its-role-in-britains-industrial-revolution",
    "id": "eu-watt-1769"
  },
  {
    "key": "lloyds-coffee-house-network",
    "theme": "trade",
    "ask": "Nguồn gốc thị trường bảo hiểm Lloyd’s ở London gắn với địa điểm nào?",
    "choices": [
      "Một xưởng đóng tàu thuộc hải quân",
      "Một quán cà phê nơi giới hàng hải trao đổi tin tức",
      "Một cơ quan thu thuế đặt ngay trong hoàng cung"
    ],
    "correct": 1,
    "why": "Chủ tàu, người buôn hàng và người nhận bảo hiểm gặp nhau ở quán cà phê của Edward Lloyd để trao đổi tin tàu đi, tàu đến. Muốn định giá rủi ro cho một chuyến biển, thứ họ cần trước hết là tin tức đáng tin cậy.",
    "ref": "https://www.lloyds.com/about-lloyds/history/coffee-and-commerce"
  },
  {
    "key": "liberty-copper-green-patina",
    "theme": "architecture",
    "ask": "Màu xanh quen thuộc của tượng Nữ thần Tự do hình thành chủ yếu từ đâu?",
    "choices": [
      "Sơn chống nước được quét lên tượng sau khi lắp ráp",
      "Men màu được nung trên các tấm đồng ngay tại xưởng",
      "Lớp patina hình thành trên vỏ đồng ngoài không khí"
    ],
    "correct": 2,
    "why": "Vỏ tượng được ghép từ những tấm đồng. Ban đầu đồng có màu nâu đỏ. Qua nhiều năm ngoài trời, bề mặt đồng hình thành lớp patina xanh mà nay người ta nhận ra từ xa.",
    "ref": "https://www.nps.gov/stli/planyourvisit/frequently-asked-questions-statue-of-liberty.htm"
  },
  {
    "key": "metre-earth-meridian",
    "theme": "measurement",
    "ask": "Khi xây dựng hệ mét ở Pháp, người ta ban đầu muốn gắn một mét với điều gì?",
    "choices": [
      "Một phần cung kinh tuyến từ xích đạo tới Bắc Cực",
      "Chiều dài con lắc đếm một nhịp mỗi giây ở Paris",
      "Một phần khoảng cách trung bình từ Trái Đất đến Mặt Trăng"
    ],
    "correct": 0,
    "why": "Một mét được chọn bằng một phần mười triệu cung kinh tuyến nối xích đạo với Bắc Cực. Để tính chiều dài ấy, các nhà đo đạc khảo sát một đoạn giữa Dunkirk và Barcelona.",
    "ref": "https://www.nist.gov/si-redefinition/meter",
    "id": "culture-metric-1795"
  },
  {
    "key": "republican-calendar-ten-day-cycle",
    "theme": "daily-life",
    "ask": "Trong lịch Cộng hòa Pháp, nhịp tuần bảy ngày được thay bằng chu kỳ nào?",
    "choices": [
      "Sáu ngày",
      "Mười ngày",
      "Tám ngày"
    ],
    "correct": 1,
    "why": "Trong lịch Cộng hòa Pháp, tháng có 30 ngày chia thành ba décade, mỗi décade gồm mười ngày. Người xem lịch phải học cả nhịp đếm ngày mới, ngoài tên gọi mới của các tháng.",
    "ref": "https://anlux.public.lu/fr/rechercher/outils-pratiques/calendrier-republicain.html"
  },
  {
    "key": "papyrus-crossed-strips",
    "theme": "writing",
    "ask": "Một tấm papyrus Ai Cập thường được tạo thành theo cách nào?",
    "choices": [
      "Nghiền vỏ cây thành bột rồi vớt bằng khuôn lưới",
      "Cạo mỏng da động vật rồi căng khô",
      "Xếp các dải ruột cây thành lớp giao nhau rồi ép khô"
    ],
    "correct": 2,
    "why": "Thợ cắt ruột thân cây thành những dải dài rồi xếp hai lớp vuông góc và ép lại. Trên một tấm papyrus, bạn vẫn có thể nhìn thấy hướng các dải cây chạy ngang hoặc dọc.",
    "ref": "https://www.metmuseum.org/pt/essays/papyrus-making-in-egypt"
  },
  {
    "key": "marathon-modern-olympic-invention",
    "theme": "sport",
    "ask": "Môn marathon ở Olympic hiện đại có mối quan hệ thế nào với Olympic cổ đại?",
    "choices": [
      "Một môn mới lấy cảm hứng từ truyền thuyết Hy Lạp",
      "Một môn cổ được phục dựng theo đúng lộ trình xưa",
      "Tên mới của cuộc chạy nhiều vòng sân ở Olympia"
    ],
    "correct": 0,
    "why": "Michel Bréal đề xuất cuộc đua lấy cảm hứng từ truyền thuyết người đưa tin. Khi Spiridon Louis thắng ở Athens năm 1896, đó là lần đầu cả lịch sử Olympic có môn marathon.",
    "ref": "https://worldathletics.org/heritage/news/1896-olympic-marathon-spiridon-louis-125-anniversary-breal-cup",
    "id": "eu-marathon-olympic-1896"
  },
  {
    "key": "web-cern-information-sharing",
    "theme": "computing",
    "ask": "Nhu cầu ban đầu thúc đẩy Tim Berners-Lee đề xuất World Wide Web ở CERN là gì?",
    "choices": [
      "Chia thời gian xử lý của một máy tính lớn cho các phòng thí nghiệm",
      "Nối tài liệu để các nhà khoa học ở nhiều nơi chia sẻ thông tin",
      "Đồng bộ đồng hồ cho các máy dò hạt trong phòng thí nghiệm"
    ],
    "correct": 1,
    "why": "Ở CERN, thông tin nghiên cứu nằm rải rác trên nhiều máy và trong nhiều nhóm. Đề xuất năm 1989 của Berners-Lee dùng các liên kết để người đọc có thể đi từ tài liệu này sang tài liệu khác.",
    "ref": "https://home.cern/science/computing/the-birth-of-the-web",
    "id": "eu-www-1989"
  },
  {
    "key": "velcro-burr-hooks",
    "theme": "invention",
    "ask": "Thứ gì trong tự nhiên đã gợi ý cho George de Mestral tạo ra khóa dán Velcro?",
    "choices": [
      "Các vảy quả thông khép lại khi ướt",
      "Nhựa cây bám dính vào sợi vải",
      "Những quả gai móc vào lông chó"
    ],
    "correct": 2,
    "why": "De Mestral xem kỹ những quả gai mắc vào lông chó và quần áo. Các móc nhỏ bám vào sợi vải gợi cho ông hai bề mặt có thể ép dính rồi bóc ra nhiều lần.",
    "ref": "https://lemelson.mit.edu/resources/george-de-mestral"
  },
  {
    "key": "great-wave-printers-collaboration",
    "theme": "art",
    "ask": "Ai đã biến bản vẽ Sóng lừng ngoài khơi Kanagawa của Hokusai thành những bản in nhiều sắc xanh?",
    "choices": [
      "Thợ khắc ván và thợ in từng lớp màu",
      "Thợ vẽ tay tô riêng từng tờ sau khi in nét",
      "Thợ dệt tạo sẵn hoa văn trên nền lụa"
    ],
    "correct": 0,
    "why": "Sóng lừng là tranh in khắc gỗ. Từ bản vẽ của Hokusai, thợ khắc chuẩn bị ván, rồi thợ in lần lượt đặt các lớp màu lên giấy. Sắc xanh trên bản in vì thế mang cả dấu tay của người in.",
    "ref": "https://www.metmuseum.org/ja/essays/hokusai-great-wave",
    "id": "ea-hokusai-1831"
  },
  {
    "key": "boston-tea-chinese-origin",
    "theme": "trade",
    "ask": "Dù do Công ty Đông Ấn của Anh vận chuyển, trà bị đổ xuống biển trong Boston Tea Party có nguồn gốc ở đâu?",
    "choices": [
      "Ấn Độ",
      "Trung Quốc",
      "Đảo Java"
    ],
    "correct": 1,
    "why": "Tên Công ty Đông Ấn dễ khiến ta nghĩ tới Ấn Độ. Nhưng trà trên những chiếc tàu ở Boston năm 1773 đến từ Trung Quốc. Nơi trồng trà, công ty vận chuyển và nơi phản đối thuế nằm ở ba phía khác nhau của mạng lưới buôn bán.",
    "ref": "https://www.osmh.org/history/boston-tea-party/frequently-asked-questions-about-boston-tea-party_destination-node_36",
    "id": "am-tiec-tra-boston-1773"
  },
  {
    "key": "mendeleev-predictive-gaps",
    "theme": "science",
    "ask": "Vì sao việc Mendeleev để ô trống trong bảng tuần hoàn lại trở thành một điểm mạnh?",
    "choices": [
      "Để dành chỗ cho những nguyên tố chỉ tồn tại ở dạng hợp chất",
      "Để tách các kim loại hiếm khỏi các kim loại thông thường",
      "Để dự đoán tính chất của những nguyên tố chưa biết"
    ],
    "correct": 2,
    "why": "Nếu các nguyên tố cùng nhóm có tính chất lặp lại, một khoảng trống cũng mang thông tin. Mendeleev dùng vị trí trống để dự đoán tính chất của những nguyên tố người ta chưa tìm thấy.",
    "ref": "https://periodic-table.rsc.org/about",
    "id": "eu-mendeleev-1869"
  },
  {
    "key": "mona-lisa-poplar-panel",
    "theme": "conservation",
    "ask": "Khác với hình dung về tranh vẽ trên vải, Mona Lisa được Leonardo vẽ trên bề mặt nào?",
    "choices": [
      "Một tấm gỗ dương",
      "Một tấm lụa căng trên khung",
      "Một tấm đồng đánh nhẵn"
    ],
    "correct": 0,
    "why": "Leonardo dùng sơn dầu trên một tấm gỗ dương. Khách xem thường nhớ lớp màu và nụ cười, nhưng tấm gỗ bên dưới cũng là một phần của hiện vật mà Louvre phải bảo quản.",
    "ref": "https://www.louvre.fr/en/explore/the-palace/from-the-mona-lisa-to-the-wedding-feast-at-cana",
    "id": "eu-mona-lisa-1503"
  },
  {
    "key": "voyager-record-earth-portrait",
    "theme": "space",
    "ask": "Chiếc đĩa vàng trên Voyager được tạo ra chủ yếu để làm gì?",
    "choices": [
      "Lưu bản dự phòng chương trình điều khiển tàu",
      "Giới thiệu Trái Đất với bất kỳ ai có thể tìm thấy tàu",
      "Ghi lại các tín hiệu vô tuyến thu được trên hành trình"
    ],
    "correct": 1,
    "why": "Mỗi tàu Voyager mang theo một đĩa chứa âm nhạc, lời chào, âm thanh và hình ảnh về Trái Đất. Người nhận được hình dung là bất cứ ai có thể tìm thấy con tàu rất lâu sau khi nó rời xa chúng ta.",
    "ref": "https://science.nasa.gov/mission/voyager/voyager-golden-record-overview/"
  },
  {
    "key": "bayeux-embroidery-technique",
    "theme": "craft",
    "ask": "Tên gọi “thảm Bayeux” dễ gây nhầm ở điểm nào về cách tác phẩm được làm?",
    "choices": [
      "Hình được in từ ván khắc lên từng tấm vải",
      "Hình được ghép từ những mảnh vải nhuộm màu",
      "Hình được thêu bằng chỉ lên nền vải đã dệt"
    ],
    "correct": 2,
    "why": "Hình người, ngựa và thuyền được thêu bằng chỉ len trên nền vải lanh đã dệt sẵn. Ở một tấm thảm dệt hình, hoa văn hình thành ngay khi người thợ dệt nên tấm vải.",
    "ref": "https://www.bayeuxmuseum.com/en/the-bayeux-tapestry/discover-the-bayeux-tapestry/tapestry-or-embroidery/"
  },
  {
    "key": "impressionism-critical-label",
    "theme": "art",
    "ask": "Tên gọi “Ấn tượng” của phong trào hội họa gắn với phản ứng nào khi tranh Monet được trưng bày năm 1874?",
    "choices": [
      "Một nhà phê bình dùng tên bức tranh để đặt lời chế giễu",
      "Viện hàn lâm trao giải rồi chính thức đặt tên cho nhóm",
      "Monet mở trường dạy vẽ mang tên Ấn tượng"
    ],
    "correct": 0,
    "why": "Nhà phê bình Louis Leroy mượn tên bức Ấn tượng, mặt trời mọc của Monet để châm biếm cuộc triển lãm năm 1874. Cái tên từng mang ý giễu cợt rồi lại gắn với cả phong trào.",
    "ref": "https://www.marmottan.fr/en/the-museum/the-museum-and-its-history/",
    "id": "culture-impressionism-1874"
  },
  {
    "key": "orsay-railway-station-reuse",
    "theme": "architecture",
    "ask": "Trước khi thành bảo tàng nghệ thuật, tòa nhà chính của Musée d’Orsay ở Paris phục vụ công việc gì?",
    "choices": [
      "Một nhà hát opera",
      "Một ga đường sắt",
      "Một nhà máy điện"
    ],
    "correct": 1,
    "why": "Tòa nhà bên sông Seine ban đầu là ga Orsay. Không gian từng đón các đoàn tàu nay là sảnh trưng bày, và những chiếc đồng hồ lớn vẫn gợi lại công dụng cũ.",
    "ref": "https://www.musee-orsay.fr/fr/articles/histoire-du-musee-60"
  },
  {
    "key": "nylon-stockings-parachutes",
    "theme": "industry",
    "ask": "Loại vật liệu nào đi từ những đôi tất được săn đón sang vai trò thay thế lụa làm dù trong Thế chiến II?",
    "choices": [
      "Rayon",
      "Sợi axetat",
      "Nylon"
    ],
    "correct": 2,
    "why": "Năm 1940, phần lớn nylon của DuPont được dùng làm tất. Khi nhu cầu quân sự tăng lên, hãng chuyển sản lượng sang các mặt hàng như dù và sợi gia cường lốp, khiến tất nylon trở nên khó mua.",
    "ref": "https://www.sciencehistory.org/stories/magazine/nylon-a-revolution-in-textiles/"
  },
  {
    "key": "vn-bia-thi-1442",
    "theme": "education",
    "ask": "Vì sao bia tiến sĩ ở Văn Miếu ghi cả khoa thi năm 1442, dù đến năm 1484 mới bắt đầu dựng bia?",
    "choices": [
      "Khoa thi năm 1442 kéo dài đến khi dựng bia",
      "Có bia được dựng để ghi danh người đỗ các khoa trước",
      "1442 là năm khắc đá, 1484 là năm chuyển bia về Hà Nội"
    ],
    "correct": 1,
    "why": "Có hai dòng thời gian trên cùng một tấm bia. 82 bia còn lại ghi các khoa thi từ 1442 đến 1779, còn việc dựng những bia ấy diễn ra trong khoảng 1484–1780.",
    "id": "vn-bia-tien-si-1484",
    "ref": "https://www.unesco.org/en/memory-world/stone-stele-records-royal-examinations-le-and-mac-dynasties-1442-1779?hub=1081"
  },
  {
    "key": "vn-quanho-response",
    "theme": "music",
    "ask": "Trong một canh hát Quan họ, bên kia đã hát một câu. Bên mình thường đối lại thế nào?",
    "choices": [
      "Giữ nguyên lời nhưng đổi hẳn làn điệu",
      "Nhắc lại nguyên cả lời lẫn điệu để mời hát tiếp",
      "Đối bằng lời khác trên làn điệu tương ứng"
    ],
    "correct": 2,
    "why": "Người hát phải nghe cả lời lẫn giọng của bạn hát. Trong lối đối đáp truyền thống, hai bên hát những lời khác nhau trên làn điệu tương ứng. Cuộc gặp vì thế giống một cuộc trò chuyện bằng âm nhạc.",
    "id": "culture-quan-ho-2009",
    "ref": "https://ich.unesco.org/en/RL/quan-ho-bac-ninh-folk-songs-00183"
  },
  {
    "key": "vn-ho-citadel-tran",
    "theme": "architecture",
    "ask": "Khi những khối đá đầu tiên của Thành nhà Hồ được xếp lên ở Thanh Hóa năm 1397, triều đại nào đang trị vì?",
    "choices": [
      "Nhà Trần",
      "Nhà Hồ",
      "Nhà Lê sơ"
    ],
    "correct": 0,
    "why": "Hồ Quý Ly cho dựng thành khi ông còn làm quan nhà Trần. Ba năm sau ông mới lập nhà Hồ. Tên di tích quen thuộc ngày nay dễ khiến ta đặt nhầm năm xây thành sang triều đại kế tiếp.",
    "id": "vn-thanh-nha-ho-1397",
    "ref": "https://whc.unesco.org/en/list/1358/"
  },
  {
    "key": "voyager-order",
    "theme": "space",
    "ask": "Voyager 1 và Voyager 2 có điểm nào dễ khiến ta đoán nhầm thứ tự phóng?",
    "choices": [
      "Voyager 2 rời Trái Đất trước Voyager 1",
      "Cả hai được phóng trên cùng một tên lửa",
      "Voyager 1 được đổi tên sau khi phóng"
    ],
    "correct": 0,
    "why": "Voyager 2 phóng ngày 20/8/1977, Voyager 1 ngày 5/9. Đường bay nhanh hơn giúp Voyager 1 đến Sao Mộc và Sao Thổ trước.",
    "id": "am-voyager-1977",
    "ref": "https://science.nasa.gov/mission/voyager/planetary-voyage/"
  },
  {
    "key": "voyager-four-planets",
    "theme": "space",
    "ask": "Tàu nào đã bay qua cả Sao Mộc, Sao Thổ, Sao Thiên Vương và Sao Hải Vương?",
    "choices": [
      "Voyager 1",
      "Voyager 2",
      "Cả hai tàu Voyager"
    ],
    "correct": 1,
    "why": "Voyager 1 chỉ thăm Sao Mộc và Sao Thổ. Voyager 2 theo hành trình cho phép tiếp tục tới Sao Thiên Vương và Sao Hải Vương.",
    "id": "am-voyager-1977",
    "ref": "https://science.nasa.gov/mission/voyager/planetary-voyage/"
  },
  {
    "key": "smallpox-surveillance",
    "theme": "medicine",
    "ask": "Sau khi có vaccine, điều gì vẫn cần làm để biết đậu mùa thực sự đã ngừng lây?",
    "choices": [
      "Chỉ đếm số liều vaccine đã sản xuất",
      "Chỉ xét nghiệm những người vừa được tiêm",
      "Chủ động tìm ca bệnh và theo dõi đường lây"
    ],
    "correct": 2,
    "why": "Một chiến dịch có nhiều liều vaccine chưa tự cho biết virus còn lây ở đâu. Giám sát và tìm ca bệnh là phần thiết yếu của chương trình thanh toán.",
    "id": "gb-smallpox-eradicated-1980",
    "ref": "https://www.who.int/news-room/spotlight/history-of-vaccination/history-of-smallpox-vaccination"
  },
  {
    "key": "penicillin-shared-prize",
    "theme": "medicine",
    "ask": "Vì sao Nobel Y học 1945 về penicillin được chia cho Fleming, Chain và Florey?",
    "choices": [
      "Công trình bao gồm cả phát hiện và phát triển tác dụng điều trị",
      "Mỗi người tìm ra một loại nấm tạo ra penicillin",
      "Cả ba cùng quan sát đĩa nuôi cấy đầu tiên năm 1928"
    ],
    "correct": 0,
    "why": "Quan sát của Fleming là bước mở đầu. Chain và Florey tiếp tục nghiên cứu để phát triển khả năng chữa bệnh của penicillin. Giải thưởng ghi nhận công trình chung ấy.",
    "id": "eu-penicillin-nobel-1945",
    "ref": "https://www.nobelprize.org/prizes/medicine/1945/summary/"
  },
  {
    "key": "higgs-two-experiments",
    "theme": "science",
    "ask": "Vì sao thông báo hạt mới ở CERN năm 2012 có cả tên ATLAS lẫn CMS?",
    "choices": [
      "Đó là tên hai lý thuyết cạnh tranh nhau",
      "Hai nhóm thực nghiệm đều thấy bằng chứng về hạt mới",
      "Một nhóm chế tạo hạt, nhóm kia đặt tên cho hạt"
    ],
    "correct": 1,
    "why": "Hai thí nghiệm quan sát bằng các thiết bị riêng và cùng trình bày kết quả. Sự tương hợp giữa các phép đo giúp kiểm tra bằng chứng.",
    "id": "eu-higgs-observation-2012",
    "ref": "https://home.cern/cern-experiments-observe-particle-consistent-with-long-sought-higgs-boson/"
  },
  {
    "key": "orsay-opening-dates",
    "theme": "architecture",
    "ask": "Tư liệu ghi Musée d’Orsay khánh thành ngày 1/12/1986 nhưng mở cửa ngày 9/12. Hai mốc này nói điều gì?",
    "choices": [
      "Bảo tàng đóng rồi mở lại trong một tuần",
      "Hai lịch khác nhau được dùng ở Paris",
      "Lễ khánh thành diễn ra trước ngày đón công chúng"
    ],
    "correct": 2,
    "why": "Một công trình có thể có ngày tổ chức lễ riêng với ngày mở cửa cho người tham quan. Lịch sử chính thức của bảo tàng phân biệt hai mốc.",
    "id": "culture-orsay-1986",
    "ref": "https://www.musee-orsay.fr/fr/articles/histoire-du-musee-60"
  },
  {
    "key": "wave-pigment-mixture",
    "theme": "art",
    "ask": "Phân tích bản Sóng lừng ở The Met cho thấy thợ in làm sắc xanh sâu hơn bằng cách nào?",
    "choices": [
      "Kết hợp chàm với xanh Phổ và in chồng màu",
      "Phủ toàn bộ bản in bằng một lớp mực đen",
      "Tô riêng bằng sơn dầu sau khi in"
    ],
    "correct": 0,
    "why": "Pha sắc tố và đặt các lớp màu chồng lên nhau tạo được chuyển độ xanh. Người in góp phần trực tiếp vào cảm giác sâu và chuyển động của con sóng.",
    "id": "ea-hokusai-1831",
    "ref": "https://www.metmuseum.org/essays/hokusai-great-wave"
  },
  {
    "key": "rosetta-language-script",
    "theme": "language",
    "ask": "Đá Rosetta có ba hệ chữ. Nó ghi bao nhiêu ngôn ngữ?",
    "choices": [
      "Ba",
      "Hai",
      "Một"
    ],
    "correct": 1,
    "why": "Tiếng Ai Cập được viết bằng chữ tượng hình và demotic. Phần còn lại dùng tiếng Hy Lạp. Vì vậy hai ngôn ngữ xuất hiện dưới ba hệ chữ.",
    "id": "wa-da-rosetta-1799",
    "ref": "https://heritage.bnf.fr/bibliothequesorient/jean-francois-champollion-1790-1832-0"
  }
];
const quizHistoryKey='lsh.quiz.seen';
let quizHistory=[];
let quizStorageAvailable=true;
function loadQuizHistory() {
  if(!quizStorageAvailable)return;
  try {
    const saved=JSON.parse(localStorage.getItem(quizHistoryKey)||'[]');
    if(Array.isArray(saved))quizHistory=[...new Set(saved.filter(key=>surpriseQuestions.some(q=>q.key===key)))];
  } catch { quizStorageAvailable=false; }
}
function rememberQuiz(key) {
  quizHistory.push(key);
  try { localStorage.setItem(quizHistoryKey,JSON.stringify(quizHistory)); } catch { quizStorageAvailable=false; }
}
function shuffled(items) {
  const copy=items.slice();
  for(let i=copy.length-1;i>0;i--) { const j=Math.floor(Math.random()*(i+1)); [copy[i],copy[j]]=[copy[j],copy[i]]; }
  return copy;
}
function newQuestion() {
  loadQuizHistory();
  const unseen=surpriseQuestions.filter(q=>!quizHistory.includes(q.key));
  if(!unseen.length) {
    $('challenge').innerHTML='<h2>Bạn đã xem hết '+surpriseQuestions.length+' câu trong bộ này.</h2><p>Muốn thử lại, bạn có thể bắt đầu một lượt mới.</p><button class="secondary-path" id="quiz-restart">Chơi lại từ đầu →</button>';
    $('quiz-restart').onclick=()=>{quizHistory=[];try{localStorage.removeItem(quizHistoryKey);}catch{quizStorageAvailable=false;}newQuestion();};
    return;
  }
  const recentThemes=quizHistory.slice(-2).map(key=>surpriseQuestions.find(q=>q.key===key)?.theme);
  const differentTopic=unseen.filter(q=>!recentThemes.includes(q.theme));
  const q=shuffled(differentTopic.length?differentTopic:unseen)[0];
  rememberQuiz(q.key);
  const choices=shuffled(q.choices.map((label,index)=>({label,index})));
  $('challenge').dataset.question=q.key;
  $('challenge').innerHTML='<p class="edition">Đố vui lịch sử · Đã xem '+quizHistory.length+'/'+surpriseQuestions.length+'</p><h2>'+escapeHTML(q.ask)+'</h2>'+choices.map((c,i)=>'<button class="answer" data-answer="'+i+'">'+escapeHTML(c.label)+'</button>').join('')+'<div id="quiz-feedback" role="status"></div>';
  $('challenge').querySelectorAll('.answer').forEach(button=>button.onclick=()=>{
    const pick=choices[Number(button.dataset.answer)];
    $('challenge').querySelectorAll('.answer').forEach(btn=>{btn.disabled=true;btn.classList.toggle('correct',choices[Number(btn.dataset.answer)].index===q.correct);});
    $('quiz-feedback').innerHTML='<b>'+(pick.index===q.correct?'Đúng rồi.':'Đáp án là '+escapeHTML(q.choices[q.correct]))+'</b><p>'+escapeHTML(q.why)+'</p>'+(q.id?'<a class="answer-date" href="#'+q.id+'">Đọc bài liên quan →</a>':'')+'<div class="quiz-next-actions"><a class="note-source" href="'+q.ref+'" target="_blank" rel="noopener">Xem nguồn ↗</a><button class="secondary-path" id="another">Câu tiếp theo →</button></div>';
    $('another').onclick=newQuestion;
  });
}
const panels = {read:'body-copy', compare:'world', people:'portraits', play:'challenge'};
function selectPanel(name) {
  for (const [button,section] of Object.entries(panels)) {
    $(button).setAttribute('aria-pressed', String(name===button));
    if($(section)) $(section).hidden = name!==button;
  }
  if (name==='compare' || name==='read') {
    showWorld();
    $('world').hidden=false;

  }
  if (name==='people') showPeople();
  if (name==='play' && !$('challenge').hasChildNodes()) newQuestion();
}
for (const name of Object.keys(panels)) $(name).onclick=()=>selectPanel(name);
const atlas = $('atlas-inline');
function displayAtlas(open) {
  atlas.hidden = !open;
  const toggle = document.querySelector('.time-link');
  toggle.textContent = open ? 'Thu gọn bản đồ ↑' : 'Mở bản đồ thời gian ↓';
  toggle.setAttribute('aria-expanded', String(open));
  if (!open) { $('atlas-frame').replaceChildren(); return; }
  const frame = document.createElement('iframe');
  frame.title = 'Chọn sự kiện hoặc nhân vật để đọc';
  frame.src = 'dong-thoi-gian.html?reader=1' + href(current);
  $('atlas-frame').replaceChildren(frame);
  atlas.scrollIntoView({block:'nearest'});
}
$('atlas-close').onclick=()=>{ displayAtlas(false); document.querySelector('.time-link').focus(); };
for (const link of document.querySelectorAll('[data-atlas]')) link.onclick = event => {
  if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  displayAtlas(atlas.hidden || !link.classList.contains('time-link'));
};
function sendToAtlas(id) {
  const frame = $('atlas-frame').firstElementChild;
  frame?.contentWindow?.postMessage({type:'show-item', id}, location.origin==='null'?'*':location.origin);
}
window.addEventListener('message', event => {
  const frame = $('atlas-frame').firstElementChild;
  if (!frame || event.source!==frame.contentWindow || event.origin!==location.origin) return;
  if (event.data?.type==='atlas-ready') { if(current) sendToAtlas(current.id); return; }
  const entry = catalog.get(event.data?.id);
  if (event.data?.type!=='read-item' || !entry) return;
  if (current !== entry) {
    history.pushState(null,'',href(entry));
    render();
  }
  $('headline').focus({preventScroll:true});
  $('headline').scrollIntoView({block:'start'});
});
function updateRail() {
  const chain=activeReadingChain(current);
  const sequence=chain?chain.steps.map(step=>catalog.get(step.id)):timeline;
  const index = sequence.indexOf(current);
  const year = current.source.k ?? current.year;
  const nextIndex = index>=0 ? index+1 : sequence.findIndex(e=>e.year>=year);
  const pivot = nextIndex<0 ? sequence.length : nextIndex;
  const stops = [['rail-before',sequence[index>=0?index-1:pivot-1],'← Trước'],['rail-after',sequence[pivot],'Sau →']];
  for(const [id,entry,label] of stops) {
    const link=$(id);
    link.hidden=!entry;
    if (!entry) continue;
    link.href=chain?chainHref(chain,entry.id):href(entry);
    link.toggleAttribute('data-chain-nav',Boolean(chain));
    link.innerHTML='<small>'+label+' · '+yearText(entry.year)+'</small><span>'+escapeHTML(entry.title)+'</span>';
  }
  $('year').textContent=yearText(year);
}
$('rail-list').onclick=()=>openLibrary('events');
function paragraphs(text) {
  const sentences = String(text || '').trim().split(/(?<=[.!?])\s+(?=[\p{Lu}“])/u);
  const blocks = [];
  let paragraph = '';
  for (const sentence of sentences) {
    paragraph += (paragraph ? ' ' : '') + sentence;
    if (paragraph.length >= 180) {
      blocks.push(paragraph);
      paragraph = '';
    }
  }
  if (paragraph) blocks.push(paragraph);
  return blocks.map(p=>'<p>'+escapeHTML(p)+'</p>').join('');
}
function artFigure(id) {
  const art=ART_ASSETS[id];
  return '<figure class="art-figure"><button class="art-open" data-art="'+id+'" aria-label="Phóng to '+escapeHTML(art.title)+'"><img src="'+art.src+'" alt="'+escapeHTML(art.alt)+'" loading="lazy" decoding="async"><span>Xem gần hơn ⤢</span></button><figcaption><strong>'+escapeHTML(art.title)+'</strong><span>'+escapeHTML(art.artist+' · '+art.date)+'</span><p>'+escapeHTML(art.note)+'</p><a href="'+art.url+'" target="_blank" rel="noopener">'+escapeHTML(art.license)+'</a>'+(art.licenseUrl?'<a class="map-credit" href="'+art.licenseUrl+'" target="_blank" rel="noopener">Maps courtesy FCIT · Maps ETC</a>':'')+'</figcaption></figure>';
}
function articleVisuals(item) {
  const ids=ARTICLE_ART[item.id]||[];
  if(!ids.length)return '';
  const comparison=ids[0]==='45434'||ids[0]==='436535';
  return '<section class="article-visuals" aria-label="Tác phẩm và hiện vật">'+ids.map(artFigure).join('')+
    (comparison?'<details class="art-compare"><summary>Đặt hai tác phẩm cạnh nhau</summary><p class="summary">Hai cách dựng một phong cảnh, hai chất liệu và hai thời điểm.</p><div class="art-pair">'+artFigure('45434')+artFigure('436535')+'</div><details class="art-observation"><summary>Bạn thấy nét cong được lặp lại ở đâu?</summary><p>Thử lần theo mép sóng của Hokusai, rồi nhìn những dải mây và tán bách của Van Gogh. Đây là gợi ý quan sát hai tác phẩm, không phải bằng chứng về mối liên hệ giữa chúng.</p></details></details>':'')+'</section>';
}
const artDialog=$('art-dialog');
let artOpener;
document.addEventListener('click',event=>{
  const button=event.target.closest('[data-art]');
  if(!button)return;
  artOpener=button;
  const art=ART_ASSETS[button.dataset.art];
  $('art-dialog-title').textContent=art.title;
  $('art-full').src=art.src;$('art-full').alt=art.alt;
  $('art-zoom').value=100;$('art-scale').value='100%';
  $('art-full').style.width='100%';
  $('art-description').textContent=art.artist+' · '+art.date+'. '+art.note+' '+art.credit+' · '+art.license;
  $('art-source').href=art.url;
  artDialog.showModal();
});
$('art-close').onclick=()=>artDialog.close();
artDialog.addEventListener('keydown',event=>{
  if(event.key==='Escape'){event.preventDefault();artDialog.close();}
});
$('art-zoom').oninput=()=>{
  const zoom=$('art-zoom').value;
  $('art-full').style.width=zoom+'%';$('art-scale').value=zoom+'%';
};
artDialog.addEventListener('close',()=>{$('art-full').removeAttribute('src');if(artOpener?.isConnected)artOpener.focus({preventScroll:true});});
function exploreHTML(item) {
  const year=item.source.k??item.year;
  const maps=PERIOD_MAPS.filter(map=>year>=map.start&&year<=map.end&&map.lanes.includes(item.lane));
  return '<details class="explore-details"><summary>Khám phá chi tiết</summary><div class="explore-actions"><button data-explore="timeline">Mở dòng thời gian</button>'+
    ((ARTICLE_ART[item.id]||[]).length?'<button data-art="'+ARTICLE_ART[item.id][0]+'">Xem ảnh lớn</button>':'')+
    '</div>'+maps.map(map=>'<details class="period-map"><summary>Xem bản đồ · '+escapeHTML(ART_ASSETS[map.id].title)+'</summary>'+artFigure(map.id)+'</details>').join('')+'</details>';
}
document.addEventListener('click',event=>{
  if(!event.target.closest('[data-explore="timeline"]'))return;
  displayAtlas(true);
  atlas.scrollIntoView({block:'start'});
});
function eventEffects(item) {
  const o=item.source;
  const effect=o.consequences||o.why;
  if(!effect)return '';
  return '<section class="story-effects"><h2>'+escapeHTML(o.consequencesTitle||noteTitle(item.id,'why'))+'</h2>'+paragraphs(effect)+'</section>';
}
function relatedStory(item) {
  const chain=activeReadingChain(item);
  const links=(item.source.related||[]).filter(link=>catalog.has(link.id)&&!chain?.steps.some(step=>step.id===link.id));
  if(!links.length)return '';
  return '<section class="story-connections"><h2>Đọc thêm trong dòng thời gian</h2>'+links.map(link=>{
    const target=catalog.get(link.id);
    return '<div class="story-connection"><span>'+escapeHTML(RELATION_NAMES[link.kind])+' · '+yearText(target.year)+'</span><a href="'+href(target)+'">'+escapeHTML(target.title)+' →</a>'+paragraphs(link.text)+'</div>';
  }).join('')+'</section>';
}
function articleSources(o) {
  const refs=o.refs?.length?o.refs:o.ref?[{url:o.ref,title:'Nguồn tham khảo'}]:[];
  if(!refs.length)return '';
  return '<details class="article-sources"><summary>Nguồn đối chiếu</summary><ul>'+refs.map(ref=>'<li><a href="'+escapeHTML(ref.url)+'" target="_blank" rel="noopener">'+escapeHTML(ref.title)+' ↗</a>'+(ref.scope?'<p>'+escapeHTML(ref.scope)+'</p>':'')+'</li>').join('')+'</ul></details>';
}
function readingQuestion(item) {
  const questions=surpriseQuestions.filter(q=>q.id===item.id);
  if(!questions.length)return '';
  const q=questions[Math.floor(Math.random()*questions.length)];
  return '<details class="reading-question"><summary>Thử một câu về bài này</summary><div data-reading-question="'+escapeHTML(q.key)+'"><h3>'+escapeHTML(q.ask)+'</h3>'+shuffled(q.choices.map((label,index)=>({label,index}))).map(c=>'<button type="button" class="answer" data-reading-choice="'+c.index+'">'+escapeHTML(c.label)+'</button>').join('')+'<div class="reading-feedback" role="status" aria-live="polite"></div></div></details>';
}
$('body-copy').addEventListener('click',event=>{
  const button=event.target.closest('[data-reading-choice]');
  if(!button)return;
  const block=button.closest('[data-reading-question]');
  const q=surpriseQuestions.find(q=>q.key===block.dataset.readingQuestion);
  const correct=Number(button.dataset.readingChoice)===q.correct;
  block.querySelectorAll('[data-reading-choice]').forEach(b=>{
    b.disabled=true;
    b.classList.toggle('correct',Number(b.dataset.readingChoice)===q.correct);
    b.classList.toggle('incorrect',b===button&&!correct);
  });
  block.querySelector('.reading-feedback').innerHTML='<b>'+(correct?'Đúng rồi.':'Đáp án là '+escapeHTML(q.choices[q.correct]))+'</b>'+paragraphs(q.why)+'<a href="'+escapeHTML(q.ref)+'" target="_blank" rel="noopener">Xem nguồn ↗</a>';
});
function activeReadingChain(item) {
  const id=new URLSearchParams(location.search).get('chain');
  return READING_CHAINS.find(chain=>chain.id===id&&chain.steps.some(step=>step.id===item?.id));
}
function chainHref(chain,id) {
  const url=new URL(location.href);
  if(chain)url.searchParams.set('chain',chain.id);
  else url.searchParams.delete('chain');
  url.hash=id;
  return url.href;
}
function chainSteps(chain,item) {
  return '<ol class="chain-steps">'+chain.steps.map((step,index)=>{
    const entry=catalog.get(step.id);
    const here=entry===item;
    return '<li'+(here?' aria-current="step"':'')+'><span class="chain-step-number" aria-hidden="true">'+(index+1)+'</span><div><a data-chain-nav href="'+escapeHTML(chainHref(chain,entry.id))+'"'+(here?' aria-current="page"':'')+'><time>'+yearText(entry.year)+'</time> '+escapeHTML(entry.title)+'</a><p>'+escapeHTML(step.note)+'</p><a class="chain-source" href="'+escapeHTML(step.ref)+'" target="_blank" rel="noopener">Nguồn cho mối nối ↗</a></div></li>';
  }).join('')+'</ol>';
}
function chainHTML(item) {
  const chain=activeReadingChain(item);
  if(chain){
    const index=chain.steps.findIndex(step=>step.id===item.id);
    const count=chain.steps.filter(step=>finished.has(step.id)).length;
    return '<section class="reading-chain active-chain" aria-label="Chuỗi đang đọc"><details><summary><span class="chain-label">Mốc '+(index+1)+' / '+chain.steps.length+' trong chuỗi</span><strong class="chain-title">'+escapeHTML(chain.title)+'</strong><span class="chain-hint">Xem mối nối và các mốc</span></summary><p class="chain-note">'+escapeHTML(chain.steps[index].note)+'</p><p data-chain-read-count="'+chain.id+'">'+count+' / '+chain.steps.length+' bài đã đọc</p>'+chainSteps(chain,item)+'</details><a class="chain-exit" data-chain-nav href="'+escapeHTML(chainHref(null,item.id))+'">Trở về dòng thời gian →</a></section>';
  }
  return READING_CHAINS.filter(c=>c.steps.some(step=>step.id===item.id)).map(c=>
    '<details class="reading-chain chain-offer"><summary><span class="chain-label">Đọc nối mạch · '+c.steps.length+' mốc</span><strong>'+escapeHTML(c.title)+'</strong></summary><p>'+escapeHTML(c.description)+'</p>'+chainSteps(c,item)+'<a class="chain-start" data-chain-nav href="'+escapeHTML(chainHref(c,c.steps[0].id))+'">Đọc từ mốc đầu →</a></details>').join('');
}
document.addEventListener('click',event=>{
  const link=event.target.closest('a[data-chain-nav]');
  if(!link||event.defaultPrevented||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
  event.preventDefault();
  history.pushState(null,'',link.href);
  render(true);
});
const chainMenu=document.createElement('details');
chainMenu.className='reading-chain chain-menu';
chainMenu.innerHTML='<summary>Đọc nối mạch theo một chủ đề</summary><ul>'+READING_CHAINS.map(chain=>'<li><a data-chain-nav href="'+escapeHTML(chainHref(chain,chain.steps[0].id))+'">'+escapeHTML(chain.title)+' <small>· '+chain.steps.length+' mốc</small></a></li>').join('')+'</ul>';
$('home-progress').after(chainMenu);
window.addEventListener('popstate',()=>{if(renderedURL!==location.href)render(true);});
function article(item) {
  const o = item.source;
  const body = item.kind === 'np' ? o.bio : o.d;
  const meta = [o.topic, o.date, o.place, o.role, item.kind === 'np' ? personDates(o) : '', ['pd','gb'].includes(item.kind) ? (o.ca?'Khoảng ':'')+yearText(o.s)+' – '+yearText(o.e) : ''].filter(Boolean);
  const notes = [[o.altTitle||noteTitle(item.id,'alt'),o.alt],['Liên hệ Việt Nam',o.vn],['Một dấu mốc đáng nhớ',o.act ? milestoneYear(o)+', '+o.n+' '+o.act+'.' : ''],['Cùng thời',o.same],['Bạn có biết?',o.fun]];
  return (meta.length ? '<p class="meta">'+escapeHTML(meta.join(' · '))+'</p>' : '')+
    (activeReadingChain(item)?chainHTML(item):'')+'<div class="prose">'+paragraphs(o.context)+paragraphs(body)+articleVisuals(item)+eventEffects(item)+notes.filter(([,v])=>v).map(([h,v])=>(h?'<h2>'+escapeHTML(h)+'</h2>':'')+paragraphs(v)).join('')+(item.kind==='sl' ? sliceNotes(item) : '')+(activeReadingChain(item)?'':chainHTML(item))+relatedStory(item)+highlightHTML(item)+readingQuestion(item)+storyPeople(item)+'</div>'+exploreHTML(item)+articleSources(o)+'<details id="comparison-details" class="comparison-end"><summary>Cùng thời ở những nơi khác <span>Mở đối chiếu +</span></summary><div id="world" aria-label="Đối chiếu cuối bài"></div></details>';
}
function comparisonItems(item) {
  if (item.kind === 'sl') return (item.source.ev || []).map(id=>catalog.get(id)).filter(Boolean);
  const year = item.source.k ?? item.year;
  const peers = [];
  for (const lane of LANES) {
    if (lane.id === item.lane) continue;
    const period = all.find(entry=>entry.kind==='pd' && entry.lane===lane.id && entry.source.s<=year && year<entry.source.e);
    if (period) peers.push(period);
    else {
      const nearby = events.filter(entry=>entry.lane===lane.id && Math.abs(entry.year-year)<=25).sort((a,b)=>Math.abs(a.year-year)-Math.abs(b.year-year))[0];
      if (nearby) peers.push(nearby);
    }
  }
  return peers;
}
let comparisonYear;
let comparisonLanes=['vn','eu'];
function comparisonLink(entry, detail) {
  return '<a class="place-entry" href="'+href(entry)+'"><strong>'+escapeHTML(entry.title)+'</strong>'+(detail?'<span>'+escapeHTML(detail)+'</span>':'')+'</a>';
}
function placeData(lane) {
  const year=comparisonYear;
  const active=all.filter(e=>e.kind==='pd'&&e.lane===lane&&e.source.s<=year&&year<=e.source.e).sort((a,b)=>Number(b.source.g==='a')-Number(a.source.g==='a')||b.source.s-a.source.s);
  const exact=events.filter(e=>e.lane===lane&&e.year===year);
  const near=events.filter(e=>e.lane===lane&&e.year!==year&&Math.abs(e.year-year)<=25)
    .sort((a,b)=>Math.abs(a.year-year)-Math.abs(b.year-year)).slice(0,2);
  const people=all.filter(e=>e.kind==='np'&&e.lane===lane&&e.year<=year&&(e.source.d??Infinity)>=year)
    .sort((a,b)=>Math.abs(a.source.k-year)-Math.abs(b.source.k-year)).slice(0,3);
  return {lane,name:regions.get(lane),year,active,exact,near,people};
}
function placeCard(lane) {
  const {year,active,exact,near,people}=placeData(lane);
  const background=active.length ? active.map(e=>comparisonLink(e,yearText(e.source.s)+' – '+yearText(e.source.e))).join('')+'<p class="place-background">'+escapeHTML(active[0].source.d)+'</p>' : '<p class="comparison-empty">Chưa có thời kỳ trong dữ liệu.</p>';
  const landmarks=exact.length ? exact.map(e=>comparisonLink(e,(e.source.ca?'Niên đại xấp xỉ · ':'')+(e.source.date||yearText(e.year)))).join('') : '<p class="comparison-empty">Chưa có mốc được ghi ở năm này.</p>';
  const neighbours=near.map(e=>{
    const delta=Math.abs(e.year-year)-(Math.min(e.year,year)<0&&Math.max(e.year,year)>0?1:0);
    return comparisonLink(e,yearText(e.year)+' · '+delta+' năm '+(e.year<year?'trước':'sau'));
  }).join('');
  const faces=people.length?people.map(e=>comparisonLink(e,personAge(e.source,year)+' · '+e.source.role)).join(''):'<p class="comparison-empty">Chưa có hồ sơ nhân vật ở mốc này.</p>';
  return '<section class="place-card" aria-label="'+escapeHTML(regions.get(lane))+' năm '+yearText(year)+'"><h3>'+escapeHTML(regions.get(lane))+'</h3><div class="place-section"><h4>Bối cảnh</h4>'+background+'</div><div class="place-section"><h4>Mốc tại năm '+yearText(year)+'</h4>'+landmarks+'</div><div class="place-section"><h4>Nhân vật cùng thời</h4>'+faces+'</div>'+(neighbours?'<details class="nearby-events"><summary>Mốc gần đó</summary>'+neighbours+'</details>':'')+'</section>';
}
function updateComparison() {
  $('comparison-heading').textContent='Cùng lúc ấy, nhìn sang những nơi khác';
  $('comparison-cards').innerHTML=comparisonLanes.map(placeCard).join('');
  $('comparison-cards').classList.toggle('three-places',comparisonLanes.length===3);
  $('add-place').hidden=comparisonLanes.length===3;
  $('remove-place').hidden=comparisonLanes.length===2;
  document.querySelectorAll('[data-place-select]').forEach(select=>{
    const index=Number(select.dataset.placeSelect);
    select.value=comparisonLanes[index];
    for(const option of select.options)option.disabled=comparisonLanes.includes(option.value)&&option.value!==comparisonLanes[index];
  });
  $('comparison-year').value=comparisonYear;
  $('comparison-reset').hidden=comparisonYear===(current.source.k??current.year);
  mountComparisonUI();
}
function drawPlaceControls() {
  $('place-controls').innerHTML=comparisonLanes.map((lane,index)=>'<label>Nơi '+(index+1)+'<select data-place-select="'+index+'">'+LANES.map(l=>'<option value="'+l.id+'">'+escapeHTML(l.name)+'</option>').join('')+'</select></label>').join('');
  document.querySelectorAll('[data-place-select]').forEach(select=>select.onchange=()=>{
    comparisonLanes[Number(select.dataset.placeSelect)]=select.value;
    updateComparison();
  });
  updateComparison();
}
let nativeComparisonLoading=false;
function mountComparisonUI() {
  const host=$('comparison-native-root');
  const details=$('comparison-details');
  if(!host||!details?.open)return;
  if(!window.mountNativeComparison){
    if(!nativeComparisonLoading){
      nativeComparisonLoading=true;
      const script=document.createElement('script');
      script.src='comparison-native.js?v=audit-life-1';
      script.onerror=()=>{nativeComparisonLoading=false;script.remove();};
      document.head.append(script);
    }
    return;
  }
  window.mountNativeComparison(host,{
    year:comparisonYear,currentYear:current.source.k??current.year,
    lanes:comparisonLanes,regions:LANES,cards:comparisonLanes.map(placeData),
    onYear:year=>{comparisonYear=year;updateComparison();},
    onLanes:lanes=>{comparisonLanes=lanes;drawPlaceControls();},
    onRead:id=>{location.hash=href(catalog.get(id));},
    onReady:()=>{if($('comparison-fallback'))$('comparison-fallback').hidden=true;}
  });
}
window.addEventListener('native-comparison-ready',mountComparisonUI);
function showWorld() {
  window.unmountNativeComparison?.();
  comparisonYear=current.source.k??current.year;
  $('world').innerHTML='<div id="comparison-native-root"></div><div id="comparison-fallback"><h2 id="comparison-heading"></h2><p class="summary">Đặt các nơi cạnh nhau để xem bối cảnh, những mốc được ghi ở năm này và các nhân vật cùng thời.</p><form id="comparison-year-form" class="comparison-toolbar"><label>Năm <input id="comparison-year" type="number" min="-3500" max="2026" step="1" required aria-describedby="year-tip"></label><button type="submit">Đối chiếu</button><button type="button" id="comparison-reset">Về năm của bài</button><small id="year-tip">Nhập số âm cho năm trước Công nguyên. Không có năm 0.</small></form><div id="place-controls"></div><div class="place-count"><button id="add-place">+ Thêm nơi thứ ba</button><button id="remove-place" hidden>− Còn hai nơi</button></div><div id="comparison-cards"></div><p class="comparison-footnote">Các cột dùng chung một năm. “Mốc gần đó” ghi rõ khoảng cách thời gian. Bấm một mục để đọc ngay trong hành trình.</p></div>';
  $('comparison-year-form').onsubmit=event=>{
    event.preventDefault();
    const input=$('comparison-year');
    input.setCustomValidity(Number(input.value)===0?'Lịch sử không có năm 0. Hãy nhập -1 hoặc 1.':'');
    if(!input.reportValidity())return;
    comparisonYear=Number(input.value);updateComparison();
  };
  $('comparison-year').oninput=()=> $('comparison-year').setCustomValidity('');
  $('comparison-reset').onclick=()=>{comparisonYear=current.source.k??current.year;updateComparison();};
  $('add-place').onclick=()=>{comparisonLanes.push(LANES.find(l=>!comparisonLanes.includes(l.id)).id);drawPlaceControls();};
  $('remove-place').onclick=()=>{comparisonLanes.pop();drawPlaceControls();};
  drawPlaceControls();
  $('comparison-details').ontoggle=()=>{if($('comparison-details').open)mountComparisonUI();};
}
let renderedURL='';
function render(focus = false) {
  let id;
  try { id=decodeURIComponent(location.hash.slice(1)); } catch { id=''; }
  current = catalog.get(id);
  const requestedHighlight = current?.kind==='sl' ? current.id : null;
  if(requestedHighlight && sliceAnchors.has(requestedHighlight)) {
    current=sliceAnchors.get(requestedHighlight);
    history.replaceState(null,'',href(current));
  }
  if(new URLSearchParams(location.search).has('chain')&&!activeReadingChain(current)){
    history.replaceState(null,'',chainHref(null,current?.id||''));
  }
  renderedURL=location.href;
  if(artDialog.open)artDialog.close();
  if (!current && !atlas.hidden) displayAtlas(false);
  refreshProgress();
  $('intro').hidden = Boolean(current);
  $('reader-layout').hidden = $('article-pager').hidden = !current;
  $('skip').href = current ? '#story' : '#intro';
  if (!current) {
    document.title = 'Lịch Sử Song Hành';
    if (focus) { $('intro').focus({preventScroll:true}); window.scrollTo(0,0); }
    return;
  }
  const activeChain=activeReadingChain(current);
  const sequence = activeChain?activeChain.steps.map(step=>catalog.get(step.id)):timeline;
  const itemIndex=sequence.indexOf(current);
  const nextIndex=sequence.findIndex(e=>e.year>=(current.source.k??current.year));
  const index=itemIndex>=0?itemIndex:Math.max(0,(nextIndex<0?sequence.length:nextIndex)-1);
  const inTimeline = eventIds.has(current.id);
  $('next').querySelector('b').textContent = activeChain?(index===sequence.length-1?'Đã đọc · Kết thúc chuỗi':'Đã đọc · Mốc tiếp trong chuỗi'):inTimeline ? 'Đã đọc · tiếp' : 'Mốc tiếp';
  $('next').onclick = event => {
    if (inTimeline && (activeChain||index < sequence.length-1) && !finished.has(current.id) && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) markRead();
  };
  $('series').textContent = [labels[current.kind],regions.get(current.lane)].filter(Boolean).join(' · ');
  $('number').textContent = String(index+1).padStart(2,'0')+' / '+String(sequence.length).padStart(2,'0')+(activeChain?' · trong chuỗi':'');
  updateRail();
  sendToAtlas(current.id);
  $('headline').textContent = current.title;
  $('body-copy').innerHTML = article(current);
  if(requestedHighlight) {
    const highlight=$('highlight-'+requestedHighlight);
    if(highlight)highlight.open=true;
  }
  for (const [name,entry] of [['prev',sequence[index-1]],['next',sequence[index+1]]]) {
    $(name).toggleAttribute('data-chain-nav',Boolean(activeChain));
    if (entry) { $(name).href=activeChain?chainHref(activeChain,entry.id):href(entry); $(name).setAttribute('aria-label',(name==='next'?(inTimeline?'Đánh dấu đã đọc và đến':'Mốc tiếp'):'Mốc trước')+' · '+entry.title); }
    else if(name==='next'&&activeChain) {$(name).href=chainHref(null,current.id);$(name).setAttribute('aria-label','Đánh dấu đã đọc và kết thúc chuỗi');}
    else $(name).removeAttribute('href');
  }
  for (const link of document.querySelectorAll('[data-atlas]')) link.href='dong-thoi-gian.html'+href(current);
  document.title=current.title+' · Lịch Sử Song Hành';
  $('challenge').replaceChildren();
  selectPanel('read');

  if (focus) { $('story').focus({preventScroll:true}); window.scrollTo(0,0); }
}
let catalogMode = "search";
let unreadOnly = false;
function results() {
  const tokens=fold($('search').value.trim()).split(/\s+/).filter(Boolean);
  const kind=$('kind').value;
  const source = catalogMode === "events" ? timeline : all;
  const bounds = $('era-range').value.split(',').map(Number);
  const topic=$('topic-filter').value;
  const matches=source.filter(entry=>(!topic || entry.source.topic===topic || (topic==='cul' && entry.source.c==='cul')) && (bounds.length!==2 || (entry.year>=bounds[0] && entry.year<=bounds[1])) && (!unreadOnly || !finished.has(entry.id)) && (!kind || entry.kind===kind || (kind==='ev' && entry.kind==='gb')) && tokens.every(t=>entry.search.includes(t)));
  const visible=matches.slice(0,limit);
  $('status').textContent=matches.length ? matches.length+' mục' : 'Chưa tìm thấy. Thử tên ngắn hơn hoặc một năm.';
  $('results').innerHTML=visible.map(entry=>'<a class="result" href="'+href(entry)+'" '+(entry===current?'aria-current="page"':'')+'><time>'+escapeHTML(yearText(entry.year))+'</time><div><strong>'+escapeHTML(entry.title)+'</strong><small>'+escapeHTML([labels[entry.kind],regions.get(entry.lane),finished.has(entry.id)?'✓ Đã đọc':''].filter(Boolean).join(' · '))+'</small></div><span aria-hidden="true">›</span></a>').join('')+(visible.length<matches.length?'<button class="more" id="more">Xem thêm kết quả ↓</button>':'');
}
function openLibrary(mode) {
  catalogMode=mode;
  unreadOnly=false;
  const contents=mode==='slices', isEvents=mode==='events';
  $('dialog-title').textContent=contents?'Mục lục lát cắt':isEvents?'Toàn bộ dòng sự kiện':'Tra cứu lịch sử';
  $('search').value=''; $('kind').value=contents?'sl':'';
  $('kind').hidden=contents || isEvents;
  $('search').placeholder=contents?'Tìm lát cắt hoặc năm…':'Tìm tên hoặc năm…';
  $('era-field').hidden=!isEvents;
  $('era-range').value='';
  $('topic-filter').value='';
  $('topic-field').hidden=contents;
  $('only-unread').hidden=!isEvents;
  $('only-unread').setAttribute('aria-pressed','false');
  $('catalog-events').setAttribute('aria-pressed',String(isEvents));
  $('catalog-slices').setAttribute('aria-pressed',String(contents));
  limit=isEvents ? Math.max(50,timeline.indexOf(current)+10) : 50; results();
  if (!library.open) library.showModal();
  $('results').scrollTop=0;
  if (mode==='search') $('search').focus();
  else { $('close').focus(); $('results').querySelector('[aria-current]')?.scrollIntoView({block:'nearest'}); }
}
$('lookup').onclick=()=>openLibrary('search');
$('contents').onclick=()=>openLibrary('events');
$('contents-side').onclick=$('catalog-slices').onclick=()=>openLibrary('events');
$('events-side').onclick=$('catalog-events').onclick=()=>openLibrary('events');
$('only-unread').onclick=()=>{
  unreadOnly=!unreadOnly;
  $('only-unread').setAttribute('aria-pressed',String(unreadOnly));
  limit=50;results();$('results').scrollTop=0;
};
$('skip').onclick=e=>{e.preventDefault();$(current ? 'story' : 'intro').focus()};
$('close').onclick=()=>library.close();
library.onclick=e=>{if(e.target===library){const r=library.getBoundingClientRect();if(e.clientX<r.left || e.clientX>r.right || e.clientY<r.top || e.clientY>r.bottom)library.close();}};
$('results').onclick=e=>{
  if(e.target.closest('.result')) {library.close(); if(e.target.closest('.result').hash===location.hash)render(true);}
  if(e.target.closest('#more')) {const count=limit;limit+=50;results();$('results').children[count]?.focus();}
};
$('topic-filter').onchange=$('era-range').onchange=$('search').oninput=$('kind').onchange=()=>{limit=50;results();$('results').scrollTop=0};
window.addEventListener('hashchange',()=>{if(renderedURL!==location.href)render(true);});
render();
