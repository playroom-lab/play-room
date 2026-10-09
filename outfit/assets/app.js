/* Outfit選手権 — PLAY ROOM
 * 予選は4択、決勝は2択（二分挿入でTOP5を順位付け）。
 *   推しメンモード: 毎回20衣装をランダムに選ぶ → 4択5問 → 5衣装 → 決勝で5衣装の順位を決める
 *   箱推しモード:   各メンバー4衣装ずつ計32衣装 → 4択8問（1問に4人ちがうメンバー）→ 8衣装 → 決勝でTOP5
 * 写真: 最強9マスの「アー写編」と「パフォ衣装編」と同じ写真から、毎回ランダムに選ぶ
 *   アー写編  : mazzel-best-visual/images/<member>/01〜15.png ＋ new-20260918/<member>-1〜3.png
 *   パフォ衣装: mazzel-best-visual-performance/images/<member>/01〜11・13〜18.png（12枚目は使わない）
 */
(() => {
'use strict';

const MEMBERS = [
  ['kairyu', 'KAIRYU'], ['naoya', 'NAOYA'], ['ran', 'RAN'], ['seito', 'SEITO'],
  ['ryuki', 'RYUKI'], ['takuto', 'TAKUTO'], ['hayato', 'HAYATO'], ['eiki', 'EIKI']
].map(([id, name]) => ({ id, name }));
const SHOTS = 20;
const range = n => Array.from({ length: n }, (_, i) => i + 1);
const TOP = 5;
const M = id => MEMBERS.find(m => m.id === id);
const pad2 = n => String(n).padStart(2, '0');
// 写真の候補（メンバー共通の番号）。'a..' はアー写編、'p..' はパフォ衣装編
const POOL = [
  ...range(15).map(n => 'a' + pad2(n)), 'n1', 'n2', 'n3',
  ...[13, 14, 15, 16, 17, 18, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(n => 'p' + pad2(n))
];
const rawSrc = s => {
  const BV = 'https://raw.githubusercontent.com/rikomuze/mazzel-best-visual/main/images/';
  const PF = 'https://raw.githubusercontent.com/rikomuze/mazzel-best-visual-performance/main/images/';
  if (s.n[0] === 'n') return `${BV}new-20260918/${s.m}-${s.n.slice(1)}.png`;
  if (s.n[0] === 'p') return `${PF}${s.m}/${s.n.slice(1)}.png`;
  return `${BV}${s.m}/${s.n.slice(1)}.png`;
};
const src = s => PRfast(rawSrc(s), 640);   // 画面表示は軽量版
const key = s => `${s.m}-${s.n}`;
const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $ = id => document.getElementById(id);
const app = $('app');

function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

/* ---------- state ---------- */
let S = { screen: 'home' };
let history = [];
const snap = () => JSON.parse(JSON.stringify(S));
function go(next, keepHistory = true) {
  if (keepHistory) history.push(snap()); else history = [];
  S = next; render(); window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
}
function undo() { if (history.length) { S = history.pop(); render(); } }

/* ---------- setup ---------- */
function startMember(mid) {
  const shots = shuffle(POOL).slice(0, SHOTS).map(n => ({ m: mid, n }));
  const groups = [];
  for (let i = 0; i < shots.length; i += 4) groups.push(shots.slice(i, i + 4));
  go({ screen: 'prelim', mode: 'member', member: mid, groups, qi: 0, winners: [] }, false);
}
function startBox() {
  // 各メンバーから4衣装ずつ。1問に4人ちがうメンバーが並ぶように、メンバー順を回して8組つくる。
  const order = shuffle(MEMBERS.map(m => m.id));
  const pool = {}; order.forEach(m => { pool[m] = shuffle(POOL).slice(0, 4); });
  const groups = [];
  for (let g = 0; g < 8; g++) {
    const grp = [0, 1, 2, 3].map(k => { const m = order[(g + k) % 8]; return { m, n: pool[m].pop() }; });
    groups.push(shuffle(grp));
  }
  go({ screen: 'prelim', mode: 'box', member: null, groups: shuffle(groups), qi: 0, winners: [] }, false);
}
function pickPrelim(i) {
  const next = snap();
  next.winners.push(next.groups[next.qi][i]);
  next.qi++;
  if (next.qi >= next.groups.length) { next.screen = 'interlude'; }
  go(next);
}
function startFinal() {
  const next = snap();
  const pending = shuffle(next.winners);
  Object.assign(next, { screen: 'final', ranked: [pending.shift()], pending, cur: null, lo: 0, hi: 0, asked: 0, total: next.winners.length });
  advance(next);
  go(next);
}
// 二分挿入：cur を ranked のどこに入れるか、ranked[mid] と比べて決める
function advance(st) {
  while (true) {
    if (st.cur === null) {
      if (!st.pending.length) { st.screen = 'result'; return; }
      st.cur = st.pending.shift(); st.lo = 0; st.hi = Math.min(st.ranked.length, TOP);
    }
    if (st.lo < st.hi) return; // ask
    if (st.lo < TOP) st.ranked.splice(st.lo, 0, st.cur);
    st.ranked = st.ranked.slice(0, TOP);
    st.cur = null;
  }
}
function pickFinal(curWins) {
  const next = snap();
  const mid = Math.floor((next.lo + next.hi) / 2);
  if (curWins) next.hi = mid; else next.lo = mid + 1;
  next.asked++;
  advance(next);
  go(next);
}

/* ---------- views ---------- */
const backIcon = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"></path></svg>';
const title = () => S.mode === 'box' ? '箱推しの選手権' : `${M(S.member).name} の選手権`;
const label = s => S.mode === 'box' ? M(s.m).name : '';

function render() {
  if (S.screen === 'home') return renderHome();
  if (S.screen === 'prelim') return renderPrelim();
  if (S.screen === 'interlude') return renderInterlude();
  if (S.screen === 'final') return renderFinal();
  if (S.screen === 'result') return renderResult();
}
function renderHome() {
  app.innerHTML = `
  <section>
    <p class="room-label">02 / PICK YOUR FAVORITE</p><h1>衣装 <em>選手権</em></h1>
    <p class="lede">予選は4択、決勝は2択。好きな衣装を選んでいくと、最後にあなたの衣装TOP5が決まります。</p>
  </section>
  <section class="sec">
    <h2>推しメンで選ぶ</h2>
    <p class="meta">アー写・パフォ衣装から毎回ちがう20衣装 ・ 4択5問 → 2択で順位決め（10問前後）</p>
    <div class="members">${MEMBERS.map(m => `
      <button class="mcard" data-member="${m.id}"><img src="${PRfast(`https://raw.githubusercontent.com/rikomuze/mazzel-outfit/main/photos/${m.id}/16.jpg`, 360)}" alt="" loading="lazy"><span>${m.name}</span></button>`).join('')}
    </div>
  </section>
  <section class="sec">
    <h2>箱推しで選ぶ</h2>
    <button class="boxcard" id="box">
      <span class="boxstrip">${MEMBERS.map(m => `<img src="${PRfast(`https://raw.githubusercontent.com/rikomuze/mazzel-outfit/main/photos/${m.id}/19.jpg`, 200)}" alt="" loading="lazy">`).join('')}</span>
      <span class="cap"><b>全員の衣装から選ぶ</b><small>毎回32衣装</small></span>
    </button>
    <p class="meta">各メンバーから4衣装ずつ選ばれた32衣装から ・ 4択8問 → 2択でTOP5（15問前後）・ メンバー名入りのTOP5</p>
  </section>
  <section class="guide" aria-labelledby="g-h">
    <h2 id="g-h">遊び方</h2>
    <ol class="steps">
      <li><b>メンバーを選ぶ</b><span>推しメン1人の衣装で選ぶか、箱推しで全員の衣装から選ぶかを決めます。</span></li>
      <li><b>予選は4択</b><span>4枚の中からいちばん好きな衣装をタップ。選んだ1枚が決勝に進みます。</span></li>
      <li><b>決勝は2択</b><span>勝ち残った衣装を2枚ずつ比べて、好きな順に並べていきます。</span></li>
      <li><b>TOP5を保存・シェア</b><span>結果は画像で保存したり、Xにシェアしたりできます。</span></li>
    </ol>
  </section>`;
  app.querySelectorAll('[data-member]').forEach(b => b.onclick = () => startMember(b.dataset.member));
  $('box').onclick = startBox;
}
function head(phase, left, right, ratio, cls = '') {
  return `
  <div class="bar">
    <button class="back" id="quit">${backIcon}${S.mode === 'box' ? 'やめる' : 'メンバーを選び直す'}</button>
    <span class="who">${esc(title())}</span>
  </div>
  <div class="prog">
    <div class="row"><span><b>${phase}</b>${left}</span><span>${right}</span></div>
    <div class="track ${cls}"><i style="width:${Math.round(ratio * 100)}%"></i></div>
  </div>`;
}
function bindCommon() {
  $('quit').onclick = () => go({ screen: 'home' }, false);
  const u = $('undo'); if (u) u.onclick = undo;
}
function renderPrelim() {
  const g = S.groups[S.qi];
  app.innerHTML = head('予選', '4択', `${S.qi + 1} / ${S.groups.length}`, S.qi / S.groups.length) + `
  <h2 class="q">いちばん好きな衣装は？</h2>
  <div class="grid4">${g.map((s, i) => `
    <button class="pick" data-i="${i}"><img src="${src(s)}" alt="${esc(M(s.m).name)}の衣装" loading="lazy" decoding="async"><span>${S.mode === 'box' ? M(s.m).name : 'ABCD'[i]}</span></button>`).join('')}
  </div>
  <p class="hint">選んだ1枚が決勝に進みます（予選${S.groups.length}問で${S.groups.length}衣装が決勝へ）</p>
  <button class="btn ghost" id="undo" ${history.length ? '' : 'disabled'}>ひとつ戻る</button>`;
  bindCommon();
  app.querySelectorAll('[data-i]').forEach(b => b.onclick = () => { b.classList.add('chosen'); setTimeout(() => pickPrelim(+b.dataset.i), 160); });
}
function renderInterlude() {
  app.innerHTML = head('予選', 'おわり', `${S.groups.length} / ${S.groups.length}`, 1) + `
  <div class="interlude">
    <h2 class="q">決勝に進む${S.winners.length}衣装</h2>
    <div class="five ${S.winners.length > 5 ? 'eight' : ''}">${S.winners.map(s => `<img src="${src(s)}" alt="" loading="lazy" decoding="async">`).join('')}</div>
    <p class="hint">ここからは2択。2枚ずつ比べて、好きな順に並べていきます。</p>
    <button class="btn" id="toFinal" style="width:100%">決勝へ</button>
    <button class="btn ghost" id="undo" style="width:100%">ひとつ戻る</button>
  </div>`;
  bindCommon();
  $('toFinal').onclick = startFinal;
}
function renderFinal() {
  const mid = Math.floor((S.lo + S.hi) / 2);
  const a = S.cur, b = S.ranked[mid];
  const done = S.total - S.pending.length - 1; // 並べ終わった数
  const pair = Math.random() < .5 ? [[a, true], [b, false]] : [[b, false], [a, true]];
  app.innerHTML = head('決勝', '2択', `${S.asked + 1}問目`, Math.max(0, done - 1) / Math.max(1, S.total - 1), 'final') + `
  <h2 class="q">どっちの衣装が好き？</h2>
  <div class="grid2">${pair.map(([s, isCur]) => `
    <button class="pick" data-cur="${isCur ? 1 : 0}"><img src="${src(s)}" alt="${esc(M(s.m).name)}の衣装" loading="lazy" decoding="async"><span>${esc(label(s)) || '&nbsp;'}</span></button>`).join('')}
    <span class="vs">VS</span>
  </div>
  <p class="hint">写真をタップすると次の問題へ進みます</p>
  <button class="btn ghost" id="undo">ひとつ戻る</button>`;
  bindCommon();
  app.querySelectorAll('[data-cur]').forEach(b => b.onclick = () => { b.classList.add('chosen'); setTimeout(() => pickFinal(b.dataset.cur === '1'), 160); });
}
function resultTitle() { return S.mode === 'box' ? 'MAZZEL 箱推し' : M(S.member).name; }
function renderResult() {
  const r = S.ranked;
  app.innerHTML = `
  <div class="result-h"><small>RESULT</small><h1>${esc(resultTitle())}<br>好きな衣装 TOP${r.length}</h1></div>
  <div class="poster" id="poster">
    <div class="first"><img src="${src(r[0])}" alt="1位の衣装"><div class="cap"><b>1位</b><span>${S.mode === 'box' ? esc(M(r[0].m).name) : ''}</span></div></div>
    <div class="rest">${r.slice(1).map((s, i) => `<div><img src="${src(s)}" alt="${i + 2}位の衣装"><p><b>${i + 2}位</b>${S.mode === 'box' ? `<small>${esc(M(s.m).name)}</small>` : ''}</p></div>`).join('')}</div>
    <div class="foot"><span>PLAY ROOM ・ Outfit選手権</span><span>${today()}</span></div>
  </div>
  <p class="hint">「画像で保存」で、この結果を1枚の画像にできます</p>
  <div class="btns">
    <button class="btn" id="save">画像で保存</button>
    <button class="btn" id="share">Xでシェア</button>
    <button class="btn ghost" id="again">もう一回</button>
    <button class="btn ghost" id="home">${S.mode === 'box' ? '推しメンで選ぶ' : 'ほかのメンバーで'}</button>
  </div>`;
  $('save').onclick = saveImage;
  $('share').onclick = shareX;
  $('again').onclick = () => S.mode === 'box' ? startBox() : startMember(S.member);
  $('home').onclick = () => go({ screen: 'home' }, false);
}
function today() { const d = new Date(); return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`; }

/* ---------- share ---------- */
function shareX() {
  const text = `【Outfit選手権】${resultTitle()}の好きな衣装TOP5が決まりました！ #Outfit選手権 #PLAYROOM`;
  const url = 'https://playroom-lab.github.io/play-room/outfit/';
  window.open(`https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank', 'noopener');
}
function loadImg(u) {
  return loadImg1(PRfast(u, 1080)).catch(() => loadImg1(u));
}
function loadImg1(u) { return new Promise((res, rej) => { const i = new Image(); if(/^https?:/.test(u)) i.crossOrigin = 'anonymous'; i.onload = () => res(i); i.onerror = rej; i.src = u; }); }
function cover(ctx, img, x, y, w, h, fy = .2) {
  const r = Math.max(w / img.width, h / img.height), sw = w / r, sh = h / r;
  ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) * fy, sw, sh, x, y, w, h);
}
async function drawResult() {
  const W = 1080, H = 1700, c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  try { await Promise.all([document.fonts.load('600 60px "Klee One"'), document.fonts.load('700 30px "Zen Kaku Gothic New"')]); } catch (e) {}
  const hand = '"Zen Kaku Gothic New", "Hiragino Sans", sans-serif', goth = '"Zen Kaku Gothic New", "Hiragino Sans", sans-serif';
  const imgs = await Promise.all(S.ranked.map(s => loadImg(rawSrc(s))));
  // desk
  x.fillStyle = '#f7f5ed'; x.fillRect(0, 0, W, H);
  
  // heading
  x.fillStyle = '#625f6d'; x.font = `700 28px ${goth}`; x.textAlign = 'center'; x.fillText('RESULT', W / 2, 92);
  x.fillStyle = '#282536'; x.font = `600 64px ${hand}`; x.fillText(resultTitle(), W / 2, 176);
  x.font = `600 56px ${hand}`; x.fillText(`好きな衣装 TOP${S.ranked.length}`, W / 2, 252);
  // sheet
  const sx = 60, sy = 300, sw = W - 120, sh = H - sy - 60;
  x.save(); x.shadowColor = 'rgba(64,56,47,.25)'; x.shadowBlur = 40; x.shadowOffsetY = 18; x.fillStyle = '#ded7ff'; x.fillRect(sx, sy, sw, sh); x.restore();
  // 1st
  const fw = 480, fh = 640, fx = (W - fw) / 2, fy = sy + 64;
  x.save(); x.translate(W / 2, fy + (fh + 120) / 2); x.rotate(-1.5 * Math.PI / 180); x.translate(-W / 2, -(fy + (fh + 120) / 2));
  x.save(); x.shadowColor = 'rgba(64,56,47,.35)'; x.shadowBlur = 36; x.shadowOffsetY = 16; x.fillStyle = '#fff'; x.fillRect(fx - 20, fy - 20, fw + 40, fh + 120); x.restore();
  cover(x, imgs[0], fx, fy, fw, fh);
  x.fillStyle = '#282536'; x.textAlign = 'left'; x.font = `600 58px ${hand}`; x.fillText('1位', fx, fy + fh + 74);
  if (S.mode === 'box') { x.textAlign = 'right'; x.font = `600 40px ${hand}`; x.fillText(M(S.ranked[0].m).name, fx + fw, fy + fh + 70); }
  x.fillStyle = '#ffd5df'; x.translate(W / 2, fy - 22); x.rotate(-4 * Math.PI / 180); x.fillRect(-80, -22, 160, 44);
  x.restore();
  // 2-5
  const gap = 24, n = 4, cw = (sw - 80 - gap * (n - 1)) / n, ch = cw * 4 / 3, cy = fy + fh + 150;
  S.ranked.slice(1).forEach((s, i) => {
    const cx = sx + 40 + i * (cw + gap);
    x.save(); x.shadowColor = 'rgba(64,56,47,.3)'; x.shadowBlur = 20; x.shadowOffsetY = 10; x.fillStyle = '#fff'; x.fillRect(cx, cy, cw, ch + (S.mode === 'box' ? 96 : 70)); x.restore();
    cover(x, imgs[i + 1], cx + 8, cy + 8, cw - 16, ch - 8);
    x.fillStyle = '#282536'; x.textAlign = 'center'; x.font = `600 36px ${hand}`; x.fillText(`${i + 2}位`, cx + cw / 2, cy + ch + 46);
    if (S.mode === 'box') { x.fillStyle = '#625f6d'; x.font = `700 22px ${goth}`; x.fillText(M(s.m).name, cx + cw / 2, cy + ch + 80); }
  });
  // footer
  x.fillStyle = '#282536'; x.font = `700 24px ${goth}`; x.textAlign = 'left'; x.fillText('PLAY ROOM ・ Outfit選手権', sx + 40, sy + sh - 34);
  x.textAlign = 'right'; x.fillText(today(), sx + sw - 40, sy + sh - 34);
  return new Promise(r => c.toBlob(r, 'image/png'));
}
async function saveImage() {
  const btn = $('save'); btn.disabled = true; btn.textContent = '画像をつくっています…';
  try {
    const blob = await drawResult();
    const name = `outfit-top5-${S.mode === 'box' ? 'mazzel' : S.member}.png`;
    const file = new File([blob], name, { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: 'Outfit選手権' }); }
      catch (e) { if (e.name !== 'AbortError') throw e; }
    } else {
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      toast('画像を保存しました');
    }
  } catch (e) { console.error(e); toast('画像を作れませんでした。もう一度試してください'); }
  btn.disabled = false; btn.textContent = '画像で保存';
}
let tt;
function toast(t) {
  let d = document.querySelector('.toast');
  if (!d) { d = document.createElement('div'); d.className = 'toast'; d.setAttribute('role', 'status'); document.body.appendChild(d); }
  d.textContent = t; clearTimeout(tt); tt = setTimeout(() => d.remove(), 2600);
}

render();
})();
