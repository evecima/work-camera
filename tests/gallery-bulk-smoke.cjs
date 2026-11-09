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
  const removed=[];let allowDelete=false;let typed='';let shared=null;let zipCount=0;let previewed=null;
  const doc={getElementById:get,createElement:tag=>new MockElement(tag)};
  const sandbox={
    window:{WC_BACKUP:{makeZip:async batch=>{zipCount=batch.length;return new Blob(['fake-zip'],{type:'application/zip'});}}},
    document:doc,Blob,File,Date,Set,Map,URL:{createObjectURL:()=> 'blob:work-camera-test',revokeObjectURL:()=>{}},
    navigator:{share:args=>{shared=args;return Promise.resolve();},canShare:()=>true},
    confirm:()=>allowDelete,prompt:()=>typed,setTimeout
  };
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
    locationKey:()=> 'k1'
  });
  await bulk.render();
  assert.equal(get('photo-count').textContent,'4 photos');
  assert(!bulk.isSelected('legacy'),'Cloud-only record is not selected');
  bulk.toggle('one');
  assert(bulk.isSelected('one'),'First thumbnail should be selectable');
  get('gallery-share').click();
  await Promise.resolve();
  assert.equal(shared.files.length,1,'Single-photo share must contain one original');
  get('gallery-clear-selection').click();
  assert(!bulk.isSelected('one'));
  get('gallery-filter').value='current';
  await bulk.render();
  get('gallery-select-visible').click();
  assert(bulk.isSelected('one')&&bulk.isSelected('two'));
  assert(!bulk.isSelected('three'),'Only visible matching images selected');
  assert(!bulk.isSelected('legacy'),'Legacy record without image must be excluded');
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
  await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(removed.sort(),['one','two'],'Batch deletion only removes selected photos');
  assert(photos.some(p=>p.id==='three'),'Unselected photo must remain');
  assert(photos.some(p=>p.id==='legacy'),'Legacy entry must remain');
  assert.equal(get('gallery-selected-count').textContent,'0 selected photos');
  console.log('PASS: Gallery selects visible images, shares only selected files, creates ZIP and protects deletion');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
