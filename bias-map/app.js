(() => {
'use strict';
const MEMBERS=['KAIRYU','NAOYA','RAN','SEITO','RYUKI','TAKUTO','HAYATO','EIKI'];
const PRESETS={
 island:{no:'01',name:'無人島に持ってくものは？',top:'実用性を優先',bottom:'好きを優先',left:'自分のため',right:'みんなのため'},
 dinner:{no:'02',name:'夕飯の意見が割れたら？',top:'自分の意見を通す',bottom:'みんなに合わせる',left:'すぐ決める',right:'じっくり悩む'},
 birthday:{no:'03',name:'誕生日サプライズするなら？',top:'企画・準備を仕切る',bottom:'当日の盛り上げ役',left:'完璧に仕込む',right:'アドリブで盛り上げる'},
 secret:{no:'04',name:'ひみつの趣味がバレたら？',top:'開き直って語る',bottom:'できれば隠したい',left:'みんなに広める',right:'ひとりで楽しむ'},
 lost:{no:'05',name:'道に迷ったら？',top:'自分が先頭に立つ',bottom:'誰かについていく',left:'地図で調べる',right:'人に聞く'},
 afterparty:{no:'06',name:'打ち上げ、そろそろ終盤',top:'まだ盛り上がる',bottom:'そろそろ帰る',left:'聞き役',right:'話し役'},
 battery:{no:'07',name:'スマホの充電、残り1％！',top:'すぐ対処する',bottom:'もう諦める',left:'誰かに頼る',right:'自力でなんとかする'},
 karaage:{no:'08',name:'から揚げ、最後の1個！',top:'遠慮する',bottom:'迷わずいただく',left:'みんなで分ける',right:'自分が食べる'},
 photo:{no:'09',name:'写真を撮ってもらうなら？',top:'ポーズを決める',bottom:'自然体で写る',left:'納得いくまで撮る',right:'一発でOK'},
 movie:{no:'10',name:'感動映画のラスト、どうなる？',top:'涙が出る',bottom:'泣かずに見る',left:'感想を語りたい',right:'余韻に浸りたい'},
 capsule:{no:'11',name:'タイムカプセルに手紙を書くなら？',top:'未来の自分へ宣言',bottom:'今の思い出を残す',left:'しっかり長文',right:'ひとことだけ'},
 convenience:{no:'12',name:'コンビニで新商品を見つけたら？',top:'すぐ買ってみる',bottom:'まず様子を見る',left:'自分で楽しむ',right:'みんなに教える'},
 packing:{no:'13',name:'旅行の荷造り、いつやる？',top:'前日までに準備',bottom:'出発直前に準備',left:'念のため多め',right:'必要最低限'},
 omikuji:{no:'14',name:'おみくじで大吉が出たら？',top:'素直に信じて喜ぶ',bottom:'軽く受け流す',left:'みんなに見せる',right:'自分だけで楽しむ'},
 gift:{no:'15',name:'手土産を持っていくなら？',top:'事前にじっくり選ぶ',bottom:'当日その場で選ぶ',left:'定番を選ぶ',right:'珍しいものを選ぶ'},
 regular:{no:'16',name:'好きなお店の常連になったら？',top:'新メニューに挑戦',bottom:'いつもの定番',left:'店員さんと話す',right:'静かに過ごす'},
 hideout:{no:'17',name:'とっておきの隠れ家を見つけたら？',top:'みんなに教えたい',bottom:'自分だけの秘密',left:'何度も通う',right:'ときどき行く'},
 hobby:{no:'18',name:'新しい趣味を始めるなら？',top:'道具から揃える',bottom:'まず体験する',left:'ひとりで極める',right:'仲間と楽しむ'},
 custom:{no:'19',name:'CUSTOM',top:'',bottom:'',left:'',right:''}
};
const PRESET_TOTAL=Object.keys(PRESETS).length;
const CATALOG='https://raw.githubusercontent.com/rikomuze/oshi-visual-6/main/images/';
const state={member:'ALL',preset:null,photos:[],selectedId:null,projectId:null,createdAt:null,epoch:0};
const pending=new Set();
const $=s=>document.querySelector(s), $$=s=>Array.from(document.querySelectorAll(s));
const uid=()=>crypto.randomUUID?crypto.randomUUID():Date.now()+'-'+Math.random().toString(36).slice(2);
const esc=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const catalogUrl=(member,n)=>CATALOG+member.toLowerCase()+'/'+String(n).padStart(2,'0')+(member==='RYUKI'&&n!==6?'.png':'.jpg');
function buildMemberMarkers(){
 const cols=3, rows=3;
 return MEMBERS.map((name,i)=>({
  id:'member-'+name.toLowerCase(),
  src:catalogUrl(name,20),
  label:name,
  member:name,
  x:.5,
  y:.5,
  size:52,
  _placed:false
 }));
}
const status=t=>{$('#appStatus').textContent=t;};
const photoStatus=t=>{$('#photoStatus').textContent=t;};
function show(id){
 $$('.screen').forEach(el=>{el.classList.toggle('is-active',el.id===id);el.hidden=el.id!==id;});
 status('');
 if(id==='screen-photos') {renderCatalog();renderPhotoList();}
 if(id==='screen-editor') {renderMap();selectPhoto(state.selectedId);}
 if(id==='screen-member') syncMembers();
 if(id==='screen-map') syncPresets();
 window.scrollTo({top:0,behavior:'auto'});
 const heading=$('#'+id+' h2');if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true});}
}
$$('[data-back]').forEach(b=>b.addEventListener('click',()=>show(b.dataset.back)));
$('#startNew').onclick=()=>{
 state.epoch++;pending.clear();Object.assign(state,{member:'ALL',preset:null,photos:buildMemberMarkers(),selectedId:null,projectId:null,createdAt:null});
 ['Top','Bottom','Left','Right'].forEach(k=>$('#custom'+k).value='');
 syncPresets();show('screen-map');
};
function syncMembers(){
 $$('.member-button').forEach(b=>{const on=b.dataset.member===state.member;b.classList.toggle('is-selected',on);b.setAttribute('aria-pressed',String(on));});
 $('#toMap').disabled=!state.member;
}
function initMembers(){
 MEMBERS.forEach(name=>{
  const b=document.createElement('button');b.type='button';b.className='member-button';b.dataset.member=name;b.setAttribute('aria-pressed','false');
  b.innerHTML='<img src="'+catalogUrl(name,20)+'" alt="" loading="lazy"><span>'+name+'</span>';
  b.onclick=()=>{if(state.member!==name){state.epoch++;pending.clear();state.photos=[];state.selectedId=null;state.projectId=null;}state.member=name;syncMembers();};
  $('#memberList').appendChild(b);
 });
}
$('#toMap').onclick=()=>{if(state.member)show('screen-map');};
function currentAxes(){
 if(state.preset!=='custom')return PRESETS[state.preset]||PRESETS.island;
 const a={name:'CUSTOM'};['Top','Bottom','Left','Right'].forEach(k=>a[k.toLowerCase()]=$('#custom'+k).value.trim());return a;
}
function validPreset(){return !!state.preset&&(state.preset!=='custom'||['top','bottom','left','right'].every(k=>currentAxes()[k]));}
function syncPresets(){
 $$('.preset-card').forEach(c=>{const on=c.dataset.key===state.preset;c.classList.toggle('is-selected',on);c.querySelector('button').setAttribute('aria-pressed',String(on));});
 $('#toPhotos').disabled=!validPreset();
}
function initPresets(){
 Object.entries(PRESETS).forEach(([key,p])=>{
  const card=document.createElement('div');card.className='preset-card';card.dataset.key=key;
  const b=document.createElement('button');b.type='button';b.className='preset-select';b.setAttribute('aria-pressed','false');
  b.innerHTML='<span class="preset-no">'+p.no+' / '+String(PRESET_TOTAL).padStart(2,'0')+'</span><span class="preset-title">'+p.name+'</span>';
  card.onclick=()=>{
   state.preset=key;syncPresets();
   if(key!=='custom'){
    if(state.photos.length!==MEMBERS.length)state.photos=buildMemberMarkers();
    enterEditor();
   }
  };card.appendChild(b);
  if(key==='custom'){
   const fields=document.createElement('div');fields.className='custom-fields';
   [['Top','上','例：光'],['Bottom','下','例：闇'],['Left','左','例：かわいい'],['Right','右','例：色気']].forEach(([k,label,placeholder])=>{
    const l=document.createElement('label');l.textContent=label;
    const input=document.createElement('input');input.id='custom'+k;input.maxLength=10;input.placeholder=placeholder;
    input.onclick=e=>e.stopPropagation();input.oninput=()=>{state.preset='custom';syncPresets();};l.appendChild(input);fields.appendChild(l);
   });card.appendChild(fields);
  }
  $('#presetList').appendChild(card);
 });
}
$('#toPhotos').onclick=()=>{if(!validPreset())return;if(state.photos.length!==MEMBERS.length)state.photos=buildMemberMarkers();enterEditor();};
function setSource(source){
 const catalog=source==='catalog';$('#catalogSection').hidden=!catalog;$('#uploadSection').hidden=catalog;
 [['#useCatalog',catalog],['#useUpload',!catalog]].forEach(([id,on])=>{$(id).classList.toggle('is-selected',on);$(id).setAttribute('aria-pressed',String(on));});
}
$('#useCatalog').onclick=()=>setSource('catalog');$('#useUpload').onclick=()=>setSource('upload');
function renderCatalog(){
 $('#catalogMember').textContent=state.member||'';
 const grid=$('#catalogGrid');
 if(grid.dataset.member!==state.member){
  grid.innerHTML='';grid.dataset.member=state.member||'';
  if(!state.member)return;
  for(let n=20;n>=1;n--){
   const key=state.member+'-'+n,b=document.createElement('button');b.type='button';b.className='catalog-photo';b.dataset.key=key;b.dataset.number=n;
   b.setAttribute('aria-label',state.member+'の写真 '+String(n).padStart(2,'0'));
   b.innerHTML='<img src="'+catalogUrl(state.member,n)+'" alt="" loading="lazy"><span>'+String(n).padStart(2,'0')+'</span>';
   b.onclick=()=>toggleCatalog(n);grid.appendChild(b);
  }
 }
 $$('.catalog-photo').forEach(b=>{const on=state.photos.some(p=>p.catalogKey===b.dataset.key);b.classList.toggle('is-selected',on);b.setAttribute('aria-pressed',String(on));b.disabled=pending.has(b.dataset.key);b.setAttribute('aria-busy',String(b.disabled));});
}
function loadImage(src){return new Promise((resolve,reject)=>{
 const img=new Image();let timer=setTimeout(()=>{img.onload=img.onerror=null;reject(new Error('画像の読み込みがタイムアウトしました。通信を確認してください。'));},20000);
 if(/^https?:/.test(src))img.crossOrigin='anonymous';
 img.onload=()=>{clearTimeout(timer);resolve(img);};img.onerror=()=>{clearTimeout(timer);reject(new Error('写真を読み込めませんでした。別の写真かアップロードを試してください。'));};img.src=src;
});}
function imageData(img){
 const scale=Math.min(1,1400/Math.max(img.width,img.height)),c=document.createElement('canvas');c.width=Math.round(img.width*scale);c.height=Math.round(img.height*scale);
 c.getContext('2d').drawImage(img,0,0,c.width,c.height);return c.toDataURL('image/jpeg',.9);
}
function newPhoto(src,extra={}){return {id:uid(),src,x:.5,y:.5,size:58,...extra};}
async function toggleCatalog(n){
 const member=state.member,key=member+'-'+n,epoch=state.epoch;
 const existing=state.photos.find(p=>p.catalogKey===key);
 if(existing){removePhoto(existing.id);photoStatus('写真を外しました');return;}
 if(pending.has(key))return;
 if(state.photos.length+pending.size>=9){photoStatus('選べる写真は9枚までです。追加するには、選んだ写真を外してください。');return;}
 pending.add(key);renderCatalog();photoStatus('写真を追加しています…');$('#toEditor').disabled=true;
 try{
  const image=await loadImage(catalogUrl(member,n));const src=imageData(image);
  if(epoch!==state.epoch)return;
  state.photos.push(newPhoto(src,{catalogKey:key,label:member+' '+String(n).padStart(2,'0')}));
  photoStatus('写真を追加しました');
 }catch(e){if(epoch===state.epoch)photoStatus(e.message||'写真を追加できませんでした。');}
 finally{pending.delete(key);if(epoch===state.epoch){renderCatalog();renderPhotoList();}}
}
function readFile(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(new Error('ファイルを読み込めませんでした。'));r.readAsDataURL(file);});}
$('#photoInput').onchange=async e=>{
 const files=Array.from(e.target.files||[]),epoch=state.epoch;e.target.value='';
 let added=0;const problems=[];
 for(const file of files){
  if(state.photos.length+pending.size>=9){problems.push('合計9枚までです');break;}
  if(file.size>20*1024*1024){problems.push(file.name+'は20MBを超えています');continue;}
  if(!file.type.startsWith('image/')){problems.push(file.name+'は画像ではありません');continue;}
  const key='upload-'+uid();pending.add(key);$('#toEditor').disabled=true;
  try{const src=imageData(await loadImage(await readFile(file)));if(epoch!==state.epoch)return;state.photos.push(newPhoto(src,{label:file.name}));added++;}
  catch(err){problems.push(file.name+'を読み込めませんでした。JPEG・PNGなどで試してください');}
  finally{pending.delete(key);if(epoch===state.epoch)renderPhotoList();}
 }
 if(epoch===state.epoch)photoStatus((added?added+'枚追加しました。 ':'')+problems.join('。'));
};
function removePhoto(id){state.photos=state.photos.filter(p=>p.id!==id);if(state.selectedId===id)state.selectedId=null;renderPhotoList();renderCatalog();}
function renderPhotoList(){
 const list=$('#photoList');list.innerHTML='';
 state.photos.forEach((p,i)=>{const d=document.createElement('div');d.className='photo-thumb';
 const img=document.createElement('img');img.src=p.src;img.alt=p.label||'選んだ写真 '+(i+1);d.appendChild(img);
 const b=document.createElement('button');b.type='button';b.textContent='×';b.setAttribute('aria-label','写真 '+(i+1)+'を外す');b.onclick=()=>removePhoto(p.id);d.appendChild(b);list.appendChild(d);});
 $('#photoCount').textContent=state.photos.length+' / 9';$('#toEditor').disabled=state.photos.length===0||pending.size>0;$('#toPreview').disabled=state.photos.length===0;
}
function applyAxes(){
 const a=currentAxes();['Top','Bottom','Left','Right'].forEach(k=>$('#axis'+k).textContent=a[k.toLowerCase()]);
 ['Tl','Tr','Bl','Br'].forEach((k,i)=>{const el=$('#corner'+k);el.textContent=a.corners?a.corners[i]:'';el.hidden=!a.corners;});
}
function layoutInitial(){}
function enterEditor(){
 if(!state.photos.length||pending.size)return;
 applyAxes();layoutInitial();$('#summaryMember').textContent='8 MEMBERS';$('#summaryMap').textContent=currentAxes().name;
 $('#allSizeRange').value=state.photos[0].size;show('screen-editor');
}
$('#toEditor').onclick=enterEditor;
function constrain(p){const half=p.size/800;p.x=Math.max(half,Math.min(1-half,p.x));p.y=Math.max(half,Math.min(1-half,p.y));}
function renderMap(){
 const box=$('#mapPhotos'),tray=$('#memberTray');box.innerHTML='';tray.innerHTML='';
 state.photos.forEach((p,i)=>{
  const b=document.createElement('button');b.type='button';b.dataset.id=p.id;b.setAttribute('aria-label','メンバー写真 '+(i+1));b.setAttribute('aria-pressed',String(p.id===state.selectedId));
  const pic=document.createElement('span');pic.className='pic';const img=document.createElement('img');img.src=p.src;img.alt='';img.draggable=false;pic.appendChild(img);b.appendChild(pic);
  if(p._placed){constrain(p);b.className='map-photo';b.style.left=p.x*100+'%';b.style.top=p.y*100+'%';box.appendChild(b);}
  else{b.className='tray-photo';tray.appendChild(b);}
 });updateSizes();selectPhoto(state.selectedId);
}
function updateSizes(){
 const width=$('#mapCanvas').clientWidth||400;
 $$('.map-photo').forEach(el=>{const p=state.photos.find(x=>x.id===el.dataset.id);if(!p)return;const pic=el.querySelector('.pic');pic.style.width=pic.style.height=p.size/400*width+'px';pic.style.padding=3/400*width+'px';el.style.left=p.x*100+'%';el.style.top=p.y*100+'%';});
}
function selectPhoto(id){
 const p=state.photos.find(x=>x.id===id);state.selectedId=p?id:null;
 $('#sizeRange').disabled=!p;$('#deleteSelected').disabled=!p;$('#selectedHint').textContent=p?'選択した写真のサイズを調整できます':'写真をタップすると、個別にサイズを調整できます';if(p)$('#sizeRange').value=p.size;
 $$('.map-photo').forEach(el=>{const on=el.dataset.id===state.selectedId;el.classList.toggle('is-selected',on);el.setAttribute('aria-pressed',String(on));});
}
let drag=null,ignoreBoardClick=false;
function startMemberDrag(e){
 if(e.button>0)return;
 const el=e.target.closest('.map-photo,.tray-photo');if(!el)return;
 const p=state.photos.find(x=>x.id===el.dataset.id);if(!p)return;
 e.preventDefault();selectPhoto(p.id);
 const r=$('#mapCanvas').getBoundingClientRect();
 drag={p,id:e.pointerId,startX:e.clientX,startY:e.clientY,moved:false,
  offsetX:p._placed?e.clientX-r.left-p.x*r.width:0,
  offsetY:p._placed?e.clientY-r.top-p.y*r.height:0};
 try{el.setPointerCapture(e.pointerId);}catch(_){}
}
$('#memberTray').addEventListener('pointerdown',startMemberDrag);
$('#mapPhotos').addEventListener('pointerdown',startMemberDrag);
window.addEventListener('pointermove',e=>{
 if(!drag||drag.id!==e.pointerId)return;
 if(Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY)<5&&!drag.moved)return;
 drag.moved=true;e.preventDefault();
 const r=$('#mapCanvas').getBoundingClientRect();
 if(e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom){
  drag.p.x=(e.clientX-r.left-drag.offsetX)/r.width;
  drag.p.y=(e.clientY-r.top-drag.offsetY)/r.height;
  drag.p._placed=true;constrain(drag.p);
  if(!drag.token){
   drag.token=document.createElement('button');drag.token.type='button';drag.token.className='map-photo';drag.token.dataset.id=drag.p.id;
   const pic=document.createElement('span');pic.className='pic';const img=document.createElement('img');img.src=drag.p.src;img.alt='';img.draggable=false;pic.appendChild(img);drag.token.appendChild(pic);$('#mapPhotos').appendChild(drag.token);
  }
  const width=$('#mapCanvas').clientWidth||400,pic=drag.token.querySelector('.pic');
  pic.style.width=pic.style.height=drag.p.size/400*width+'px';pic.style.padding=3/400*width+'px';
  drag.token.style.left=drag.p.x*100+'%';drag.token.style.top=drag.p.y*100+'%';
 }
},{passive:false});
window.addEventListener('pointerup',e=>{
 if(!drag||drag.id!==e.pointerId)return;
 const d=drag,r=$('#mapCanvas').getBoundingClientRect();
 const inside=e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom;
 if(d.moved&&inside){d.p.x=(e.clientX-r.left-d.offsetX)/r.width;d.p.y=(e.clientY-r.top-d.offsetY)/r.height;d.p._placed=true;constrain(d.p);}
 drag=null;renderMap();
});
window.addEventListener('pointercancel',()=>{drag=null;});
$('#mapPhotos').onclick=e=>{const el=e.target.closest('.map-photo');if(el)selectPhoto(el.dataset.id);};
$('#memberTray').onclick=e=>{const el=e.target.closest('.tray-photo');if(el)selectPhoto(el.dataset.id);};
$('#mapPhotos').onkeydown=e=>{
 const el=e.target.closest('.map-photo');if(!el||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;
 e.preventDefault();const p=state.photos.find(x=>x.id===el.dataset.id);selectPhoto(p.id);const d=e.shiftKey?.05:.01;
 if(e.key==='ArrowLeft')p.x-=d;if(e.key==='ArrowRight')p.x+=d;if(e.key==='ArrowUp')p.y-=d;if(e.key==='ArrowDown')p.y+=d;constrain(p);updateSizes();
};
window.addEventListener('resize',updateSizes);
$('#allSizeRange').oninput=e=>{state.photos.forEach(p=>{p.size=+e.target.value;constrain(p);});updateSizes();selectPhoto(state.selectedId);};
$('#sizeRange').oninput=e=>{const p=state.photos.find(x=>x.id===state.selectedId);if(p){p.size=+e.target.value;constrain(p);updateSizes();}};
$('#deleteSelected').onclick=()=>{if(!state.selectedId)return;removePhoto(state.selectedId);renderMap();if(!state.photos.length){show('screen-photos');photoStatus('写真がなくなりました。新しい写真を選んでください。');}};
async function busy(button,text,action){if(button.disabled)return;const label=button.textContent;button.disabled=true;button.textContent=text;try{await action();}catch(e){status(e.message||'処理に失敗しました。もう一度試してください。');}finally{button.disabled=false;button.textContent=label;}}
function cover(ctx,img,x,y,size){const scale=Math.max(size/img.width,size/img.height),side=size/scale;ctx.drawImage(img,(img.width-side)/2,(img.height-side)/2,side,side,x,y,size,size);}
async function drawResult(){
 if(state.photos.some(p=>!p._placed))throw new Error('8人全員をマップに配置してください。');
 const images=await Promise.all(state.photos.map(p=>loadImage(p.src)));
 if(document.fonts){try{await Promise.all([document.fonts.load('900 46px "Zen Kaku Gothic New"'),document.fonts.load('700 22px "Zen Kaku Gothic New"')]);}catch(_){}}
 const c=$('#resultCanvas'),ctx=c.getContext('2d'),a=currentAxes(),mx=110,my=145,mw=860,mh=860,cx=540,cy=my+mh/2;
 ctx.clearRect(0,0,1080,1080);ctx.fillStyle='#f7f5ed';ctx.fillRect(0,0,1080,1080);
 ctx.fillStyle='#ded7ff';ctx.fillRect(62,27,190,34);ctx.fillStyle='#282536';ctx.font='700 18px "Zen Kaku Gothic New",sans-serif';ctx.textAlign='left';ctx.fillText('BIAS MAP',74,51);
 ctx.font='900 42px "Zen Kaku Gothic New",sans-serif';ctx.fillText('MEMBER MAP',62,111);
 ctx.textAlign='right';ctx.font='700 20px "Zen Kaku Gothic New",sans-serif';ctx.fillText(a.name,1018,102);
 ctx.fillStyle='#282536';ctx.fillRect(mx+5,my+6,mw,mh);ctx.fillStyle='#fff';ctx.fillRect(mx,my,mw,mh);ctx.strokeStyle='#282536';ctx.lineWidth=2;ctx.strokeRect(mx,my,mw,mh);
 ctx.strokeStyle='#b9b2c8';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(cx,my);ctx.lineTo(cx,my+mh);ctx.moveTo(mx,cy);ctx.lineTo(mx+mw,cy);ctx.stroke();
 if(a.corners){
  ctx.save();ctx.globalAlpha=.55;ctx.fillStyle='#8051bd';ctx.font='900 36px "Zen Kaku Gothic New",sans-serif';const pad=22;
  ctx.textAlign='left';ctx.fillText(a.corners[0],mx+pad,my+pad+30);ctx.fillText(a.corners[2],mx+pad,my+mh-pad);
  ctx.textAlign='right';ctx.fillText(a.corners[1],mx+mw-pad,my+pad+30);ctx.fillText(a.corners[3],mx+mw-pad,my+mh-pad);
  ctx.restore();
 }
 ctx.fillStyle='#282536';ctx.font='700 21px "Zen Kaku Gothic New",sans-serif';ctx.textAlign='center';ctx.fillText(a.top,cx,my-12);ctx.fillText(a.bottom,cx,my+mh+29);
 ctx.save();ctx.translate(mx-31,cy);ctx.rotate(-Math.PI/2);ctx.fillText(a.left,0,0);ctx.restore();ctx.save();ctx.translate(mx+mw+31,cy);ctx.rotate(Math.PI/2);ctx.fillText(a.right,0,0);ctx.restore();
 state.photos.forEach((p,i)=>{if(!p._placed)return;const size=p.size/400*mw,frame=3/400*mw,x=mx+p.x*mw-size/2,y=my+p.y*mh-size/2;
  ctx.save();ctx.fillStyle='#282536';ctx.fillRect(x+2,y+3,size,size);ctx.fillStyle='#fff';ctx.fillRect(x,y,size,size);cover(ctx,images[i],x+frame,y+frame,size-2*frame);ctx.restore();
 });ctx.fillStyle='#625f6d';ctx.textAlign='right';ctx.font='500 14px "Zen Kaku Gothic New",sans-serif';ctx.fillText('PLAY ROOM',1018,1061);
}
$('#toPreview').onclick=()=>busy($('#toPreview'),'画像をつくっています…',async()=>{await drawResult();show('screen-preview');$('#saveStatus').textContent='';});
function canvasBlob(){return new Promise((resolve,reject)=>$('#resultCanvas').toBlob(b=>b?resolve(b):reject(new Error('画像を書き出せませんでした。')),'image/png'));}
let fallbackFocus=null;
function showFallback(){fallbackFocus=document.activeElement;$('#fallbackImage').src=$('#resultCanvas').toDataURL('image/png');$('#fallback').hidden=false;$('#closeFallback').focus();}
function closeFallback(){$('#fallback').hidden=true;fallbackFocus?.focus();}
$('#closeFallback').onclick=closeFallback;$('#fallback').onclick=e=>{if(e.target===$('#fallback'))closeFallback();};
window.addEventListener('keydown',e=>{if($('#fallback').hidden)return;if(e.key==='Escape')closeFallback();if(e.key==='Tab'){e.preventDefault();$('#closeFallback').focus();}});
$('#saveImage').onclick=()=>busy($('#saveImage'),'画像を保存しています…',async()=>{
 await drawResult();const blob=await canvasBlob(),file=new File([blob],'member-bias-map.png',{type:'image/png'});
 if(navigator.canShare&&navigator.canShare({files:[file]})){
  try{await navigator.share({files:[file],title:'BIAS MAP'});$('#saveStatus').textContent='画像を共有しました';return;}catch(e){if(e.name==='AbortError')return;showFallback();return;}
 }
 const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=file.name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),4000);
 $('#saveStatus').textContent='画像を保存しました。保存できない場合は下から長押し保存できます。';
 let manual=$('#manualSave');if(!manual){manual=document.createElement('button');manual.id='manualSave';manual.className='ghost';manual.textContent='長押しで保存する';manual.onclick=showFallback;$('#saveStatus').after(manual);}
});
function openDB(){return new Promise((resolve,reject)=>{
 // Open the current version first, so another tool's newer DB version cannot block this one.
 const request=indexedDB.open('muze-tool-box');
 request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains('biasMaps'))request.result.createObjectStore('biasMaps',{keyPath:'id'});};
 request.onerror=()=>reject(new Error('端末保存を利用できませんでした。画像で保存してください。'));
 request.onsuccess=()=>{const db=request.result;db.onversionchange=()=>db.close();if(db.objectStoreNames.contains('biasMaps')){resolve(db);return;}
  const version=db.version+1;db.close();const upgrade=indexedDB.open('muze-tool-box',version);
  upgrade.onupgradeneeded=()=>{if(!upgrade.result.objectStoreNames.contains('biasMaps'))upgrade.result.createObjectStore('biasMaps',{keyPath:'id'});};
  upgrade.onsuccess=()=>{upgrade.result.onversionchange=()=>upgrade.result.close();resolve(upgrade.result);};upgrade.onerror=request.onerror;
  upgrade.onblocked=()=>reject(new Error('ほかのPLAY ROOMツールを閉じて、もう一度保存してください。'));
 };
});}
async function dbAction(mode,action){
 const db=await openDB();try{return await new Promise((resolve,reject)=>{const tx=db.transaction('biasMaps',mode);let result;const req=action(tx.objectStore('biasMaps'));req.onsuccess=()=>{result=req.result;};tx.oncomplete=()=>resolve(result);tx.onerror=tx.onabort=()=>reject(new Error('端末保存に失敗しました。保存容量などを確認してください。'));});}finally{db.close();}
}
async function renderSavedProjects(){
 try{const projects=(await dbAction('readonly',store=>store.getAll())||[]).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));$('#savedSection').hidden=projects.length===0;const list=$('#savedList');list.innerHTML='';
  projects.forEach(p=>{const card=document.createElement('div');card.className='saved-card';const date=new Date(p.createdAt),label=Number.isNaN(date.getTime())?'':date.toLocaleDateString('ja-JP',{month:'numeric',day:'numeric'});
   card.innerHTML='<button class="saved-open" type="button"><span class="saved-title">'+esc(p.member||'BIAS')+'</span><span class="saved-meta">'+esc(p.axes?.name||'BIAS MAP')+' · '+esc(label)+'</span></button><button class="saved-delete" type="button" aria-label="'+esc(p.member||'BIAS')+'の保存MAPを削除">削除</button>';
   card.querySelector('.saved-open').onclick=()=>openProject(p);card.querySelector('.saved-delete').onclick=async()=>{if(!confirm('この保存MAPを削除しますか？'))return;try{await dbAction('readwrite',store=>store.delete(p.id));await renderSavedProjects();}catch(e){status(e.message);}};list.appendChild(card);
  });
 }catch(e){status(e.message);}
}
function openProject(p){
 state.epoch++;pending.clear();state.member='ALL';state.preset=PRESETS[p.preset]?p.preset:'custom';state.projectId=p.id;state.createdAt=p.createdAt;
 state.photos=(p.photos||[]).filter(x=>x.src).slice(0,9).map(x=>({...x,id:x.id||uid(),x:Number.isFinite(x.x)?x.x:.5,y:Number.isFinite(x.y)?x.y:.5,size:Math.min(100,Math.max(40,+x.size||52)),_placed:true}));if(state.photos.length!==MEMBERS.length||!state.photos.every(x=>x.member||MEMBERS.includes(x.label)))state.photos=buildMemberMarkers();state.selectedId=null;
 if(state.preset==='custom') ['Top','Bottom','Left','Right'].forEach(k=>$('#custom'+k).value=p.axes?.[k.toLowerCase()]||'');
 syncMembers();syncPresets();renderPhotoList();applyAxes();$('#summaryMember').textContent='8 MEMBERS';$('#summaryMap').textContent=currentAxes().name;$('#allSizeRange').value=state.photos[0]?.size||58;
 show(state.photos.length?'screen-editor':'screen-photos');
}
$('#saveProject').onclick=()=>busy($('#saveProject'),'MAPを保存しています…',async()=>{
 const project={id:state.projectId||'bias-'+uid(),createdAt:state.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString(),member:'ALL',preset:state.preset,axes:currentAxes(),photos:state.photos.map(p=>({...p}))};
 await dbAction('readwrite',store=>store.put(project));state.projectId=project.id;state.createdAt=project.createdAt;$('#saveStatus').textContent='この端末にMAPを保存しました。トップから再編集できます。';await renderSavedProjects();
});
initPresets();state.photos=buildMemberMarkers();renderPhotoList();syncPresets();show('screen-start');renderSavedProjects();
})();
