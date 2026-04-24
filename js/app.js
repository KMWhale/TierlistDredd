/* ═══════════════════════════════════════════════════════════════
   TKK DREDD — js/app.js   (lógica principal)
═══════════════════════════════════════════════════════════════ */
'use strict';

const S = {
  items:{}, nextId:1, selectedId:null, zoom:1, gallery:[],
  dragging:null, dragStartMx:0, dragStartMy:0, dragStartPx:0, dragStartPy:0,
  panning:false, panMx:0, panMy:0, panSx:0, panSy:0, spaceHeld:false,
  fsActive:false, fsZoom:1, fsDragging:null,
  fsPanning:false, fsPanMx:0, fsPanMy:0, fsPanSx:0, fsPanSy:0,
};

const RANGE  = 10;
const BASE_W = 720;
const BASE_H = 600;

const planeEl   = document.getElementById('cartesian-plane');
const planeSVG  = document.getElementById('plane-svg');
const vpScroll  = document.getElementById('vp-scroll');
const vpCanvas  = document.getElementById('vp-canvas');
const tooltipEl = document.getElementById('tooltip');
const notifEl   = document.getElementById('notif');
const galleryEl = document.getElementById('gallery');
const fsOverlay = document.getElementById('fs-overlay');
const fsPlane   = document.getElementById('fs-plane');
const fsInner   = document.getElementById('fs-inner');
const fsCanvas  = document.getElementById('fs-canvas');

/* ── Notificação ─────────────────────────────────────────────── */
let _nt = null;
function showNotif(msg, type = 'ok') {
  notifEl.textContent = msg;
  notifEl.style.borderColor = type === 'ok' ? 'var(--accent2)' : 'var(--accent3)';
  notifEl.style.color       = type === 'ok' ? 'var(--accent2)' : 'var(--accent3)';
  notifEl.classList.add('visible');
  clearTimeout(_nt);
  _nt = setTimeout(() => notifEl.classList.remove('visible'), 3200);
}

/* ── Coordenadas ─────────────────────────────────────────────── */
function pixelToCoord(px, py) {
  return {
    x: parseFloat((px / BASE_W * 2 * RANGE - RANGE).toFixed(2)),
    y: parseFloat((-(py / BASE_H * 2 * RANGE - RANGE)).toFixed(2)),
  };
}

/* ══════════════ ZOOM ══════════════ */
function applyZoom(z, fcx, fcy) {
  z = Math.max(0.25, Math.min(5, parseFloat(z.toFixed(3))));
  const oldZ = S.zoom; S.zoom = z;
  const r  = vpScroll.getBoundingClientRect();
  const fx = fcx != null ? fcx - r.left : r.width  / 2;
  const fy = fcy != null ? fcy - r.top  : r.height / 2;

  const minPad = 140; // espaço extra nas bordas
  const oldW = BASE_W*oldZ + minPad*2, oldH = BASE_H*oldZ + minPad*2;
  const oldPadX = (Math.max(r.width, oldW) - BASE_W*oldZ)/2;
  const oldPadY = (Math.max(r.height, oldH) - BASE_H*oldZ)/2;

  const cx = (vpScroll.scrollLeft + fx - oldPadX) / oldZ;
  const cy = (vpScroll.scrollTop  + fy - oldPadY) / oldZ;

  const newW = BASE_W*z + minPad*2, newH = BASE_H*z + minPad*2;
  const cw = Math.max(r.width, newW), ch = Math.max(r.height, newH);
  const padX = (cw - BASE_W*z)/2, padY = (ch - BASE_H*z)/2;

  vpCanvas.style.width  = cw + 'px';
  vpCanvas.style.height = ch + 'px';
  planeEl.style.transform = `translate(${padX}px, ${padY}px) scale(${z})`; 
  planeEl.style.transformOrigin='top left';
  vpScroll.scrollLeft = cx*z + padX - fx; 
  vpScroll.scrollTop  = cy*z + padY - fy;
  document.getElementById('zoom-label').textContent = Math.round(z*100)+'%';
}
function changeZoom(delta,fx,fy){applyZoom(S.zoom+delta,fx,fy);}
function resetZoom(){
  applyZoom(1);
  requestAnimationFrame(()=>{
    const r=vpScroll.getBoundingClientRect();
    vpScroll.scrollLeft = Math.max(0, (parseFloat(vpCanvas.style.width) - r.width)/2);
    vpScroll.scrollTop  = Math.max(0, (parseFloat(vpCanvas.style.height) - r.height)/2);
  });
}
window.addEventListener('DOMContentLoaded',()=>{
  resetZoom();
});

