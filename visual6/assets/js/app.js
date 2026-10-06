/* =====================================================================
   推しビジュ6選 — アプリ本体
   ・プレビューと保存画像は「同じ描画関数(drawDesign)」を共用
     → プレビューCanvas(1200×1200)をCSSで縮小表示しているだけなので、
       写真位置・ラベル位置・名前位置が保存画像とズレることはない
   ・結果画像デザインは scrap / archive / idcard の3種類
   ・編集はプレビュー上で直接おこなう
       枠をタップで選択 → ドラッグで位置 / ピンチ・ホイール・ボタンで拡大
     プレビューは画面に固定表示(スマホは上部に固定)なので、
     調整しながら常に仕上がりを見られる
   ===================================================================== */
(function () {
"use strict";

/* ---------- データ ---------- */
/* 公式番号は最終審査の呼び出し順(公式サイト掲載順)。bday は誕生日 MMDD。 */
var members = [
  { id: "kairyu", name: "KAIRYU", no: "01", bday: "1022" },
  { id: "naoya",  name: "NAOYA",  no: "02", bday: "0428" },
  { id: "ran",    name: "RAN",    no: "03", bday: "0823" },
  { id: "seito",  name: "SEITO",  no: "04", bday: "1226" },
  { id: "ryuki",  name: "RYUKI",  no: "05", bday: "1004" },
  { id: "takuto", name: "TAKUTO", no: "06", bday: "1028" },
  { id: "hayato", name: "HAYATO", no: "07", bday: "0101" },
  { id: "eiki",   name: "EIKI",   no: "08", bday: "1206" }
];

/* テーマの並び順(固定):
   上段左: 沼落ち / 上段中央: 最愛 / 上段右: かわいい
   下段左: かっこいい / 下段中央: ずるい / 下段右: 殿堂入り */
var themes = [
  { id: "numa",   label: "沼落ちビジュ" },
  { id: "best",   label: "今の最愛ビジュ" },
  { id: "cute",   label: "かわいい" },
  { id: "cool",   label: "かっこいい" },
  { id: "zurui",  label: "ずるい" },
  { id: "legend", label: "殿堂入り" }
];

/* 結果画像デザイン(3種類) */
var designs = [
  { id: "idcard", label: "証明写真", hint: "プロフィール登録シート風のドキュメントデザイン" }
];

var IMAGE_COUNT = 20;
var IMAGE_ORDER_DESCENDING = true;
var SCALE_MIN = 100, SCALE_MAX = 300;

/* ---------- 状態 ---------- */
var currentMemberId = "kairyu";
var currentDesignId = "idcard";
var currentThemeId = themes[0].id;          /* 編集中の枠(常にどれか1つ選択) */
var selectedImages = createEmptySelection();
var lastFocused = null;
var fineOpen = false;                       /* 「こまかく調整」の開閉を再描画しても保つ */
var slotGeom = [];                          /* 枠ごとの位置 {m,x,y,w,h}(描画時に記録) */
var lastImgs = [];                          /* 直近に描いた画像(ドラッグ量の換算用) */
var pointers = new Map();                   /* プレビュー上のポインタ */
var pinch = null;

/* ---------- 要素 ---------- */
var memberTags = document.getElementById("memberTags");
var designChips = document.createElement("div");
var designHint = document.createElement("p");
var editor = document.getElementById("editor");
var editRoots = [editor];
var previewCanvas = document.getElementById("previewCanvas");
var overlay = document.getElementById("overlay");
var viewBtn = document.getElementById("viewBtn");
var saveBtn = document.getElementById("saveBtn");
var statusEl = document.getElementById("status");
var progressEl = document.getElementById("progress");
var photoModal = document.getElementById("photoModal");
var modalTitle = document.getElementById("modalTitle");
var modalPhotoGrid = document.getElementById("modalPhotoGrid");
var uploadInput = document.getElementById("uploadInput");
var modalUploadBtn = document.getElementById("modalUploadBtn");
var closeButton = photoModal.querySelector(".close-button");
var userNameInput = document.getElementById("userNameInput");
var saveFallback = document.getElementById("saveFallback");
var fallbackImage = document.getElementById("fallbackImage");
var fallbackClose = document.getElementById("fallbackClose");
var viewModal = document.getElementById("viewModal");
var viewImage = document.getElementById("viewImage");
var viewClose = document.getElementById("viewClose");

init();

function init() {
  renderMemberTags();
  renderDesignChips();
  buildOverlay();
  renderAll();

  userNameInput.addEventListener("input", schedulePreview);
  saveBtn.addEventListener("click", saveResultImage);
  viewBtn.addEventListener("click", openView);
  modalUploadBtn.addEventListener("click", function(){ uploadInput.click(); });
  uploadInput.addEventListener("change", handleUploadFromInput);
  closeButton.addEventListener("click", closeModal);
  photoModal.addEventListener("click", function (e) {
    if (e.target === photoModal) closeModal();
  });
  fallbackClose.addEventListener("click", function(){ saveFallback.classList.remove("active"); });
  saveFallback.addEventListener("click", function (e) {
    if (e.target === saveFallback) saveFallback.classList.remove("active");
  });
  viewClose.addEventListener("click", function(){ viewModal.classList.remove("active"); });
  viewModal.addEventListener("click", function (e) {
    if (e.target === viewModal) viewModal.classList.remove("active");
  });
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    if (photoModal.classList.contains("active")) closeModal();
    if (saveFallback.classList.contains("active")) saveFallback.classList.remove("active");
    if (viewModal.classList.contains("active")) viewModal.classList.remove("active");
  });

  bindEditor();
  bindOverlay();

  // フォントが読み込めたらプレビューを描き直す(字形が変わるため)
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(schedulePreview);
  }
}

function createEmptySelection() {
  var empty = {};
  themes.forEach(function (t) { empty[t.id] = null; });
  return empty;
}
function getCurrentMember() {
  return members.find(function (m) { return m.id === currentMemberId; }) || members[0];
}
function themeIndex(id) {
  return themes.findIndex(function (t) { return t.id === id; });
}
function getTheme(id) {
  return themes[themeIndex(id)] || themes[0];
}
function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
/* 表示名: 自由入力があればそれを優先。空欄なら選択中のメンバー名。 */
function getDisplayName() {
  var free = userNameInput.value.trim();
  return free || getCurrentMember().name;
}
function isFreeNameUsed() {
  return userNameInput.value.trim().length > 0;
}

/* すべて描き直す(選択・枠一覧・編集パネル・プレビュー・進み具合) */
function renderAll() {
  renderSlots();
  renderEditor();
  syncOverlayState();
  updateProgress();
  schedulePreview();
}

/* 編集する枠を切り替える */
function selectSlot(themeId) {
  if (themeId === currentThemeId) return;
  currentThemeId = themeId;
  renderSlots();
  renderEditor();
  syncOverlayState();
}

