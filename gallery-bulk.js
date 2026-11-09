/* Work Camera v3.5 — gallery multi-selection and offline bulk actions.
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
  function notice(message,error=false){
    $('gallery-action-message').textContent=message;
    $('gallery-action-message').classList.toggle('error',error);
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
    $('gallery-selection-summary').textContent=count?count+' selected (across filters)':'Tap images to select';
    $('gallery-select-visible').disabled=busy||visibleIds.length===0||visibleIds.every(id=>selection.has(id));
    $('gallery-clear-selection').disabled=busy||count===0;
    for(const id of ['gallery-share','gallery-download','gallery-delete'])$(id).disabled=busy||count===0;
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
  async function render(){
    release();$('gallery-grid').replaceChildren();
    try{
      const all=await api.listPhotos();
      photoMap=new Map(all.map(p=>[p.id,p]));
      for(const id of [...selection]){
        const photo=photoMap.get(id);
        if(!photo?.blob||!photo.blob.size)selection.delete(id);
      }
      const filter=$('gallery-filter').value;
      let photos=all;
      if(filter==='current')photos=photos.filter(p=>p.location.key===api.locationKey());
      else if(filter.startsWith('building:'))photos=photos.filter(p=>p.location.group==='buildings'&&p.location.building===filter.slice(9));
      else if(filter.startsWith('facility:'))photos=photos.filter(p=>p.location.group==='facilities'&&p.location.facility===filter.slice(9));
      photos.sort((a,b)=>(a.location.path||'').localeCompare(b.location.path||'')||b.createdAt-a.createdAt);
      visibleIds=photos.filter(p=>p.blob&&p.blob.size>0).map(p=>p.id);
      $('photo-count').textContent=photos.length+' photo'+(photos.length===1?'':'s');
      $('gallery-empty').classList.toggle('hide',photos.length!==0);
      let lastGroup='';
      for(const photo of photos){
        const folder=photo.location.path||'Unknown location';
        if(folder!==lastGroup){
          const heading=document.createElement('h3');
          heading.className='gallery-group-title';heading.textContent='📁 '+folder;
          $('gallery-grid').append(heading);lastGroup=folder;
        }
        const src=photo.blob?URL.createObjectURL(photo.blob):null;
        if(src)thumbnails.push(src);
        const cell=document.createElement('div');cell.className='photo-cell';
        const tile=document.createElement('button');tile.type='button';
        tile.className='photo-tile';tile.dataset.photoId=photo.id;
        tile.disabled=!photo.blob;
        tile.setAttribute('aria-pressed',String(selection.has(photo.id)));
        tile.setAttribute('aria-label','Select photo in '+folder+', '+new Date(photo.createdAt).toLocaleString());
        const img=document.createElement(photo.blob?'img':'div');
        if(src){img.src=src;img.alt='Work photo';img.loading='lazy';}
        else{img.className='cloud-thumbnail';img.textContent='Legacy cloud-only record';}
        const check=document.createElement('span');check.className='photo-select-indicator';
        check.setAttribute('aria-hidden','true');check.textContent=selection.has(photo.id)?'✓':'';
        const caption=document.createElement('div');caption.className='tile-caption';
        const title=document.createElement('strong');title.textContent=folder;
        const date=document.createElement('small');date.textContent=new Date(photo.createdAt).toLocaleString();
        const status=document.createElement('div');status.className='tile-badge'+(photo.backupVerifiedAt?' verified':'');
        status.textContent=!photo.blob?'No local image (legacy record)':photo.backupVerifiedAt?'✓ Computer backup confirmed':photo.backupBatchId?'● Exported · check on computer':'● On this device only';
        caption.append(title,date);tile.append(img,check,caption,status);
        tile.addEventListener('click',()=>toggle(photo.id));
        const preview=document.createElement('button');
        preview.type='button';preview.className='photo-preview-button';
        preview.textContent='👁';preview.setAttribute('aria-label','View full photo');
        preview.title='View photo';preview.addEventListener('click',()=>api.showDetails(photo));
        cell.append(tile,preview);$('gallery-grid').append(cell);
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
      const files=photos.map((photo,i)=>{
        const name=(photo.filename||'work-photo.jpg').replace(/[^a-zA-Z0-9._-]/g,'_');
        const mime=photo.blob.type||photo.mime||(/\.heic$/i.test(name)?'image/heic':/\.heif$/i.test(name)?'image/heif':'image/jpeg');
        return new File([photo.blob],'WC_'+(i+1)+'_'+name,{type:mime});
      });
      if(typeof navigator.share!=='function'||typeof navigator.canShare!=='function'||!navigator.canShare({files})){
        notice('This device cannot share all selected files directly. Try fewer photos or use Download for a ZIP.',true);
        return;
      }
      const result=navigator.share({files,title:photos.length===1?'Work Camera photo':'Work Camera photos'});
      Promise.resolve(result).then(()=>notice('Sharing flow finished. Your originals remain in Work Camera.'))
        .catch(error=>{if(error?.name!=='AbortError')notice('Could not share: '+(error?.message||error),true);});
    }catch(error){notice('Could not open sharing: '+(error?.message||error),true);}
  }
  async function prepareDownload(){
    if(busy)return;
    const photos=selectedPhotos();if(!photos.length)return;
    if(photos.length===1){
      downloadBlob(photos[0].blob,photos[0].filename||'work-photo.jpg');
      notice('Download requested. This does not confirm a computer backup.');return;
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
    $('gallery-select-visible').addEventListener('click',selectVisible);
    $('gallery-clear-selection').addEventListener('click',clear);
    $('gallery-share').addEventListener('click',share);
    $('gallery-download').addEventListener('click',()=>void prepareDownload());
    $('gallery-delete').addEventListener('click',()=>void deleteSelected());
    $('gallery-save-zip').addEventListener('click',saveZip);
    $('gallery-discard-zip').addEventListener('click',()=>{
      discardZip();notice('Prepared ZIP canceled. Local photos remain unchanged.');refreshSelection();
    });
    refreshSelection();
  }
  root.WC_GALLERY_BULK={init,render,release,toggle,isSelected:id=>selection.has(id)};
})(window);