/* ══════════════ IMAGENS COMPARTILHADAS ══════════════
   Carrega automaticamente as imagens listadas em images/manifest.json.
   O manifesto é gerado pelo admin e commitado junto ao projeto.
   Formato: { "images": ["foto1.jpg", "subpasta/foto2.png", ...] }
═══════════════════════════════════════════════════════ */
async function loadSharedImages() {
  try {
    const res = await fetch('images/manifest.json?_=' + Date.now());
    if (!res.ok) return; // pasta ainda não tem manifesto — silencia
    const data = await res.json();
    const imgs = Array.isArray(data.images) ? data.images : [];
    if (!imgs.length) return;
    let loaded = 0;
    for (const filename of imgs) {
      // Evita duplicar se já estiver na galeria
      if (S.gallery.find(g => g.name === filename)) continue;
      const src = 'images/' + filename;
      addToGallery(src, filename);
      loaded++;
    }
    if (loaded) {
      updateGalleryCount();
      showNotif(`🖼 ${loaded} imagem(ns) carregada(s) automaticamente`);
    }
  } catch (_) {
    // Sem manifesto ou erro de rede — ignora silenciosamente
  }
}
window.addEventListener('resize',()=>applyZoom(S.zoom));
vpScroll.addEventListener('wheel',e=>{
  if(!e.ctrlKey&&!e.metaKey)return;
  e.preventDefault(); changeZoom(e.deltaY<0?.1:-.1,e.clientX,e.clientY);
},{passive:false});

/* ── Pan ─────────────────────────────────────────────────────── */
document.addEventListener('keydown',e=>{
  if(e.code==='Space'&&document.activeElement.tagName!=='INPUT'){
    e.preventDefault(); S.spaceHeld=true; vpScroll.style.cursor='grab';
  }
});
document.addEventListener('keyup',e=>{
  if(e.code==='Space'){S.spaceHeld=false; vpScroll.style.cursor='';}
});
vpScroll.addEventListener('mousedown',e=>{
  if(e.button===1||(e.button===0&&S.spaceHeld)){
    e.preventDefault(); S.panning=true;
    S.panMx=e.clientX; S.panMy=e.clientY;
    S.panSx=vpScroll.scrollLeft; S.panSy=vpScroll.scrollTop;
    vpScroll.style.cursor='grabbing';
  }
});

/* ══════════════ GRID ══════════════ */
function drawGrid() {
  planeSVG.setAttribute('viewBox',`0 0 ${BASE_W} ${BASE_H}`);
  planeSVG.innerHTML='';
  const ns='http://www.w3.org/2000/svg', steps=RANGE*2, cx=BASE_W/2, cy=BASE_H/2;
  for(let i=0;i<=steps;i++){
    const isA=i===RANGE, is5=i%5===0;
    const lv=document.createElementNS(ns,'line');
    lv.setAttribute('x1',i*(BASE_W/steps));lv.setAttribute('y1',0);
    lv.setAttribute('x2',i*(BASE_W/steps));lv.setAttribute('y2',BASE_H);
    lv.setAttribute('class', isA ? 'grid-main' : is5 ? 'grid-5' : 'grid-1');
    planeSVG.appendChild(lv);
  }
  for(let i=0;i<=steps;i++){
    const isA=i===RANGE, is5=i%5===0;
    const lh=document.createElementNS(ns,'line');
    lh.setAttribute('x1',0);lh.setAttribute('y1',i*(BASE_H/steps));
    lh.setAttribute('x2',BASE_W);lh.setAttribute('y2',i*(BASE_H/steps));
    lh.setAttribute('class', isA ? 'grid-main' : is5 ? 'grid-5' : 'grid-1');
    planeSVG.appendChild(lh);
  }
  const a=5,arr=pts=>{const p=document.createElementNS(ns,'polygon');p.setAttribute('points',pts);p.setAttribute('fill','rgba(255,255,255,.22)');planeSVG.appendChild(p);};
  arr(`${BASE_W-4},${cy} ${BASE_W-4-a*1.6},${cy-a} ${BASE_W-4-a*1.6},${cy+a}`);
  arr(`${cx},4 ${cx-a},${4+a*1.8} ${cx+a},${4+a*1.8}`);
  document.querySelectorAll('.tick-label').forEach(t=>t.remove());
  for(let v=-RANGE;v<=RANGE;v+=5){
    if(!v)continue;
    const mk=(left,top,txt)=>{const d=document.createElement('div');d.className='tick-label';d.style.left=left+'px';d.style.top=top+'px';d.textContent=txt;planeEl.appendChild(d);};
    const tx=cx+(v/RANGE)*cx, ty=cy-(v/RANGE)*cy;
    mk(tx,cy+11,v); mk(cx-16,ty,v);
  }
}
drawGrid();

/* ══════════════ EDIÇÃO DOS EIXOS ══════════════ */
function openAxisModal() {
  if(!isAdmin()){showNotif('🔒 Sem permissão','err');return;}
  document.getElementById('ax-x-neg').value = document.getElementById('lbl-x-neg').dataset.value || 'Anti-científico';
  document.getElementById('ax-x-pos').value = document.getElementById('lbl-x-pos').dataset.value || 'Científico';
  document.getElementById('ax-y-pos').value = document.getElementById('lbl-y-pos').dataset.value || 'Competente';
  document.getElementById('ax-y-neg').value = document.getElementById('lbl-y-neg').dataset.value || 'Incompetente';
  document.getElementById('axis-modal').classList.remove('hidden');
  document.getElementById('ax-x-neg').focus();
}
function closeAxisModal(){document.getElementById('axis-modal').classList.add('hidden');}
function applyAxisLabels(){
  const xn=document.getElementById('ax-x-neg').value.trim()||'Anti-científico';
  const xp=document.getElementById('ax-x-pos').value.trim()||'Científico';
  const yp=document.getElementById('ax-y-pos').value.trim()||'Competente';
  const yn=document.getElementById('ax-y-neg').value.trim()||'Incompetente';
  setAxisLabel('lbl-x-neg', `← ${xn}`, xn);
  setAxisLabel('lbl-x-pos', `${xp} →`, xp);
  setAxisLabel('lbl-y-pos', `▲ ${yp}`, yp);
  setAxisLabel('lbl-y-neg', `${yn} ▼`, yn);
  closeAxisModal();
  showNotif('Eixos atualizados');
}
function setAxisLabel(id, display, value) {
  const el = document.getElementById(id);
  el.textContent   = display;
  el.dataset.value = value;
}
document.getElementById('axis-modal').addEventListener('click',function(e){if(e.target===this)closeAxisModal();});