/* ---------- メンバー名札 ---------- */
function renderMemberTags() {
  memberTags.innerHTML = "";
  members.forEach(function (m) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "tag";
    b.textContent = m.name;
    b.setAttribute("aria-pressed", m.id === currentMemberId ? "true" : "false");
    b.addEventListener("click", function () {
      if (m.id === currentMemberId) return;
      currentMemberId = m.id;
      currentThemeId = themes[0].id;
      selectedImages = createEmptySelection(); // 切替でリセット(現行仕様)
      renderMemberTags();
      renderAll();
      setStatus(m.name + " の6枚をつくる", true);
    });
    memberTags.appendChild(b);
  });
}

/* ---------- デザイン切替(プレビューの真下) ---------- */
function renderDesignChips() {
  designChips.innerHTML = "";
  designs.forEach(function (d) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "seg-btn";
    b.textContent = d.label;
    b.setAttribute("aria-pressed", d.id === currentDesignId ? "true" : "false");
    b.addEventListener("click", function () {
      currentDesignId = d.id;
      renderDesignChips();
      schedulePreview();
    });
    designChips.appendChild(b);
  });
  var cur = designs.find(function (d) { return d.id === currentDesignId; });
  designHint.textContent = cur ? cur.hint : "";
}

/* ---------- 位置調整(プレビューと保存で同じ値を使用) ----------
   posX / posY: 余白のうち何%ぶん動かすか(0〜100)
   scale: 枠にぴったり収まる大きさを100としたときの倍率 */
function adjustDefaults(s) {
  s = s || {};
  var up = s.type === "upload";
  return {
    posX: s.posX !== undefined ? s.posX : 50,
    posY: s.posY !== undefined ? s.posY : (up ? 20 : 0),
    scale: s.scale !== undefined ? s.scale : 100
  };
}
function getImageAdjustStyle(selected) {
  if (!selected) return "";
  var a = adjustDefaults(selected);
  return "object-position:" + a.posX + "% " + a.posY + "%;transform:scale(" + (a.scale / 100) + ");";
}
function hasPhoto(themeId) {
  return !!(selectedImages[themeId] && selectedImages[themeId].src);
}
function nextEmptyTheme(fromId) {
  var start = themeIndex(fromId);
  for (var k = 1; k <= themes.length; k++) {
    var t = themes[(start + k) % themes.length];
    if (!hasPhoto(t.id)) return t;
  }
  return null;
}

/* ---------- 枠一覧(テンプレと同じ 3×2 の並び) ---------- */
function renderSlots() {}
function updateChipThumb() {}

/* ---------- 編集パネル(選んだ枠の操作) ---------- */
function renderEditor() {
  var theme = getTheme(currentThemeId);
  var idx = themeIndex(theme.id);
  var s = selectedImages[theme.id];
  var photo = !!(s && s.src);
  var a = adjustDefaults(s);

  /* 固定エリア: 枠名・写真を入れるボタン・拡大スライダー(スクロールなしで常に見える) */
  var h = '<div class="ed-title"><span class="ed-eyebrow">編集中 ' + (idx + 1) + "/" + themes.length + "</span>";
  h += "<strong>" + theme.label + "</strong>";
  h += '<span class="ed-state">' + (photo ? (s.type === "upload" ? "アップロード" : "候補から") : "未選択") + "</span></div>";
  h += '<div class="ed-actions">';
  h += '<button type="button" class="btn pick" data-act="pick">' + (photo ? "写真を変える" : "候補から選ぶ") + "</button>";
  h += '<button type="button" class="btn" data-act="upload">アップロード</button>';
  h += '<button type="button" class="btn next" data-act="next" aria-label="次の枠へ">次へ →</button>';
  h += "</div>";
  var dis = photo ? "" : " disabled";
  h += '<div class="ed-sliders' + (photo ? "" : " off") + '">';
  h += '<div class="ed-zoom"><span class="ed-label" id="zoomLabel">拡大</span>';
  h += '<button type="button" class="step" data-act="zoomOut" aria-label="縮小"' + dis + '>−</button>';
  h += '<input type="range" id="zoomRange" data-key="scale" min="' + SCALE_MIN + '" max="' + SCALE_MAX + '" step="1" value="' + a.scale + '" aria-labelledby="zoomLabel"' + dis + '>';
  h += '<button type="button" class="step" data-act="zoomIn" aria-label="拡大"' + dis + '>＋</button>';
  h += '<output id="zoomOut" class="val">' + a.scale + "%</output></div>";
  h += '<div class="ed-zoom"><label class="ed-label" for="posXRange">左右</label><input type="range" id="posXRange" data-key="posX" min="0" max="100" value="' + a.posX + '"' + dis + '><output class="val" data-for="posX">' + Math.round(a.posX) + "%</output></div>";
  h += '<div class="ed-zoom"><label class="ed-label" for="posYRange">上下</label><input type="range" id="posYRange" data-key="posY" min="0" max="100" value="' + a.posY + '"' + dis + '><output class="val" data-for="posY">' + Math.round(a.posY) + "%</output></div>";
  h += '</div>';
  h += '<div class="ed-sub"><span class="when-touch">写真をドラッグで移動・2本指で拡大</span><span class="when-mouse">写真をドラッグで移動・ホイールで拡大</span>';
  h += '<button type="button" class="link" data-act="resetAdjust"' + dis + '>もどす</button><button type="button" class="link" data-act="clear"' + dis + '>枠をからに</button></div>';
  editor.innerHTML = h;
}

/* 編集パネルのボタン・スライダー(再描画のたびに作り直さないよう委譲で受ける) */
function bindEditor() {
  editRoots.forEach(bindEditorOn);
}
function bindEditorOn(editor) {
  editor.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-act]");
    if (!btn) return;
    var act = btn.dataset.act;
    var s = selectedImages[currentThemeId];
    if (act === "pick") openModal(currentThemeId);
    else if (act === "upload") uploadInput.click();
    else if (act === "zoomIn" && s) setScale(adjustDefaults(s).scale + 10);
    else if (act === "zoomOut" && s) setScale(adjustDefaults(s).scale - 10);
    else if (act === "resetAdjust" && s) {
      delete s.posX; delete s.posY; delete s.scale;
      afterAdjust(true);
    }
    else if (act === "clear") {
      selectedImages[currentThemeId] = null;
      renderAll();
    }
    else if (act === "next") {
      var n = nextEmptyTheme(currentThemeId) || themes[(themeIndex(currentThemeId) + 1) % themes.length];
      if (n) { selectSlot(n.id); }
    }
  });
  editor.addEventListener("input", function (e) {
    var input = e.target;
    if (!input.dataset || !input.dataset.key) return;
    var s = selectedImages[currentThemeId];
    if (!s) return;
    var v = Number(input.value);
    if (input.dataset.key === "scale") v = clamp(v, SCALE_MIN, SCALE_MAX);
    s[input.dataset.key] = v;
    afterAdjust(false);
  });
  editor.addEventListener("toggle", function (e) {
    if (e.target.classList && e.target.classList.contains("fine")) fineOpen = e.target.open;
  }, true);
}

