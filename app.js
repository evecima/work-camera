/* Work Camera V3 — offline-first private photo library.
 * IndexedDB schema and existing images are preserved; backups require explicit computer verification.
 */
(() => {
  'use strict';
  const APP_VERSION='3.3.0';
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
  let currentView='home'; let databasePromise=null; let urls=[]; let detailURL=null; let selectedPhoto=null;
  let preparedExport=null, preparingExport=false, savingExport=false;
  const MAX_BATCH_BYTES=70*1024*1024, MAX_BATCH_PHOTOS=80;
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
  async function getPhoto(id){const db=await openDb();return new Promise((resolve,reject)=>{const tx=db.transaction('photos','readonly');const req=tx.objectStore('photos').get(id);req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>reject(req.error);});}
  async function deletePhoto(id){const db=await openDb();await new Promise((resolve,reject)=>{const tx=db.transaction('photos','readwrite');tx.objectStore('photos').delete(id);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}
  function notify(message,isError=false){$('camera-message').textContent=message;$('camera-message').classList.toggle('error',isError);}
  async function saveBlob(blob,filename){
    if(!blob||!blob.size){notify('Empty image: nothing saved.',true);return;}
    if(!blob.type.startsWith('image/')&&!/\.(jpe?g|png|heic|heif|webp|avif|gif)$/i.test(filename||'')){notify('Select a photo file, not another document.',true);return;}
    try{
      const photo=await addPhoto(blob,filename);
      notify('✓ Photo saved: '+photo.location.path+'. Take another photo or open My Photos to review it.');
    }catch(e){notify('Could not save photo: '+e.message,true);}
  }
  function releaseUrls(){urls.forEach(u=>URL.revokeObjectURL(u));urls=[];}
  async function renderGallery(){
    releaseUrls();$('gallery-grid').replaceChildren();
    try{
      let photos=await listPhotos();const filter=$('gallery-filter').value;
      if(filter==='current')photos=photos.filter(p=>p.location.key===locationKey());
      else if(filter.startsWith('building:'))photos=photos.filter(p=>p.location.group==='buildings'&&p.location.building===filter.slice(9));
      else if(filter.startsWith('facility:'))photos=photos.filter(p=>p.location.group==='facilities'&&p.location.facility===filter.slice(9));
      photos.sort((a,b)=>(a.location.path||'').localeCompare(b.location.path||'')||b.createdAt-a.createdAt);
      let lastGroup='';
      $('photo-count').textContent=photos.length+' photo'+(photos.length===1?'':'s');$('gallery-empty').classList.toggle('hide',photos.length>0);
      for(const p of photos){
        if(p.location.path!==lastGroup){const heading=document.createElement('h3');heading.className='gallery-group-title';heading.textContent='📁 '+p.location.path;$('gallery-grid').append(heading);lastGroup=p.location.path;}
        const url=p.blob?URL.createObjectURL(p.blob):null;if(url)urls.push(url);
        const tile=document.createElement('button');tile.type='button';tile.className='photo-tile';
        const img=document.createElement(p.blob?'img':'div');if(url){img.src=url;img.alt='Work photo';img.loading='lazy';}else{img.className='cloud-thumbnail';img.textContent='Old cloud-only entry';}
        const caption=document.createElement('div');caption.className='tile-caption';
        const title=document.createElement('strong');title.textContent=p.location.path;
        const date=document.createElement('small');date.textContent=new Date(p.createdAt).toLocaleString();
        const status=document.createElement('div');status.className='tile-badge'+(p.backupVerifiedAt?' verified':'');status.textContent=!p.blob?'No local image (legacy record)':p.backupVerifiedAt?'✓ Computer backup confirmed':p.backupBatchId?'● Exported · check on computer':'● On this device only';
        caption.append(title,date);tile.append(img,caption,status);tile.addEventListener('click',()=>showDetails(p));$('gallery-grid').append(tile);
      }
    }catch(e){$('gallery-empty').classList.remove('hide');$('gallery-empty').querySelector('p').textContent='Could not read local photos: '+e.message;}
  }
  function showDetails(photo){selectedPhoto=photo;if(detailURL)URL.revokeObjectURL(detailURL);detailURL=photo.blob?URL.createObjectURL(photo.blob):null;$('detail-image').classList.toggle('hide',!detailURL);if(detailURL)$('detail-image').src=detailURL;else $('detail-image').removeAttribute('src');$('export-photo').disabled=!photo.blob;$('share-photo').disabled=!photo.blob;$('detail-info').textContent=photo.location.path+' · '+new Date(photo.createdAt).toLocaleString()+' · '+((photo.size||0)/1024/1024).toFixed(2)+' MB · '+(!photo.blob?'No local photo (legacy entry)':photo.backupVerifiedAt?'Computer backup confirmed':'NOT verified on computer');$('photo-dialog').showModal();}
  function closeDialog(){$('photo-dialog').close();if(detailURL)URL.revokeObjectURL(detailURL);detailURL=null;selectedPhoto=null;}
  function exportSelected(){if(!selectedPhoto?.blob)return;const a=document.createElement('a');const url=URL.createObjectURL(selectedPhoto.blob);a.href=url;a.download=selectedPhoto.filename||'work-photo.jpg';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
  async function shareSelected(){
    if(!selectedPhoto?.blob)return;
    const photo=selectedPhoto;
    const name=photo.filename||'work-photo.jpg';
    const mime=photo.blob.type||(/\.heic$/i.test(name)?'image/heic':/\.heif$/i.test(name)?'image/heif':photo.mime||'image/jpeg');
    const file=new File([photo.blob],name,{type:mime});
    if(typeof navigator.share!=='function'||typeof navigator.canShare!=='function'||!navigator.canShare({files:[file]})){
      alert('This browser cannot share this image directly. Use Download, then share it from Files.');
      return;
    }
    try{
      await navigator.share({files:[file],title:'Work Camera photo'});
    }catch(e){
      if(e?.name!=='AbortError')alert('Could not open sharing: '+(e?.message||'Please try Download instead.'));
    }
  }
  async function removeSelected(){if(!selectedPhoto)return;const reason=selectedPhoto.backupVerifiedAt?'This photo has a manually confirmed computer backup. Delete the local photo permanently?':'WARNING: This photo has NOT been confirmed on a computer. You may destroy its only copy. Delete permanently?';if(!confirm(reason))return;const id=selectedPhoto.id;try{await deletePhoto(id);closeDialog();renderGallery();}catch(e){alert('Delete failed: '+e.message);}}

  function localImages(all){return all.filter(p=>p.blob&&p.blob.size>0);}
  function pendingBatch(all){
    const pending=localImages(all).filter(p=>p.backupBatchId&&!p.backupVerifiedAt).sort((a,b)=>(a.backupExportedAt||0)-(b.backupExportedAt||0));
    return pending.length?pending.filter(p=>p.backupBatchId===pending[0].backupBatchId):[];
  }
  function chooseBatch(all){
    const unfinished=pendingBatch(all);
    if(unfinished.length)return unfinished.sort((a,b)=>a.createdAt-b.createdAt);
    const outstanding=localImages(all).filter(p=>!p.backupVerifiedAt&&!p.backupBatchId).sort((a,b)=>a.createdAt-b.createdAt);
    let bytes=0;const batch=[];
    for(const p of outstanding){
      if(batch.length&&(batch.length>=MAX_BATCH_PHOTOS||bytes+p.blob.size>MAX_BATCH_BYTES))break;
      batch.push(p);bytes+=p.blob.size;
    }
    return batch;
  }
  function backupMessage(value,error=false){$('backup-message').textContent=value;$('backup-message').classList.toggle('error',error);}
  function updateConfirmButton(){
    $('confirm-backup').disabled=!$('backup-checked').checked||$('confirm-backup').dataset.available!=='true';
  }
  async function renderHome(){
    try{const all=localImages(await listPhotos());const pending=all.filter(p=>!p.backupVerifiedAt).length;
      $('home-summary').textContent=all.length+' photo(s) on this iPhone · '+pending+' awaiting confirmed computer backup.';
    }catch(e){$('home-summary').textContent='Cannot read local photo library: '+e.message;}
  }
  async function renderSettings(){
    try{
      const all=await listPhotos(),local=localImages(all),pending=pendingBatch(all);
      const bytes=local.reduce((sum,p)=>sum+p.blob.size,0);
      const confirmed=local.filter(p=>p.backupVerifiedAt);
      const newPhotos=local.filter(p=>!p.backupVerifiedAt&&!p.backupBatchId);
      $('storage-number').textContent=local.length+' photos · '+(bytes/1024/1024).toFixed(1)+' MB on this device';
      $('backup-summary').textContent=newPhotos.length+' new photo(s) need export.\n'+pending.length+' photo(s) exported but NOT confirmed.\n'+confirmed.length+' photo(s) manually confirmed on computer.';
      $('export-backup').disabled=preparingExport||savingExport||!chooseBatch(all).length;
      $('export-backup').textContent=preparingExport?'Preparing…':pending.length?'Prepare current batch again':'Prepare ZIP';
      $('save-backup').disabled=!preparedExport||savingExport;
      $('confirm-backup').dataset.available=pending.length?'true':'false';
      updateConfirmButton();
      $('clear-backed-up').disabled=!confirmed.length||preparingExport||savingExport;
      if(!preparedExport)$('backup-ready').textContent=pending.length
        ? 'An exported batch is waiting for computer verification. Re-export it if needed.'
        : 'Prepare a ZIP, then tap Save / Share ZIP.';
    }catch(e){backupMessage('Could not read storage: '+e.message,true);}
  }
  async function prepareBackup(){
    if(preparingExport||savingExport)return;
    preparingExport=true;preparedExport=null;$('backup-ready').textContent='Preparing archive…';
    await renderSettings();
    try{
      const photos=chooseBatch(await listPhotos());
      if(!photos.length){backupMessage('No unverified local photos to export.');return;}
      if(!window.WC_BACKUP)throw new Error('Offline backup module unavailable.');
      const batchId=photos[0].backupBatchId||('wc-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8));
      const blob=await window.WC_BACKUP.makeZip(photos);
      const fileName='Work_Camera_'+new Date().toISOString().slice(0,10)+'_'+batchId+'.zip';
      preparedExport={photos,blob,fileName,batchId};
      $('backup-ready').textContent='ZIP ready: '+photos.length+' photo(s) · '+(blob.size/1024/1024).toFixed(1)+' MB.\nTap Save / Share ZIP, then transfer it to your computer.';
      backupMessage('The ZIP is only prepared in memory; it has NOT yet been saved or verified.');
    }catch(e){backupMessage('Could not prepare ZIP: '+e.message,true);}
    finally{preparingExport=false;await renderSettings();}
  }
  function downloadZip(blob,fileName){
    const url=URL.createObjectURL(blob);const link=document.createElement('a');
    link.href=url;link.download=fileName;document.body.append(link);link.click();link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),60000);
  }
  async function savePreparedBackup(){
    if(!preparedExport||savingExport)return;
    savingExport=true;const archive=preparedExport;let dispatched=false;
    try{
      const file=new File([archive.blob],archive.fileName,{type:'application/zip'});
      if(navigator.share&&navigator.canShare&&navigator.canShare({files:[file]})){
        try{await navigator.share({files:[file],title:'Work Camera photo archive'});dispatched=true;}
        catch(e){if(e.name==='AbortError'){backupMessage('Share canceled. ZIP remains ready; nothing was deleted.');return;}
          downloadZip(archive.blob,archive.fileName);dispatched=true;}
      }else{downloadZip(archive.blob,archive.fileName);dispatched=true;}
    }catch(e){
      try{downloadZip(archive.blob,archive.fileName);dispatched=true;}
      catch(error){backupMessage('Cannot export ZIP: '+error.message,true);}
    }finally{
      if(dispatched){
        try{
          for(const p of archive.photos){const current=await getPhoto(p.id);
            if(current?.blob&&!current.backupVerifiedAt){current.backupBatchId=archive.batchId;current.backupExportedAt=Date.now();await updatePhoto(current);}
          }
          preparedExport=null;$('backup-checked').checked=false;
          backupMessage('ZIP sent to the share/download flow. NOT verified yet. Move it to your computer, open it and check the photos. Only then confirm step 2.');
        }catch(e){backupMessage('ZIP sent, but could not record the export: '+e.message+'. Keep every local photo.',true);}
      }
      savingExport=false;await renderSettings();
    }
  }
  async function confirmBackup(){
    if(!$('backup-checked').checked){backupMessage('First check the confirmation box after inspecting the ZIP on your computer.',true);return;}
    const pending=pendingBatch(await listPhotos());
    if(!pending.length){backupMessage('No exported batch awaits verification.',true);return;}
    if(!confirm('I have opened the exported ZIP ON MY COMPUTER and verified all '+pending.length+' photo(s). Mark this batch as backed up?'))return;
    try{
      const now=Date.now();
      for(const p of pending){const current=await getPhoto(p.id);
        if(current?.blob&&current.backupBatchId===p.backupBatchId){current.backupVerifiedAt=now;await updatePhoto(current);}
      }
      $('backup-checked').checked=false;
      backupMessage('✓ '+pending.length+' photo(s) marked as manually verified on computer. You may now delete ONLY confirmed local photos in step 3.');
      await renderSettings();
    }catch(e){backupMessage('Could not record confirmation: '+e.message,true);}
  }
  async function clearBackedUp(){
    const confirmed=localImages(await listPhotos()).filter(p=>p.backupVerifiedAt);
    if(!confirmed.length)return;
    const bytes=confirmed.reduce((n,p)=>n+p.blob.size,0);
    const response=prompt('Delete '+confirmed.length+' confirmed local photo(s) and free '+(bytes/1024/1024).toFixed(1)+' MB?\nONLY if a verified copy remains on your computer.\nType DELETE to continue:');
    if(response!=='DELETE'){backupMessage('Deletion canceled. Photos preserved.');return;}
    try{
      for(const p of confirmed){const current=await getPhoto(p.id);if(current?.blob&&current.backupVerifiedAt)await deletePhoto(p.id);}
      backupMessage('Deleted '+confirmed.length+' confirmed local photo(s). Other photos were not touched.');
      await renderSettings();await renderHome();
    }catch(e){backupMessage('Cleanup interrupted: '+e.message+'. Check remaining photos.',true);await renderSettings();}
  }
  async function refreshApp(){
    const message=$('update-message'),button=$('refresh-app');
    if(!navigator.onLine){
      message.textContent='Connect to the internet before checking for an updated version. No photos were changed.';
      return;
    }
    button.disabled=true;
    message.textContent='Checking for the latest Work Camera version. Your photos will stay on this device…';
    try{
      if('serviceWorker' in navigator){
        const registration=await navigator.serviceWorker.getRegistration('./');
        if(registration)await registration.update();
      }
      // Same origin and IndexedDB; only a new page request, never delete site data.
      const address=new URL(location.href);
      address.searchParams.set('wc-update',APP_VERSION+'-'+Date.now());
      window.location.replace(address.href);
    }catch(error){
      message.textContent='Update check failed: '+(error?.message||error)+'. No photos were deleted.';
      button.disabled=false;
    }
  }
  async function setView(view){
    if(view==='camera'&&!state.confirmed){view='locations';$('open-camera').focus();}
    currentView=view;document.querySelectorAll('.view').forEach(x=>x.classList.toggle('active',x.id==='view-'+view));document.querySelectorAll('.nav-item').forEach(x=>x.classList.toggle('active',x.dataset.view===view));
    if(view==='camera')updatePath();if(view==='gallery')await renderGallery();else releaseUrls();if(view==='settings')await renderSettings();if(view==='home')await renderHome();
  }
  function init(){
    $('runtime-version').textContent='V'+APP_VERSION;
    $('refresh-app').addEventListener('click',refreshApp);
    validState();renderBuilding();renderFacilities();renderGroup();
    $('building').addEventListener('change',e=>{state.building=e.target.value;state.area=state.building==='3615'?'office':'apartment';state.unit='';markChanged();renderAreas();});
    $('unit').addEventListener('change',e=>{state.unit=e.target.value;markChanged();});
    ['buildings','facilities'].forEach(g=>$('mode-'+g).addEventListener('click',()=>{state.group=g;markChanged();renderGroup();}));
    $('open-camera').addEventListener('click',()=>{state.confirmed=true;persist();void setView('camera');notify('');$('file-camera').click();});
    $('change-location').addEventListener('click',()=>setView('locations'));
    $('camera-view-gallery').addEventListener('click',()=>setView('gallery'));
    $('file-camera').addEventListener('change',async e=>{const file=e.target.files?.[0];e.target.value='';if(file)await saveBlob(file,file.name);});
    $('file-import').addEventListener('change',async e=>{const file=e.target.files?.[0];e.target.value='';if(file)await saveBlob(file,file.name);});
    for(const b of buildingIds)$('gallery-filter').append(option('building:'+b,b==='3615'?'3615 · Leasing Office':'Building '+b));
    for(const f of facilities)$('gallery-filter').append(option('facility:'+f.id,f.label));
    $('gallery-filter').addEventListener('change',renderGallery);
    document.querySelectorAll('.nav-item').forEach(x=>x.addEventListener('click',()=>setView(x.dataset.view)));
    $('close-dialog').addEventListener('click',closeDialog);
    $('photo-dialog').addEventListener('cancel',e=>{e.preventDefault();closeDialog();});
    $('share-photo').addEventListener('click',shareSelected);
    $('export-photo').addEventListener('click',exportSelected);
    $('delete-photo').addEventListener('click',removeSelected);
    $('home-take-photo').addEventListener('click',()=>setView('locations'));
    $('home-my-photos').addEventListener('click',()=>setView('gallery'));
    $('home-backup').addEventListener('click',()=>setView('settings'));
    $('export-backup').addEventListener('click',prepareBackup);
    $('save-backup').addEventListener('click',savePreparedBackup);
    $('backup-checked').addEventListener('change',updateConfirmButton);
    $('confirm-backup').addEventListener('click',confirmBackup);
    $('clear-backed-up').addEventListener('click',clearBackedUp);
    void renderHome();
    if('serviceWorker' in navigator && ['https:','http:'].includes(location.protocol))navigator.serviceWorker.register('./service-worker.js?v='+APP_VERSION,{updateViaCache:'none'}).catch(()=>{});
  }
  if(apartments.length===500&&residential.length===54){init();}else{document.querySelector('.warning').textContent='Catalog failed validation: expected 500 apartments in 54 buildings. Camera disabled for safety.';$('open-camera').disabled=true;$('home-take-photo').disabled=true;}
})();