/* ══════════════ GALERIA ══════════════ */
function triggerUpload(){
  if(!isAdmin()){showNotif('🔒 Sem permissão para upload','err');return;}
  document.getElementById('file-input').click();
}
document.getElementById('file-input').addEventListener('change',function(e){
  handleFiles(Array.from(e.target.files)); this.value='';
});
const uploadZone=document.getElementById('upload-zone');
uploadZone.addEventListener('dragover',e=>{e.preventDefault();if(isAdmin())uploadZone.classList.add('drag-over');});
uploadZone.addEventListener('dragleave',()=>uploadZone.classList.remove('drag-over'));
uploadZone.addEventListener('drop',e=>{
  e.preventDefault();uploadZone.classList.remove('drag-over');
  if(!isAdmin()){showNotif('🔒 Sem permissão','err');return;}
  handleFiles(Array.from(e.dataTransfer.files));
});

function handleFiles(files){
  const imgs=files.filter(f=>f.type.startsWith('image/'));
  if(!imgs.length)return;
  let i=0;
  function batch(){
    const end=Math.min(i+20,imgs.length);
    for(;i<end;i++)addToGallery(URL.createObjectURL(imgs[i]),imgs[i].name);
    updateGalleryCount();
    if(i<imgs.length)requestAnimationFrame(batch);
  }
  requestAnimationFrame(batch);
  showNotif(`${imgs.length} imagem(ns) adicionada(s)`);
}

function addToGallery(src,name){
  const div=document.createElement('div');
  div.className='gallery-item'; div.dataset.name=name.toLowerCase(); div.title=name;
  const badge=document.createElement('div'); badge.className='badge'; badge.textContent='✓';
  const img=document.createElement('img'); img.loading='lazy'; img.decoding='async'; img.src=src; img.alt=name;
  div.appendChild(img); div.appendChild(badge);

  if(isAdmin() || isEditor()){
    if(isAdmin()){
      const delBtn=document.createElement('button');
      delBtn.className='del-btn'; delBtn.title='Remover da galeria'; delBtn.textContent='✕';
      delBtn.addEventListener('click',e=>{e.stopPropagation(); removeFromGallery(src);});
      div.appendChild(delBtn);
    }
    div.addEventListener('dblclick',()=>addToPlaneCenter(src,name,div));
    div.setAttribute('draggable',true);
    div.addEventListener('dragstart',e=>{e.dataTransfer.setData('src',src);e.dataTransfer.setData('name',name);});
  }

  galleryEl.appendChild(div);
  S.gallery.push({src,name,el:div});
}

function removeFromGallery(src){
  const idx=S.gallery.findIndex(g=>g.src===src); if(idx===-1)return;
  const gItem=S.gallery[idx];
  Object.keys(S.items).forEach(id=>{if(S.items[id].src===src)removeItem(id);});
  gItem.el.remove(); URL.revokeObjectURL(src);
  S.gallery.splice(idx,1); updateGalleryCount();
  showNotif('Imagem removida');
}

function updateGalleryCount(){
  const vis=S.gallery.filter(g=>g.el.dataset.hidden!=='true').length;
  document.getElementById('gallery-count').textContent=
    `(${S.gallery.length}${vis<S.gallery.length?', '+vis+' vis.':''})`;
}
document.getElementById('gallery-search').addEventListener('input',function(){
  const q=this.value.toLowerCase().trim();
  S.gallery.forEach(g=>{g.el.dataset.hidden=(!q||g.name.toLowerCase().includes(q))?'false':'true';});
  updateGalleryCount();
});

/* ══════════════ DROP NO PLANO ══════════════ */
const dropOverlay=document.getElementById('drop-overlay');
planeEl.addEventListener('dragover',e=>{e.preventDefault();if(isEditor())dropOverlay.classList.add('visible');});
planeEl.addEventListener('dragleave',()=>dropOverlay.classList.remove('visible'));
planeEl.addEventListener('drop',e=>{
  e.preventDefault(); dropOverlay.classList.remove('visible');
  if(!isEditor()){showNotif('🔒 Sem permissão','err');return;}
  const src=e.dataTransfer.getData('src'), name=e.dataTransfer.getData('name');
  if(!src)return;
  const r=planeEl.getBoundingClientRect();
  const bpx=(e.clientX-r.left)/S.zoom, bpy=(e.clientY-r.top)/S.zoom;
  const SIZE=60;
  addToPlane(src,name,bpx-SIZE/2,bpy-SIZE/2,SIZE,S.gallery.find(g=>g.src===src)?.el);
});
function addToPlaneCenter(src,name,gEl){const SIZE=60;addToPlane(src,name,BASE_W/2-SIZE/2,BASE_H/2-SIZE/2,SIZE,gEl);}