function setScale(v) {
  var s = selectedImages[currentThemeId];
  if (!s) return;
  s.scale = clamp(Math.round(v), SCALE_MIN, SCALE_MAX);
  afterAdjust(true);
}

/* 調整後に、表示中の数値・枠一覧のサムネ・プレビューをそろえる */
function afterAdjust(syncInputs) {
  var s = selectedImages[currentThemeId];
  if (!s) return;
  var a = adjustDefaults(s);
  var z = document.getElementById("zoomOut");
  if (z) z.textContent = a.scale + "%";
  var vx = document.querySelector('[data-for="posX"]');
  var vy = document.querySelector('[data-for="posY"]');
  if (vx) vx.textContent = Math.round(a.posX) + "%";
  if (vy) vy.textContent = Math.round(a.posY) + "%";
  if (syncInputs !== false) {
    var rs = document.querySelectorAll("#editor input[data-key], #editorMore input[data-key]");
    for (var i = 0; i < rs.length; i++) rs[i].value = a[rs[i].dataset.key];
  } else {
    /* スライダー操作中は、操作していない側(ドラッグで動いた値)だけ合わせる */
    var all = document.querySelectorAll("#editor input[data-key], #editorMore input[data-key]");
    for (var j = 0; j < all.length; j++) {
      if (document.activeElement !== all[j]) all[j].value = a[all[j].dataset.key];
    }
  }
  updateChipThumb(currentThemeId);
  schedulePreview();
}

function updateProgress() {
  var filled = themes.filter(function (t) { return !!selectedImages[t.id]; }).length;
  var left = themes.length - filled;
  if (left === 0) {
    progressEl.textContent = "ぜんぶ揃った！";
    progressEl.classList.add("done");
  } else {
    progressEl.textContent = "あと" + left + "枠";
    progressEl.classList.remove("done");
  }
}

/* ---------- プレビュー上の操作(タップで選択・ドラッグで移動・ピンチで拡大) ---------- */
var SVG_NS_UNUSED = 1;

function buildOverlay() {
  var SVG_NS = "http://www.w3.org/2000/svg";
  overlay.setAttribute("viewBox", "0 0 " + previewCanvas.width + " " + previewCanvas.height);
  overlay.innerHTML = "";
  themes.forEach(function (theme, i) {
    var halo = document.createElementNS(SVG_NS, "polygon");
    halo.setAttribute("class", "halo");
    halo.setAttribute("data-halo", i);
    var hit = document.createElementNS(SVG_NS, "polygon");
    hit.setAttribute("class", "hit");
    hit.setAttribute("data-i", i);
    hit.setAttribute("tabindex", "0");
    hit.setAttribute("role", "button");
    hit.setAttribute("aria-label", theme.label + " の枠");
    overlay.appendChild(halo);
    overlay.appendChild(hit);
  });
}

/* 描画で記録した枠の位置から、選択用の多角形を作り直す(回転している枠にも合う) */
function updateOverlayGeometry() {
  themes.forEach(function (theme, i) {
    var g = slotGeom[i];
    if (!g) return;
    var corners = [[g.x, g.y], [g.x + g.w, g.y], [g.x + g.w, g.y + g.h], [g.x, g.y + g.h]];
    var pts = corners.map(function (c) {
      var p = g.m.transformPoint(new DOMPoint(c[0], c[1]));
      return p.x.toFixed(1) + "," + p.y.toFixed(1);
    }).join(" ");
    var hit = overlay.querySelector('[data-i="' + i + '"]');
    var halo = overlay.querySelector('[data-halo="' + i + '"]');
    if (hit) hit.setAttribute("points", pts);
    if (halo) halo.setAttribute("points", pts);
  });
}

/* 選択中の枠・写真の有無を見た目と操作モードに反映 */
function syncOverlayState() {
  var cur = themeIndex(currentThemeId);
  overlay.querySelectorAll("[data-i]").forEach(function (el) {
    var i = Number(el.getAttribute("data-i"));
    var on = i === cur;
    el.classList.toggle("on", on);
    el.classList.toggle("has", hasPhoto(themes[i].id));
    el.setAttribute("aria-pressed", on ? "true" : "false");
  });
  overlay.querySelectorAll("[data-halo]").forEach(function (el) {
    el.classList.toggle("on", Number(el.getAttribute("data-halo")) === cur);
  });
  /* 写真のある枠を選んでいる間だけ、プレビュー上の指の動きを写真の移動に使う。
     それ以外はページのスクロールを妨げない。 */
  overlay.classList.toggle("is-editing", hasPhoto(currentThemeId));
}

function bindOverlay() {
  overlay.addEventListener("pointerdown", function (e) {
    var el = e.target.closest("[data-i]");
    if (!el) return;
    var id = themes[Number(el.getAttribute("data-i"))].id;
    if (id !== currentThemeId) selectSlot(id);
    if (!hasPhoto(currentThemeId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try { overlay.setPointerCapture(e.pointerId); } catch (err) {}
    if (pointers.size === 2) startPinch();
    e.preventDefault();
  });
  overlay.addEventListener("pointermove", function (e) {
    var p = pointers.get(e.pointerId);
    if (!p) return;
    var dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (pointers.size >= 2) {
      updatePinch();
    } else if (dx || dy) {
      panBy(dx, dy);
    }
  });
  function endPointer(e) {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
  }
  overlay.addEventListener("pointerup", endPointer);
  overlay.addEventListener("pointercancel", endPointer);
  overlay.addEventListener("wheel", function (e) {
    var el = e.target.closest("[data-i]");
    if (!el || themes[Number(el.getAttribute("data-i"))].id !== currentThemeId) return;
    var s = selectedImages[currentThemeId];
    if (!s || !s.src) return;
    e.preventDefault();
    setScale(adjustDefaults(s).scale * (e.deltaY < 0 ? 1.07 : 0.93));
  }, { passive: false });

  /* キーボード: 枠にフォーカスして Enter で選択、矢印で移動、+/-で拡大 */
  overlay.addEventListener("keydown", function (e) {
    var el = e.target.closest("[data-i]");
    if (!el) return;
    var id = themes[Number(el.getAttribute("data-i"))].id;
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); selectSlot(id); return; }
    var s = selectedImages[currentThemeId];
    if (id !== currentThemeId || !s || !s.src) return;
    var a = adjustDefaults(s), step = e.shiftKey ? 8 : 2, used = true;
    if (e.key === "ArrowLeft") s.posX = clamp(a.posX + step, 0, 100);
    else if (e.key === "ArrowRight") s.posX = clamp(a.posX - step, 0, 100);
    else if (e.key === "ArrowUp") s.posY = clamp(a.posY + step, 0, 100);
    else if (e.key === "ArrowDown") s.posY = clamp(a.posY - step, 0, 100);
    else if (e.key === "+" || e.key === "=") { setScale(a.scale + 10); return; }
    else if (e.key === "-") { setScale(a.scale - 10); return; }
    else used = false;
    if (used) { e.preventDefault(); afterAdjust(true); }
  });
}

