'use strict';
const $ = id => document.getElementById(id);
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const yearText = year => year < 0 ? Math.abs(year) + ' TCN' : String(year);
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
  return (highlights.get(item.id)||[]).map(slice=>'<details class="event-highlight" id="highlight-'+slice.id+'"><summary><span class="edition">Nhìn rộng ra</span><strong>'+escapeHTML(slice.title)+'</strong><span class="expand-hint">Mở câu chuyện cùng thời +</span></summary><div class="highlight-copy">'+paragraphs(slice.source.d)+'<div class="highlight-events">'+(slice.source.ev||[]).filter(id=>id!==item.id&&catalog.has(id)).map(id=>'<a href="'+href(catalog.get(id))+'">'+escapeHTML(catalog.get(id).title)+' →</a>').join('')+'</div></div></details>').join('');
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
    return '<section class="story-note"><h2>'+escapeHTML(noteTitle(entry.id,field))+'</h2>'+
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
  const age=year-p.b-(p.b<0&&year>0?1:0);
  const uncertain=p.cb || p.cd;
  const difference=p.k-year;
  const action = difference===0 ? 'Ngay năm này, ' : difference>0 ? difference+' năm sau, ' : -difference+' năm trước, ';
  return '<div class="person-scene"><a class="person-bio-link" href="'+href(entry)+'"><span class="scene-age">'+'Khoảng '+age+' tuổi · '+escapeHTML(regions.get(entry.lane))+'</span>'+
    '<strong>'+escapeHTML(entry.title)+'</strong><span>'+escapeHTML(p.role)+'</span>'+
    '<p>'+escapeHTML(action+p.n+' '+p.act+'.')+'</p><small>'+yearText(p.b)+' — '+(p.d==null?'nay':yearText(p.d))+' · Tìm hiểu thêm →</small></a>'+personTrail(entry,year)+'</div>';
}
function storyPeople(item) {
  if(item.kind==='np')return '';
  const people=peopleAt(item).slice(0,3);
  const year=item.source.k??item.year;
  return people.length ? '<section class="people-in-story"><h2>Những nhân vật cùng thời</h2><p class="summary">Vào năm '+yearText(year)+'</p>'+people.map(e=>lifeScene(e,year)).join('')+'</section>' : '';
}
function showPeople() {
  const year=current.source.k??current.year, alive=peopleAt(current);
  $('portraits').innerHTML='<h2>Đang sống vào năm '+yearText(year)+'</h2>'+
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
  const index = timeline.indexOf(current);
  const year = current.source.k ?? current.year;
  const nextIndex = index>=0 ? index+1 : timeline.findIndex(e=>e.year>=year);
  const pivot = nextIndex<0 ? timeline.length : nextIndex;
  const stops = [['rail-before',timeline[index>=0?index-1:pivot-1],'← Trước'],['rail-after',timeline[pivot],'Sau →']];
  for(const [id,entry,label] of stops) {
    const link=$(id);
    link.hidden=!entry;
    if (!entry) continue;
    link.href=href(entry);
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
function article(item) {
  const o = item.source;
  const body = item.kind === 'np' ? o.bio : o.d;
  const meta = [o.topic, o.date, o.place, o.role, item.kind === 'np' ? yearText(o.b)+' – '+(o.d == null ? 'nay' : yearText(o.d)) : '', ['pd','gb'].includes(item.kind) ? yearText(o.s)+' – '+yearText(o.e) : ''].filter(Boolean);
  const notes = [[noteTitle(item.id,'why'),o.why],[noteTitle(item.id,'alt'),o.alt],['Liên hệ Việt Nam',o.vn],['Một dấu mốc đáng nhớ',o.act ? 'Năm '+yearText(o.k)+', '+o.n+' '+o.act+'.' : ''],['Cùng thời',o.same],['Bạn có biết?',o.fun]];
  return (meta.length ? '<p class="meta">'+escapeHTML(meta.join(' · '))+'</p>' : '')+
    '<div class="prose">'+paragraphs(body)+articleVisuals(item)+notes.filter(([,v])=>v).map(([h,v])=>'<h2>'+h+'</h2>'+paragraphs(v)).join('')+(item.kind==='sl' ? sliceNotes(item) : '')+highlightHTML(item)+storyPeople(item)+'</div>'+exploreHTML(item)+(o.ref ? '<a class="note-source" href="'+escapeHTML(o.ref)+'" target="_blank" rel="noopener">Nguồn tham khảo ↗</a>' : '')+'<details id="comparison-details" class="comparison-end"><summary>Cùng thời ở những nơi khác <span>Mở đối chiếu +</span></summary><div id="world" aria-label="Đối chiếu cuối bài"></div></details>';
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
  const faces=people.length?people.map(e=>comparisonLink(e,'Khoảng '+(year-e.year-(e.year<0&&year>0?1:0))+' tuổi · '+e.source.role)).join(''):'<p class="comparison-empty">Chưa có hồ sơ nhân vật ở mốc này.</p>';
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
      script.src='comparison-native.js?v=native-2';
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
function render(focus = false) {
  let id;
  try { id=decodeURIComponent(location.hash.slice(1)); } catch { id=''; }
  current = catalog.get(id);
  const requestedHighlight = current?.kind==='sl' ? current.id : null;
  if(requestedHighlight && sliceAnchors.has(requestedHighlight)) {
    current=sliceAnchors.get(requestedHighlight);
    history.replaceState(null,'',href(current));
  }
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
  const sequence = timeline;
  const itemIndex=sequence.indexOf(current);
  const nextIndex=sequence.findIndex(e=>e.year>=(current.source.k??current.year));
  const index=itemIndex>=0?itemIndex:Math.max(0,(nextIndex<0?sequence.length:nextIndex)-1);
  const inTimeline = eventIds.has(current.id);
  $('next').querySelector('b').textContent = inTimeline ? 'Đã đọc · tiếp' : 'Mốc tiếp';
  $('next').onclick = event => {
    if (inTimeline && index < sequence.length-1 && !finished.has(current.id) && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) markRead();
  };
  $('series').textContent = [labels[current.kind],regions.get(current.lane)].filter(Boolean).join(' · ');
  $('number').textContent = String(index+1).padStart(2,'0')+' / '+String(sequence.length).padStart(2,'0');
  updateRail();
  sendToAtlas(current.id);
  $('headline').textContent = current.title;
  $('body-copy').innerHTML = article(current);
  if(requestedHighlight) {
    const highlight=$('highlight-'+requestedHighlight);
    if(highlight)highlight.open=true;
  }
  for (const [name,entry] of [['prev',sequence[index-1]],['next',sequence[index+1]]]) {
    if (entry) { $(name).href=href(entry); $(name).setAttribute('aria-label',(name==='next'?(inTimeline?'Đánh dấu đã đọc và đến':'Mốc tiếp'):'Mốc trước')+' · '+entry.title); }
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
window.addEventListener('hashchange',()=>render(true));
render();
