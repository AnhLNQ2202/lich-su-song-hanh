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
  const count = finished.size + ' / ' + timeline.length + ' sự kiện đã đọc';
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
    '<p>'+escapeHTML(action+p.n+' '+p.act+'.')+'</p><small>'+yearText(p.b)+' — '+(p.d==null?'nay':yearText(p.d))+' · Đọc cuộc đời →</small></a>';
}
function storyPeople(item) {
  if(item.kind==='np')return '';
  const people=peopleAt(item).slice(0,3);
  const year=item.source.k??item.year;
  return people.length ? '<section class="people-in-story"><h2>Những cuộc đời ở năm '+yearText(year)+'</h2>'+people.map(e=>lifeScene(e,year)).join('')+'</section>' : '';
}
function showPeople() {
  const year=current.source.k??current.year, alive=peopleAt(current);
  $('portraits').innerHTML='<h2>Đang sống vào năm '+yearText(year)+'</h2>'+
    (alive.length?alive.map(e=>lifeScene(e,year)).join(''):'<p>Thư viện chưa có tiểu sử ở mốc này.</p>')+
    '<button class="secondary-path" id="all-people">Tra cứu mọi nhân vật →</button>';
  $('all-people').onclick=()=>{openLibrary('search');$('kind').value='np';results();};
}
let quizTopic='all', quizTurn=0, lastQuizId='';
function shuffled(items) {
  const copy=items.slice();
  for(let i=copy.length-1;i>0;i--) { const j=Math.floor(Math.random()*(i+1)); [copy[i],copy[j]]=[copy[j],copy[i]]; }
  return copy;
}
function newQuestion() {
  const eligible=all.filter(e=>(e.kind==='ev'||e.kind==='np') &&
    (quizTopic==='all' || quizTopic===e.kind || e.source.c===quizTopic || e.source.topic===quizTopic));
  const near=eligible.filter(e=>e.id!==lastQuizId).sort((a,b)=>
    Math.abs((a.source.k??a.year)-(current.source.k??current.year))-Math.abs((b.source.k??b.year)-(current.source.k??current.year))).slice(0,35);
  const entry=shuffled(near)[0]||eligible[0];
  lastQuizId=entry.id;
  const o=entry.source;
  const mode=quizTurn++%4;
  let ask, right, alternatives, explanation;
  if(entry.kind==='np' && mode%2===0) {
    ask='Ai có vai trò này?';
    explanation=o.role;
    right=entry.title;
    alternatives=all.filter(e=>e.kind==='np'&&e.id!==entry.id).map(e=>e.title);
  } else if(entry.kind==='np') {
    ask=entry.title+' gắn với dấu mốc nào sau đây?';
    right='Năm '+yearText(o.k)+': '+o.act;
    alternatives=all.filter(e=>e.kind==='np'&&e.id!==entry.id&&e.source.act).map(e=>'Năm '+yearText(e.source.k)+': '+e.source.act);
    explanation=entry.title+' '+o.act+' vào năm '+yearText(o.k)+'.';
  } else if(mode===0) {
    ask='Sự kiện nào được ghi nhận ở năm '+yearText(entry.year)+'?';
    right=entry.title;
    alternatives=events.filter(e=>e.year!==entry.year&&e.id!==entry.id).map(e=>e.title);
    explanation=entry.title+' · '+(o.date||yearText(entry.year));
  } else if(mode===1) {
    ask='Sự kiện này thuộc khu vực nào trên dòng thời gian?';
    right=regions.get(entry.lane);
    alternatives=LANES.filter(l=>l.id!==entry.lane).map(l=>l.name);
    explanation=entry.title+' được xếp trong khu vực '+right+'.';
  } else if(mode===2) {
    ask='Sự kiện này diễn ra vào thế kỷ nào?';
    const century=y=>Math.ceil(Math.abs(y)/100);
    const label=y=>'Thế kỷ '+century(y)+(y<0?' TCN':'');
    right=label(entry.year);
    alternatives=events.filter(e=>label(e.year)!==right).map(e=>label(e.year));
    explanation=entry.title+' · '+(o.date||yearText(entry.year))+' · '+right+'.';
  } else {
    ask='Mốc năm nào gắn với sự kiện này?';
    right=yearText(entry.year);
    alternatives=events.filter(e=>e.year!==entry.year).map(e=>yearText(e.year));
    explanation=entry.title+' · '+(o.date||yearText(entry.year));
  }
  const choices=shuffled([right,...shuffled([...new Set(alternatives)].filter(v=>v!==right)).slice(0,2)]);
  $('challenge').innerHTML='<label class="quiz-topic">Chủ đề <select id="quiz-topic">'+
    [['all','Tổng hợp'],['ev','Sự kiện'],['np','Nhân vật'],['sci','Khoa học'],['cul','Văn hóa'],['Âm nhạc','Âm nhạc'],['Điện ảnh','Điện ảnh'],['Trò chơi','Trò chơi']].map(([key,label])=>'<option value="'+key+'">'+label+'</option>').join('')+
    '</select></label><h2>'+escapeHTML(ask)+'</h2>'+
    '<p class="quiz-prompt">'+escapeHTML(entry.kind==='np'&&mode%2===0?o.role:mode===0&&entry.kind==='ev'?'Chọn một đáp án.':entry.title)+'</p>'+
    choices.map((choice,i)=>'<button class="answer" data-answer="'+i+'">'+escapeHTML(choice)+'</button>').join('')+
    '<div id="quiz-feedback" role="status"></div>';
  $('quiz-topic').value=quizTopic;
  $('quiz-topic').onchange=()=>{quizTopic=$('quiz-topic').value;newQuestion();};
  $('challenge').querySelectorAll('.answer').forEach(button=>button.onclick=()=>{
    const answer=choices[Number(button.dataset.answer)];
    $('challenge').querySelectorAll('.answer').forEach(btn=>{
      btn.disabled=true;
      btn.classList.toggle('correct',choices[Number(btn.dataset.answer)]===right);
    });
    $('quiz-feedback').innerHTML='<b>'+(answer===right?'Đúng rồi.':'Đáp án đúng: '+escapeHTML(right))+'</b><p>'+escapeHTML(explanation)+'</p>'+
      '<a class="answer-date" href="'+href(entry)+'">Đọc câu chuyện liên quan →</a><button class="secondary-path" id="another">Câu tiếp →</button>';
    $('another').onclick=newQuestion;
  });
}
const panels = {read:'body-copy', compare:'world', people:'portraits', play:'challenge'};
function selectPanel(name) {
  for (const [button,section] of Object.entries(panels)) {
    $(button).setAttribute('aria-pressed', String(name===button));
    $(section).hidden = name!==button;
  }
  if (name==='compare') showWorld();
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
function article(item) {
  const o = item.source;
  const body = item.kind === 'np' ? o.bio : o.d;
  const meta = [o.topic, o.date, o.place, o.role, item.kind === 'np' ? yearText(o.b)+' – '+(o.d == null ? 'nay' : yearText(o.d)) : '', ['pd','gb'].includes(item.kind) ? yearText(o.s)+' – '+yearText(o.e) : ''].filter(Boolean);
  const notes = [[noteTitle(item.id,'why'),o.why],[noteTitle(item.id,'alt'),o.alt],['Liên hệ Việt Nam',o.vn],['Dấu mốc trong đời',o.act ? 'Năm '+yearText(o.k)+', '+o.n+' '+o.act+'.' : ''],['Cùng thời',o.same],['Bạn có biết?',o.fun]];
  return (meta.length ? '<p class="meta">'+escapeHTML(meta.join(' · '))+'</p>' : '')+
    '<div class="prose">'+paragraphs(body)+storyPeople(item)+(item.kind==='sl' ? sliceNotes(item) : '')+notes.filter(([,v])=>v).map(([h,v])=>'<h2>'+h+'</h2>'+paragraphs(v)).join('')+'</div>'+(o.ref ? '<a class="note-source" href="'+escapeHTML(o.ref)+'" target="_blank" rel="noopener">Nguồn tham khảo ↗</a>' : '');
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
  const sequence = eventIds.has(current.id) ? timeline : current.kind === 'sl' ? slices : all.filter(e=>e.kind===current.kind && e.lane===current.lane);
  const index = sequence.indexOf(current);
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
$('contents').onclick=()=>openLibrary(eventIds.has(current?.id)?'events':'slices');
$('contents-side').onclick=$('catalog-slices').onclick=()=>openLibrary('slices');
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