/* ══════════════ ITEM NO PLANO ══════════════ */
function addToPlane(src,name,px,py,size,galleryItemEl,forceId){
  px=Math.max(0,Math.min(BASE_W-size,px)); py=Math.max(0,Math.min(BASE_H-size,py));
  const id=forceId || ('item-'+(S.nextId++));
  const wrap=document.createElement('div');
  wrap.className='plane-item'; wrap.id=id;
  wrap.style.cssText=`left:${px}px;top:${py}px;width:${size}px;height:${size}px;cursor:${isEditor()?'grab':'default'}`;

  const rmBtn=document.createElement('button'); rmBtn.className='remove-btn'; rmBtn.textContent='✕';
  rmBtn.addEventListener('click',e=>{e.stopPropagation();if(isAdmin() && !S.items[id].locked)removeItem(id);});
  if(!isAdmin())rmBtn.style.display='none'; // editor e viewer não veem botão remover no plano

  const lckBtn=document.createElement('button'); lckBtn.className='lock-btn'; lckBtn.innerHTML='<svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>';
  lckBtn.addEventListener('click',e=>{
    e.stopPropagation();
    if(!isEditor())return;
    const isLck = S.items[id].locked = !S.items[id].locked;
    if(isLck) wrap.classList.add('locked');
    else wrap.classList.remove('locked');
  });
  if(!isEditor())lckBtn.style.display='none';

  const imgWrap=document.createElement('div'); imgWrap.className='img-wrap';
  const img=document.createElement('img'); img.src=src; img.alt=name; img.draggable=false;
  imgWrap.appendChild(img);

  const szCtrl=document.createElement('div'); szCtrl.className='size-controls';
  szCtrl.innerHTML=`<button onclick="resizeItem('${id}',-10)">−</button><span class="sz-label" id="sz-${id}">${size}</span><button onclick="resizeItem('${id}',+10)">+</button>`;

  wrap.appendChild(rmBtn); wrap.appendChild(lckBtn); wrap.appendChild(imgWrap); wrap.appendChild(szCtrl);
  planeEl.appendChild(wrap);

  const coords=pixelToCoord(px+size/2,py+size/2);
  S.items[id]={el:wrap,src,name,px,py,size,x:coords.x,y:coords.y,galleryEl:galleryItemEl||null, locked:false};
  if(galleryItemEl)galleryItemEl.classList.add('on-plane');

  wrap.addEventListener('wheel',e=>{
    e.preventDefault(); e.stopPropagation();
    if(e.ctrlKey||e.metaKey){changeZoom(e.deltaY<0?.1:-.1,e.clientX,e.clientY);return;}
    if(isEditor() && !S.items[id].locked)resizeItem(id,e.deltaY<0?8:-8);
  },{passive:false});

  if(isEditor()){
    wrap.addEventListener('mousedown',e=>{
      if(e.target.tagName==='BUTTON' || e.target.closest('button'))return; if(e.button!==0)return;
      e.preventDefault(); e.stopPropagation();
      selectItem(id);
      if(S.items[id].locked) return;
      S.dragging=id; S.dragStartMx=e.clientX; S.dragStartMy=e.clientY;
      S.dragStartPx=S.items[id].px; S.dragStartPy=S.items[id].py;
      wrap.style.cursor='grabbing';
      document.body.style.userSelect='none';
    });
  } else {
    wrap.addEventListener('mousedown',e=>{e.preventDefault();selectItem(id);});
  }

  selectItem(id); updateItemsList(); updateCoordPanel(id);
  
  if (typeof firebaseUpdateItem === 'function') {
    firebaseUpdateItem(id, S.items[id]);
  }
}

