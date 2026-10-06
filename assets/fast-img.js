/* PLAY ROOM 共通: 画像の軽量化
   元画像(約100KB〜1MB)をそのまま読まず、リサイズ配信(wsrv.nl)で小さく読む。
   読み込みに失敗した <img> は自動で元の画像に戻る(最悪でも従来と同じ)。 */
(function () {
  "use strict";
  var HOSTS = /^https:\/\/(raw\.githubusercontent\.com|rikomuze\.github\.io)\//;
  window.PRfast = function (url, w) {
    if (!HOSTS.test(url)) return url;
    return "https://wsrv.nl/?url=" + encodeURIComponent(url.replace(/^https:\/\//, "")) + "&w=" + (w || 640) + "&output=jpg&q=82";
  };
  window.PRorig = function (src) {
    var m = /^https:\/\/wsrv\.nl\/\?url=([^&]+)/.exec(src || "");
    return m ? "https://" + decodeURIComponent(m[1]) : src;
  };
  /* <img>の読み込み失敗(エラーは伝播しないのでキャプチャで拾う) */
  document.addEventListener("error", function (e) {
    var t = e.target;
    if (!t || t.tagName !== "IMG" || t.dataset.prFallback) return;
    var o = window.PRorig(t.src);
    if (o !== t.src) { t.dataset.prFallback = "1"; t.src = o; }
  }, true);
})();
