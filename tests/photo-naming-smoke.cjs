const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const ctx={window:{},Date};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../photo-naming.js'),'utf8'),ctx);
const naming=ctx.window.WC_PHOTO_NAMING;
assert(naming&&typeof naming.photoFileName==='function');
const timestamp=Date.parse('2026-11-09T00:10:23Z'); // 19:10:23 on Nov 8 at UTC-05:00
function photo(id,location,filename='IMG_001.JPG',type='image/jpeg',offset=300){
 return {id,createdAt:timestamp,createdTimezoneOffsetMinutes:offset,filename,
   blob:{type,size:4},location};
}
const boiler=photo('abc123def456',{group:'buildings',building:'3544',area:'boiler',path:'Building 3544 / Boiler Room'});
assert.equal(naming.photoFileName(boiler),'Building_3544_Boiler_Room_2026-11-08_19-10-23_abc123def456.jpg');
const apartment=photo('xyz456',{group:'buildings',building:'3525',area:'apartment',unit:'22C'},'IMG_003.heic','image/heic');
assert.equal(naming.photoFileName(apartment),'Building_3525_Apt_22C_2026-11-08_19-10-23_xyz456.heic');
assert.equal(naming.photoFileName(photo('hall1',{group:'buildings',building:'3525',area:'hallways'},'photo.png','image/png')),'Building_3525_Hallways_2026-11-08_19-10-23_hall1.png');
assert.equal(naming.photoFileName(photo('laundry1',{group:'buildings',building:'3525',area:'laundry'})),'Building_3525_Laundry_Room_2026-11-08_19-10-23_laundry1.jpg');
assert.equal(naming.photoFileName(photo('outside1',{group:'buildings',building:'3525',area:'exterior'})),'Building_3525_Exterior_2026-11-08_19-10-23_outside1.jpg');
assert.equal(naming.photoFileName(photo('office1',{group:'buildings',building:'3615',area:'office'})),'Building_3615_Office_Lease_2026-11-08_19-10-23_office1.jpg');
assert.equal(naming.photoFileName(photo('school1',{group:'facilities',facility:'school',path:'3613 - Montessori School'})),'Facility_3613_Montessori_School_2026-11-08_19-10-23_school1.jpg');
assert.equal(naming.photoFileName(photo('pool1',{group:'facilities',facility:'pool',path:'Swimming Pool'},'pool.webp','image/webp')),'Facility_Swimming_Pool_2026-11-08_19-10-23_pool1.webp');
assert.equal(naming.photoFileName(photo('tennis1',{group:'facilities',facility:'tennis',path:'Tennis Courts'})),'Facility_Tennis_Courts_2026-11-08_19-10-23_tennis1.jpg');
assert.equal(naming.localTimestamp(boiler),'2026-11-08_19-10-23');
assert.equal(naming.localTimestamp({...boiler,createdTimezoneOffsetMinutes:-120}),'2026-11-09_02-10-23');
assert.equal(naming.localTimestamp({createdAt:null}),'Date_Unknown_Time_Unknown');
assert.equal(naming.fileExtension(photo('tiff1',{group:'buildings',building:'3544',area:'boiler'},'img.tif','image/tiff')),'.tiff');
assert.equal(naming.fileExtension(photo('other',{group:'buildings',building:'3544',area:'boiler'},'img.avif','')),'.avif');
const another={...boiler,id:'ef789abc555'};
assert.notEqual(naming.photoFileName(boiler),naming.photoFileName(another),'Two shots in the same second must not have the same name');
assert(!/[\\/:*?"<>|]/.test(naming.photoFileName(apartment)),'Export names must be safe for Windows/macOS/iOS');
assert.equal(boiler.filename,'IMG_001.JPG','Naming never mutates the original filename');
assert.equal(boiler.location.path,'Building 3544 / Boiler Room','Naming never changes location metadata');
console.log('PASS: Descriptive exported names for apartments, boiler, hallways, facilities, date, local time, file type and unique ID');
