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
  $('resume-events').href = href(next || timeline[0]);
  $('resume-events').textContent = !next ? 'Đọc lại từ đầu →' : finished.size ? 'Đọc tiếp theo dòng thời gian →' : 'Đọc theo dòng thời gian →';
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
function lifeScene(entry, year) {
  const p=entry.source;
  const age=year-p.b-(p.b<0&&year>0?1:0);
  const uncertain=p.cb || p.cd;
  const difference=p.k-year;
  const action = difference===0 ? 'Ngay năm này, ' : difference>0 ? difference+' năm sau, ' : -difference+' năm trước, ';
  return '<a class="person-scene" href="'+href(entry)+'"><span class="scene-age">'+(uncertain?'Khoảng ':'')+age+' tuổi · '+escapeHTML(regions.get(entry.lane))+'</span>'+
    '<strong>'+escapeHTML(entry.title)+'</strong><span>'+escapeHTML(p.role)+'</span>'+
    '<p>'+escapeHTML(action+p.n+' '+p.act+'.')+'</p><small>'+yearText(p.b)+' — '+(p.d==null?'nay':yearText(p.d))+' · Tìm hiểu thêm →</small></a>';
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
  {ask:'Trước thời Mario, Nintendo bán thứ gì?', choices:['Bài hanafuda','Máy nghe nhạc','Truyện tranh'], correct:0, why:'Nintendo làm bài hanafuda ở Kyoto từ năm 1889. Trò chơi điện tử đến sau rất nhiều thập kỷ.', id:'culture-nintendo-1889', ref:'https://www.nintendo.com/us/about/'},
  {ask:'Hai bản Pokémon ra mắt đầu tiên ở Nhật có màu gì?', choices:['Đỏ và xanh lá','Đỏ và xanh dương','Vàng và bạc'], correct:0, why:'Đó là Red và Green, phát hành ngày 27/2/1996. Red và Blue quen thuộc với nhiều người chơi quốc tế thuộc đợt phát hành sau.', id:'culture-pokemon-1996', ref:'https://www.pokemon.co.jp/game/other/gb-rg/'},
  {ask:'Năm 1937 có phải lúc thế giới lần đầu có phim hoạt hình dài?', choices:['Không, đó là mốc phim dài đầu tiên của Disney','Đúng, mọi phim hoạt hình trước đó đều ngắn','Đó là năm hoạt hình máy tính xuất hiện'], correct:0, why:'Bạch Tuyết là phim hoạt hình dài đầu tiên của Disney. Không thể biến một cột mốc của hãng thành cột mốc đầu tiên của toàn thế giới.', id:'culture-snow-white-1937', ref:'https://d23.com/disney-history/'},
  {ask:'Toy Story có gì đặc biệt trong lịch sử hoạt hình?', choices:['Phim truyện dài đầu tiên hoàn toàn bằng hoạt hình máy tính','Phim đầu tiên dùng bất kỳ hình ảnh máy tính nào','Phim hoạt hình dài đầu tiên của thế giới'], correct:0, why:'Pixar xác định cột mốc năm 1995 là phim dài hoàn toàn bằng hoạt hình máy tính. Hình ảnh máy tính và phim hoạt hình dài đều đã có lịch sử trước đó.', id:'culture-toy-story-1995', ref:'https://www.pixar.com/our-story'},
  {ask:'Ca trù và Quan họ cùng được ghi danh năm 2009. Chúng vào cùng một danh sách UNESCO?', choices:['Không, Ca trù vào danh sách cần bảo vệ khẩn cấp','Có, mọi di sản phi vật thể ở cùng một danh sách','Ca trù chưa từng được ghi danh'], correct:0, why:'Ca trù vào danh sách cần bảo vệ khẩn cấp. Quan họ vào Danh sách đại diện. Hai cách ghi danh thể hiện mục đích bảo vệ khác nhau.', id:'culture-ca-tru-2009', ref:'https://ich.unesco.org/en/USL/ca-tru-singing-00309?USL=00309'},
  {ask:'Jikji năm 1377 ở Pháp là cả bộ sách còn nguyên vẹn?', choices:['Chỉ còn quyển hai của bản in chữ kim loại','Là cả bộ, còn đủ hai quyển','Là bản chép tay của Gutenberg'], correct:0, why:'BnF lưu quyển hai của bản in chữ kim loại năm 1377. Bản khắc gỗ đầy đủ năm 1378 ở Hàn Quốc là một ấn bản khác.', id:'ea-jikji-1377', ref:'https://www.bnf.fr/en/jikji-treasure-world-printing'},
  {ask:'Giải Nobel Vật lý mang niên hiệu 1921 của Einstein được quyết định trao năm nào?', choices:['1922','1921','1905'], correct:0, why:'Hồ sơ Nobel ghi niên hiệu giải là 1921 nhưng ngày công bố quyết định là 9/11/1922. Niên hiệu giải và năm công bố không phải lúc nào cũng trùng nhau.', id:'eu-einstein-1905', ref:'https://www.nobelprize.org/prizes/physics/1921/einstein/facts/'},
  {ask:'Khi xây xong các kim tự tháp Giza, voi ma mút đã tuyệt chủng hết chưa?', choices:['Chưa, một quần thể còn sống trên đảo Wrangel','Đã tuyệt chủng hết từ rất lâu','Voi ma mút chỉ xuất hiện sau thời La Mã'], correct:0, why:'Theo các bảo tàng tự nhiên, voi ma mút ở Wrangel còn tồn tại tới khoảng 4.000 năm trước, muộn hơn thời xây các kim tự tháp Giza. Không phải mọi quần thể tuyệt chủng cùng lúc.', id:'wa-kim-tu-thap-giza-2560tcn', ref:'https://www.nhm.ac.uk/discover/were-all-mammoths-woolly.html'},
  {ask:'Ghi “Oxford thành lập chính xác năm 1096” có ổn không?', choices:['Chưa chính xác: chỉ biết đã có giảng dạy vào năm ấy','Chính xác tuyệt đối, có ngày khai giảng rõ ràng','Không, Oxford chỉ xuất hiện ở thế kỷ XX'], correct:0, why:'Oxford cho biết không có ngày thành lập rõ ràng. Hoạt động giảng dạy đã tồn tại dưới một hình thức nào đó vào năm 1096.', id:'culture-oxford-1096', ref:'https://www.ox.ac.uk/about/the-university/history'},
  {ask:'Một tỷ lượt xem của Gangnam Style là mốc nào?', choices:['Một kỷ lục đạt sau ngày video ra mắt','Ngày ca khúc lần đầu được sáng tác','Ngày YouTube bắt đầu hoạt động'], correct:0, why:'Video ra mắt tháng 7/2012, còn mốc một tỷ lượt xem đạt ngày 21/12/2012. Sự ra đời và sự lan truyền của một tác phẩm là hai câu chuyện khác nhau.', id:'culture-gangnam-2012', ref:'https://blog.youtube/creator-and-artist-stories/10-years-of-youtubes-billion-views-club-psy-gangnam-style/'}
];
let quizDeck=[];
function shuffled(items) {
  const copy=items.slice();
  for(let i=copy.length-1;i>0;i--) { const j=Math.floor(Math.random()*(i+1)); [copy[i],copy[j]]=[copy[j],copy[i]]; }
  return copy;
}
function newQuestion() {
  if (!quizDeck.length) quizDeck=shuffled(surpriseQuestions);
  const q=quizDeck.pop();
  const choices=shuffled(q.choices.map((label,index)=>({label,index})));
  $('challenge').innerHTML='<p class="edition">Một chuyện dễ bất ngờ</p><h2>'+escapeHTML(q.ask)+'</h2>'+
    choices.map((c,i)=>'<button class="answer" data-answer="'+i+'">'+escapeHTML(c.label)+'</button>').join('')+
    '<div id="quiz-feedback" role="status"></div>';
  $('challenge').querySelectorAll('.answer').forEach(button=>button.onclick=()=>{
    const pick=choices[Number(button.dataset.answer)];
    $('challenge').querySelectorAll('.answer').forEach(btn=>{btn.disabled=true;btn.classList.toggle('correct',choices[Number(btn.dataset.answer)].index===q.correct);});
    $('quiz-feedback').innerHTML='<b>'+(pick.index===q.correct?'Đúng rồi.':'Đáp án là '+escapeHTML(q.choices[q.correct]))+'</b><p>'+escapeHTML(q.why)+'</p>'+
      '<a class="answer-date" href="#'+q.id+'">Đọc câu chuyện →</a><a class="note-source" href="'+q.ref+'" target="_blank" rel="noopener">Đối chiếu nguồn ↗</a><button class="secondary-path" id="another">Thử chuyện tiếp →</button>';
    $('another').onclick=newQuestion;
  });
}
const panels = {read:'body-copy', compare:'world', people:'portraits', play:'challenge'};
function selectPanel(name) {
  for (const [button,section] of Object.entries(panels)) {
    $(button).setAttribute('aria-pressed', String(name===button));
    $(section).hidden = name!==button;
  }
  if (name==='compare' || name==='read') {
    showWorld();
    $('world').hidden=false;
    $('world').insertAdjacentHTML('afterbegin','<h2>Cùng lúc ấy ở nơi khác</h2>');
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
  return '<figure class="art-figure"><button class="art-open" data-art="'+id+'" aria-label="Phóng to '+escapeHTML(art.title)+'"><img src="'+art.src+'" alt="'+escapeHTML(art.alt)+'" loading="lazy" decoding="async"><span>Xem gần hơn ⤢</span></button><figcaption><strong>'+escapeHTML(art.title)+'</strong><span>'+escapeHTML(art.artist+' · '+art.date)+'</span><p>'+escapeHTML(art.note)+'</p><a href="'+art.url+'" target="_blank" rel="noopener">'+escapeHTML(art.license)+'</a></figcaption></figure>';
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
function article(item) {
  const o = item.source;
  const body = item.kind === 'np' ? o.bio : o.d;
  const meta = [o.topic, o.date, o.place, o.role, item.kind === 'np' ? yearText(o.b)+' – '+(o.d == null ? 'nay' : yearText(o.d)) : '', ['pd','gb'].includes(item.kind) ? yearText(o.s)+' – '+yearText(o.e) : ''].filter(Boolean);
  const notes = [[noteTitle(item.id,'why'),o.why],[noteTitle(item.id,'alt'),o.alt],['Liên hệ Việt Nam',o.vn],['Một dấu mốc đáng nhớ',o.act ? 'Năm '+yearText(o.k)+', '+o.n+' '+o.act+'.' : ''],['Cùng thời',o.same],['Bạn có biết?',o.fun]];
  return (meta.length ? '<p class="meta">'+escapeHTML(meta.join(' · '))+'</p>' : '')+
    '<div class="prose">'+paragraphs(body)+articleVisuals(item)+highlightHTML(item)+storyPeople(item)+(item.kind==='sl' ? sliceNotes(item) : '')+notes.filter(([,v])=>v).map(([h,v])=>'<h2>'+h+'</h2>'+paragraphs(v)).join('')+'</div>'+(o.ref ? '<a class="note-source" href="'+escapeHTML(o.ref)+'" target="_blank" rel="noopener">Nguồn tham khảo ↗</a>' : '');
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
function comparisonRows() {
  const lane = $('region').value;
  const rows = comparisons.filter(item=>!lane || lane===item.lane);
  $('comparison-list').innerHTML = rows.map(item=>'<section class="compare-row"><div class="caption">'+escapeHTML(regions.get(item.lane))+' · '+escapeHTML(yearText(item.year)+(item.kind==='pd'?' – '+yearText(item.source.e):''))+'</div><h3>'+escapeHTML(item.title)+'</h3><p>'+escapeHTML(item.source.d || item.source.bio)+'</p><a href="'+href(item)+'">Đọc bài riêng →</a></section>').join('') || '<p>Chưa có mục cùng thời cho mốc này.</p>';
}
function showWorld() {
  comparisons = comparisonItems(current);
  const ids = new Set(comparisons.map(entry=>entry.lane));
  $('world').innerHTML = '<p class="summary">'+(current.kind==='sl'?'Các sự kiện được nhắc đến trong lát cắt này.':'Các thời kỳ đang diễn ra hoặc sự kiện gần năm '+yearText(current.source.k ?? current.year)+'.')+'</p><div class="world-filter"><label for="region">Khu vực</label><select id="region"><option value="">Tất cả khu vực</option>'+LANES.filter(l=>ids.has(l.id)).map(l=>'<option value="'+l.id+'">'+escapeHTML(l.name)+'</option>').join('')+'</select></div><div id="comparison-list"></div>';
  $('region').onchange = comparisonRows;
  comparisonRows();
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
$('discover-culture').onclick=()=>{
  openLibrary('events');
  $('topic-filter').value='cul';
  results();
};
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