/* 指(マウス)の移動量を、枠の中の座標(回転も考慮)に直して、写真の表示位置に反映 */
function panBy(dxClient, dyClient) {
  var idx = themeIndex(currentThemeId);
  var g = slotGeom[idx], img = lastImgs[idx], s = selectedImages[currentThemeId];
  if (!g || !img || !s) return;
  var rect = overlay.getBoundingClientRect();
  if (!rect.width) return;
  var k = previewCanvas.width / rect.width;
  var dx = dxClient * k, dy = dyClient * k;
  var m = g.m, det = m.a * m.d - m.b * m.c;
  if (!det) return;
  var lx = (m.d * dx - m.c * dy) / det;
  var ly = (-m.b * dx + m.a * dy) / det;
  var a = adjustDefaults(s);
  var base = Math.max(g.w / img.naturalWidth, g.h / img.naturalHeight) * (a.scale / 100);
  var ox = g.w - img.naturalWidth * base;
  var oy = g.h - img.naturalHeight * base;
  if (Math.abs(ox) > 0.5) s.posX = clamp(a.posX + 100 * lx / ox, 0, 100);
  if (Math.abs(oy) > 0.5) s.posY = clamp(a.posY + 100 * ly / oy, 0, 100);
  afterAdjust(true);
}

function pointerDistance() {
  var pts = Array.from(pointers.values());
  return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
}
function startPinch() {
  var s = selectedImages[currentThemeId];
  if (!s) return;
  var d = pointerDistance();
  pinch = d > 0 ? { d0: d, s0: adjustDefaults(s).scale } : null;
}
function updatePinch() {
  if (!pinch) { startPinch(); return; }
  var d = pointerDistance();
  if (d > 0) setScale(pinch.s0 * d / pinch.d0);
}

/* ---------- 候補モーダル ---------- */
function openModal(themeId) {
  currentThemeId = themeId;
  lastFocused = document.activeElement;
  var theme = getTheme(themeId);
  modalTitle.textContent = theme.label + "を選ぶ";
  renderModalPhotoGrid();
  photoModal.classList.add("active");
  closeButton.focus();
}
function closeModal() {
  var wasOpen = photoModal.classList.contains("active");
  photoModal.classList.remove("active");
  modalPhotoGrid.innerHTML = "";
  if (wasOpen && lastFocused && lastFocused.focus) lastFocused.focus();
}
function renderModalPhotoGrid() {
  if (!currentThemeId) return;
  modalPhotoGrid.innerHTML = "";
  var selected = selectedImages[currentThemeId];
  var numbers = [];
  for (var i = 1; i <= IMAGE_COUNT; i++) numbers.push(String(i).padStart(2, "0"));
  if (IMAGE_ORDER_DESCENDING) numbers.reverse();

  numbers.forEach(function (number) {
    var button = document.createElement("button");
    button.type = "button";
    button.className = "photo-option";
    var img = document.createElement("img");
    img.crossOrigin = "anonymous"; img.src = "https://raw.githubusercontent.com/rikomuze/oshi-visual-6/main/images/" + currentMemberId + "/" + number + ".jpg";
    img.alt = getCurrentMember().name + " " + number;
    img.loading = "lazy";
    img.onerror = function () {
      if (!img.dataset.fallbackTried) {
        img.dataset.fallbackTried = "true";
        img.crossOrigin = "anonymous"; img.src = "https://raw.githubusercontent.com/rikomuze/oshi-visual-6/main/images/" + currentMemberId + "/" + number + ".png";
      } else {
        button.style.display = "none";
      }
    };
    if (selected && selected.src && selected.src.indexOf("/images/" + currentMemberId + "/" + number + ".") !== -1) {
      button.classList.add("is-selected");
    }
    button.appendChild(img);
    button.addEventListener("click", function () {
      selectedImages[currentThemeId] = { src: img.currentSrc || img.src, type: "preset" };
      renderAll();
      closeModal();
      setStatus(getTheme(currentThemeId).label + " に入れました。", true);
    });
    modalPhotoGrid.appendChild(button);
  });
}

