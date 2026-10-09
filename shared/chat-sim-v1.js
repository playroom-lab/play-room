/* chat-sim-v1: shared engine for the ライブ帰りシミュレーター series.
   A scenario calls ChatSim.start(SCN). See haruya scenario for the shape. */
(function(){
"use strict";
const $=id=>document.getElementById(id);
const pick=a=>a&&a.length?a[Math.floor(Math.random()*a.length)]:undefined;
const rnd=(a,b)=>a+Math.floor(Math.random()*(b-a+1));
const shuffle=a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
const fmt=m=>{m=((Math.round(m)%1440)+1440)%1440;return Math.floor(m/60)+":"+String(m%60).padStart(2,"0")};
const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const ACT=s=>Object.assign({act:true},s);
const LS={get(k,d){try{const v=localStorage.getItem(k);return v?JSON.parse(v):d}catch(e){return d}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}};

let SCN,S=null,sid=0,timer=null,seen={},titlesGot={},diff="normal";

/* ---------------- skeleton ---------------- */
function mount(){
  const st=SCN.stats;
  let root=$("app");if(!root){root=document.createElement("div");root.className="app";root.id="app";document.body.appendChild(root)}
  if(!$("view")) root.innerHTML=`
  <div class="band" aria-label="ゲームの状態">
    <div class="srow">
      ${st.map(s=>`<div class="stat"><div class="lab"><span>${esc(s.label)}<em id="w_${s.key}"></em></span><b id="v_${s.key}"></b></div><div class="bar"><span id="b_${s.key}"></span></div></div>`).join("")}
      <div class="train"><small id="tkS"></small><b id="tkB"></b><i id="tkI"></i></div>
    </div>
    <button class="pinch" id="pinch" type="button" aria-expanded="false"><i id="pinchI">✓</i><span id="pinchT">いまのピンチはなし</span><small id="pinchN"></small></button>
    <div class="plist" id="plist" hidden></div>
    ${SCN.route?`<div class="route"><div class="track" id="track"><span class="fill" id="rFill"></span>${SCN.route.nodes.map((n,i)=>`<span class="node${i===SCN.route.nodes.length-1?" last":""}" style="left:${n[0]}%"><span>${esc(n[1])}</span></span>`).join("")}<span class="walker wait" id="rMe" style="left:0%"></span></div></div>`:""}
    <div class="arow"><div class="stage" id="stage"><b>いま</b><span></span></div><span class="acts" id="acts"></span></div>
  </div>
  <div class="phone">
    <div class="sbar" id="sbar"><span id="clk"></span><span class="r"><span>4G</span><span class="bat" id="bat"><span id="batp"></span><i><b id="batb"></b></i></span></span></div>
    <div class="view" id="view"></div>
  </div>
  <button class="pa" id="pa" type="button" aria-live="polite"><i id="paI"></i><b id="paT"></b><span id="paX"></span></button>
  <div class="scene" id="scene" hidden></div>
  <div class="ov intro" id="intro"></div>
  <div class="ov call" id="call" hidden></div>
  <div class="ov osd" id="osd" hidden></div>
  <div class="ov result" id="result" hidden></div>`;
  if(SCN.stats.length!==2) $("app").querySelector(".srow").style.gridTemplateColumns=`repeat(${SCN.stats.length},1fr) auto`;
  $("pinch").onclick=()=>{if(!S||S.over)return;const el=$("plist");el.hidden=!el.hidden;$("pinch").setAttribute("aria-expanded",String(!el.hidden));drawPlist()};
  $("pa").onclick=()=>{const th=$("pa").dataset.th;$("pa").classList.remove("on");clearTimeout(bT);setTimeout(nextBanner,320);if(th&&S) openTh(th)};
}

/* ---------------- state ---------------- */
function fresh(name){
  const th={};
  for(const k of SCN.order){const d=SCN.threads[k];th[k]={msgs:(d.msgs||[]).map(m=>Object.assign({read:true},m)),unread:0,pending:null,queue:[],busy:false,last:d.last||null,lastT:d.lastT||0,aq:[],asking:false,idle:0,chase:0}}
  const s={name,diff:SCN.diffs?diff:"normal",t:SCN.start,acc:0,view:"list",th,fired:{},over:false,callOn:false,m:{by:{},chased:0,calls:0,miss:0,notif:0,photo:0}};
  for(const st of SCN.stats) s[st.key]=st.init;
  if(SCN.diffs){const D=SCN.diffs[s.diff];for(const k in (D.stats||{})) s[k]=D.stats[k]}
  if(SCN.init) SCN.init(s,api);
  return s;
}
function fill(x){let r=String(x).replace(/\{name\}/g,S?S.name:"");if(SCN.fill&&S) r=SCN.fill(S,r);return r}
function later(fn,ms){const my=sid;setTimeout(()=>{if(my===sid&&S&&!S.over) fn()},ms)}

/* ---------------- clock ---------------- */
function startClock(){
  clearInterval(timer);const my=sid;
  timer=setInterval(()=>{
    if(my!==sid||!S||S.over||!$("scene").hidden) return;
    const q=isQuiet();S.qms=q?(S.qms||0)+250:0;
    if(q&&S.qms>=(SCN.quietMs||8000)){S.qms=0;fireFiller()}
    S.acc+=(q&&S.qms>=1500)?(S.noFill?3000:(SCN.ffStep||1500)):250;
    if(S.acc>=SCN.speed){S.acc-=SCN.speed;minute()}
    idleTick(250);
  },250);
}
function isQuiet(){
  if(S.callOn||!$("osd").hidden) return false;
  for(const k of SCN.order){const T=S.th[k];if(T.busy||T.asking&&!T.pending) return false;if(T.pending&&!T.pending.end&&!SCN.threads[k].static&&Date.now()-(T.pendAt||0)<6000) return false}
  return true;
}
function fireFiller(){
  if(!SCN.fillers) return;
  if(!S.fq) S.fq=shuffle(SCN.fillers.map((f,i)=>i));
  for(let n=0;n<S.fq.length;n++){
    const i=S.fq[n],f=SCN.fillers[i];
    if(S.usedF&&S.usedF[i]) continue;
    if(f.when&&!f.when(S)) continue;
    if(openQ(f.th)||S.th[f.th].asking||S.th[f.th].busy) continue;
    (S.usedF=S.usedF||{})[i]=1;S.noFill=0;
    if(f.f) f.f(S,api); else if(f.choices) ask(f.th,f.lines,f.choices); else them(f.th,f.lines);
    return;
  }
  S.noFill=1;
}
function minute(){
  S.t++;
  if(SCN.minute) SCN.minute(S,api,S.t-SCN.start);
  if(S.over) return;
  runEvents();
  if(S.over) return;
  hud();
}
function addTime(n){for(let i=0;i<n&&!S.over;i++) minute()}
function runEvents(){SCN.events.forEach((e,i)=>{if(S.over||S.fired[i]) return;const at=typeof e.at==="function"?e.at(S):e.at;if(S.t>=at){S.fired[i]=1;e.f(S,api)}})}
function idleTick(ms){
  if(!SCN.chase) return;
  const quiet=!S.callOn&&$("osd").hidden;
  for(const th in SCN.chase){
    const c=SCN.chase[th],T=S.th[th];
    if(T.pending&&!T.pending.end&&!T.busy&&quiet){T.idle+=ms;if(T.idle>=c.ms&&T.chase<c.max){T.idle=0;T.chase++;S.m.chased++;them(th,[c.lines[(T.chase-1)%c.lines.length]]);if(c.on)c.on(S,api)}}
    else T.idle=0;
  }
}

/* ---------------- stats ---------------- */
function change(k,d){
  const st=SCN.stats.find(s=>s.key===k);
  if(!st){S[k]=(S[k]||0)+d;return}
  const before=S[k];S[k]=Math.max(0,Math.min(st.max||100,S[k]+d));
  if(S[k]!==before){const el=$("v_"+k);if(el){el.classList.add("flash");clearTimeout(el._t);el._t=setTimeout(()=>el.classList.remove("flash"),700)}}
  if(SCN.onStat) SCN.onStat(S,api,k);
  hud();
}
function applyFx(fx){if(!fx)return;for(const k in fx) change(k,fx[k])}

/* ---------------- messaging ---------------- */
function line(th,obj){obj.t=S.t;S.th[th].msgs.push(obj);S.th[th].lastT=S.t}
function sys(th,x){S.th[th].msgs.push({k:"sys",x:fill(x),read:true});S.th[th].lastT=S.t;render()}
function preview(o){return o.stamp?"スタンプを送信しました":o.photo?"写真を送信しました":o.x}
function them(th,lines,opts={}){const T=S.th[th];T.queue.push({lines:lines.slice(),opts});if(!T.busy) drain(th)}
function drain(th){
  const T=S.th[th],my=sid;
  const job=T.queue.shift();
  if(!job){T.busy=false;render();return}
  T.busy=true;
  const step=()=>{
    if(my!==sid||S.over) return;
    if(!job.lines.length){T.busy=false;if(job.opts.then) job.opts.then();render();if(T.queue.length&&!T.busy) drain(th);return}
    T.typing=true;render();
    const raw=job.lines.shift();
    let obj;
    if(Array.isArray(raw)&&SCN.threads[th].group) obj={k:"them",who:raw[0],x:fill(raw[1])};
    else if(Array.isArray(raw)) obj={k:"them",stamp:raw};
    else if(typeof raw==="object") obj=Object.assign({k:"them"},raw,raw.x?{x:fill(raw.x)}:{});
    else obj={k:"them",x:fill(raw)};
    const txt=obj.x||"";
    setTimeout(()=>{
      if(my!==sid||S.over) return;
      T.typing=false;
      line(th,obj);
      T.last=(obj.who?obj.who+": ":"")+preview(obj);
      if(S.view===th){obj.read=true;if(SCN.onRead) SCN.onRead(S,api,th,[obj])}
      else{T.unread++;S.m.notif++;banner(th,SCN.threads[th].name,T.last)}
      render();step();
    },Math.min(900+txt.length*65,2200)+Math.random()*400);
  };
  step();
}
function me(th,o){line(th,Object.assign({k:"me",read:true},o));S.th[th].last=preview(o);render()}
function setPending(th,choices,onPick,end){S.th[th].pendT=S.t;S.th[th].pendAt=Date.now();S.th[th].pending={choices:end?choices:shuffle(choices),onPick,end:!!end};render()}
function endStamp(th,choices){setPending(th,choices,()=>{},true)}
const openQ=th=>{const P=S.th[th].pending;return P&&!P.end};
function answer(th,c){
  const T=S.th[th];if(!T.pending) return;
  const why=SCN.canReply&&SCN.canReply(S,th);if(why) return;
  const p=T.pending;T.pending=null;
  if(!p.end){S.m.by[th]=(S.m.by[th]||0)+1;S.lastAns=S.lastAns||{};S.lastAns[th]=S.t}
  if(c.photo){S.m.photo++;me(th,{photo:c.photo})}
  else if(c.stamp) me(th,{stamp:c.stamp});
  else me(th,{x:fill(c.t)});
  if(c.time) addTime(c.time);
  p.onPick(c);
}
function ask(th,lines,choices,after){
  const T=S.th[th];
  if(openQ(th)||T.asking){T.aq.push([lines,choices,after]);return}
  T.asking=true;T.chase=0;T.idle=0;
  them(th,lines,{then:()=>setPending(th,choices,c=>{applyFx(c.fx);if(c.on)c.on(S,api,c);later(()=>them(th,c.r||[],{then:()=>{T.asking=false;if(c.after)c.after(c);if(after)after(c);askNext(th)}}),400)})});
}
function askNext(th){const T=S.th[th];if(T.aq.length&&!openQ(th)&&!T.asking){const a=T.aq.shift();ask(th,a[0],a[1],a[2])}}

/* ---------------- notifications (one slim strip) ---------------- */
let bq=[],bOn=false,bT=null;
function banner(th,t,x,kind){bq.push({th,t,x,kind});if(!bOn) nextBanner()}
function nextBanner(){
  const el=$("pa");let b=bq.shift();
  while(b&&S&&b.kind!=="pa"&&b.th&&S.view===b.th) b=bq.shift();
  if(!b||!S||S.over){bOn=false;el.classList.remove("on");return}
  bOn=true;const i=$("paI");const d=b.th?SCN.threads[b.th]:null;
  i.style.background=b.kind==="pa"?"#6b6680":b.kind==="rain"?"#7fb2ff":d?d.col:"#6b6680";
  i.textContent=b.kind==="pa"?"📢":b.kind==="rain"?"☂":d?d.ini:"!";
  $("paT").textContent=b.t;$("paX").textContent=b.x;
  el.dataset.th=b.kind==="pa"?"":(b.th||"");el.classList.add("on");
  clearTimeout(bT);bT=setTimeout(()=>{el.classList.remove("on");setTimeout(nextBanner,320)},b.kind==="pa"?4200:2800);
}
function info(src,x,kind){const k=SCN.infoThread||"info";const T=S.th[k];line(k,{k:"them",who:src,x:fill(x),read:S.view===k});T.last=src+": "+fill(x);if(S.view!==k){T.unread++;S.m.notif++}banner(k,src,fill(x),kind);render()}

/* ---------------- overlays ---------------- */
let sceneT=null;
function scene(tag,title,body,hand,kind,opt){
  const el=$("scene");el.hidden=false;opt=opt||{};
  el.innerHTML=`<div class="scard ${kind||""}" role="status"><span class="tag">${esc(fill(tag))}</span><h3><span>${esc(fill(title))}</span></h3><p>${esc(fill(body))}</p>${hand?`<p class="hand">${esc(fill(hand))}</p>`:""}${opt.wait?`<p class="tapnext">タップでつづき ›</p>`:""}</div>`;
  clearTimeout(sceneT);let shut=false;const close=()=>{if(shut)return;shut=true;el.hidden=true;clearTimeout(sceneT);if(opt.onClose)opt.onClose()};el.onclick=close;
  if(!opt.wait) sceneT=setTimeout(close,3200);
}
function confirmBox(title,body,yes,no,onYes){
  const el=$("osd");el.hidden=false;el.className="ov osd";
  el.innerHTML=`<div class="osbox" role="dialog" aria-label="${esc(title)}"><div class="in"><b>${esc(fill(title))}</b><p>${esc(fill(body))}</p></div><div class="bt"><button type="button" id="cbN">${esc(no)}</button><button type="button" id="cbY">${esc(yes)}</button></div></div>`;
  $("cbN").onclick=()=>{el.hidden=true};$("cbY").onclick=()=>{el.hidden=true;onYes()};
}
function menu(title,body,items){
  const el=$("osd");el.hidden=false;el.className="ov osd";
  const done=items.filter(it=>it.done),live=items.map((it,i)=>[it,i]).filter(([it])=>!it.done);
  el.innerHTML=`<div class="osbox menu" role="dialog" aria-label="${esc(title)}"><div class="in"><b>${esc(title)}</b>${body?`<p>${esc(body)}</p>`:""}</div><div class="bt v scroll">${live.map(([it,i])=>`<button type="button" data-i="${i}" ${it.disabled?"disabled":""}>${esc(fill(it.label))}${it.sub?`<small>${esc(fill(it.sub))}</small>`:""}</button>`).join("")}${done.length?`<p class="done">済み：${done.map(it=>esc(it.short||it.label)).join("・")}</p>`:""}</div><div class="bt v"><button type="button" id="mX">閉じる</button></div></div>`;
  el.querySelectorAll("button[data-i]").forEach(b=>b.onclick=()=>{el.hidden=true;const it=items[+b.dataset.i];if(it&&!it.disabled&&it.on) it.on()});
  $("mX").onclick=()=>{el.hidden=true};
  el.onclick=e=>{if(e.target===el) el.hidden=true};
}
function incoming(th,o){
  if(S.over) return;
  if(S.callOn||!$("scene").hidden){later(()=>incoming(th,o),3000);return}
  S.callOn=true;const d=SCN.threads[th];
  const el=$("call");el.hidden=false;el.classList.remove("live");let decided=false;
  el.innerHTML=`<div><div class="av" style="background:${d.col}">${d.ini}</div><h3>${esc(d.name)}</h3><p>${esc(o.label||"音声通話の着信")}</p></div><div class="subs"></div>
  <div class="cbtns"><button class="cb no" id="cNo" type="button"><i>✕</i>拒否</button><button class="cb yes" id="cYes" type="button"><i>✆</i>応答</button></div>`;
  const decline=missed=>{if(decided)return;decided=true;el.hidden=true;S.callOn=false;line(th,{k:"call",x:missed?"不在着信":"キャンセル",read:true});S.th[th].last=missed?"不在着信":"通話をキャンセルしました";S.m.miss++;render();o.onDecline&&o.onDecline()};
  $("cNo").onclick=()=>decline(false);
  $("cYes").onclick=()=>{if(decided)return;decided=true;S.m.calls++;talk(el,th,o.lines,o.cost||3,o.onEnd)};
  later(()=>{if(!decided) decline(true)},11000);
}
function callOut(th,lines,onEnd,cost){
  if(S.over||S.callOn) return;
  S.callOn=true;const d=SCN.threads[th];const el=$("call");el.hidden=false;
  el.innerHTML=`<div><div class="av" style="background:${d.col}">${d.ini}</div><h3>${esc(d.name)}</h3><p>発信中…</p></div><div class="subs"></div><div class="cbtns"></div>`;
  later(()=>talk(el,th,lines,cost==null?2:cost,onEnd),1400);
}
function ring(th,onEnd,ms){
  if(S.over||S.callOn) return;
  S.callOn=true;const d=SCN.threads[th];const el=$("call");el.hidden=false;el.classList.remove("live");
  el.innerHTML=`<div><div class="av" style="background:${d.col}">${d.ini}</div><h3>${esc(d.name)}</h3><p>呼び出し中…</p></div><div class="subs"><div class="s">プルルル…</div></div><div class="cbtns"><button class="cb no" type="button" id="rgX"><i>✕</i>切る</button></div>`;
  let done=false;const fin=()=>{if(done)return;done=true;el.hidden=true;S.callOn=false;line(th,{k:"me",x:"✆ 不在着信",read:true});S.th[th].last="発信しました";addTime(1);render();onEnd&&onEnd()};
  $("rgX").onclick=fin;later(fin,ms||3600);
}
function talk(el,th,lines,cost,onEnd){
  el.classList.add("live");const p=el.querySelector("p");p.textContent="0:00";
  el.querySelector(".cbtns").innerHTML=`<button class="cb no" type="button" disabled><i>✕</i>通話中</button>`;
  const subs=el.querySelector(".subs");let sec=0,i=0;const my=sid;
  const tick=setInterval(()=>{if(my!==sid){clearInterval(tick);return}sec++;p.textContent=Math.floor(sec/60)+":"+String(sec%60).padStart(2,"0")},400);
  const next=()=>{
    if(i>=lines.length){clearInterval(tick);later(()=>{el.hidden=true;S.callOn=false;line(th,{k:"call",x:"通話時間 "+Math.floor(sec/60)+":"+String(sec%60).padStart(2,"0"),read:true});S.th[th].last="通話が終了しました";addTime(cost);onEnd&&onEnd();render()},700);return}
    const dv=document.createElement("div");dv.className="s";dv.textContent=fill(lines[i++]);subs.appendChild(dv);if(subs.children.length>3) subs.firstChild.remove();
    later(next,1900);
  };
  later(next,600);
}

/* ---------------- HUD ---------------- */
function hud(){
  if(!S) return;
  $("clk").textContent=fmt(S.t);
  for(const st of SCN.stats){
    const v=S[st.key];$("v_"+st.key).textContent=Math.round(v);
    const b=$("b_"+st.key);b.style.width=Math.max(0,Math.min(100,v/(st.max||100)*100))+"%";b.style.background=st.color?st.color(v,S):"var(--pink)";
    $("w_"+st.key).textContent=st.warn?st.warn(v,S)||"":"";
  }
  const tk=SCN.ticket(S);$("tkS").textContent=tk.small;$("tkB").textContent=tk.big;const ti=$("tkI");ti.textContent=tk.sub||"";ti.className=tk.cls||"";
  const bat=S.bat!=null?Math.round(S.bat):(SCN.phoneBattery||64);$("batp").textContent=bat+"%";$("batb").style.width=Math.max(2,bat/100*19)+"px";
  $("bat").classList.toggle("low",bat<=20&&!S.lp);$("bat").classList.toggle("lp",!!S.lp);
  pinch();drawPlist();
  if(SCN.route){
    const pct=Math.max(0,Math.min(100,SCN.route.pct(S)));
    $("rFill").style.width=pct+"%";$("rMe").style.left=pct+"%";$("rMe").classList.toggle("wait",!!(SCN.route.wait&&SCN.route.wait(S)));
    document.querySelectorAll("#track .node").forEach((n,i)=>n.classList.toggle("on",pct>=SCN.route.nodes[i][0]));
  }
  const sg=SCN.stage(S);const st=$("stage");st.className="stage"+(sg.ready?" ready":"");st.innerHTML=`<b>${esc(sg.tag||"いま")}</b><span>${esc(sg.text)}</span>`;
  const acts=$("acts");acts.innerHTML=(sg.acts||[]).map((a,i)=>`<button class="act${a.sub?" sub":""}${a.pulse?" pulse":""}" type="button" data-i="${i}" ${a.disabled?"disabled":""}>${esc(a.label)}</button>`).join("");
  acts.querySelectorAll("button").forEach(b=>b.onclick=()=>{const a=sg.acts[+b.dataset.i];if(a&&!a.disabled&&S&&!S.over) a.on()});
}
function alerts(){
  const A=SCN.alerts?SCN.alerts(S).slice():[];
  for(const k of SCN.order){const T=S.th[k];if(T.pending&&!T.pending.end&&!T.busy&&!SCN.threads[k].static) A.push({lv:1,x:SCN.threads[k].short||SCN.threads[k].name,th:k,wait:1})}
  return A.map(a=>a.wait?Object.assign(a,{x:a.x+"が返事を待っている"}):a).sort((a,b)=>b.lv-a.lv);
}
function pinch(){
  const A=alerts(),el=$("pinch"),top=A[0];
  el.className="pinch"+(top?top.lv>=3?" crit":top.lv===2?" warn":"":"");
  $("pinchI").textContent=top?top.lv>=2?"!":"i":"✓";$("pinchT").textContent=top?top.x:"いまのピンチはなし";
  $("pinchN").textContent=A.length>1?"ほか"+(A.length-1)+"件":"";
}
function drawPlist(){
  const el=$("plist");if(el.hidden||!S) return;const A=alerts();
  el.innerHTML=A.length?A.map((a,i)=>`<button type="button" class="l${a.lv}" data-i="${i}" ${a.th?"":"disabled"}><i></i><span>${esc(a.x)}</span>${a.th?"<small>開く ›</small>":""}</button>`).join(""):"<p>いまのピンチはなし</p>";
  el.querySelectorAll("button[data-i]").forEach(b=>b.onclick=()=>{const a=A[+b.dataset.i];if(a&&a.th){closePlist();openTh(a.th)}});
}
function closePlist(){const el=$("plist");if(el){el.hidden=true;$("pinch").setAttribute("aria-expanded","false")}}

/* ---------------- render ---------------- */
function openTh(th){
  S.view=th;const T=S.th[th];T.unread=0;
  const fresh=T.msgs.filter(m=>m.k==="them"&&!m.read);fresh.forEach(m=>m.read=true);
  if(fresh.length&&SCN.onRead) SCN.onRead(S,api,th,fresh);
  bq=bq.filter(b=>b.th!==th||b.kind==="pa");
  if($("pa").dataset.th===th){$("pa").classList.remove("on");clearTimeout(bT);setTimeout(nextBanner,320)}
  render(true);hud();
}
function totalUnread(ex){let n=0;for(const k of SCN.order) if(k!==ex) n+=S.th[k].unread;return n}
function avatar(k){const d=SCN.threads[k];return `<span class="av" style="background:${d.col}">${d.ini}</span>`}
function render(scroll){
  if(!S) return;
  const v=$("view");
  $("sbar").style.background=S.view==="list"?"var(--app)":"var(--wall)";
  if(S.view==="list"){
    const rows=SCN.order.filter(k=>S.th[k].lastT).sort((a,b)=>(S.th[b].lastT||0)-(S.th[a].lastT||0)).map(k=>{
      const T=S.th[k],d=SCN.threads[k];
      return `<button class="row" type="button" data-th="${k}">${avatar(k)}<span style="min-width:0"><div class="nm">${esc(d.name)}${d.n?`<small>(${d.n})</small>`:""}</div><div class="pv">${esc(T.last||"")}</div></span><span class="side">${fmt(T.lastT)}${T.unread?`<span class="badge">${T.unread}</span>`:""}</span></button>`;
    }).join("");
    const oldList=v.querySelector(".list"),keepY=oldList?oldList.scrollTop:0;
    v.innerHTML=`<div class="list"><div class="lhead"><h2>トーク</h2><span class="ic" aria-hidden="true"><span>⌕</span><span>✎</span></span></div><div class="search">検索</div><div class="tabs" aria-hidden="true"><span class="on">すべて</span><span>友だち</span><span>グループ</span><span>公式アカウント</span></div>${rows}</div><div class="nav" aria-hidden="true"><span><i>⌂</i>ホーム</span><span class="on"><i>💬</i>トーク</span><span><i>▤</i>ニュース</span><span><i>☰</i>ウォレット</span></div>`;
    v.querySelector(".list").scrollTop=keepY;
    v.querySelectorAll(".row").forEach(b=>b.onclick=()=>openTh(b.dataset.th));
    return;
  }
  const th=S.view,T=S.th[th],d=SCN.threads[th];
  const prev=v.querySelector(".msgs");const atBottom=!prev||prev.scrollHeight-prev.scrollTop-prev.clientHeight<80;
  let html=`<div class="day">今日</div>`,prevKey=null;
  for(const m of T.msgs){
    if(m.k==="sys"){html+=`<div class="sys">${esc(m.x)}</div>`;prevKey=null;continue}
    const mine=m.k==="me";const key=mine?"me":"them:"+(m.who||"");const first=key!==prevKey;prevKey=key;
    let body;
    if(m.k==="call") body=`<div class="bub">✆ ${esc(m.x)}</div>`;
    else if(m.photo) body=`<div class="photo ${esc(m.photo)}" role="img" aria-label="写真"><i></i></div>`;
    else if(m.stamp) body=`<div class="stamp"><span><b>${m.stamp[0]}</b>${esc(m.stamp[1])}</span></div>`;
    else body=`<div class="bub${m.oshi?" oshi":""}${m.tag?" "+esc(m.tag):""}">${esc(m.x)}</div>`;
    const tm=`<span class="tm">${mine?`<span>${d.group?"既読"+(d.n?d.n-1:2):"既読"}</span>`:""}<span>${m.t!=null?fmt(m.t):""}</span></span>`;
    if(mine) html+=`<div class="m me${first?" first":""}"><span class="col">${body}</span>${tm}</div>`;
    else{const showWho=first&&(d.group||th===(SCN.infoThread||"info"))&&m.who;html+=`<div class="m them${first?" first":""}">${first?avatar(th):`<span class="gap"></span>`}<span class="col">${showWho?`<span class="who">${esc(m.who)}</span>`:""}${body}</span>${tm}</div>`}
  }
  if(T.typing) html+=`<div class="m them">${prevKey&&prevKey.startsWith("them")?`<span class="gap"></span>`:avatar(th)}<div class="typing" aria-label="入力中"><i></i><i></i><i></i></div></div>`;
  const tu=totalUnread(th);
  let reply="";
  if(T.pending&&!T.busy){
    const why=SCN.canReply&&SCN.canReply(S,th);
    reply=why?`<div class="reply"><div class="busy">${esc(why)}</div></div>`:`<div class="reply"><div class="q">返信を選ぶ</div>${T.pending.choices.map((c,i)=>`<button class="choice${c.act?" actn":""}" type="button" data-i="${i}">${esc(c.t?fill(c.t):c.stamp?"（スタンプ）"+c.stamp[0]+" "+c.stamp[1]:"")}${c.cost?`<small>${esc(fill(c.cost))}</small>`:""}</button>`).join("")}</div>`;
  }
  v.innerHTML=`<div class="chat"><div class="chead"><button class="back" type="button" id="back" aria-label="トーク一覧に戻る">‹${tu?`<span class="badge">${tu}</span>`:""}</button><span class="t">${esc(d.name)}${d.n?` (${d.n})`:""}</span><span class="ic" aria-hidden="true"><span>⌕</span><span>✆</span><span>≡</span></span></div><div class="msgs" id="msgs">${html}</div>${reply}</div>`;
  $("back").onclick=()=>{S.view="list";render();hud()};
  v.querySelectorAll(".choice").forEach(b=>b.onclick=()=>answer(th,T.pending.choices[+b.dataset.i]));
  const ms=$("msgs");if(scroll||atBottom) ms.scrollTop=ms.scrollHeight;
}

/* ---------------- endings, titles, result ---------------- */
function pickTitle(kind){return SCN.titles.find(t=>t.ok(S,kind))||SCN.titles[SCN.titles.length-1]}
function end(kind){
  if(!S||S.over) return;
  S.over=true;S.endKind=kind;clearInterval(timer);S.name="推し";closePlist();
  ["call","osd","scene"].forEach(id=>$(id).hidden=true);$("pa").classList.remove("on");
  seen[kind]=1;LS.set(SCN.id+":seen",seen);
  S.titleObj=pickTitle(kind);S.newTitle=!titlesGot[S.titleObj.id];titlesGot[S.titleObj.id]=1;LS.set(SCN.id+":titles",titlesGot);
  const go=()=>{
    const el=$("result");el.hidden=false;const E=SCN.endings[kind];const keys=SCN.endOrder;
    const got=keys.filter(k=>seen[k]).length;const no=String(keys.indexOf(kind)+1).padStart(2,"0");
    const R=SCN.result(S,kind);const clear=!!E.clear;
    const tGot=SCN.titles.filter(t=>titlesGot[t.id]).length;
    el.innerHTML=`<div class="pnav"><a href="../../">PLAY ROOM</a><span>ENDING ${got} / ${keys.length}</span></div>
    <header class="hero${clear?" clear":""}"><div><p class="tag">${clear?"CLEAR":"ENDING "+no}</p><h2><span>${esc(E.name)}</span></h2><p class="note">${fmt(S.t)}、${esc(SCN.where(S))}にて。</p></div><p class="ticket">${esc(R.ticket[0])}<strong>${esc(R.ticket[1])}</strong></p></header>
    <div class="pcard pink"><p class="lbl">今夜のこと</p><p class="end">${esc(fill(E.text))}</p>
      <div class="checks">${R.checks.map(c=>`<div class="${c[1]?"ok":"ng"}"><b>${c[1]?"✓":"—"}</b>${esc(c[0])}</div>`).join("")}</div>
      ${R.big?`<div class="cards"><b>${R.big.n}</b><span>/ ${R.big.of}</span><small>${esc(R.big.label)}</small></div>`:""}
      <div class="stampbox"><small>称号${S.newTitle?"　NEW":""}</small><b>${esc(S.titleObj.name)}</b></div></div>
    <div class="pcard"><p class="lbl">きろく</p><dl class="kv">${(SCN.diffs?[["難易度",SCN.diffs[S.diff].name]]:[]).concat(R.kv).map(r=>`<dt>${esc(r[0])}</dt><dd>${esc(r[1])}</dd>`).join("")}</dl></div>
    <div class="pcard violet"><p class="lbl">見たエンディング ${got} / ${keys.length}</p><div class="endmap">${keys.map(k=>`<span class="${seen[k]?"got":""}${k===kind?" clear":""}">${seen[k]?esc(SCN.endings[k].name):"？？？"}</span>`).join("")}</div></div>
    <div class="pcard sky"><p class="lbl">集めた称号 ${tGot} / ${SCN.titles.length}</p><div class="endmap titles">${SCN.titles.map(t=>`<span class="${titlesGot[t.id]?"got":""}${t.id===S.titleObj.id?" clear":""}">${titlesGot[t.id]?esc(t.name):"？？？"}</span>`).join("")}</div><p class="thint">「？？？」のヒント：${esc((pick(SCN.titles.filter(t=>!titlesGot[t.id]))||{hint:"ぜんぶ集めました！"}).hint)}</p></div>
    <button class="go" type="button" id="saveImg">結果を画像で保存</button>
    <button class="go sub" type="button" id="again">もう一度遊ぶ</button>
    <p class="handnote">${esc(clear?(SCN.clearNote||"次は、ちがう夜で。"):"次は、ちがう夜で。")}</p>
    ${SCN.links?`<div class="pcard"><p class="lbl">ほかの夜</p><div class="endmap">${SCN.links.map(l=>`<a class="lnk" href="${esc(l[1])}">${esc(l[0])}</a>`).join("")}</div></div>`:""}
    <p class="fine">${esc(SCN.fine)}</p>`;
    $("again").onclick=showIntro;
    const img={kind,no,got,total:keys.length,ending:E.name,clear,text:fill(E.text),time:fmt(S.t),where:SCN.where(S),ticket:R.ticket,checks:R.checks,big:R.big,title:S.titleObj.name,name:S.name,nameLabel:SCN.intro.field?SCN.intro.field.short:"",stats:R.stats};
    const blobP=makeImage(img).catch(()=>null);
    $("saveImg").onclick=()=>saveResult(blobP);
  };
  if(SCN.endings[kind].black){const el=$("osd");el.hidden=false;el.className="ov dead";el.innerHTML="";setTimeout(()=>{el.hidden=true;el.className="ov osd";go()},1600)}else go();
}
function wrapText(ctx,text,maxW){const lines=[];let cur="";for(const ch of text){if(ctx.measureText(cur+ch).width>maxW&&cur&&!"。、！？」）ー…".includes(ch)){lines.push(cur);cur=ch}else cur+=ch}if(cur)lines.push(cur);return lines}
async function makeImage(R){
  try{if(document.fonts){await Promise.all([document.fonts.load('900 80px "Zen Kaku Gothic New"'),document.fonts.load('700 36px "Zen Kaku Gothic New"'),document.fonts.load('600 40px "Klee One"')])}}catch(e){}
  const W=1080,H=1350,c=document.createElement("canvas");c.width=W;c.height=H;const x=c.getContext("2d");
  const INK="#282536",PAPER="#f7f5ed",PINK="#ffd5df",LIME="#dcefa5",VIOLET="#ded7ff",MUTED="#625f6d";
  const G='"Zen Kaku Gothic New","Hiragino Sans",sans-serif',HAND='"Klee One","Hiragino Sans",sans-serif';
  x.fillStyle=PAPER;x.fillRect(0,0,W,H);
  x.fillStyle=INK;x.font="700 34px "+G;x.fillText(SCN.title,80,110);
  x.textAlign="right";x.font="600 32px "+HAND;x.fillText("ENDING "+R.got+" / "+R.total,W-80,110);x.textAlign="left";
  x.strokeStyle="#d5d1d9";x.lineWidth=2;x.beginPath();x.moveTo(80,140);x.lineTo(W-80,140);x.stroke();
  x.save();x.translate(80,215);x.rotate(-3*Math.PI/180);x.font="700 30px "+G;const tag=(R.clear?"CLEAR":"ENDING "+R.no)+(SCN.diffs&&S&&S.diff==="hard"?"・ムズい":"");const tw=x.measureText(tag).width;x.fillStyle=INK;x.fillRect(0,-36,tw+36,50);x.fillStyle=PAPER;x.fillText(tag,18,0);x.restore();
  let fs=84;x.font="900 "+fs+"px "+G;while(x.measureText(R.ending).width>640&&fs>56){fs-=4;x.font="900 "+fs+"px "+G}
  let y=330;for(const t of wrapText(x,R.ending,640)){const w=x.measureText(t).width;x.save();x.translate(80,y);x.rotate(-1.8*Math.PI/180);x.fillStyle=R.clear?LIME:PINK;x.fillRect(-10,-20,w+20,30);x.restore();x.fillStyle=INK;x.fillText(t,80,y);y+=100}
  x.font="600 38px "+HAND;x.fillStyle=INK;x.fillText(R.time+"、"+R.where+"にて。",80,y-20);
  x.save();x.translate(W-210,250);x.rotate(5*Math.PI/180);x.fillStyle="#fff";x.fillRect(-90,-70,180,150);x.strokeStyle=INK;x.lineWidth=4;x.strokeRect(-90,-70,180,150);x.fillStyle=INK;x.textAlign="center";x.font="700 26px "+G;x.fillText(R.ticket[0],0,-25);x.font="500 64px "+G;x.fillText(String(R.ticket[1]),0,52);x.restore();x.textAlign="left";
  const cy=y+20,cx=80,cw=W-160;x.font="500 32px "+G;let tl=wrapText(x,R.text,cw-80);if(tl.length>5){tl=tl.slice(0,5);tl[4]=tl[4].slice(0,-1)+"…"}
  const ch=90+tl.length*52+10+165+200+100;
  x.fillStyle=INK;x.fillRect(cx+10,cy+12,cw,ch);x.fillStyle="#fff";x.fillRect(cx,cy,cw,ch);x.strokeStyle=INK;x.lineWidth=4;x.strokeRect(cx,cy,cw,ch);
  x.save();x.translate(cx+cw-200,cy);x.rotate(-3*Math.PI/180);x.fillStyle=PINK;x.fillRect(0,-24,170,46);x.strokeStyle=INK;x.lineWidth=2;x.strokeRect(0,-24,170,46);x.fillStyle=INK;x.font="700 26px "+G;x.fillText("今夜のこと",20,8);x.restore();
  x.font="500 32px "+G;x.fillStyle=INK;let ty=cy+90;for(const l of tl){x.fillText(l,cx+40,ty);ty+=52}
  const n=R.checks.length,bw=(cw-80-20*(n-1))/n;let bx=cx+40;const by=ty+10;
  for(const [lab,ok] of R.checks){x.fillStyle=ok?LIME:"#fff";x.fillRect(bx,by,bw,120);x.strokeStyle=INK;x.lineWidth=3;x.strokeRect(bx,by,bw,120);x.fillStyle=ok?INK:MUTED;x.textAlign="center";x.font="900 48px "+G;x.fillText(ok?"✓":"—",bx+bw/2,by+58);let lf=28;x.font="700 "+lf+"px "+G;while(x.measureText(lab).width>bw-20&&lf>18){lf-=2;x.font="700 "+lf+"px "+G}x.fillText(lab,bx+bw/2,by+100);x.textAlign="left";bx+=bw+20}
  const ky=by+165;
  if(R.big){x.fillStyle=INK;x.fillRect(cx+46,ky+6,330,140);x.fillStyle=VIOLET;x.fillRect(cx+40,ky,330,140);x.strokeStyle=INK;x.lineWidth=3;x.strokeRect(cx+40,ky,330,140);x.fillStyle=INK;x.font="900 72px "+G;x.fillText(String(R.big.n),cx+64,ky+80);x.font="700 34px "+G;x.fillText("/ "+R.big.of,cx+64+x.measureText(String(R.big.n)).width+40,ky+78);x.font="500 24px "+G;x.fillStyle=MUTED;x.fillText(R.big.short||R.big.label,cx+64,ky+120)}
  x.save();x.translate(cx+430,ky+14);x.rotate(-2*Math.PI/180);x.fillStyle=PAPER;x.fillRect(0,0,cw-470,112);x.strokeStyle=INK;x.lineWidth=3;x.strokeRect(0,0,cw-470,112);x.fillStyle=MUTED;x.font="700 22px "+G;x.fillText("称号",20,36);x.fillStyle=INK;let tf=42;x.font="600 "+tf+"px "+HAND;while(x.measureText(R.title).width>cw-510&&tf>24){tf-=2;x.font="600 "+tf+"px "+HAND}x.fillText(R.title,20,88);x.restore();
  const sy=ky+200;x.strokeStyle="#d5d1d9";x.lineWidth=2;x.setLineDash([8,8]);x.beginPath();x.moveTo(cx+40,sy-30);x.lineTo(cx+cw-40,sy-30);x.stroke();x.setLineDash([]);
  const sw=(cw-80)/R.stats.length;R.stats.forEach(([l,v],i)=>{const sx=cx+40+sw*i;x.fillStyle=MUTED;x.font="700 24px "+G;x.fillText(l,sx,sy+10);x.fillStyle=INK;x.font="900 46px "+G;x.fillText(v,sx,sy+66)});
  x.fillStyle=MUTED;x.font="500 26px "+G;x.textAlign="center";x.fillText("フィクションです",W/2,Math.max(H-40,cy+ch+60));x.textAlign="left";
  return await new Promise((res,rej)=>c.toBlob(b=>b?res(b):rej(new Error("toBlob")),"image/png"));
}
async function saveResult(blobP){
  const btn=$("saveImg");const blob=await blobP;
  if(!blob){btn.textContent="画像を作れませんでした";return}
  const file=new File([blob],SCN.id+"-result.png",{type:"image/png"});
  try{if(navigator.canShare&&navigator.canShare({files:[file]})){await navigator.share({files:[file],title:SCN.title});return}}catch(e){if(e&&e.name==="AbortError") return}
  const fr=new FileReader();fr.onload=()=>{const el=$("osd");el.hidden=false;el.className="ov shot";el.innerHTML=`<img src="${fr.result}" alt="結果の画像"><p>画像を長押しして保存してください</p><button type="button" id="shotX">閉じる</button>`;$("shotX").onclick=()=>{el.hidden=true;el.className="ov osd"}};fr.readAsDataURL(blob);
}

/* ---------------- intro ---------------- */
function showIntro(){
  sid++;clearInterval(timer);S=null;bq=[];bOn=false;
  ["result","call","osd","scene"].forEach(id=>$(id).hidden=true);$("osd").className="ov osd";$("view").innerHTML="";closePlist();
  const I=SCN.intro,el=$("intro");el.hidden=false;
  const last=I.field?LS.get(SCN.id+":name",""):"";
  el.innerHTML=`<div class="pnav"><a href="../../">PLAY ROOM</a><span>エンディング${SCN.endOrder.length}種</span></div>
  <header class="hero"><div><p class="tag">${esc(I.tag)}</p><h1>${I.h1}</h1><p class="note">${esc(I.note)}</p></div><p class="ticket">${esc(I.ticket[0])}<strong>${esc(I.ticket[1])}</strong></p></header>
  <div class="pcard pink"><p class="lbl">${esc(I.storyLabel||"はじまり")}</p><p class="story">${I.story}</p></div>
  <div class="pcard sky"><p class="lbl">ゴール</p><p class="goal">${I.goal}</p>${I.goalSub?`<p class="story" style="font-size:13px;color:var(--pmuted)">${I.goalSub}</p>`:""}</div>
  <div class="pcard"><p class="lbl">あそびかた</p><ul class="how">${I.how.map(h=>`<li><b>${esc(h[0])}</b><span>${esc(h[1])}</span></li>`).join("")}</ul></div>
  ${I.field?`<form class="field pcard violet" id="oform"><p class="lbl">${esc(I.field.tag||"推し")}</p><label for="nm">${esc(I.field.label)}</label><input id="nm" type="text" maxlength="12" autocomplete="off" placeholder="${esc(I.field.def)}" value="${esc(last)}"></form>`:""}
  ${SCN.diffs?`<div class="pcard"><p class="lbl">難易度</p><div class="diffs" role="radiogroup" aria-label="難易度">${["normal","hard"].map(k=>`<button type="button" role="radio" data-d="${k}" aria-checked="${diff===k}"><b>${esc(SCN.diffs[k].name)}</b><small>${esc(SCN.diffs[k].desc)}</small></button>`).join("")}</div></div>`:""}
  <button class="go" type="button" id="start">${esc(I.button||"はじめる")}</button>
  <p class="handnote">展開は毎回ちょっとずつ変わります。</p>
  ${SCN.links?`<div class="pcard"><p class="lbl">ほかの夜</p><div class="endmap">${SCN.links.map(l=>`<a class="lnk" href="${esc(l[1])}">${esc(l[0])}</a>`).join("")}</div></div>`:""}
  <p class="fine">${esc(SCN.fine)}</p>`;
  const go=()=>{let v=I.field?($("nm").value.trim()||I.field.def):"";if(I.field) LS.set(SCN.id+":name",v===I.field.def?"":v);el.hidden=true;begin(v)};
  el.querySelectorAll(".diffs button").forEach(b=>b.onclick=()=>{diff=b.dataset.d;LS.set(SCN.id+":diff",diff);el.querySelectorAll(".diffs button").forEach(x=>x.setAttribute("aria-checked",String(x===b)))});
  $("start").onclick=go;if($("oform")) $("oform").onsubmit=e=>{e.preventDefault();go()};
}
function begin(name){sid++;S=fresh(name);hud();render();const D=SCN.diffs&&SCN.diffs[S.diff];if(D&&D.scene) scene.apply(null,D.scene);runEvents();startClock()}

const api={ring,quietWhy(){if(S.callOn)return"call";if(!$("osd").hidden)return"osd";if(!$("scene").hidden)return"scene";for(const k of SCN.order){const T=S.th[k];if(T.busy)return k+" busy";if(T.asking&&!T.pending)return k+" asking";if(T.pending&&!T.pending.end&&!SCN.threads[k].static&&Date.now()-(T.pendAt||0)<6000)return k+" pending"}return "quiet "+(S.qms||0)},$,pick,rnd,shuffle,fmt,esc,ACT,LS,later,addTime,change,applyFx,line,sys,them,me,setPending,endStamp,openQ,ask,banner,info,scene,confirmBox,menu,incoming,callOut,hud,render,openTh,end,fill,get S(){return S},get SCN(){return SCN}};
window.ChatSim={start(scn){SCN=scn;diff=LS.get(scn.id+":diff","normal")==="hard"?"hard":"normal";if(!document.title) document.title=scn.title;seen=LS.get(scn.id+":seen",{});titlesGot=LS.get(scn.id+":titles",{});mount();showIntro()},api,ACT};
})();