/* ── Mousemove / mouseup ─────────────────────────────────────── */
document.addEventListener('mousemove',e=>{
  if(S.panning){vpScroll.scrollLeft=S.panSx-(e.clientX-S.panMx);vpScroll.scrollTop=S.panSy-(e.clientY-S.panMy);return;}
  if(S.fsPanning){fsInner.scrollLeft=S.fsPanSx-(e.clientX-S.fsPanMx);fsInner.scrollTop=S.fsPanSy-(e.clientY-S.fsPanMy);return;}
  if(S.dragging){
    const item=S.items[S.dragging]; if(!item){S.dragging=null;return;}
    const dx=(e.clientX-S.dragStartMx)/S.zoom, dy=(e.clientY-S.dragStartMy)/S.zoom;
    let nx=Math.max(0,Math.min(BASE_W-item.size,S.dragStartPx+dx));
    let ny=Math.max(0,Math.min(BASE_H-item.size,S.dragStartPy+dy));
    item.px=nx; item.py=ny; item.el.style.left=nx+'px'; item.el.style.top=ny+'px';
    const co=pixelToCoord(nx+item.size/2,ny+item.size/2); item.x=co.x; item.y=co.y;
    updateCoordPanel(S.dragging); showTooltip(e.clientX,e.clientY,S.dragging); 
    
    // Throttle the firebase update during drag
    if (typeof firebaseUpdateItem === 'function') {
      if (!item._lastFbUpdate || Date.now() - item._lastFbUpdate > 50) {
        firebaseUpdateItem(S.dragging, item);
        item._lastFbUpdate = Date.now();
      }
    }
    return;
  }
  if(S.fsDragging){
    const{wrap,id,fsScale}=S.fsDragging;
    const fsW=parseFloat(fsPlane.style.width),fsH=parseFloat(fsPlane.style.height);
    const sw=parseFloat(wrap.style.width);
    const dx=(e.clientX-S.fsDragging.startMx)/S.fsZoom, dy=(e.clientY-S.fsDragging.startMy)/S.fsZoom;
    let nx=Math.max(0,Math.min(fsW-sw,S.fsDragging.startPx+dx));
    let ny=Math.max(0,Math.min(fsH-sw,S.fsDragging.startPy+dy));
    wrap.style.left=nx+'px'; wrap.style.top=ny+'px';
    if(S.items[id]){S.items[id].px=nx/fsScale;S.items[id].py=ny/fsScale;
      const co=pixelToCoord(S.items[id].px+S.items[id].size/2,S.items[id].py+S.items[id].size/2);S.items[id].x=co.x;S.items[id].y=co.y;}
  }
});
document.addEventListener('mouseup',()=>{
  if(S.panning){S.panning=false;vpScroll.style.cursor=S.spaceHeld?'grab':'';}
  if(S.fsPanning){S.fsPanning=false;fsInner.style.cursor=S.spaceHeld?'grab':'';}
  if(S.dragging){
    const item=S.items[S.dragging];
    if(item){
      item.el.style.cursor='grab';
      if (typeof firebaseUpdateItem === 'function') firebaseUpdateItem(S.dragging, item);
    }
    document.body.style.userSelect='';hideTooltip();updateItemsList();S.dragging=null;
  }
  if(S.fsDragging){document.body.style.userSelect='';syncFStoPlane();S.fsDragging=null;}
});

/* ── Seleção / remoção ───────────────────────────────────────── */
function selectItem(id){
  if(S.selectedId){
    const old=S.items[S.selectedId];
    if(old)old.el.classList.remove('selected');
  }
  S.selectedId=id;
  if(id && S.items[id]){
    S.items[id].el.classList.add('selected');
    S.topZIndex = (S.topZIndex || 50) + 1;
    S.items[id].el.style.zIndex = S.topZIndex;
  }
  updateCoordPanel(id);
  updateItemsList();
}
planeEl.addEventListener('mousedown',e=>{if(e.target===planeEl||e.target===planeSVG)selectItem(null);});
document.addEventListener('keydown',e=>{
  if(e.code==='Space'&&document.activeElement.tagName!=='INPUT')e.preventDefault();
  if((e.key==='Delete'||e.key==='Backspace')&&S.selectedId){
    if(document.activeElement.tagName==='INPUT')return;
    if(isAdmin() && !S.items[S.selectedId].locked)removeItem(S.selectedId);
  }
  if(e.key==='Escape'&&S.fsActive)exitFullscreen();
});
function resizeItem(id,delta){
  if(!isEditor()){showNotif('🔒 Sem permissão','err');return;}
  const item=S.items[id]; if(!item || item.locked)return;
  const ns=Math.max(24,Math.min(400,item.size+delta));
  item.size=ns; item.el.style.width=ns+'px'; item.el.style.height=ns+'px';
  const co=pixelToCoord(item.px+ns/2,item.py+ns/2); item.x=co.x; item.y=co.y;
  const lbl=document.getElementById('sz-'+id); if(lbl)lbl.textContent=ns;
  updateCoordPanel(id);
  if (typeof firebaseUpdateItem === 'function') {
    firebaseUpdateItem(id, item);
  }
}
function removeItem(id, skipFirebase){
  const item=S.items[id]; if(!item)return;
  item.el.remove();
  const fsEl=fsPlane.querySelector(`[data-src-id="${id}"]`); if(fsEl)fsEl.remove();
  if(item.galleryEl)item.galleryEl.classList.remove('on-plane');
  delete S.items[id];
  if(S.selectedId===id){S.selectedId=null;clearCoordPanel();}
  updateItemsList();
  if (!skipFirebase && typeof firebaseRemoveItem === 'function') {
    firebaseRemoveItem(id);
  }
}
function updateCoordPanel(id){
  const item=S.items[id]; if(!item){clearCoordPanel();return;}
  document.getElementById('cd-name').textContent=item.name.replace(/\.[^.]+$/,'').slice(0,18);
  document.getElementById('cd-x').textContent=item.x.toFixed(2);
  document.getElementById('cd-y').textContent=item.y.toFixed(2);
  document.getElementById('cd-sz').textContent=item.size+'px';
}
function clearCoordPanel(){['cd-name','cd-x','cd-y','cd-sz'].forEach(k=>document.getElementById(k).textContent='—');}
function updateItemsList(){
  const list=document.getElementById('items-list');
  const entries=Object.entries(S.items);
  const frag=document.createDocumentFragment();
  entries.forEach(([id,item])=>{
    const div=document.createElement('div');
    div.className='item-entry'+(S.selectedId===id?' active':'');
    const thumb=document.createElement('img'); thumb.className='ie-thumb'; thumb.src=item.src; thumb.loading='lazy';
    const info=document.createElement('div');
    info.innerHTML=`<div class="ie-name">${item.name.replace(/\.[^.]+$/,'')}</div><div class="ie-coords">x:${item.x.toFixed(1)} y:${item.y.toFixed(1)}</div>`;
    div.appendChild(thumb); div.appendChild(info);
    div.addEventListener('click',()=>{
      selectItem(id);
      applyZoom(S.zoom, item.px+item.size/2, item.py+item.size/2);
    });
    frag.appendChild(div);
  });
  list.innerHTML=''; list.appendChild(frag);
  document.getElementById('items-count').textContent=`(${entries.length})`;
}
function showTooltip(mx,my,id){const item=S.items[id];if(!item)return;tooltipEl.textContent=`x: ${item.x.toFixed(2)}  y: ${item.y.toFixed(2)}`;tooltipEl.style.left=(mx+14)+'px';tooltipEl.style.top=(my-30)+'px';tooltipEl.classList.add('visible');}
function hideTooltip(){tooltipEl.classList.remove('visible');}
function resetPlane(){
  if(!isAdmin()){showNotif('🔒 Sem permissão','err');return;}
  if(!confirm('Limpar todo o plano?'))return;
  Object.keys(S.items).forEach(id=>removeItem(id));
  if (typeof firebaseClearPlane === 'function') firebaseClearPlane();
  showNotif('Plano limpo');
}