/* ---------- アップロード(自動縮小つき: 長辺2048px) ---------- */
function handleUploadFromInput(event) {
  var file = event.target.files && event.target.files[0];
  uploadInput.value = "";
  if (!file || !currentThemeId) return;
  if (!file.type || file.type.indexOf("image/") !== 0) {
    setStatus("画像ファイルを選んでください。");
    return;
  }
  if (file.size > 20 * 1024 * 1024) {
    setStatus("画像が大きすぎます（20MBまで）。");
    return;
  }
  var themeId = currentThemeId;
  var reader = new FileReader();
  reader.onerror = function () { setStatus("画像の読み込みに失敗しました。"); };
  reader.onload = function () {
    var img = new Image();
    img.onerror = function () { setStatus("画像を開けませんでした。別の画像でお試しください。"); };
    img.onload = function () {
      var MAX = 2048; // スマホの大きい写真はここで縮小(メモリ・保存失敗対策)
      var src = reader.result;
      var longest = Math.max(img.naturalWidth, img.naturalHeight);
      if (longest > MAX) {
        var r = MAX / longest;
        var c = document.createElement("canvas");
        c.width = Math.round(img.naturalWidth * r);
        c.height = Math.round(img.naturalHeight * r);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        src = c.toDataURL(file.type === "image/png" ? "image/png" : "image/jpeg", 0.92);
      }
      selectedImages[themeId] = { src: src, type: "upload", posX: 50, posY: 20, scale: 100 };
      currentThemeId = themeId;
      renderAll();
      closeModal();
      setStatus("読み込みました。プレビューを動かして調整できます。", true);
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}

/* プレビューを全画面で大きく見る(保存画像と同じ絵) */
function openView() {
  try { viewImage.src = previewCanvas.toDataURL("image/png"); }
  catch (e) { setStatus("大きく表示できませんでした。"); return; }
  viewModal.classList.add("active");
  viewClose.focus();
}

/* =====================================================================
   ここから結果画像の描画。
   プレビュー(schedulePreview → renderInto(previewCanvas))と
   保存(createResultCanvas)は同じ drawDesign() を呼ぶだけなのでズレない。
   ===================================================================== */

var W = 1200, H = 1200;

/* フォント指定(Canvas用)。Webフォント読込前でも近い系統に落ちる。 */
/* フォントは4ファミリーに統一(index.html の CSS変数と同一の定義)
   - 日本語メイン: Zen Kaku Gothic New
   - 日本語手書き風: Klee One
   - 欧文サンセリフ: Montserrat
   - 欧文セリフ(英字専用): DM Serif Display
   日本語を DM Serif Display / Georgia / Times で描画しないこと。 */
var F = {
  /* 結果画像内の日本語はすべて「花とちょうちょ」。
     フォント未収録の文字(自由入力の珍しい漢字など)は
     字単位で Zen Kaku Gothic New にフォールバックする。
     ※操作画面UIのフォントは index.html 側のCSS変数で管理(花とちょうちょ不使用) */
  jp:      "'HanaToChoucho','Zen Kaku Gothic New','Noto Sans JP','Hiragino Sans','Yu Gothic',sans-serif",
  jpHand:  "'HanaToChoucho','Klee One','Zen Kaku Gothic New',sans-serif",
  /* UI寄りの手書き風(花とちょうちょは含めない) */
  jpKlee:  "'Klee One','Zen Kaku Gothic New','Hiragino Sans',sans-serif",
  en:      "'Montserrat','Helvetica Neue',Arial,sans-serif",
  enSerif: "'DM Serif Display',Georgia,serif"
};
/* 旧名エイリアス(既存コード互換) */
F.gothic = F.jp;
F.hand   = F.jpKlee;
F.mincho = F.jp;      /* 明朝は廃止 → 日本語ゴシックへ */
F.serif  = F.enSerif; /* 欧文専用 */
F.script = F.enSerif;
F.mono   = F.en;

/* 日本語を含むか(ひらがな/カタカナ/漢字/長音) */
function containsJapanese(t) {
  return /[\u3041-\u3096\u30A1-\u30FA\u4E00-\u9FFF\u3005\u30FC]/.test(t);
}
/* 推し名用フォントテンプレート:
   英字のみ → DM Serif Display 400 / 日本語を含む → Zen Kaku Gothic New 600 */
function nameFontTpl() {
  return containsJapanese(getDisplayName())
    ? "600 {S}px " + F.jp
    : "400 {S}px " + F.enSerif;
}
/* Canvasの字間(未対応ブラウザでは無視され、フォント自体は正しく出る) */
function setLS(ctx, px) {
  try { ctx.letterSpacing = px + "px"; } catch (e) {}
}

/* ---------- 画像キャッシュ ---------- */
var imageCache = {};
function loadCanvasImage(src) {
  if (!src) return Promise.resolve(null);
  if (imageCache[src]) return imageCache[src];
  imageCache[src] = new Promise(function (resolve) {
    var image = new Image();
    if (/^https?:/.test(src)) image.crossOrigin = "anonymous";
    image.onload = function(){ resolve(image); };
    image.onerror = function(){ resolve(null); };
    image.src = src;
  });
  return imageCache[src];
}

/* ---------- プレビューの再描画(連打対策つき) ---------- */
var previewToken = 0;
var previewQueued = false;
function schedulePreview() {
  if (previewQueued) return;
  previewQueued = true;
  window.requestAnimationFrame(function () {
    previewQueued = false;
    var token = ++previewToken;
    renderInto(previewCanvas).catch(function(){}).then(function () {
      // 古い描画要求は上書きされるだけなのでここでは何もしない
      void token;
    });
  });
}

async function renderInto(canvas) {
  var ctx = canvas.getContext("2d");
  await ensureFonts();
  var imgs = await loadSelectedImages();
  if (canvas === previewCanvas) lastImgs = imgs;
  drawDesign(ctx, currentDesignId, imgs);
  if (canvas === previewCanvas) updateOverlayGeometry();
}

/* Canvasに描く日本語をすべて含んだサンプル文字列。
   Google Fontsの日本語フォントは unicode-range で分割配信されるため、
   fonts.load() に実際の文字を渡さないと日本語サブセットが
   ダウンロードされず、Canvas描画が型崩れする。 */
var JP_SAMPLE = "推しビジュ6選沼落ち今の最愛かわいいかっこいいずるい殿堂入り未選択";
/* 花とちょうちょ用: スクラップの写真下6ラベルに出る文字 */
var HANA_SAMPLE = "沼落ちビジュ今の最愛かわいこずる殿堂入り";

async function ensureFonts() {
  if (!document.fonts || !document.fonts.load) return;
  try {
    await Promise.all([
      document.fonts.load("400 80px 'Zen Kaku Gothic New'", JP_SAMPLE),
      document.fonts.load("500 80px 'Zen Kaku Gothic New'", JP_SAMPLE),
      document.fonts.load("700 80px 'Zen Kaku Gothic New'", JP_SAMPLE),
      document.fonts.load("900 80px 'Zen Kaku Gothic New'", JP_SAMPLE + "NAME0123456789#"),
      document.fonts.load("400 60px 'Klee One'", JP_SAMPLE),
      document.fonts.load("600 60px 'Klee One'", JP_SAMPLE),
      document.fonts.load("400 60px 'HanaToChoucho'", JP_SAMPLE + HANA_SAMPLE),
      document.fonts.load("500 40px 'Montserrat'", "MY VISUAL 6"),
      document.fonts.load("600 40px 'Montserrat'", "MY VISUAL 6"),
      document.fonts.load("700 40px 'Montserrat'", "PROFILE SNAP CARD"),
      document.fonts.load("400 150px 'DM Serif Display'", "MY VISUAL 6")
    ]);
    /* 分割サブセットの取りこぼし対策として、全フォントの読込完了も待つ */
    if (document.fonts.ready) await document.fonts.ready;
  } catch (e) { /* 読めなくてもフォールバックで描画 */ }
}

function loadSelectedImages() {
  return Promise.all(themes.map(function (theme) {
    var s = selectedImages[theme.id];
    return s && s.src ? loadCanvasImage(s.src) : Promise.resolve(null);
  }));
}

/* ---------- 共通描画ヘルパー ---------- */
function roundedRectPath(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/* 写真をカバー配置で描く。アップロード画像は posX/posY/scale を反映。
   プリセット画像は「上寄せカバー」(既存挙動)。 */
function drawCoverImage(ctx, image, x, y, w, h, selected, radius, placeholderColor, slotIndex) {
  ctx.save();
  if (slotIndex !== undefined) slotGeom[slotIndex] = { m: ctx.getTransform(), x: x, y: y, w: w, h: h };
  if (radius > 0) { roundedRectPath(ctx, x, y, w, h, radius); ctx.clip(); }
  else { ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); }
  if (!image) {
    ctx.fillStyle = placeholderColor || "#eee4d8";
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = "rgba(64,56,47,.35)";
    ctx.font = "500 " + Math.round(Math.min(w, h) * 0.11) + "px " + F.jp;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("未選択", x + w / 2, y + h / 2);
    ctx.restore();
    return;
  }
  var a = adjustDefaults(selected);
  var base = Math.max(w / image.naturalWidth, h / image.naturalHeight) * (a.scale / 100);
  var dw = image.naturalWidth * base;
  var dh = image.naturalHeight * base;
  var dx = x + (w - dw) * (a.posX / 100);
  var dy = y + (h - dh) * (a.posY / 100);
  ctx.drawImage(image, dx, dy, dw, dh);
  ctx.restore();
}

/* マスキングテープ */
function drawTape(ctx, cx, cy, w, h, deg, color) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(deg * Math.PI / 180);
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = color;
  ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.globalAlpha = 1;
  ctx.restore();
}

/* 円形スタンプ(円周に沿った文字つき) */
function drawStamp(ctx, cx, cy, r, color, topText, centerDraw) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.85;
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(0, 0, r - 8, 0, Math.PI * 2); ctx.stroke();
  // 上半分の円弧テキスト
  var chars = topText.split("");
  var fs = Math.round(r * 0.26);
  ctx.font = "700 " + fs + "px " + F.gothic;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  var arc = Math.PI * 1.15;
  var start = -Math.PI / 2 - arc / 2;
  chars.forEach(function (ch, i) {
    var ang = start + arc * (chars.length === 1 ? 0.5 : i / (chars.length - 1));
    ctx.save();
    ctx.rotate(ang + Math.PI / 2);
    ctx.fillText(ch, 0, -(r - 22));
    ctx.restore();
  });
  if (centerDraw) centerDraw(ctx, r);
  ctx.globalAlpha = 1;
  ctx.restore();
}

