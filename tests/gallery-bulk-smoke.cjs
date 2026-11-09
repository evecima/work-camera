const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const {File}=require('node:buffer');

class MockElement{
  constructor(tag='div'){
    this.tag=tag;this.children=[];this.dataset={};this.attributes={};this.listeners={};
    this.className='';this.textContent='';this.disabled=false;this.value='';
    const state=new Set();
    this.classList={
      add:c=>state.add(c),remove:c=>state.delete(c),
      contains:c=>state.has(c),toggle:(c,force)=>{const on=force===undefined?!state.has(c):!!force;on?state.add(c):state.delete(c);return on;}
    };
  }
  append(...children){this.children.push(...children);}
  replaceChildren(...children){this.children=children;}
  setAttribute(name,value){this.attributes[name]=value;}
  addEventListener(event,handler){this.listeners[event]=handler;}
  click(){this.listeners.click?.();}
  querySelectorAll(selector){
    const found=[];
    const visit=n=>{
      if(!(n instanceof MockElement))return;
      if(selector==='.photo-tile[data-photo-id]'&&n.className.split(' ').includes('photo-tile')&&n.dataset.photoId)found.push(n);
      n.children.forEach(visit);
    };
    this.children.forEach(visit);return found;
  }
  querySelector(selector){
    let found=null;
    const visit=n=>{
      if(!n||found)return;
      if(selector.startsWith('.')&&n.className?.split(' ').includes(selector.slice(1)))found=n;
      else if(selector==='p'&&n.tag==='p')found=n;
      for(const child of n.children||[])visit(child);
    };
    this.children.forEach(visit);return found;
  }
}
async function main(){
  const elements=new Map();
  const get=id=>{
    if(!elements.has(id))elements.set(id,new MockElement());
    return elements.get(id);
  };
  get('gallery-filter').value='all';
  const photo=(id,key,blob,backupVerifiedAt=null)=>({
    id,createdAt:Date.parse('2026-11-08T19:00:00Z'),filename:id+'.jpg',
    blob,size:blob?.size||0,backupVerifiedAt,
    location:{group:'buildings',building:key==='k1'?'3544':'3615',key,path:key==='k1'?'Building 3544 / Boiler Room':'3615 / Office Lease',area:key==='k1'?'boiler':'office'}
  });
  let photos=[
    photo('one','k1',new Blob(['first'],{type:'image/jpeg'})),
    photo('two','k1',new Blob(['second'],{type:'image/jpeg'})),
    photo('three','k2',new Blob(['third'],{type:'image/jpeg'})),
    photo('legacy','k1',null)
  ];
  const removed=[];let allowDelete=false;let typed='';let shared=null;let copied=null;let zipCount=0;let previewed=null;
  const doc={getElementById:get,createElement:tag=>new MockElement(tag)};
  const sandbox={
    window:{WC_BACKUP:{makeZip:async batch=>{zipCount=batch.length;return new Blob(['fake-zip'],{type:'application/zip'});}}},
    document:doc,Blob,File,Date,Set,Map,URL:{createObjectURL:()=> 'blob:work-camera-test',revokeObjectURL:()=>{}},
    navigator:{share:args=>{shared=args;return Promise.resolve();},canShare:()=>true,clipboard:{writeText:async value=>{copied=value;}}},
    confirm:()=>allowDelete,prompt:()=>typed,setTimeout
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../photo-naming.js'),'utf8'),sandbox);
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../gallery-bulk.js'),'utf8'),sandbox);
  const bulk=sandbox.window.WC_GALLERY_BULK;
  assert.equal(typeof bulk.init,'function');
  bulk.init({
    listPhotos:async()=>photos,
    openDb:async()=>({
      transaction:()=>{
        const tx={oncomplete:null,onerror:null,onabort:null};
        tx.objectStore=()=>({delete(id){
          removed.push(id);photos=photos.filter(p=>p.id!==id);
          setTimeout(()=>tx.oncomplete?.(),0);
        }});
        return tx;
      }
    }),
    showDetails:p=>{previewed=p.id;},
    renderHome:async()=>{},
    locationKey:()=> 'k1',
    buildingIds:['3515','3544','3615'],
    facilities:[{id:'school',label:'3613 - Montessori School'}]
  });
  const choices=()=>get('gallery-filter').children.flatMap(node=>node.tag==='optgroup'?node.children:[node]);
  const labelFor=value=>choices().find(node=>node.value===value)?.textContent||null;
  await bulk.render();
  assert.equal(get('photo-count').textContent,'3 photos','Count only actual photos');
  assert.match(labelFor('all'),/3 photos/,'Counts only photo images, not legacy cloud-only records');
  assert.match(labelFor('current'),/2 photos/,'Counts actual photos at current location');
  assert.match(labelFor('building:3544'),/2 photos/,'Populated building shows count');
  assert.match(labelFor('building:3615'),/1 photo/,'Office location is included');
  assert.equal(labelFor('building:3515'),null,'Empty buildings must be hidden by default');
  assert.equal(labelFor('facility:school'),null,'Empty facilities must be hidden by default');
  assert.match(get('gallery-location-summary').textContent,/2 buildings with photos/);
  get('gallery-show-empty').checked=true;
  await bulk.render();
  assert.match(labelFor('building:3515'),/0 photos/,'Toggle displays empty buildings');
  assert.match(labelFor('facility:school'),/0 photos/,'Toggle displays empty facilities');
  get('gallery-filter').value='building:3515';
  await bulk.render();
  assert.equal(get('gallery-filter').value,'building:3515','Selected empty building stays available when toggle is on');
  get('gallery-show-empty').checked=false;
  await bulk.render();
  assert.equal(labelFor('building:3515'),null,'Switching off removes empty building');
  assert.equal(get('gallery-filter').value,'all','If selected building becomes hidden, fall back to All locations');
  get('gallery-filter').value='all';
  const folders=()=>get('gallery-grid').children.filter(n=>n.className==='gallery-folder');
  const open=async(kind,id)=>{
    const f=folders().find(node=>node.dataset.folderKind===kind&&node.dataset.folderId===id);
    assert(f,'Expected folder '+kind+'/'+id);
    f.click();
    await new Promise(resolve=>setTimeout(resolve,5));
  };
  const back=async()=>{
    get('gallery-folder-back').click();
    await new Promise(resolve=>setTimeout(resolve,5));
  };
  await bulk.render();
  assert.equal(get('gallery-grid').querySelectorAll('.photo-tile[data-photo-id]').length,0,'Root shows folders, not images');
  assert(folders().some(n=>n.dataset.folderId==='3544'),'Root must contain Building 3544');
  assert(folders().some(n=>n.dataset.folderId==='3615'),'Root must contain 3615 Leasing Office');
  assert.equal(get('gallery-select-visible').disabled,true,'No selecting invisible photos from folder level');
  await open('building','3544');
  assert(folders().some(n=>n.dataset.folderId==='boiler'),'Building displays Boiler Room area folder');
  assert.equal(get('gallery-grid').querySelectorAll('.photo-tile[data-photo-id]').length,0,'Area level does not pre-render images');
  await open('area','boiler');
  assert.equal(get('gallery-grid').querySelectorAll('.photo-tile[data-photo-id]').length,2,'Only selected area reveals photos');
  assert.match(get('gallery-folder-path').textContent,/Building 3544 \/ Boiler Room/);
  const selectedTile=get('gallery-grid').querySelectorAll('.photo-tile[data-photo-id]').find(n=>n.dataset.photoId==='one');
  selectedTile.click();
  assert(bulk.isSelected('one'),'Tapping a displayed thumbnail must select it');
  const firstCell=get('gallery-grid').children.find(n=>n.className==='photo-cell');
  firstCell.children.find(n=>n.className==='photo-preview-button').click();
  assert(previewed==='one'||previewed==='two','Eye button previews without changing the selection');
  assert(bulk.isSelected('one'),'Preview should not deselect the photo');
  await back();
  assert(folders().some(n=>n.dataset.folderId==='boiler'),'Back returns to area folders');
  await back();
  assert(folders().some(n=>n.dataset.folderId==='3544'),'Second Back returns to buildings');
  assert(!bulk.isSelected('legacy'),'Cloud-only record is not selected');
  get('gallery-share').click();
  await Promise.resolve();
  assert.equal(shared.files.length,1,'Single-photo share must contain one original');
  assert.deepEqual(Object.keys(shared),['files'],'Sharing must contain only the image file — no text or title messages');
  get('gallery-copy-details').click();
  await new Promise(resolve=>setImmediate(resolve));
  assert.match(copied,/Building 3544 \/ Boiler Room/,'Copy details must include location');
  assert.match(copied,/\d{4}-\d\d-\d\d \d\d:\d\d:\d\d/,'Copy details must include date and time');
  assert.match(shared.files[0].name,/^Building_3544_Boiler_Room_\d{4}-\d\d-\d\d_\d\d-\d\d-\d\d_one\.jpg$/,'Shared file must have descriptive building, area, timestamp and ID');
  get('gallery-clear-selection').click();
  assert(!bulk.isSelected('one'));
  get('gallery-filter').value='current';
  bulk.changedFilter();
  await new Promise(resolve=>setTimeout(resolve,5));
  get('gallery-select-visible').click();
  assert(bulk.isSelected('one')&&bulk.isSelected('two'));
  assert(!bulk.isSelected('three'),'Only visible matching images selected');
  assert(!bulk.isSelected('legacy'),'Legacy record without image must be excluded');
  get('gallery-share').click();
  await Promise.resolve();
  assert.equal(shared.files.length,2,'Bulk share must send both selected image files');
  assert.deepEqual(Object.keys(shared),['files'],'Multi-share must not generate an additional text message');
  assert.equal(new Set(shared.files.map(file=>file.name)).size,2,'Multiple shared images must have distinct names');
  get('gallery-download').click();
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(zipCount,2,'Two selected photos are included in ZIP');
  assert(!get('gallery-prepared-zip').classList.contains('hide'),'Prepared ZIP save control shown');
  get('gallery-delete').click();
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(removed.length,0,'Canceled delete must not remove photos');
  allowDelete=true;typed='NO';
  get('gallery-delete').click();
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(removed.length,0,'Deletion must require typed DELETE');
  typed='DELETE';
  get('gallery-delete').click();
  await new Promise(resolve=>setTimeout(resolve,30));
  assert.deepEqual(removed.sort(),['one','two'],'Batch deletion only removes selected photos');
  assert(photos.some(p=>p.id==='three'),'Unselected photo must remain');
  assert(photos.some(p=>p.id==='legacy'),'Legacy entry must remain');
  assert.equal(get('gallery-selected-count').textContent,'0 selected photos');
  assert.equal(labelFor('building:3544'),null,'Removing the last photo hides its building automatically');
  assert.match(labelFor('building:3615'),/1 photo/,'Unchanged building count remains');
  const school=new Blob(['school'],{type:'image/jpeg'});
  const counters=bulk.summarizeLocations([
    {blob:school,location:{group:'facilities',facility:'school',key:'facility:school'}},
    {blob:school,location:{group:'buildings',building:'3544',key:'b:3544'}},
    {blob:null,location:{group:'buildings',building:'3515',key:'b:3515'}}
  ],['3515','3544','3615'],[{id:'school'}]);
  assert.equal(counters.total,2,'Only actual local images count');
  assert.equal(counters.sites.get('school'),1,'Facility photo count is supported');
  assert.equal(counters.buildings.get('3544'),1);
  assert.equal(counters.buildings.has('3515'),false);
  // Verify the full Building -> Apartments -> Apt number -> Photos hierarchy with synthetic metadata.
  const image=new Blob(['image'],{type:'image/jpeg'});
  const fake=[
    {id:'apt1',blob:image,createdAt:10,location:{group:'buildings',building:'3525',area:'apartment',unit:'22C'}},
    {id:'apt2',blob:image,createdAt:9,location:{group:'buildings',building:'3525',area:'apartment',unit:'22C'}},
    {id:'apt3',blob:image,createdAt:8,location:{group:'buildings',building:'3525',area:'apartment',unit:'23A'}},
    {id:'hall1',blob:image,createdAt:7,location:{group:'buildings',building:'3525',area:'hallways'}},
    {id:'boiler1',blob:image,createdAt:6,location:{group:'buildings',building:'3544',area:'boiler'}},
    {id:'school1',blob:image,createdAt:5,location:{group:'facilities',facility:'school'}}
  ];
  const root=bulk.folderPlan(fake,'all',[],[{id:'school',label:'Montessori School'}]);
  assert.deepEqual(Array.from(root.folders,f=>f.kind+':'+f.id),['building:3525','building:3544','facility:school']);
  const areas=bulk.folderPlan(fake,'building:3525',[],[]);
  assert.deepEqual(Array.from(areas.folders,f=>f.id),['apartment','hallways']);
  assert.equal(areas.folders[0].count,3);
  assert.match(areas.folders[0].sublabel,/2 apartments/);
  const apartments=bulk.folderPlan(fake,'building:3525',[{kind:'area',id:'apartment'}],[]);
  assert.deepEqual(Array.from(apartments.folders,f=>f.id),['22C','23A']);
  assert.deepEqual(Array.from(apartments.folders,f=>f.count),[2,1]);
  const apt22C=bulk.folderPlan(fake,'building:3525',[{kind:'area',id:'apartment'},{kind:'unit',id:'22C'}],[]);
  assert.equal(apt22C.kind,'photos');
  assert.deepEqual(Array.from(apt22C.photos,p=>p.id),['apt1','apt2']);
  const hall=bulk.folderPlan(fake,'building:3525',[{kind:'area',id:'hallways'}],[]);
  assert.deepEqual(Array.from(hall.photos,p=>p.id),['hall1']);
  const facility=bulk.folderPlan(fake,'all',[{kind:'facility',id:'school'}],[{id:'school',label:'Montessori School'}]);
  assert.deepEqual(Array.from(facility.photos,p=>p.id),['school1']);
  const legacy=bulk.folderPlan([...fake,{id:'no-blob',blob:null,location:{group:'buildings',building:'3525',area:'apartment',unit:'22C'}}],'building:3525',[{kind:'area',id:'apartment'},{kind:'unit',id:'22C'}],[]);
  assert.equal(legacy.photos.length,2,'Metadata-only records should not inflate photo counts');
  console.log('PASS: Nested folders, back navigation, leaf-only photo selection, counts, bulk share, ZIP and delete');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