function toggleRightPanel() {
  const app = document.getElementById('app');
  const hidden = app.dataset.rightHidden === 'true';
  app.dataset.rightHidden = hidden ? 'false' : 'true';
  requestAnimationFrame(() => applyZoom(S.zoom));
}

document.getElementById('plane-search').addEventListener('input',function(){
  const q=this.value.toLowerCase().trim();
  document.querySelectorAll('.item-entry').forEach(el=>{
    const name=el.querySelector('.ie-name').textContent.toLowerCase();
    el.dataset.hidden = (!q||name.includes(q))?'false':'true';
  });
});

function changeTheme(t) {
  document.documentElement.dataset.theme = t === 'default' ? '' : t;
}

/* ══════════════ IMPORTAR JSON ══════════════ */
function importJSON(data, filename) {
  // Trata o caso em que o usuário faz upload do manifest.json em vez de um save
  if (data.images && !data.items) {
    let loaded = 0;
    const imgs = Array.isArray(data.images) ? data.images : [];
    for (const imgName of imgs) {
      if (S.gallery.find(g => g.name === imgName)) continue;
      addToGallery('images/' + imgName, imgName);
      loaded++;
    }
    if (loaded) {
      updateGalleryCount();
      showNotif(`🖼 ${loaded} imagem(ns) da galeria carregada(s)`);
    } else {
      showNotif('Nenhuma imagem nova no manifesto');
    }
    return;
  }

  if(!data||!Array.isArray(data.items)){showNotif('JSON sem campo "items"','err');return;}

  // Carrega rótulos dos eixos se presentes
  if(data.axisX){
    if(data.axisX.neg) setAxisLabel('lbl-x-neg',`← ${data.axisX.neg}`,data.axisX.neg);
    if(data.axisX.pos) setAxisLabel('lbl-x-pos',`${data.axisX.pos} →`,data.axisX.pos);
  }
  if(data.axisY){
    if(data.axisY.pos) setAxisLabel('lbl-y-pos',`▲ ${data.axisY.pos}`,data.axisY.pos);
    if(data.axisY.neg) setAxisLabel('lbl-y-neg',`${data.axisY.neg} ▼`,data.axisY.neg);
  }

  const range=data.range||RANGE;
  let placed=0,skipped=0;
  data.items.forEach(item=>{
    const name=item.name||'';
    const x=item.x_cientifico||0, y=item.y_competente||0, size=item.size_px||60;
    const gItem=S.gallery.find(g=>g.name===name||g.name.split('/').pop()===name);
    if(!gItem){skipped++;return;}
    const px=(x+range)/(range*2)*BASE_W - size/2;
    const py=(-y+range)/(range*2)*BASE_H - size/2;
    addToPlane(gItem.src,gItem.name,px,py,size,gItem.el);
    placed++;
  });
  let msg=`✔ ${placed} posicionado(s)`;
  if(skipped) msg+=` · ${skipped} sem imagem`;
  if(filename) msg+=` — ${filename}`;
  showNotif(msg, skipped&&!placed?'err':'ok');
}