/* バーコード(文字列から決定的に生成) */
function drawBarcode(ctx, seedStr, x, y, w, h, color) {
  var seed = 0;
  for (var i = 0; i < seedStr.length; i++) seed = (seed * 31 + seedStr.charCodeAt(i)) >>> 0;
  function rnd() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }
  ctx.save();
  ctx.fillStyle = color || "#3c352c";
  var cx = x;
  while (cx < x + w) {
    var bw = 2 + Math.floor(rnd() * 5);
    if (rnd() > 0.42) ctx.fillRect(cx, y, Math.min(bw, x + w - cx), h);
    cx += bw + 2;
  }
  ctx.restore();
}

/* ハート */
function drawHeart(ctx, cx, cy, size, color, alpha) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(size / 30, size / 30);
  ctx.globalAlpha = alpha === undefined ? 1 : alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, 9);
  ctx.bezierCurveTo(-1, 4, -14, -2, -14, -9);
  ctx.bezierCurveTo(-14, -16, -6, -17, 0, -10);
  ctx.bezierCurveTo(6, -17, 14, -16, 14, -9);
  ctx.bezierCurveTo(14, -2, 1, 4, 0, 9);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/* キラキラ(4方向スパークル) */
function drawSparkle(ctx, cx, cy, r, color, alpha) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.globalAlpha = alpha === undefined ? 1 : alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, -r);
  ctx.quadraticCurveTo(r * 0.14, -r * 0.14, r, 0);
  ctx.quadraticCurveTo(r * 0.14, r * 0.14, 0, r);
  ctx.quadraticCurveTo(-r * 0.14, r * 0.14, -r, 0);
  ctx.quadraticCurveTo(-r * 0.14, -r * 0.14, 0, -r);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function formatDate(d) {
  return d.getFullYear() + "." + String(d.getMonth() + 1).padStart(2, "0") + "." + String(d.getDate()).padStart(2, "0");
}
/* IDコード: MZ{公式番号}-{誕生日MMDD}-{表示名の頭3文字}
   例: EIKI選択・自由入力なし → MZ08-1206-EIK */
function idCode() {
  var mem = getCurrentMember();
  var name = getDisplayName().replace(/[^A-Za-z0-9]/g, "").toUpperCase() || mem.name;
  return "MZ" + mem.no + "-" + mem.bday + "-" + (name + "XXX").slice(0, 3);
}
function serialNo() {
  var d = new Date();
  return "MTB-" + String(d.getMonth() + 1).padStart(2, "0") + String(d.getDate()).padStart(2, "0");
}

/* 名前をボックス幅に収めて描く(はみ出し防止のため自動縮小) */
function fitText(ctx, text, maxW, baseFont, baseSize, minSize) {
  var size = baseSize;
  do {
    ctx.font = baseFont.replace("{S}", size);
    if (ctx.measureText(text).width <= maxW) break;
    size -= 2;
  } while (size > (minSize || 20));
  return size;
}

/* ---------- デザイン振り分け ---------- */
function drawDesign(ctx, designId, imgs) {
  ctx.clearRect(0, 0, W, H);
  drawIdCard(ctx, imgs);
}

/* =====================================================================
   デザイン3: 証明写真/PROFILE SNAP CARD(参考画像準拠)
   白基調・細線・余白多め。ラベルは写真下端に重なる控えめなピル型。
   ===================================================================== */
var IDCARD = {
  outer: 26,           /* 外側の細枠 */
  inner: 60,           /* カード本体 */
  headerY: 108,
  sepY: 148,
  side: { x: 96, w: 210 },
  grid: { x: 336, cellW: 250, photoH: 360, gapX: 20, startY: 176, rowGap: 38 },
  notesY: 1082
};

/* 文字間を空けて描く(レタースペーシング) */
function drawSpaced(ctx, text, cx, y, ls) {
  var chars = text.split("");
  var widths = chars.map(function (ch) { return ctx.measureText(ch).width; });
  var total = widths.reduce(function (a, b) { return a + b; }, 0) + ls * (chars.length - 1);
  var x = cx - total / 2;
  var prevAlign = ctx.textAlign;
  ctx.textAlign = "left";
  chars.forEach(function (ch, i) {
    ctx.fillText(ch, x, y);
    x += widths[i] + ls;
  });
  ctx.textAlign = prevAlign;
}

/* 点線 */
function dottedLine(ctx, x0, y0, x1, y1, color, width) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width || 1.4;
  ctx.setLineDash([2.5, 5]);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

