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
  entry.search = fold([title, yearText(year), source.who, source.role, regions.get(lane)].filter(Boolean).join(' '));
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
  const meta = [o.date, o.place, o.role, item.kind === 'np' ? yearText(o.b)+' – '+(o.d == null ? 'nay' : yearText(o.d)) : '', ['pd','gb'].includes(item.kind) ? yearText(o.s)+' – '+yearText(o.e) : ''].filter(Boolean);
  const notes = [['Vì sao quan trọng?',o.why],['Góc nhìn khác',o.alt],['Liên hệ Việt Nam',o.vn],['Dấu mốc trong đời',o.act ? 'Năm '+yearText(o.k)+', '+o.n+' '+o.act+'.' : ''],['Cùng thời',o.same],['Bạn có biết?',o.fun]];
  return (meta.length ? '<p class="meta">'+escapeHTML(meta.join(' · '))+'</p>' : '')+
    '<div class="prose">'+paragraphs(body)+notes.filter(([,v])=>v).map(([h,v])=>'<h2>'+h+'</h2>'+paragraphs(v)).join('')+'</div>';
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
function showTab(world) {
  $('body-copy').hidden = world;
  $('world').hidden = !world;
  $('read').setAttribute('aria-pressed',String(!world));
  $('compare').setAttribute('aria-pressed',String(world));
  if (!world) return;
  comparisons = comparisonItems(current);
  const ids = new Set(comparisons.map(entry=>entry.lane));
  $('world').innerHTML = '<p class="summary">'+(current.kind==='sl'?'Các sự kiện được nhắc đến trong lát cắt này.':'Các thời kỳ đang diễn ra hoặc sự kiện gần năm '+yearText(current.source.k ?? current.year)+'.')+'</p><div class="world-filter"><label for="region">Khu vực</label><select id="region"><option value="">Tất cả khu vực</option>'+LANES.filter(l=>ids.has(l.id)).map(l=>'<option value="'+l.id+'">'+escapeHTML(l.name)+'</option>').join('')+'</select></div><div id="comparison-list"></div>';
  $('region').onchange = comparisonRows;
  comparisonRows();
}
function render(focus = false) {
  let id;
  try { id=decodeURIComponent(location.hash.slice(1)); } catch { id=''; }
  current = catalog.get(id) || catalog.get('sl-938') || slices[0];
  const sequence = current.kind === 'sl' ? slices : all.filter(e=>e.kind===current.kind && e.lane===current.lane);
  const index = sequence.indexOf(current);
  $('series').textContent = [labels[current.kind],regions.get(current.lane)].filter(Boolean).join(' · ');
  $('number').textContent = String(index+1).padStart(2,'0')+' / '+String(sequence.length).padStart(2,'0');
  $('year').textContent = yearText(current.year);
  $('headline').textContent = current.title;
  $('body-copy').innerHTML = article(current);
  for (const [name,entry] of [['prev',sequence[index-1]],['next',sequence[index+1]]]) {
    if (entry) { $(name).href=href(entry); $(name).setAttribute('aria-label',(name==='next'?'Mốc tiếp':'Mốc trước')+' · '+entry.title); }
    else $(name).removeAttribute('href');
  }
  $('map').href=$('map-side').href='dong-thoi-gian.html'+href(current);
  document.title=current.title+' · Lịch Sử Song Hành';
  showTab(false);
  if (focus) { $('story').focus({preventScroll:true}); window.scrollTo(0,0); }
}
function results() {
  const tokens=fold($('search').value.trim()).split(/\s+/).filter(Boolean);
  const kind=$('kind').value;
  const matches=all.filter(entry=>(!kind || entry.kind===kind || (kind==='ev' && entry.kind==='gb')) && tokens.every(t=>entry.search.includes(t)));
  const visible=matches.slice(0,limit);
  $('status').textContent=matches.length ? matches.length+' mục' : 'Chưa tìm thấy. Thử tên ngắn hơn hoặc một năm.';
  $('results').innerHTML=visible.map(entry=>'<a class="result" href="'+href(entry)+'" '+(entry===current?'aria-current="page"':'')+'><time>'+escapeHTML(yearText(entry.year))+'</time><div><strong>'+escapeHTML(entry.title)+'</strong><small>'+escapeHTML([labels[entry.kind],regions.get(entry.lane)].filter(Boolean).join(' · '))+'</small></div><span aria-hidden="true">›</span></a>').join('')+(visible.length<matches.length?'<button class="more" id="more">Xem thêm kết quả ↓</button>':'');
}
function openLibrary(contents) {
  $('dialog-title').textContent=contents?'Mục lục lát cắt':'Tra cứu lịch sử';
  $('search').value=''; $('kind').value=contents?'sl':''; $('kind').hidden=contents;
  $('search').placeholder=contents?'Tìm lát cắt hoặc năm…':'Tìm tên, nhân vật hoặc năm…';
  limit=50; results(); library.showModal();
  if (contents) { $('close').focus(); $('results').querySelector('[aria-current]')?.scrollIntoView({block:'nearest'}); }
  else $('search').focus();
}
$('lookup').onclick=()=>openLibrary(false);
$('contents').onclick=$('contents-side').onclick=()=>openLibrary(true);
$('read').onclick=()=>showTab(false); $('compare').onclick=()=>showTab(true);
$('skip').onclick=e=>{e.preventDefault();$('story').focus()};
$('close').onclick=()=>library.close();
library.onclick=e=>{if(e.target===library){const r=library.getBoundingClientRect();if(e.clientX<r.left || e.clientX>r.right || e.clientY<r.top || e.clientY>r.bottom)library.close();}};
$('results').onclick=e=>{
  if(e.target.closest('.result')) {library.close(); if(e.target.closest('.result').hash===location.hash)render(true);}
  if(e.target.closest('#more')) {const count=limit;limit+=50;results();$('results').children[count]?.focus();}
};
$('search').oninput=$('kind').onchange=()=>{limit=50;results();$('results').scrollTop=0};
window.addEventListener('hashchange',()=>render(true));
render();
