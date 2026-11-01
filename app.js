/* Work Camera V2 — independent PWA, opt-in OneDrive App Folder sync.
 * Photo blobs stay in IndexedDB until explicitly cleared after verified backup.
 */
(() => {
  'use strict';
  const apartments = Array.isArray(window.WC_APARTMENTS) ? window.WC_APARTMENTS : [];
  const residential = [...new Set(apartments.map(x => String(x.building)))].sort((a,b)=>Number(a)-Number(b));
  const boilers = new Set(['3514','3515','3544','3545','3570','3595','3615','3645','3685','3715','3720','3735','3770','3775','3825','3845']);
  const buildingIds = [...new Set([...residential,'3615'])].sort((a,b)=>Number(a)-Number(b));
  const facilities = [
    {id:'school',label:'3613 - Montessori School',icon:'🏫'},
    {id:'pool',label:'Swimming Pool',icon:'🏊'},
    {id:'tennis',label:'Tennis Courts',icon:'🎾'}
  ];
  const categories = [
    {id:'apartment',label:'Apartment',icon:'🏠'},
    {id:'exterior',label:'Exterior',icon:'🏢'},
    {id:'hallways',label:'Hallways',icon:'🚪'},
    {id:'laundry',label:'Laundry Room',icon:'🧺'},
    {id:'boiler',label:'Boiler Room',icon:'🔥'},
    {id:'office',label:'Office Lease',icon:'🗄️'}
  ];
  const $ = id => document.getElementById(id);
  const getCategory = id => categories.find(a=>a.id===id);
  const uniqueUnits = (building) => apartments.filter(a=>String(a.building)===building).sort((a,b)=>Number(a.number)-Number(b.number));
  const allowedAreas = building => building==='3615' ? ['office','boiler'] : ['apartment','exterior','hallways','laundry',...(boilers.has(building)?['boiler']:[])];
  let previous = {};
  try { previous=JSON.parse(localStorage.getItem('work-camera:last-location')||'{}')||{}; } catch(e) { previous={}; }
  const state = {
    group:previous.group==='facilities'?'facilities':'buildings',
    building:buildingIds.includes(previous.building)?previous.building:'3615',
    area:previous.area||'office',
    unit:previous.unit||'',
    facility:facilities.some(f=>f.id===previous.facility)?previous.facility:'pool',
    confirmed:!!previous.confirmed
  };
  let currentView='locations'; let stream=null; let databasePromise=null; let urls=[]; let detailURL=null; let selectedPhoto=null;
  const cloud=window.WC_ONEDRIVE; let syncRunning=false;
  function validState(){
    const areas=allowedAreas(state.building); if(!areas.includes(state.area))state.area=areas[0];
    const units=uniqueUnits(state.building); if(state.area==='apartment'&&!units.some(x=>x.unit===state.unit))state.unit=units[0]?.unit||'';
  }
  function persist(){try{localStorage.setItem('work-camera:last-location',JSON.stringify(state));}catch(e){}}
  function locationPath(){
    if(state.group==='facilities')return facilities.find(x=>x.id===state.facility)?.label||'Facility';
    const loc=state.building==='3615'?'3615':`Building ${state.building}`;
    const category=getCategory(state.area)?.label||state.area;
    return `${loc} / ${category}${state.area==='apartment'?' / Apt '+state.unit:''}`;
  }
  function locationKey(){return state.group==='facilities'?'facility:'+state.facility:`building:${state.building}:${state.area}:${state.area==='apartment'?state.unit:''}`;}
  function currentSnapshot(){return {group:state.group,building:state.group==='buildings'?state.building:null,area:state.group==='buildings'?state.area:null,unit:state.group==='buildings'&&state.area==='apartment'?state.unit:null,facility:state.group==='facilities'?state.facility:null,path:locationPath(),key:locationKey()};}
  function markChanged(){state.confirmed=false;persist();updatePath();}
  function option(value,label){const o=document.createElement('option');o.value=value;o.textContent=label;return o;}
  function renderBuilding(){
    $('building').replaceChildren(...buildingIds.map(b=>option(b,b==='3615'?'3615 — Leasing Office':`Building ${b}`)));
    $('building').value=state.building;renderAreas();
  }
  function renderAreas(){
    validState();$('areas').replaceChildren(...allowedAreas(state.building).map(id=>{
      const info=getCategory(id);const b=document.createElement('button');b.type='button';b.className='area-button'+(state.area===id?' active':'');b.setAttribute('aria-pressed',String(state.area===id));
      const emoji=document.createElement('span');emoji.className='area-icon';emoji.textContent=info.icon;
      const title=document.createElement('span');title.textContent=info.label;b.append(emoji,title);
      b.addEventListener('click',()=>{state.area=id;markChanged();renderAreas();});return b;
    }));
    const unitSection=$('unit-section');unitSection.classList.toggle('hide',state.area!=='apartment');
    if(state.area==='apartment'){
      const units=uniqueUnits(state.building);$('unit').replaceChildren(...units.map(u=>option(u.unit,`Apartment ${u.unit}`)));$('unit').value=state.unit;
    }
    updatePath();
  }
  function renderFacilities(){
    $('facilities').replaceChildren(...facilities.map(f=>{
      const b=document.createElement('button');b.type='button';b.className='facility-button'+(f.id===state.facility?' active':'');b.setAttribute('aria-pressed',String(f.id===state.facility));
      const emo=document.createElement('span');emo.textContent=f.icon;b.append(emo,document.createTextNode(f.label));
      b.addEventListener('click',()=>{state.facility=f.id;markChanged();renderFacilities();});return b;
    })); updatePath();
  }
  function renderGroup(){
    const isBuildings=state.group==='buildings';$('building-selection').classList.toggle('hide',!isBuildings);$('facility-selection').classList.toggle('hide',isBuildings);
    for(const g of ['buildings','facilities']){$('mode-'+g).classList.toggle('active',g===state.group);$('mode-'+g).setAttribute('aria-selected',String(g===state.group));}
    updatePath();
  }
  function updatePath(){$('selected-path').textContent=locationPath();$('camera-path').textContent=locationPath();}
  function openDb(){
    if(databasePromise)return databasePromise;
    databasePromise=new Promise((resolve,reject)=>{
      if(!window.indexedDB){reject(new Error('Photo storage is unavailable in this browser.'));return;}
      const req=indexedDB.open('work-camera-v1',1);
      req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains('photos')){const store=db.createObjectStore('photos',{keyPath:'id'});store.createIndex('createdAt','createdAt');}};
      req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error||new Error('IndexedDB unavailable'));
    });return databasePromise;
  }
  async function addPhoto(blob, filename){
    const db=await openDb(); const location=currentSnapshot();
    const photo={id:typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():String(Date.now())+'-'+Math.random().toString(36).slice(2),createdAt:Date.now(),filename:filename||'work-photo.jpg',mime:blob.type||'image/jpeg',size:blob.size,blob,location,status:'local-only'};
    await new Promise((resolve,reject)=>{const tx=db.transaction('photos','readwrite');tx.objectStore('photos').add(photo);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});
    return photo;
  }
  async function listPhotos(){const db=await openDb();return new Promise((resolve,reject)=>{const tx=db.transaction('photos','readonly');const r=tx.objectStore('photos').getAll();r.onsuccess=()=>resolve(r.result.sort((a,b)=>b.createdAt-a.createdAt));r.onerror=()=>reject(r.error);});}
  async function updatePhoto(photo){const db=await openDb();await new Promise((resolve,reject)=>{const tx=db.transaction('photos','readwrite');tx.objectStore('photos').put(photo);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}
  async function deletePhoto(id){const db=await openDb();await new Promise((resolve,reject)=>{const tx=db.transaction('photos','readwrite');tx.objectStore('photos').delete(id);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}
  function notify(message,isError=false){$('camera-message').textContent=message;$('camera-message').classList.toggle('error',isError);}
  async function saveBlob(blob,filename){
    if(!blob||!blob.size){notify('Empty image: nothing saved.',true);return;}
    try{const photo=await addPhoto(blob,filename);notify('✓ Saved locally: '+photo.location.path+(cloud?.connected()?' · Cloud upload queued':' · Cloud not connected'));if(cloud?.connected())void syncPhotos();}catch(e){notify('Could not save photo: '+e.message,true);}
  }
  async function startCamera(){
    stopCamera();notify('');
    const video=$('camera-video');$('camera-placeholder').classList.remove('hide');$('shutter').disabled=true;
    try{
      if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia)throw new Error('Secure HTTPS camera access unavailable');
      stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1920},height:{ideal:1080}},audio:false});
      if(currentView!=='camera'){stopCamera();return;}
      video.srcObject=stream;await video.play();$('camera-placeholder').classList.add('hide');$('shutter').disabled=false;
    }catch(e){notify('Camera preview unavailable. Tap ＋ to open the phone camera.',true);}
  }
  function stopCamera(){if(stream){stream.getTracks().forEach(t=>t.stop());stream=null;}$('camera-video').srcObject=null;$('shutter').disabled=true;}
  async function takePicture(){
    const video=$('camera-video');if(!stream||!video.videoWidth)return;
    const canvas=$('photo-canvas');const w=video.videoWidth,h=video.videoHeight;const scale=Math.min(1,2000/Math.max(w,h));canvas.width=Math.round(w*scale);canvas.height=Math.round(h*scale);
    const ctx=canvas.getContext('2d');ctx.drawImage(video,0,0,canvas.width,canvas.height);
    $('shutter').disabled=true;
    try{const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.86));await saveBlob(blob,`WC_${new Date().toISOString().replace(/[.:]/g,'-')}.jpg`);}finally{$('shutter').disabled=!stream;}
  }
  function releaseUrls(){urls.forEach(u=>URL.revokeObjectURL(u));urls=[];}
  async function renderGallery(){
    releaseUrls();$('gallery-grid').replaceChildren();
    try{
      let photos=await listPhotos();if($('gallery-filter').value==='current')photos=photos.filter(p=>p.location.key===locationKey());
      $('photo-count').textContent=photos.length+' photo'+(photos.length===1?'':'s');$('gallery-empty').classList.toggle('hide',photos.length>0);
      for(const p of photos){
        const url=p.blob?URL.createObjectURL(p.blob):null;if(url)urls.push(url);
        const tile=document.createElement('button');tile.type='button';tile.className='photo-tile';
        const img=document.createElement(p.blob?'img':'div');if(url){img.src=url;img.alt='Work photo';img.loading='lazy';}else{img.className='cloud-thumbnail';img.textContent='☁️ Cloud copy';}
        const caption=document.createElement('div');caption.className='tile-caption';
        const title=document.createElement('strong');title.textContent=p.location.path;
        const date=document.createElement('small');date.textContent=new Date(p.createdAt).toLocaleString();
        const status=document.createElement('div');status.className='tile-badge'+(p.status==='verified'?' verified':'');status.textContent=p.status==='verified'?(p.blob?'✓ OneDrive verified':'☁️ Cloud only'):'● Local only — not backed up';
        caption.append(title,date);tile.append(img,caption,status);tile.addEventListener('click',()=>showDetails(p));$('gallery-grid').append(tile);
      }
    }catch(e){$('gallery-empty').classList.remove('hide');$('gallery-empty').querySelector('p').textContent='Could not read local photos: '+e.message;}
  }
  function showDetails(photo){selectedPhoto=photo;if(detailURL)URL.revokeObjectURL(detailURL);detailURL=photo.blob?URL.createObjectURL(photo.blob):null;$('detail-image').classList.toggle('hide',!detailURL);if(detailURL)$('detail-image').src=detailURL;else $('detail-image').removeAttribute('src');$('export-photo').disabled=!photo.blob;$('open-cloud-photo').disabled=!photo.cloud?.webUrl;$('detail-info').textContent=`${photo.location.path} · ${new Date(photo.createdAt).toLocaleString()} · ${(photo.size/1024/1024).toFixed(2)} MB · ${photo.status==='verified'?'OneDrive metadata verified':'Local only — NOT backed up'}`;$('photo-dialog').showModal();}
  function closeDialog(){$('photo-dialog').close();if(detailURL)URL.revokeObjectURL(detailURL);detailURL=null;selectedPhoto=null;}
  function exportSelected(){if(!selectedPhoto?.blob)return;const a=document.createElement('a');const url=URL.createObjectURL(selectedPhoto.blob);a.href=url;a.download=selectedPhoto.filename||'work-photo.jpg';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);}
  async function removeSelected(){if(!selectedPhoto)return;const reason=selectedPhoto.status==='verified'?'This removes the local photo/gallery entry. Your OneDrive file will NOT be deleted. Continue?':'WARNING: This photo has NOT been verified in OneDrive. Deleting it may destroy the only copy. Delete permanently?';if(!confirm(reason))return;const id=selectedPhoto.id;try{await deletePhoto(id);closeDialog();renderGallery();}catch(e){alert('Delete failed: '+e.message);}}
  function authMessage(message){$('auth-message').textContent=message;}
  function syncMessage(message){$('sync-message').textContent=message;}
  async function renderCloud(){
    $('client-id').value=cloud?.getClientId()||'';
    $('redirect-uri').textContent=location.origin+location.pathname;
    const linked=!!cloud?.connected();
    $('cloud-status').textContent=linked?'Connected for this session':'Not connected';
    $('headerStatus').textContent=linked?'ONEDRIVE READY':'LOCAL ONLY';
    $('headerStatus').classList.toggle('synced',linked);
    $('backup-warning').classList.toggle('hide',linked);
    $('sync-photos').disabled=!linked||syncRunning;
    $('disconnect-cloud').disabled=!linked;
    try{
      const all=await listPhotos();const local=all.filter(p=>p.status!=='verified'&&p.blob);
      const verified=all.filter(p=>p.status==='verified').length;
      const localCount=all.filter(p=>p.blob).length;
      $('sync-summary').textContent=`${local.length} pending · ${verified} cloud-verified · ${localCount} local photos · ${all.length-localCount} cloud-only entries`;
      $('delete-verified').disabled=!all.some(p=>p.blob&&p.status==='verified'&&p.cloud?.driveItemId&&Number(p.cloud.size)===p.size)||syncRunning;
      $('backup-warning').classList.toggle('hide',local.length===0&&verified>0);
    }catch(e){$('sync-summary').textContent='Local data unavailable: '+e.message;}
  }
  async function syncPhotos(){
    if(syncRunning||!cloud?.connected())return;
    if(!navigator.onLine){syncMessage('Offline: photos remain pending in this device.');return;}
    syncRunning=true;await renderCloud();
    let sent=0,failed=0;
    try{
      const pending=(await listPhotos()).filter(x=>x.status!=='verified'&&x.blob).sort((a,b)=>a.createdAt-b.createdAt);
      for(const p of pending){
        if(!cloud.connected()){syncMessage('Session expired. Reconnect OneDrive to continue.');break;}
        syncMessage(`Uploading ${sent+failed+1} of ${pending.length}: ${p.location.path}`);
        try{
          const receipt=await cloud.upload(p);
          p.status='verified';p.cloud=receipt;delete p.lastError;
          await updatePhoto(p);sent++;
        }catch(e){failed++;p.status='local-only';p.lastError=String(e.message||e);await updatePhoto(p);
          syncMessage(`Upload stopped: ${p.lastError}. Photos remain stored locally.`);
          break; // avoid repeated failures/rate limiting; user can retry
        }
      }
      if(!failed)syncMessage(`Sync finished: ${sent} newly verified photo(s). Local copies retained.`);
    }catch(e){syncMessage('Sync failed: '+e.message+' (local photos retained).');}
    finally{syncRunning=false;await renderCloud();if(currentView==='gallery')await renderGallery();}
  }
  async function deleteVerifiedLocal(){
    if(syncRunning)return;
    const verified=(await listPhotos()).filter(p=>p.blob&&p.status==='verified'&&p.cloud?.driveItemId&&Number(p.cloud.size)===p.size);
    if(!verified.length)return;
    if(!confirm(`Remove ${verified.length} locally stored photo(s) that have OneDrive metadata verification? This removes the local copy and depends on the cloud copy remaining available.`))return;
    for(const p of verified){p.blob=null;p.localPurged=true;await updatePhoto(p);}
    syncMessage(`Freed ${verified.length} verified local image(s). Gallery entries and cloud files retained.`);
    await renderCloud();
  }
  async function renderSettings(){
    try{const all=await listPhotos();const bytes=all.reduce((n,p)=>n+(p.blob?.size||0),0);$('storage-number').textContent=`${all.length} photos · ${(bytes/1024/1024).toFixed(1)} MB stored locally`;}catch(e){$('storage-number').textContent='Storage unavailable: '+e.message;}
    await renderCloud();
  }

  async function setView(view){
    if(view==='camera'&&!state.confirmed){view='locations';$('open-camera').focus();}
    if(currentView==='camera'&&view!=='camera')stopCamera();
    currentView=view;document.querySelectorAll('.view').forEach(x=>x.classList.toggle('active',x.id==='view-'+view));document.querySelectorAll('.nav-item').forEach(x=>x.classList.toggle('active',x.dataset.view===view));
    if(view==='camera'){updatePath();await startCamera();}if(view==='gallery')await renderGallery();else releaseUrls();if(view==='settings')await renderSettings();
  }
  function init(){
    validState();renderBuilding();renderFacilities();renderGroup();
    $('building').addEventListener('change',e=>{state.building=e.target.value;state.area=state.building==='3615'?'office':'apartment';state.unit='';markChanged();renderAreas();});
    $('unit').addEventListener('change',e=>{state.unit=e.target.value;markChanged();});
    ['buildings','facilities'].forEach(g=>$('mode-'+g).addEventListener('click',()=>{state.group=g;markChanged();renderGroup();}));
    $('open-camera').addEventListener('click',()=>{state.confirmed=true;persist();setView('camera');});
    $('change-location').addEventListener('click',()=>setView('locations'));
    $('camera-retry').addEventListener('click',startCamera);
    $('shutter').addEventListener('click',takePicture);
    $('file-camera').addEventListener('change',async e=>{const file=e.target.files?.[0];if(file)await saveBlob(file,file.name);e.target.value='';});
    $('gallery-filter').addEventListener('change',renderGallery);
    document.querySelectorAll('.nav-item').forEach(x=>x.addEventListener('click',()=>setView(x.dataset.view)));
    $('close-dialog').addEventListener('click',closeDialog);
    $('photo-dialog').addEventListener('cancel',e=>{e.preventDefault();closeDialog();});
    $('export-photo').addEventListener('click',exportSelected);
    $('open-cloud-photo').addEventListener('click',()=>{const url=selectedPhoto?.cloud?.webUrl;if(url&&/^https:\/\//.test(url))window.open(url,'_blank','noopener,noreferrer');});
    $('delete-photo').addEventListener('click',removeSelected);
    $('save-client-id').addEventListener('click',async()=>{
      try{cloud.setClientId($('client-id').value);authMessage('Application ID saved on this device (not a secret).');await renderCloud();}
      catch(e){authMessage('Error: '+e.message);}
    });
    $('connect-cloud').addEventListener('click',async()=>{
      try{
        // Save the just-entered ID to avoid requiring a separate step.
        if($('client-id').value.trim()!==cloud.getClientId())cloud.setClientId($('client-id').value);
        await cloud.startSignIn();
      }catch(e){authMessage('Cannot connect: '+e.message);}
    });
    $('disconnect-cloud').addEventListener('click',async()=>{cloud.disconnect();authMessage('Disconnected on this device. Your OneDrive files remain untouched.');await renderCloud();});
    $('sync-photos').addEventListener('click',syncPhotos);
    $('delete-verified').addEventListener('click',()=>deleteVerifiedLocal().catch(e=>syncMessage('Cannot clear: '+e.message)));
    window.addEventListener('online',()=>{if(cloud?.connected())void syncPhotos();});
    window.addEventListener('pagehide',stopCamera);
    if(cloud){
      cloud.completeSignIn().then(result=>{
        if(result.handled){authMessage('OneDrive connected for this session.');void syncPhotos();}
        return renderCloud();
      }).catch(e=>{authMessage('Microsoft sign-in error: '+e.message);void renderCloud();});
    }
    if('serviceWorker' in navigator && ['https:','http:'].includes(location.protocol))navigator.serviceWorker.register('./service-worker.js').catch(()=>{});
  }
  if(apartments.length===500&&residential.length===54){init();}else{document.querySelector('.warning').textContent='Catalog failed validation: expected 500 apartments in 54 buildings. Camera disabled for safety.';$('open-camera').disabled=true;}
})();