function drawIdCard(ctx, imgs) {
  var C = IDCARD;
  var ink = "#4a4038";       /* 文字色(墨) */
  var sub = "#9a8f86";       /* 補助ラベル */
  var pink = "#dfa6b0";      /* 差し色ピンク */
  var line = "#e3d5d2";      /* 細枠 */

  /* --- 背景と枠 --- */
  ctx.fillStyle = "#f7f2f0";
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "#dcc3c7";
  ctx.lineWidth = 1.6;
  roundedRectPath(ctx, C.outer, C.outer, W - C.outer * 2, H - C.outer * 2, 18);
  ctx.stroke();
  ctx.lineWidth = 0.8;
  roundedRectPath(ctx, C.outer + 7, C.outer + 7, W - (C.outer + 7) * 2, H - (C.outer + 7) * 2, 14);
  ctx.stroke();

  /* カード本体 */
  ctx.fillStyle = "#fffdfc";
  ctx.strokeStyle = line;
  ctx.lineWidth = 1.4;
  roundedRectPath(ctx, C.inner, C.inner, W - C.inner * 2, H - C.inner * 2, 12);
  ctx.fill();
  ctx.stroke();

  /* --- ヘッダー --- */
  ctx.fillStyle = ink;
  ctx.textBaseline = "alphabetic";
  drawSparkle(ctx, C.side.x + 16, C.headerY - 13, 12, pink, 0.9);
  ctx.textAlign = "left";
  ctx.save();
  ctx.font = "700 37px " + F.en;
  var htx = C.side.x + 46;
  "PROFILE SNAP CARD".split("").forEach(function (ch) {
    ctx.fillText(ch, htx, C.headerY);
    htx += ctx.measureText(ch).width + 4.5; /* ≒0.12em */
  });
  ctx.restore();
  drawSparkle(ctx, htx + 14, C.headerY - 13, 12, pink, 0.9);

  /* 右上ピル: ♥ 推しビジュ6選 ♥ */
  var pillW = 288, pillH = 56;
  var pillX = W - C.inner - 40 - pillW, pillY = C.headerY - 40;
  ctx.strokeStyle = "#d9aeb6";
  ctx.lineWidth = 1.6;
  roundedRectPath(ctx, pillX, pillY, pillW, pillH, pillH / 2);
  ctx.stroke();
  ctx.fillStyle = "#6a5a52";
  ctx.font = "600 24px " + F.jp;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("推しビジュ6選", pillX + pillW / 2, pillY + pillH / 2 + 1);
  drawHeart(ctx, pillX + 32, pillY + pillH / 2, 11, pink, 0.9);
  drawHeart(ctx, pillX + pillW - 32, pillY + pillH / 2, 11, pink, 0.9);

  /* ヘッダー下の点線 */
  dottedLine(ctx, C.inner + 36, C.sepY, W - C.inner - 36, C.sepY, "#cbbdb6", 1.6);

  /* --- 左サイドバー --- */
  var sx = C.side.x, sw = C.side.w;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  function sideLabel(text, y) {
    ctx.fillStyle = sub;
    ctx.font = "600 19px " + F.en;
    var lx = sx;
    text.split("").forEach(function (ch) {
      ctx.fillText(ch, lx, y);
      lx += ctx.measureText(ch).width + 2;
    });
    ctx.strokeStyle = "#c8bab3";
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(sx, y + 9); ctx.lineTo(lx - 4, y + 9); ctx.stroke();
  }

  var sy = C.grid.startY + 40;
  /* NAME */
  sideLabel("NAME", sy);
  var nm = getDisplayName();
  ctx.fillStyle = ink;
  var nfs = fitText(ctx, nm, sw + 22, nameFontTpl(), 60, 16);
  ctx.font = nameFontTpl().replace("{S}", nfs);
  ctx.fillText(nm, sx, sy + 76);
  dottedLine(ctx, sx, sy + 112, sx + sw, sy + 112, line, 1.4);

  /* TYPE */
  sideLabel("TYPE", sy + 156);
  ctx.fillStyle = ink;
  ctx.font = "700 27px " + F.en;
  ctx.fillText("MY VISUAL 6", sx, sy + 198);
  dottedLine(ctx, sx, sy + 228, sx + sw, sy + 228, line, 1.4);

  /* GROUP(自由入力名のときは空欄の罫線) */
  sideLabel("GROUP", sy + 270);
  if (isFreeNameUsed()) {
    ctx.strokeStyle = "#c8bab3";
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(sx, sy + 310); ctx.lineTo(sx + sw, sy + 310); ctx.stroke();
  } else {
    ctx.fillStyle = ink;
    ctx.font = "700 27px " + F.en;
    ctx.fillText("MAZZEL", sx, sy + 312);
  }
  dottedLine(ctx, sx, sy + 342, sx + sw, sy + 342, line, 1.4);

  /* 円形スタンプ(MUZE / TOOL BOX) */
  var stX = sx + sw / 2, stY = sy + 442, stR = 76;
  ctx.save();
  ctx.translate(stX, stY);
  ctx.rotate(-0.14);
  ctx.globalAlpha = 0.8;
  ctx.strokeStyle = pink;
  ctx.fillStyle = pink;
  ctx.lineWidth = 2.4;
  ctx.beginPath(); ctx.arc(0, 0, stR, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 1.1;
  ctx.beginPath(); ctx.arc(0, 0, stR - 7, 0, Math.PI * 2); ctx.stroke();
  ctx.font = "700 20px " + F.en;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  /* 上弧: MUZE */
  var top = "PLAY".split("");
  var arcT = Math.PI * 0.55, startT = -Math.PI / 2 - arcT / 2;
  top.forEach(function (ch, i) {
    var ang = startT + arcT * (i / (top.length - 1));
    ctx.save(); ctx.rotate(ang + Math.PI / 2); ctx.fillText(ch, 0, -(stR - 26)); ctx.restore();
  });
  /* 下弧: TOOL BOX */
  var bot = "TOOL BOX".split("");
  var arcB = Math.PI * 0.72, startB = Math.PI / 2 + arcB / 2;
  bot.forEach(function (ch, i) {
    var ang = startB - arcB * (i / (bot.length - 1));
    ctx.save(); ctx.rotate(ang - Math.PI / 2); ctx.fillText(ch, 0, stR - 26); ctx.restore();
  });
  drawHeart(ctx, 0, 0, 26, pink, 0.85);
  drawSparkle(ctx, -stR + 20, 0, 8, pink, 0.85);
  drawSparkle(ctx, stR - 20, 0, 8, pink, 0.85);
  ctx.globalAlpha = 1;
  ctx.restore();
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  dottedLine(ctx, sx, sy + 538, sx + sw, sy + 538, line, 1.4);

  /* DATE */
  sideLabel("DATE", sy + 580);
  ctx.fillStyle = ink;
  ctx.font = "600 28px " + F.en;
  ctx.fillText(formatDate(new Date()), sx, sy + 620);

  /* ID */
  sideLabel("ID", sy + 664);
  ctx.fillStyle = ink;
  var code = idCode();
  var cfs = fitText(ctx, code, sw, "600 {S}px " + F.en, 23, 15);
  ctx.font = "600 " + cfs + "px " + F.en;
  ctx.fillText(code, sx, sy + 700);

  /* バーコード */
  drawBarcode(ctx, code, sx, sy + 722, sw - 24, 40, "#5a5048");

  /* --- 写真グリッド 3×2 --- */
  var g = IDCARD.grid;
  themes.forEach(function (theme, i) {
    var col = i % 3, row = Math.floor(i / 3);
    var x = g.x + col * (g.cellW + g.gapX);
    var y = g.startY + row * (g.photoH + g.rowGap);

    /* 写真カード(角丸・細枠) */
    ctx.save();
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#ded3cd";
    ctx.lineWidth = 1.2;
    roundedRectPath(ctx, x, y, g.cellW, g.photoH, 14);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    drawCoverImage(ctx, imgs[i], x, y, g.cellW, g.photoH,
      selectedImages[theme.id], 14, "#f3ede8", i);
    ctx.strokeStyle = "#ded3cd";
    ctx.lineWidth = 1.2;
    roundedRectPath(ctx, x, y, g.cellW, g.photoH, 14);
    ctx.stroke();

    /* ラベル(写真下端に重なる白ピル・控えめ) */
    var lw = g.cellW - 48, lh = 40;
    var lx = x + g.cellW / 2, ly = y + g.photoH - 4;
    ctx.save();
    ctx.shadowColor = "rgba(120,100,90,.1)";
    ctx.shadowBlur = 3;
    ctx.shadowOffsetY = 1.5;
    ctx.fillStyle = "#fffdfb";
    roundedRectPath(ctx, lx - lw / 2, ly - lh / 2, lw, lh, 8);
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.strokeStyle = "#d5c9c2";
    ctx.lineWidth = 0.9;
    roundedRectPath(ctx, lx - lw / 2, ly - lh / 2, lw, lh, 8);
    ctx.stroke();
    ctx.strokeStyle = "#e7ddd7";
    ctx.lineWidth = 0.6;
    roundedRectPath(ctx, lx - lw / 2 + 3.5, ly - lh / 2 + 3.5, lw - 7, lh - 7, 6);
    ctx.stroke();
    ctx.fillStyle = "#5a5148";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    var lfs = fitText(ctx, theme.label, lw - 52, "500 {S}px " + F.jp, 22, 14);
    ctx.font = "500 " + lfs + "px " + F.jp;
    ctx.fillText(theme.label, lx, ly + 1);
    /* 両端の小ドット */
    ctx.fillStyle = "#b9aca4";
    ctx.beginPath(); ctx.arc(lx - lw / 2 + 15, ly, 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(lx + lw / 2 - 15, ly, 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  });
  ctx.textBaseline = "alphabetic";

  /* --- 下部: 事務欄(控えめ) + NOTES --- */
  var by = C.notesY - 58;
  dottedLine(ctx, C.inner + 36, by - 34, W - C.inner - 36, by - 34, "#cbbdb6", 1.4);
  ctx.textAlign = "left";
  function footItem(label, x) {
    ctx.fillStyle = sub;
    ctx.font = "600 16px " + F.en;
    var lx2 = x;
    label.split("").forEach(function (ch) {
      ctx.fillText(ch, lx2, by - 4);
      lx2 += ctx.measureText(ch).width + 1.8;
    });
  }
  footItem("CHECKED BY.", C.inner + 36);
  ctx.fillStyle = ink; ctx.font = "600 20px " + F.en;
  ctx.fillText("PLAY ROOM", C.inner + 36, by + 26);

  footItem("DATE.", 434);
  ctx.fillStyle = ink; ctx.font = "600 20px " + F.en;
  ctx.fillText(formatDate(new Date()), 434, by + 26);

  footItem("VERIFICATION", 640);
  ctx.strokeStyle = "#b3a69e"; ctx.lineWidth = 1.4;
  ctx.strokeRect(640, by + 8, 20, 20);
  ctx.strokeStyle = pink; ctx.lineWidth = 2.6; ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(644, by + 18); ctx.lineTo(649, by + 24); ctx.lineTo(658, by + 10);
  ctx.stroke();
  ctx.fillStyle = ink; ctx.font = "600 20px " + F.en;
  ctx.fillText("APPROVED", 668, by + 26);

  footItem("SIGNATURE.", 872);
  ctx.fillStyle = ink;
  var sig = getDisplayName();
  var sfs = fitText(ctx, sig, W - C.inner - 36 - 872, nameFontTpl(), 32, 16);
  ctx.font = nameFontTpl().replace("{S}", sfs);
  ctx.fillText(sig, 872, by + 28);

  /* NOTES行 */
  ctx.fillStyle = sub;
  ctx.font = "600 17px " + F.en;
  var nx = C.inner + 36;
  "NOTES".split("").forEach(function (ch) {
    ctx.fillText(ch, nx, C.notesY);
    nx += ctx.measureText(ch).width + 2;
  });
  dottedLine(ctx, nx + 14, C.notesY - 5, W - C.inner - 130, C.notesY - 5, "#c4b7b0", 1.5);
  drawHeart(ctx, W - C.inner - 102, C.notesY - 8, 12, pink, 0.85);
  drawHeart(ctx, W - C.inner - 72, C.notesY - 8, 12, pink, 0.7);
  drawHeart(ctx, W - C.inner - 42, C.notesY - 8, 12, pink, 0.55);
}

/* =====================================================================
   保存(共有シート → ダウンロード → 長押し保存フォールバック)
   保存画像はプレビューと同じ drawDesign() で 1200×1200 に直描き。
   ===================================================================== */
/* デバッグ/検証用に公開(プレビューと保存画像の一致確認に使える) */
window.createResultCanvas = function () { return createResultCanvas(); };
async function createResultCanvas() {
  var canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  await renderIntoCanvas(canvas);
  return canvas;
}
async function renderIntoCanvas(canvas) {
  var ctx = canvas.getContext("2d");
  await ensureFonts();
  var imgs = await loadSelectedImages();
  drawDesign(ctx, currentDesignId, imgs);
}

function isInAppBrowser() {
  var ua = navigator.userAgent || "";
  return /Twitter|X11;.*Twitter|Line\/|Instagram|FBAN|FBAV|FB_IAB/i.test(ua);
}

function canvasToBlob(canvas) {
  return new Promise(function (resolve, reject) {
    canvas.toBlob(function (blob) {
      if (blob) resolve(blob); else reject(new Error("Blob creation failed"));
    }, "image/png");
  });
}

async function saveResultImage() {
  var originalText = saveBtn.textContent;
  var fileName = "oshi-visual-6-" + currentDesignId + ".png";

  saveBtn.disabled = true;
  saveBtn.textContent = "画像を作成中…";
  setStatus("画像を作成中…", true);

  try {
    var canvas = await createResultCanvas();
    var blob = await canvasToBlob(canvas);
    var file = new File([blob], fileName, { type: "image/png" });

    // 1) 共有シート(iPhone Safariで「画像を保存」できる)
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ title: "推しビジュ6選", text: "推しビジュ6選を作ったよ", files: [file] });
        setStatus("共有シートを開きました。", true);
        stampTape();
        return;
      } catch (shareError) {
        if (shareError && shareError.name === "AbortError") {
          setStatus("共有をキャンセルしました。", true);
          return;
        }
        // 共有自体の失敗は次の手段へ
      }
    }

    // 2) アプリ内ブラウザ(Xなど)はダウンロード不可のことが多い
    //    → 画像を表示して長押し保存してもらう
    if (isInAppBrowser()) {
      showFallbackImage(canvas);
      setStatus("画像を長押しして保存してください。", true);
      stampTape();
      return;
    }

    // 3) 通常ダウンロード
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(function(){ URL.revokeObjectURL(url); }, 1000);
    setStatus("画像を保存しました。", true);
    stampTape();
  } catch (error) {
    console.error(error);
    // 失敗時も長押し保存の道を残す
    try {
      var c2 = await createResultCanvas();
      showFallbackImage(c2);
      setStatus("自動保存できなかったので、画像を長押しして保存してください。");
    } catch (e2) {
      setStatus("画像の保存に失敗しました。プレビューをスクリーンショットしてください。");
    }
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = originalText;
  }
}

function showFallbackImage(canvas) {
  fallbackImage.src = canvas.toDataURL("image/png");
  saveFallback.classList.add("active");
}

function stampTape() {}

function setStatus(message, ok) {
  statusEl.textContent = message || "";
  statusEl.classList.toggle("ok", !!ok);
  if (!message) return;
  window.clearTimeout(setStatus.timer);
  setStatus.timer = window.setTimeout(function(){ statusEl.textContent = ""; }, 3500);
}

})();