/* ══════════════ FULLSCREEN ══════════════ */
function toggleFullscreen(){S.fsActive?exitFullscreen():enterFullscreen();}
function enterFullscreen(){
  S.fsActive=true; S.fsZoom=1;
  const W=window.innerWidth, H=window.innerHeight-54;
  const fsScale=Math.min((W/BASE_W)*.95,(H/BASE_H)*.95);
  const fsW=BASE_W*fsScale, fsH=BASE_H*fsScale;
  fsPlane.dataset.fsScale=fsScale;
  fsPlane.style.width=fsW+'px'; fsPlane.style.height=fsH+'px';
  fsPlane.style.transform='scale(1)'; fsPlane.style.transformOrigin='top left';
  fsPlane.innerHTML='';
  fsPlane.appendChild(buildSVG(fsW,fsH));
  [
    [document.getElementById('lbl-x-neg').textContent, `bottom:calc(50% - 11px);left:8px`],
    [document.getElementById('lbl-x-pos').textContent, `bottom:calc(50% - 11px);right:8px`],
    [document.getElementById('lbl-y-pos').textContent, `top:8px;left:50%;transform:translateX(-50%)`],
    [document.getElementById('lbl-y-neg').textContent, `bottom:8px;left:50%;transform:translateX(-50%)`],
  ].forEach(([txt,css])=>{
    const d=document.createElement('div'); d.className='axis-end-label'; d.textContent=txt; d.style.cssText=css; fsPlane.appendChild(d);
  });
  Object.entries(S.items).forEach(([id,item])=>spawnFSItem(id,item,fsScale));
  fsOverlay.classList.add('active');
  document.getElementById('fs-toolbar').classList.add('active');
  document.getElementById('fs-btn').innerHTML=`<svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M4 1H1v3M7 1h3v3M10 7v3H7M4 10H1V7" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg> Sair`;
  document.getElementById('fs-zoom-label').textContent='100%';
  requestAnimationFrame(()=>{const iw=fsInner.clientWidth,ih=fsInner.clientHeight;fsInner.scrollLeft=Math.max(0,(fsCanvas.offsetWidth-iw)/2);fsInner.scrollTop=Math.max(0,(fsCanvas.offsetHeight-ih)/2);});
  fsInner.addEventListener('wheel',onFSWheel,{passive:false});
  fsInner.addEventListener('mousedown',onFSPanDown);
}
function buildSVG(W,H){
  const ns='http://www.w3.org/2000/svg'; const svg=document.createElementNS(ns,'svg');
  svg.setAttribute('viewBox',`0 0 ${W} ${H}`); svg.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none';
  const steps=RANGE*2,cx=W/2,cy=H/2;
  for(let i=0;i<=steps;i++){
    const isA=i===RANGE,col=isA?'rgba(255,255,255,.18)':'rgba(255,255,255,.04)',sw=isA?1.5:1;
    const lv=document.createElementNS(ns,'line');lv.setAttribute('x1',i*(W/steps));lv.setAttribute('y1',0);lv.setAttribute('x2',i*(W/steps));lv.setAttribute('y2',H);lv.setAttribute('stroke',col);lv.setAttribute('stroke-width',sw);svg.appendChild(lv);
    const lh=document.createElementNS(ns,'line');lh.setAttribute('x1',0);lh.setAttribute('y1',i*(H/steps));lh.setAttribute('x2',W);lh.setAttribute('y2',i*(H/steps));lh.setAttribute('stroke',col);lh.setAttribute('stroke-width',sw);svg.appendChild(lh);
  }
  const a=5,arr=pts=>{const p=document.createElementNS(ns,'polygon');p.setAttribute('points',pts);p.setAttribute('fill','rgba(255,255,255,.22)');svg.appendChild(p);};
  arr(`${W-4},${cy} ${W-4-a*1.6},${cy-a} ${W-4-a*1.6},${cy+a}`);arr(`${cx},4 ${cx-a},${4+a*1.8} ${cx+a},${4+a*1.8}`);
  return svg;
}
function spawnFSItem(id,item,fsScale){
  const fsPx=item.px*fsScale,fsPy=item.py*fsScale,fsSz=item.size*fsScale;
  const wrap=document.createElement('div'); wrap.className='plane-item'; wrap.dataset.srcId=id;
  wrap.style.cssText=`left:${fsPx}px;top:${fsPy}px;width:${fsSz}px;height:${fsSz}px;position:absolute;user-select:none;touch-action:none;z-index:10;cursor:${isEditor()?'grab':'default'}`;
  const rmBtn=document.createElement('button'); rmBtn.className='remove-btn'; rmBtn.textContent='✕';
  rmBtn.addEventListener('click',e=>{e.stopPropagation();if(isAdmin() && !item.locked)removeItem(id);});
  if(!isAdmin())rmBtn.style.display='none';
  const imgWrap=document.createElement('div'); imgWrap.className='img-wrap';
  const img=document.createElement('img'); img.src=item.src; img.draggable=false;
  imgWrap.appendChild(img); wrap.appendChild(rmBtn); wrap.appendChild(imgWrap); fsPlane.appendChild(wrap);
  wrap.addEventListener('wheel',e=>{
    e.preventDefault();e.stopPropagation();
    if(e.ctrlKey||e.metaKey){changeFSZoom(e.deltaY<0?.1:-.1,e.clientX,e.clientY);return;}
    if(!isEditor() || item.locked)return;
    const delta=e.deltaY<0?8:-8; const cur=parseFloat(wrap.style.width);
    const nw=Math.max(24*fsScale,Math.min(400*fsScale,cur+delta*fsScale));
    wrap.style.width=nw+'px'; wrap.style.height=nw+'px';
    if(S.items[id]){S.items[id].size=Math.round(nw/fsScale);const co=pixelToCoord(S.items[id].px+S.items[id].size/2,S.items[id].py+S.items[id].size/2);S.items[id].x=co.x;S.items[id].y=co.y;}
  },{passive:false});
  if(isEditor()){
    wrap.addEventListener('mousedown',e=>{
      if(e.target.tagName==='BUTTON' || e.target.closest('button'))return; if(e.button!==0)return;
      e.preventDefault();e.stopPropagation();
      if(item.locked) return;
      const fsScale2=parseFloat(fsPlane.dataset.fsScale);
      S.fsDragging={wrap,id,fsScale:fsScale2,startMx:e.clientX,startMy:e.clientY,startPx:parseFloat(wrap.style.left),startPy:parseFloat(wrap.style.top)};
      wrap.style.cursor='grabbing'; document.body.style.userSelect='none';
    });
  }
}
function applyFSZoom(z,fcx,fcy){
  z=Math.max(0.25,Math.min(5,parseFloat(z.toFixed(3))));
  const oldZ=S.fsZoom; S.fsZoom=z;
  const fsScale=parseFloat(fsPlane.dataset.fsScale)||1;
  const baseW=BASE_W*fsScale,baseH=BASE_H*fsScale;
  const iRect=fsInner.getBoundingClientRect();
  const fx=fcx!=null?fcx-iRect.left:iRect.width/2, fy=fcy!=null?fcy-iRect.top:iRect.height/2;

  const minPad = 120;
  const oldW = baseW*oldZ + minPad*2, oldH = baseH*oldZ + minPad*2;
  const oldPadX = (Math.max(iRect.width, oldW) - baseW*oldZ)/2;
  const oldPadY = (Math.max(iRect.height, oldH) - baseH*oldZ)/2;

  const cx=(fsInner.scrollLeft+fx-oldPadX)/oldZ, cy=(fsInner.scrollTop+fy-oldPadY)/oldZ;

  const newW = baseW*z + minPad*2, newH = baseH*z + minPad*2;
  const cw = Math.max(iRect.width, newW), ch = Math.max(iRect.height, newH);
  const padX = (cw - baseW*z)/2, padY = (ch - baseH*z)/2;

  fsPlane.style.transform=`translate(${padX}px, ${padY}px) scale(${z})`; 
  fsPlane.style.transformOrigin='top left';
  fsCanvas.style.width=cw+'px'; fsCanvas.style.height=ch+'px';
  fsInner.scrollLeft=cx*z + padX - fx; 
  fsInner.scrollTop=cy*z + padY - fy;
  document.getElementById('fs-zoom-label').textContent=Math.round(z*100)+'%';
}
function changeFSZoom(d,fx,fy){applyFSZoom(S.fsZoom+d,fx,fy);}
function resetFSZoom(){
  applyFSZoom(1);
  requestAnimationFrame(()=>{
    const iRect = fsInner.getBoundingClientRect();
    fsInner.scrollLeft = Math.max(0, (parseFloat(fsCanvas.style.width) - iRect.width)/2);
    fsInner.scrollTop = Math.max(0, (parseFloat(fsCanvas.style.height) - iRect.height)/2);
  });
}
function onFSWheel(e){if(!e.ctrlKey&&!e.metaKey)return;e.preventDefault();changeFSZoom(e.deltaY<0?.1:-.1,e.clientX,e.clientY);}
function onFSPanDown(e){if(e.button===1||(e.button===0&&S.spaceHeld)){e.preventDefault();S.fsPanning=true;S.fsPanMx=e.clientX;S.fsPanMy=e.clientY;S.fsPanSx=fsInner.scrollLeft;S.fsPanSy=fsInner.scrollTop;fsInner.style.cursor='grabbing';}}
function syncFStoPlane(){
  const fsScale=parseFloat(fsPlane.dataset.fsScale)||1;
  fsPlane.querySelectorAll('.plane-item[data-src-id]').forEach(wrap=>{
    const id=wrap.dataset.srcId; const item=S.items[id]; if(!item)return;
    item.px=parseFloat(wrap.style.left)/fsScale; item.py=parseFloat(wrap.style.top)/fsScale;
    item.size=Math.round(parseFloat(wrap.style.width)/fsScale);
    item.el.style.left=item.px+'px'; item.el.style.top=item.py+'px';
    item.el.style.width=item.size+'px'; item.el.style.height=item.size+'px';
    const co=pixelToCoord(item.px+item.size/2,item.py+item.size/2); item.x=co.x; item.y=co.y;
  });
  updateItemsList();
}
function exitFullscreen(){
  syncFStoPlane();
  fsOverlay.classList.remove('active');
  document.getElementById('fs-toolbar').classList.remove('active');
  S.fsActive=false;
  document.getElementById('fs-btn').innerHTML=`<svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M1 4V1h3M7 1h3v3M10 7v3H7M4 10H1V7" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg> Tela Cheia`;
  fsInner.removeEventListener('wheel',onFSWheel); fsInner.removeEventListener('mousedown',onFSPanDown);
  fsCanvas.style.width=''; fsCanvas.style.height='';
}

/* ══════════════ EXPORTAR PNG ══════════════ */
function exportPNG(){
  planeEl.style.transform='none';
  document.querySelectorAll('.remove-btn,.size-controls,.tick-label').forEach(el=>{el.dataset.xhide=el.style.display;el.style.display='none';});
  html2canvas(planeEl,{backgroundColor:'#0f0f16',scale:2,useCORS:true,allowTaint:true,ignoreElements:el=>el.id==='drop-overlay'}).then(canvas=>{
    document.querySelectorAll('[data-xhide]').forEach(el=>{el.style.display=el.dataset.xhide;delete el.dataset.xhide;});
    planeEl.style.transform=`scale(${S.zoom})`;
    Object.assign(document.createElement('a'),{href:canvas.toDataURL('image/png'),download:'tkk-dredd-plane.png'}).click();
    showNotif('PNG exportado');
  });
}
