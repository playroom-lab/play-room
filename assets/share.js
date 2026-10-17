/* PLAY ROOM 共通: 結果画像のシェア
   PRshare.open({ make, name, title, text, url })
     make  … 画像(Blob)を返す関数。Promise でもよい
     name  … 保存するときのファイル名
     text  … 投稿文(ハッシュタグ込み)。url はそのあとに付く
   画像ができたら、プレビューと「画像をシェア」「画像を保存」「Xでポスト」を出す。

   ・「画像をシェア」はスマホの共有シート。Xアプリを選べば、画像つき・ログイン済みでポストできる
     (x.com をブラウザで開く方式だと、アプリでログインしていてもブラウザ側のログインを求められるため)
   ・共有シートは「ボタンを押したその瞬間」にしか開けないので、画像は先に作っておき、押したら即座に開く
   ・共有シートが使えない環境(パソコン、LINE/Instagram/Xのアプリ内ブラウザなど)では、
     保存＋Xの投稿画面を開くボタンを出す。どの環境でも、画像の長押しで保存できる */
(function () {
  "use strict";
  var ua = navigator.userAgent || "";
  var IOS = /iP(hone|ad|od)/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  var INAPP = /Line\/|Instagram|FBAN|FBAV|Twitter|TwitterAndroid|XApp/i.test(ua);

  var css = '' +
    '.prs{position:fixed;inset:0;z-index:1000;display:flex;align-items:flex-end;justify-content:center;background:rgba(40,37,54,.55);padding:16px;padding-bottom:calc(16px + env(safe-area-inset-bottom,0px))}' +
    '.prs[hidden]{display:none}' +
    '.prs-box{width:100%;max-width:460px;max-height:100%;overflow:auto;background:#f7f5ed;border:1.5px solid #282536;border-radius:8px;box-shadow:4px 5px 0 #282536;padding:16px;font-family:"Zen Kaku Gothic New","Hiragino Sans","Yu Gothic",sans-serif;color:#282536;text-align:center}' +
    '@media(min-width:600px){.prs{align-items:center}}' +
    '.prs-t{margin:0 0 10px;font-weight:900;font-size:1rem;letter-spacing:.02em}' +
    '.prs-img{display:block;margin:0 auto;max-width:100%;max-height:52vh;border:1.5px solid #282536;background:#fff;-webkit-touch-callout:default;user-select:auto}' +
    '.prs-wait{padding:48px 0;font-family:"Klee One","Hiragino Sans",sans-serif;font-weight:600}' +
    '.prs-hint{margin:10px 0 0;font-size:.8125rem;color:#625f6d;line-height:1.6}' +
    '.prs-btns{display:flex;flex-direction:column;gap:8px;margin:14px 0 0}' +
    '.prs-b{display:block;width:100%;padding:12px 16px;border:1.5px solid #282536;border-radius:999px;background:#fff;color:#282536;font:inherit;font-weight:900;font-size:.9375rem;text-decoration:none;cursor:pointer;box-shadow:2px 3px 0 #282536}' +
    '.prs-b:active{transform:translate(2px,2px);box-shadow:0 1px 0 #282536}' +
    '.prs-b.main{background:#ffd5df}' +
    '.prs-b.x{background:#282536;color:#fff}' +
    '.prs-b.close{background:transparent;box-shadow:none;border-color:transparent;font-weight:700;color:#625f6d}' +
    '.prs-b small{display:block;font-weight:500;font-size:.75rem;opacity:.8}' +
    '.prs-toast{margin:8px 0 0;font-size:.8125rem;font-weight:700;min-height:1.2em}';
  var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);

  var root, cur = null, objUrl = null;
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function fullText(o) { return (o.text || "") + (o.url ? "\n" + o.url : ""); }
  function xUrl(o) { return "https://x.com/intent/post?text=" + encodeURIComponent(o.text || "") + (o.url ? "&url=" + encodeURIComponent(o.url) : ""); }

  function ensure() {
    if (root) return;
    root = el("div", "prs"); root.hidden = true; root.setAttribute("role", "dialog"); root.setAttribute("aria-modal", "true"); root.setAttribute("aria-label", "結果をシェア");
    root.addEventListener("click", function (e) { if (e.target === root) close(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && root && !root.hidden) close(); });
    document.body.appendChild(root);
  }
  function close() {
    if (!root) return;
    root.hidden = true; root.innerHTML = ""; cur = null;
    if (objUrl) { URL.revokeObjectURL(objUrl); objUrl = null; }
  }

  function canShareFile(file) {
    try { return !!(navigator.share && navigator.canShare && navigator.canShare({ files: [file] })); } catch (e) { return false; }
  }

  function render(o, blob) {
    var file = new File([blob], o.name || "playroom.png", { type: blob.type || "image/png" });
    var shareable = canShareFile(file);
    objUrl = URL.createObjectURL(blob);
    root.innerHTML = "";
    var box = el("div", "prs-box");
    box.appendChild(el("p", "prs-t", "結果の画像ができました"));
    var img = el("img", "prs-img"); img.src = objUrl; img.alt = (o.title || "結果") + "の画像"; box.appendChild(img);
    box.appendChild(el("p", "prs-hint", IOS || INAPP ? "画像を長押しすると、写真に保存できます" : "画像は右クリックや長押しでも保存できます"));
    var btns = el("div", "prs-btns");
    var toast = el("p", "prs-toast");

    if (shareable) {
      var b1 = el("button", "prs-b main", "画像をシェア<small>Xやインスタのアプリを選ぶと、画像つきで投稿できます</small>");
      b1.type = "button";
      b1.onclick = function () {
        /* 押した瞬間に開く(先に await をはさまない) */
        navigator.share({ files: [file], text: fullText(o), title: o.title || "" }).then(function () {
          toast.textContent = "";
        }).catch(function (e) {
          if (e && e.name === "AbortError") return;
          /* 文章つきで断られたら、画像だけで再挑戦 */
          navigator.share({ files: [file] }).catch(function (e2) {
            if (!e2 || e2.name !== "AbortError") toast.textContent = "シェアできませんでした。画像を長押しして保存してください";
          });
        });
      };
      btns.appendChild(b1);
    }
    if (!IOS && !INAPP) {
      var b2 = el("button", "prs-b" + (shareable ? "" : " main"), "画像を保存");
      b2.type = "button";
      b2.onclick = function () {
        var a = document.createElement("a"); a.href = objUrl; a.download = o.name || "playroom.png";
        document.body.appendChild(a); a.click(); a.remove();
        toast.textContent = "保存しました";
      };
      btns.appendChild(b2);
    }
    if (!shareable && o.text) {
      /* 共有シートがない環境: Xの投稿画面へ(画像は保存してから添付) */
      var b3 = el("a", "prs-b x", "Xでポスト<small>画像は保存してから添付してください</small>");
      b3.href = xUrl(o); b3.target = "_blank"; b3.rel = "noopener";
      btns.appendChild(b3);
    }
    var bc = el("button", "prs-b close", "閉じる"); bc.type = "button"; bc.onclick = close;
    btns.appendChild(bc);
    box.appendChild(btns); box.appendChild(toast);
    root.appendChild(box);
    (btns.querySelector("button,a") || bc).focus();
  }

  window.PRshare = {
    open: function (o) {
      ensure();
      close();
      var token = {}; cur = token;
      root.innerHTML = '<div class="prs-box"><p class="prs-wait">画像をつくっています…</p></div>';
      root.hidden = false;
      Promise.resolve().then(function () { return typeof o.make === "function" ? o.make() : o.make; }).then(function (blob) {
        if (cur !== token) return;
        if (!blob) throw new Error("no image");
        render(o, blob);
      }).catch(function (e) {
        if (cur !== token) return;
        console.error(e);
        root.innerHTML = "";
        var box = el("div", "prs-box", '<p class="prs-t">画像を作れませんでした</p><p class="prs-hint">もう一度試すか、画面をスクリーンショットしてください。</p>');
        var bc = el("button", "prs-b close", "閉じる"); bc.type = "button"; bc.onclick = close; box.appendChild(bc);
        root.appendChild(box);
      });
    },
    /* 文章とURLだけをシェア(画像なし)。共有シートがあればそれ、なければXの投稿画面 */
    text: function (o) {
      if (navigator.share) {
        navigator.share({ text: o.text || "", url: o.url || "", title: o.title || "" }).catch(function (e) {
          if (!e || e.name !== "AbortError") window.open(xUrl(o), "_blank", "noopener");
        });
      } else window.open(xUrl(o), "_blank", "noopener");
    },
    close: close
  };
})();
