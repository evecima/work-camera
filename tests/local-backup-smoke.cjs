const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const context={window:{},Blob,TextEncoder,Date,Uint8Array,Uint32Array,DataView};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../local-backup.js'),'utf8'),context);
const backup=context.window.WC_BACKUP;
assert(backup&&typeof backup.makeZip==='function');
assert.equal(backup.crc32(new TextEncoder().encode('123456789')),0xCBF43926,'CRC32 must match standard test vector');
async function test(){
  const photos=[
    {id:'photo1',createdAt:Date.parse('2026-11-06T20:00:00Z'),filename:'boiler.jpg',blob:new Blob(['boiler image'],{type:'image/jpeg'}),location:{group:'buildings',building:'3615',area:'boiler',path:'3615 / Boiler Room'}},
    {id:'photo2',createdAt:Date.parse('2026-11-06T20:01:00Z'),filename:'kitchen.jpg',blob:new Blob(['kitchen image'],{type:'image/jpeg'}),location:{group:'buildings',building:'3520',area:'apartment',unit:'101',path:'Building 3520 / Apartment / Apt 101'}},
    {id:'photo3',createdAt:Date.parse('2026-11-06T20:02:00Z'),filename:'school.jpg',blob:new Blob(['school image'],{type:'image/jpeg'}),location:{group:'facilities',facility:'school',path:'3613 - Montessori School'}}
  ];
  const archive=await backup.makeZip(photos);
  const zip=Buffer.from(await archive.arrayBuffer());
  const entries=[];
  let pointer=0;
  while(zip.readUInt32LE(pointer)===0x04034B50){
    assert.equal(zip.readUInt16LE(pointer+8),0,'Store ZIP entries without compression');
    const crc=zip.readUInt32LE(pointer+14);
    const size=zip.readUInt32LE(pointer+18);
    const nameLen=zip.readUInt16LE(pointer+26);
    const extraLen=zip.readUInt16LE(pointer+28);
    const name=zip.subarray(pointer+30,pointer+30+nameLen).toString('utf8');
    const data=zip.subarray(pointer+30+nameLen+extraLen,pointer+30+nameLen+extraLen+size);
    assert.equal(backup.crc32(data),crc,'ZIP entry checksum mismatch');
    entries.push({name,data:data.toString('utf8')});
    pointer+=30+nameLen+extraLen+size;
  }
  assert.equal(entries.length,4,'3 images plus manifest');
  assert(entries.some(x=>x.name.includes('3615/Boiler Room/')&&x.data==='boiler image'));
  assert(entries.some(x=>x.name.includes('3520/Apartment/Apartment 101/')&&x.data==='kitchen image'));
  assert(entries.some(x=>x.name.includes('Facilities/3613 - Montessori School/')&&x.data==='school image'));
  const manifest=JSON.parse(entries.find(x=>x.name==='manifest.json').data);
  assert.equal(manifest.photos.length,3);
  assert.equal(zip.readUInt32LE(zip.length-22),0x06054B50,'Expected end-of-central-directory marker');
  assert.equal(zip.readUInt16LE(zip.length-12),4,'Expected four central directory entries');
  const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
  assert(html.includes('id="view-home"')&&html.includes('id="home-take-photo"')&&html.includes('id="home-my-photos"'));
  assert(html.includes('id="confirm-backup"')&&html.includes('id="clear-backed-up"'));
  assert(!html.includes('src="onedrive.js"'),'No cloud connector should run');
  assert(html.includes('id="file-camera"')&&html.includes('capture="environment"'),'System camera capture required');
  assert(html.includes('id="file-import"'),'Manual import path is required for advanced Apple Camera shots');
  assert(html.includes('id="share-photo"')&&html.includes('id="delete-photo"'),'Photo details require Share and Delete');
  assert(!html.includes('id="camera-video"'),'Remove custom getUserMedia camera viewfinder');
  const app=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8');
  assert(app.includes("navigator.share({files:[file]"),'Share button must invoke native file share');
  assert(app.includes("$('file-camera').click()"),'Location confirmation should launch system capture immediately');
  assert(!app.includes('getUserMedia'),'No automatic custom camera stream');
  const captureSave = app.slice(app.indexOf('async function saveBlob('),app.indexOf('function releaseUrls('));
  assert(captureSave.includes('await addPhoto(blob,filename)'),'Accepted capture must be saved');
  assert(!captureSave.includes('showDetails('),'Saving a capture must not automatically open Photo Details');
  assert(app.includes("tile.addEventListener('click',()=>showDetails(p))"),'Tapping a gallery photo should still open Photo Details');
  assert(html.includes('open My Photos and tap its thumbnail'),'User instructions must match the new interaction');
  assert(html.includes('id="runtime-version"')&&html.includes('id="refresh-app"'),'In-app version and update control must be visible');
  for(const script of ['app.js','local-backup.js','data/apartments.js'])
    assert(html.includes(script+'?v=3.3.0'),'Versioned JS needed: '+script);
  assert(html.includes('styles.css?v=3.3.0'),'Versioned CSS required');
  assert(app.includes("const APP_VERSION='3.3.0'"),'Runtime build must identify the executable JS version');
  assert(app.includes("window.location.replace(address.href)"),'Refresh should navigate without changing storage');
  assert(!app.includes('indexedDB.deleteDatabase('),'Updating must never delete the photo database');
  const worker=fs.readFileSync(path.join(__dirname,'../service-worker.js'),'utf8');
  assert(worker.includes("work-camera-shell-v3.3.0"),'New SW version required');
  assert(worker.includes("fetch(event.request,{cache:'no-store'})"),'Online fetch must bypass HTTP cache');
  assert(worker.includes("cache.match('./index.html')"),'Offline fallback must remain available');
  assert(!worker.includes('indexedDB'),'SW must not modify photos');
  console.log('PASS: ZIP, catalog, native capture, photo details on tap and safe PWA update path');
}
test().catch(e=>{console.error(e);process.exitCode=1;});
