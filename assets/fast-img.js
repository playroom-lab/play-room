/* PLAY ROOM 共通: 画像の軽量化
   写真の元画像(1枚300KB〜1MB超)を、このサイト内に置いた WebP 版に差し替えて読む。
     .f.webp … 元と同じ解像度(長辺最大1600px)・高画質。表示と保存画像に使う(1枚 約100KB)
     .m.webp … 幅640px。画面に大きめに出すカードに使う(1枚 約40KB)
     .t.webp … 幅360px。一覧や選択肢のサムネイルに使う(1枚 約15KB)
   同じサイト内(GitHub Pages)から配信されるので、外部の変換サービスを待たずに速く出る。
   WebP版が読めなかった <img> は自動で元画像に戻る(最悪でも従来と同じ)。
   画像を足したら: img/<リポジトリ名>/<元のパス>.f.webp / .m.webp / .t.webp を作ってここに置く。 */
(function () {
  "use strict";
  var me = document.currentScript && document.currentScript.src;
  var ROOT = me ? new URL("../", me).href : "/play-room/";
  var RAW = /^https:\/\/raw\.githubusercontent\.com\/rikomuze\/(mazzel-gacha|mazzel-outfit|mazzel-best-visual-performance|mazzel-best-visual|oshi-visual-6)\/main\/((?:images|photos)\/[^?#]+)\.(?:png|jpe?g)$/i;
  var ORIG = {};
  function size(w) { return !w ? ".f.webp" : w <= 400 ? ".t.webp" : w <= 800 ? ".m.webp" : ".f.webp"; }

  /* 元画像のURL → 軽量版のURL。w は表示幅の目安(400以下ならサムネイル) */
  window.PRfast = function (url, w) {
    var m = RAW.exec(url || "");
    if (!m) return url;
    var f = ROOT + "img/" + m[1] + "/" + m[2] + size(w);
    ORIG[f] = url;
    return f;
  };
  /* サイト内の画像(横に .f.webp / .t.webp を置いたもの) */
  window.PRlocal = function (path, w) {
    var f = path.replace(/\.(png|jpe?g)$/i, size(w));
    if (f !== path) ORIG[new URL(f, location.href).href] = new URL(path, location.href).href;
    return f;
  };
  /* 軽量版 → 同じ写真の別サイズ(t / m / f) */
  function resize(src, tier) {
    var t = String(src || "").replace(/\.[tmf]\.webp$/, "." + tier + ".webp");
    if (t !== src) { var a = new URL(src, location.href).href, b = new URL(t, location.href).href; if (ORIG[a]) ORIG[b] = ORIG[a]; }
    return t;
  }
  window.PRthumb = function (src) { return resize(src, "t"); };
  window.PRfull = function (src) { return resize(src, "f"); };
  /* 軽量版 → 元画像(読めなかったときの予備) */
  window.PRorig = function (src) {
    if (!src) return src;
    var abs = new URL(src, location.href).href;
    if (ORIG[abs]) return ORIG[abs];
    var w = /^https:\/\/wsrv\.nl\/\?url=([^&]+)/.exec(src);
    return w ? "https://" + decodeURIComponent(w[1]) : src;
  };
  /* <img>の読み込み失敗(エラーは伝播しないのでキャプチャで拾う) */
  document.addEventListener("error", function (e) {
    var t = e.target;
    if (!t || t.tagName !== "IMG" || t.onerror || t.dataset.prFallback) return; /* 自前のonerrorがある画像はそちらに任せる */
    var o = window.PRorig(t.src);
    if (o !== t.src) { t.dataset.prFallback = "1"; t.src = o; }
  }, true);
})();
