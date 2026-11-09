/* Work Camera v3.8 — nested photo folders, multi-selection and populated locations.
 * This module reads the existing IndexedDB photo store; no schema changes or cloud calls.
 */
(function(root){
  'use strict';
  const $=id=>document.getElementById(id);
  const MAX_ARCHIVE_COUNT=80,MAX_ARCHIVE_BYTES=70*1024*1024;
  const MAX_SHARE_COUNT=25,MAX_SHARE_BYTES=50*1024*1024;
  const selection=new Set();
  const thumbnails=[];
  let visibleIds=[],photoMap=new Map(),preparedZip=null,busy=false,api=null;
  let folderTrail=[];
  function notice(message,error=false){
    $('gallery-action-message').textContent=message;
    $('gallery-action-message').classList.toggle('error',error);
    $('gallery-action-toast').textContent=message;
    $('gallery-action-toast').classList.toggle('error',error);
  }
  function release(){
    thumbnails.splice(0).forEach(url=>URL.revokeObjectURL(url));
  }
  function selectedPhotos(){
    return [...photoMap.values()].filter(p=>selection.has(p.id)&&p.blob&&p.blob.size>0);
  }
  function discardZip(){
    preparedZip=null;
    $('gallery-prepared-zip').classList.add('hide');
    $('gallery-zip-info').textContent='';
  }
  function refreshSelection(){
    for(const tile of $('gallery-grid').querySelectorAll('.photo-tile[data-photo-id]')){
      const checked=selection.has(tile.dataset.photoId);
      tile.classList.toggle('selected',checked);
      tile.setAttribute('aria-pressed',String(checked));
      const check=tile.querySelector('.photo-select-indicator');
      if(check)check.textContent=checked?'✓':'';
    }
    const count=selection.size;
    $('gallery-selection-actions').classList.toggle('hide',!count);
    $('view-gallery').classList.toggle('has-selection',count>0);
    $('gallery-selected-count').textContent=count+' selected'+(count===1?'':' photos');
    $('gallery-selection-summary').textContent=count?count+' selected (across folders)':visibleIds.length?'Tap images to select':'Open a folder to select photos';
    $('gallery-select-visible').disabled=busy||visibleIds.length===0||visibleIds.every(id=>selection.has(id));
    $('gallery-clear-selection').disabled=busy||count===0;
    for(const id of ['gallery-share','gallery-download','gallery-delete'])$(id).disabled=busy||count===0;
    $('gallery-copy-details').disabled=busy||count===0;
    $('gallery-save-zip').disabled=busy||!preparedZip;
    $('gallery-discard-zip').disabled=busy;
  }
  function toggle(id){
    if(busy)return;
    const photo=photoMap.get(id);if(!photo?.blob)return;
    selection.has(id)?selection.delete(id):selection.add(id);
    discardZip();notice('');refreshSelection();
  }
  function selectVisible(){
    if(busy)return;
    visibleIds.forEach(id=>selection.add(id));
    discardZip();notice('');refreshSelection();
  }
  function clear(){
    if(busy)return;
    selection.clear();discardZip();notice('');refreshSelection();
  }
  function summarizeLocations(photos,buildingIds,facilities){
    const buildings=new Map(),sites=new Map();
    let total=0;
    const current=new Map();
    const knownBuildings=new Set(buildingIds.map(String));
    const knownFacilities=new Set(facilities.map(f=>String(f.id)));
    for(const p of photos){
      if(!p.blob||!p.blob.size)continue;
      total++;
      const loc=p.location||{};
      if(loc.key)current.set(loc.key,(current.get(loc.key)||0)+1);
      if(loc.group==='buildings'&&knownBuildings.has(String(loc.building))){
        const key=String(loc.building);buildings.set(key,(buildings.get(key)||0)+1);
      }else if(loc.group==='facilities'&&knownFacilities.has(String(loc.facility))){
        const key=String(loc.facility);sites.set(key,(sites.get(key)||0)+1);
      }
    }
    return {total,buildings,sites,current};
  }
  function refreshLocationChoices(photos){
    const select=$('gallery-filter');
    const previous=select.value||'all';
    const showEmpty=$('gallery-show-empty').checked;
    const buildingIds=api.buildingIds||[];
    const facilities=api.facilities||[];
    const summary=summarizeLocations(photos,buildingIds,facilities);
    const createOption=(value,label)=>{
      const option=document.createElement('option');option.value=value;option.textContent=label;return option;
    };
    const items=[
      createOption('all','All locations · '+summary.total+' photo'+(summary.total===1?'':'s')),
      createOption('current','Current location · '+(summary.current.get(api.locationKey())||0)+' photos')
    ];
    const values=new Set(['all','current']);
    const buildingGroup=document.createElement('optgroup');
    buildingGroup.label=showEmpty?'BUILDINGS':'BUILDINGS WITH PHOTOS';
    for(const id of buildingIds){
      const num=summary.buildings.get(String(id))||0;
      if(!num&&!showEmpty)continue;
      const name=id==='3615'?'3615 · Leasing Office':'Building '+id;
      const option=createOption('building:'+id,(num?'📷 ':'')+name+' · '+num+' photo'+(num===1?'':'s'));
      buildingGroup.append(option);
      values.add(option.value);
    }
    if(buildingGroup.children.length)items.push(buildingGroup);
    const facilitiesGroup=document.createElement('optgroup');
    facilitiesGroup.label=showEmpty?'FACILITIES':'FACILITIES WITH PHOTOS';
    for(const facility of facilities){
      const num=summary.sites.get(String(facility.id))||0;
      if(!num&&!showEmpty)continue;
      const option=createOption('facility:'+facility.id,(num?'📷 ':'')+facility.label+' · '+num+' photo'+(num===1?'':'s'));
      facilitiesGroup.append(option);
      values.add(option.value);
    }
    if(facilitiesGroup.children.length)items.push(facilitiesGroup);
    select.replaceChildren(...items);
    // A selected building can become empty when its last local photo is deleted.
    // If hidden, return to All locations instead of silently showing a stale filter.
    select.value=values.has(previous)?previous:'all';
    const buildingCount=summary.buildings.size;
    const facilityCount=summary.sites.size;
    $('gallery-location-summary').textContent=showEmpty
      ? 'All '+buildingIds.length+' building choices available · '+buildingCount+' with photos'+(facilityCount?' · '+facilityCount+' facilities with photos':'')+'.'
      : buildingCount+' building'+(buildingCount===1?'':'s')+' with photos'+(facilityCount?' · '+facilityCount+' facilities with photos':'')+'. Only locations with saved photos are listed.';
  }
  const AREA_NAMES={
    apartment:'Apartments',exterior:'Exterior',hallways:'Hallways',
    laundry:'Laundry Room',boiler:'Boiler Room',office:'Office Lease',other:'Other'
  };
  const AREA_ORDER=['apartment','exterior','hallways','laundry','boiler','office','other'];
  function photoCountText(n){return n+' photo'+(n===1?'':'s');}
  function buildingTitle(id){return id==='3615'?'3615 · Leasing Office':'Building '+id;}
  function collectFolders(images,getGroup,labelFor,orderKeys){
    const groups=new Map();
    for(const p of images){
      const id=String(getGroup(p));
      if(!groups.has(id))groups.set(id,[]);
      groups.get(id).push(p);
    }
    const ordered=[...groups].sort((a,b)=>{
      const ra=orderKeys?orderKeys.indexOf(a[0]):-1;
      const rb=orderKeys?orderKeys.indexOf(b[0]):-1;
      if(ra!==rb&&ra>=0&&rb>=0)return ra-rb;
      if(ra>=0&&rb<0)return -1;
      if(rb>=0&&ra<0)return 1;
      return a[0].localeCompare(b[0],undefined,{numeric:true});
    });
    return ordered.map(([id,items])=>({id,label:labelFor(id,items),count:items.length,photos:items}));
  }
  function folderPlan(records,filter,trail,facilities){
    const images=records.filter(p=>p.blob&&p.blob.size>0);
    let scope=images,rest=trail;
    if(filter==='all'){
      if(!trail.length){
        const roots=collectFolders(scope,p=>{
          const loc=p.location||{};
          if(loc.group==='buildings')return 'building:'+String(loc.building||'unknown');
          if(loc.group==='facilities')return 'facility:'+String(loc.facility||'unknown');
          return 'other';
        },key=>{
          if(key.startsWith('building:'))return buildingTitle(key.slice(9));
          if(key.startsWith('facility:'))return facilities.find(f=>String(f.id)===key.slice(9))?.label||'Facility '+key.slice(9);
          return 'Other photos';
        });
        return {kind:'folders',folders:roots.map(g=>({
          kind:g.id.startsWith('building:')?'building':g.id.startsWith('facility:')?'facility':'other',
          id:g.id.includes(':')?g.id.slice(g.id.indexOf(':')+1):g.id,
          label:g.label,count:g.count
        }))};
      }
      const location=trail[0];
      if(location.kind==='facility')
        return {kind:'photos',photos:scope.filter(p=>p.location?.group==='facilities'&&String(p.location.facility)===location.id)};
      if(location.kind==='other')
        return {kind:'photos',photos:scope.filter(p=>!['buildings','facilities'].includes(p.location?.group))};
      if(location.kind!=='building')return {kind:'photos',photos:[]};
      scope=scope.filter(p=>p.location?.group==='buildings'&&String(p.location.building)===location.id);
      rest=trail.slice(1);
    }else if(filter.startsWith('building:')){
      const id=filter.slice(9);
      scope=scope.filter(p=>p.location?.group==='buildings'&&String(p.location.building)===id);
    }else{
      return {kind:'photos',photos:scope};
    }
    if(!rest.length){
      const folders=collectFolders(scope,p=>AREA_NAMES[p.location?.area]?p.location.area:'other',id=>AREA_NAMES[id]||'Other',AREA_ORDER)
        .map(f=>({kind:'area',id:f.id,label:f.label,count:f.count,
          sublabel:f.id==='apartment'?(new Set(f.photos.map(p=>String(p.location?.unit||'Unknown'))).size)+' apartments':null}));
      return {kind:'folders',folders};
    }
    if(rest[0]?.kind!=='area')return {kind:'photos',photos:[]};
    const area=rest[0].id;
    scope=scope.filter(p=>(AREA_NAMES[p.location?.area]?p.location.area:'other')===area);
    if(area==='apartment'){
      if(rest.length===1){
        const folders=collectFolders(scope,p=>String(p.location?.unit||'Unknown'),id=>'Apt '+id)
          .map(f=>({kind:'unit',id:f.id,label:f.label,count:f.count}));
        return {kind:'folders',folders};
      }
      if(rest[1]?.kind!=='unit')return {kind:'photos',photos:[]};
      scope=scope.filter(p=>String(p.location?.unit||'Unknown')===rest[1].id);
    }
    return {kind:'photos',photos:scope.sort((a,b)=>b.createdAt-a.createdAt)};
  }
  function activeFolderLabel(filter){
    if(filter==='all')return 'All locations';
    if(filter==='current')return 'Current location';
    if(filter.startsWith('building:'))return buildingTitle(filter.slice(9));
    if(filter.startsWith('facility:'))return api.facilities?.find(f=>String(f.id)===filter.slice(9))?.label||'Facility';
    return 'All locations';
  }
  function showFolderBar(filter){
    $('gallery-folder-back').hidden=filter==='all'&&folderTrail.length===0;
    $('gallery-folder-path').textContent=[activeFolderLabel(filter),...folderTrail.map(x=>x.label)].join(' / ');
  }
  function openFolder(folder){
    if(busy)return;
    folderTrail.push({kind:folder.kind,id:folder.id,label:folder.label});
    void render().then(()=>$('gallery-folder-bar').scrollIntoView?.({block:'start',behavior:'smooth'}));
  }
  function goBack(){
    if(busy)return;
    if(folderTrail.length)folderTrail.pop();
    else $('gallery-filter').value='all';
    void render().then(()=>$('gallery-folder-bar').scrollIntoView?.({block:'start',behavior:'smooth'}));
  }
  function changedFilter(){
    folderTrail=[];
    void render();
  }
  function showFolders(folders){
    const grid=$('gallery-grid');
    for(const folder of folders){
      const button=document.createElement('button');
      button.type='button';button.className='gallery-folder';
      button.dataset.folderKind=folder.kind;button.dataset.folderId=folder.id;
      button.setAttribute('aria-label','Open '+folder.label+', '+photoCountText(folder.count));
      const symbol=document.createElement('span');symbol.className='gallery-folder-icon';
      symbol.textContent=folder.kind==='building'?'🏢':folder.kind==='area'?(folder.id==='boiler'?'🔥':folder.id==='hallways'?'🚪':folder.id==='apartment'?'🏠':folder.id==='laundry'?'🧺':'📁'):'📁';
      const details=document.createElement('span');details.className='gallery-folder-info';
      const name=document.createElement('strong');name.textContent=folder.label;
      const count=document.createElement('small');count.textContent=photoCountText(folder.count)+(folder.sublabel?' · '+folder.sublabel:'');
      details.append(name,count);
      const chevron=document.createElement('span');chevron.className='gallery-folder-chevron';
      chevron.textContent='›';chevron.setAttribute('aria-hidden','true');
      button.append(symbol,details,chevron);
      button.addEventListener('click',()=>openFolder(folder));
      grid.append(button);
    }
  }
  async function render(){
    release();$('gallery-grid').replaceChildren();
    try{
      const all=await api.listPhotos();
      photoMap=new Map(all.map(p=>[p.id,p]));
      const previousFilter=$('gallery-filter').value;
      refreshLocationChoices(all);
      const filter=$('gallery-filter').value;
      if(previousFilter!==filter)folderTrail=[];
      for(const id of [...selection]){
        const photo=photoMap.get(id);
        if(!photo?.blob||!photo.blob.size)selection.delete(id);
      }
      let filtered=all;
      if(filter==='current')filtered=all.filter(p=>p.location?.key===api.locationKey());
      else if(filter.startsWith('building:'))filtered=all.filter(p=>p.location?.group==='buildings'&&String(p.location.building)===filter.slice(9));
      else if(filter.startsWith('facility:'))filtered=all.filter(p=>p.location?.group==='facilities'&&String(p.location.facility)===filter.slice(9));
      $('photo-count').textContent=photoCountText(filtered.filter(p=>p.blob&&p.blob.size).length);
      let plan=folderPlan(filtered,filter,folderTrail,api.facilities||[]);
      // If the user deleted the last photo in a nested folder, back out to the nearest populated level.
      while(folderTrail.length&&((plan.kind==='photos'&&plan.photos.length===0)||(plan.kind==='folders'&&plan.folders.length===0))){
        folderTrail.pop();
        plan=folderPlan(filtered,filter,folderTrail,api.facilities||[]);
      }
      showFolderBar(filter);
      visibleIds=[];
      $('gallery-empty').classList.toggle('hide',plan.kind==='folders'?plan.folders.length>0:plan.photos.length>0);
      if(plan.kind==='folders'){
        showFolders(plan.folders);
      }else{
        const photos=plan.photos;
        visibleIds=photos.map(p=>p.id);
        const grid=$('gallery-grid');
        for(const photo of photos){
          const folder=photo.location?.path||'Unknown location';
          const src=URL.createObjectURL(photo.blob);
          thumbnails.push(src);
          const cell=document.createElement('div');cell.className='photo-cell';
          const tile=document.createElement('button');tile.type='button';
          tile.className='photo-tile';tile.dataset.photoId=photo.id;
          tile.setAttribute('aria-pressed',String(selection.has(photo.id)));
          tile.setAttribute('aria-label','Select photo in '+folder+', '+new Date(photo.createdAt).toLocaleString());
          const img=document.createElement('img');img.src=src;img.alt='Work photo';img.loading='lazy';
          const check=document.createElement('span');check.className='photo-select-indicator';
          check.setAttribute('aria-hidden','true');check.textContent=selection.has(photo.id)?'✓':'';
          const caption=document.createElement('div');caption.className='tile-caption';
          const title=document.createElement('strong');title.textContent=folder;
          const date=document.createElement('small');date.textContent=new Date(photo.createdAt).toLocaleString();
          const status=document.createElement('div');status.className='tile-badge'+(photo.backupVerifiedAt?' verified':'');
          status.textContent=photo.backupVerifiedAt?'✓ Computer backup confirmed':photo.backupBatchId?'● Exported · check on computer':'● On this device only';
          caption.append(title,date);tile.append(img,check,caption,status);
          tile.addEventListener('click',()=>toggle(photo.id));
          const preview=document.createElement('button');preview.type='button';
          preview.className='photo-preview-button';preview.textContent='👁';
          preview.setAttribute('aria-label','View full photo');
          preview.title='View photo';
          preview.addEventListener('click',()=>api.showDetails(photo));
          cell.append(tile,preview);grid.append(cell);
        }
      }
      refreshSelection();
    }catch(error){
      $('gallery-empty').classList.remove('hide');
      $('gallery-empty').querySelector('p').textContent='Could not load photos: '+(error?.message||error);
      notice('Could not read local photos.',true);
    }
  }
  function downloadBlob(blob,filename){
    const link=document.createElement('a'),url=URL.createObjectURL(blob);
    link.href=url;link.download=filename;document.body.append(link);link.click();link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),60000);
  }
  function share(){
    if(busy)return;
    const photos=selectedPhotos();if(!photos.length)return;
    const bytes=photos.reduce((sum,p)=>sum+p.blob.size,0);
    if(photos.length>MAX_SHARE_COUNT||bytes>MAX_SHARE_BYTES){
      notice('For direct sharing, select up to 25 photos / 50 MB. Use Download for a ZIP of a larger selection.',true);
      return;
    }
    try{
      // Construct files synchronously in the user gesture: iOS Web Share may lose activation across awaits.
      if(!root.WC_PHOTO_NAMING)throw new Error('Photo naming module unavailable.');
      const files=photos.map(photo=>{
        const name=root.WC_PHOTO_NAMING.photoFileName(photo);
        const mime=photo.blob.type||photo.mime||(/\.heic$/i.test(name)?'image/heic':/\.heif$/i.test(name)?'image/heif':'image/jpeg');
        return new File([photo.blob],name,{type:mime});
      });
      if(typeof navigator.share!=='function'||typeof navigator.canShare!=='function'||!navigator.canShare({files})){
        notice('This device cannot share all selected files directly. Try fewer photos or use Download for a ZIP.',true);
        return;
      }
      // WhatsApp can display the share TITLE as its photo caption, not the actual file name.
      // Provide both a meaningful title and full text; a share target may choose either or ignore them.
      const details=root.WC_PHOTO_NAMING.sharePayload(photos);
      const result=navigator.share({files,title:details.title,text:details.text});
      Promise.resolve(result).then(()=>notice('Sharing flow finished. Your originals remain in Work Camera.'))
        .catch(error=>{if(error?.name!=='AbortError')notice('Could not share: '+(error?.message||error),true);});
    }catch(error){notice('Could not open sharing: '+(error?.message||error),true);}
  }
  async function copyDetails(){
    if(busy)return;
    const photos=selectedPhotos();if(!photos.length)return;
    if(!root.WC_PHOTO_NAMING){notice('Photo naming unavailable.',true);return;}
    const text=root.WC_PHOTO_NAMING.sharePayload(photos).text;
    try{
      if(!navigator.clipboard?.writeText)throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(text);
      notice('Location, date, time and filename copied. Paste into WhatsApp if the app omits the photo caption.');
    }catch(error){
      // Read-only fallback; the user can manually copy the prepared description.
      prompt('Copy these photo details and paste them into WhatsApp:',text);
      notice('Details ready to copy. WhatsApp may not preserve captions supplied by another app.');
    }
  }
  async function prepareDownload(){
    if(busy)return;
    const photos=selectedPhotos();if(!photos.length)return;
    if(photos.length===1){
      if(!root.WC_PHOTO_NAMING){notice('Photo naming module unavailable.',true);return;}
      const name=root.WC_PHOTO_NAMING.photoFileName(photos[0]);
      downloadBlob(photos[0].blob,name);
      notice('Download requested: '+name+'. This does not confirm a computer backup.');return;
    }
    const bytes=photos.reduce((sum,p)=>sum+p.blob.size,0);
    if(photos.length>MAX_ARCHIVE_COUNT||bytes>MAX_ARCHIVE_BYTES){
      notice('Select at most 80 photos / 70 MB for one ZIP. For larger archives, use Weekly Backup in batches.',true);
      return;
    }
    busy=true;discardZip();refreshSelection();
    notice('Preparing ZIP of '+photos.length+' original photos…');
    const ids=photos.map(p=>p.id);
    try{
      if(!root.WC_BACKUP)throw new Error('ZIP export is not available.');
      const blob=await root.WC_BACKUP.makeZip(photos);
      if(ids.length!==selection.size||ids.some(id=>!selection.has(id)))throw new Error('Selection changed. Prepare again.');
      preparedZip={blob,filename:'Work_Camera_Selected_'+new Date().toISOString().slice(0,10)+'.zip'};
      $('gallery-prepared-zip').classList.remove('hide');
      $('gallery-zip-info').textContent=photos.length+' photos · '+(blob.size/1024/1024).toFixed(1)+' MB · ZIP ready';
      notice('ZIP ready. Tap Save ZIP. Your photos remain stored inside Work Camera.');
    }catch(error){notice('Could not prepare ZIP: '+(error?.message||error),true);}
    finally{busy=false;refreshSelection();}
  }
  function saveZip(){
    if(!preparedZip||busy)return;
    downloadBlob(preparedZip.blob,preparedZip.filename);
    notice('ZIP download requested. Verify the exported archive on your computer before deleting photos.');
  }
  async function deleteSelected(){
    if(busy)return;
    const photos=selectedPhotos();if(!photos.length)return;
    const unverified=photos.filter(p=>!p.backupVerifiedAt).length;
    const warning=unverified?'\nWARNING: '+unverified+' photo(s) have no confirmed computer backup and could be your only copies.':'\nThese photos have manually confirmed computer backups.';
    if(!confirm('Permanently delete '+photos.length+' selected photo(s)?'+warning+'\nThis cannot be undone.'))return;
    if(prompt('Type DELETE to permanently erase '+photos.length+' selected photo(s):')!=='DELETE'){
      notice('Deletion canceled. Photos remain unchanged.');return;
    }
    busy=true;refreshSelection();
    try{
      const db=await api.openDb();
      await new Promise((resolve,reject)=>{
        const tx=db.transaction('photos','readwrite'),store=tx.objectStore('photos');
        for(const photo of photos)store.delete(photo.id);
        tx.oncomplete=resolve;
        tx.onerror=()=>reject(tx.error||new Error('Delete transaction failed.'));
        tx.onabort=()=>reject(tx.error||new Error('Delete transaction canceled.'));
      });
      selection.clear();discardZip();
      await render();await api.renderHome();
      notice('Deleted '+photos.length+' selected local photo(s). No other photos were changed.');
    }catch(error){notice('Could not delete selected photos: '+(error?.message||error),true);}
    finally{busy=false;refreshSelection();}
  }
  function init(dependencies){
    api=dependencies;
    $('gallery-show-empty').addEventListener('change',()=>void render());
    $('gallery-folder-back').addEventListener('click',goBack);
    $('gallery-select-visible').addEventListener('click',selectVisible);
    $('gallery-clear-selection').addEventListener('click',clear);
    $('gallery-share').addEventListener('click',share);
    $('gallery-copy-details').addEventListener('click',()=>void copyDetails());
    $('gallery-download').addEventListener('click',()=>void prepareDownload());
    $('gallery-delete').addEventListener('click',()=>void deleteSelected());
    $('gallery-save-zip').addEventListener('click',saveZip);
    $('gallery-discard-zip').addEventListener('click',()=>{
      discardZip();notice('Prepared ZIP canceled. Local photos remain unchanged.');refreshSelection();
    });
    refreshSelection();
  }
  root.WC_GALLERY_BULK={init,render,release,toggle,changedFilter,isSelected:id=>selection.has(id),summarizeLocations,folderPlan};
})(window);
