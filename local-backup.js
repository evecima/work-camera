/* Work Camera local-only ZIP export. No network requests or third-party libraries. */
(function(root){
  'use strict';
  const encoder = new TextEncoder();
  const table = new Uint32Array(256);
  for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?(0xEDB88320^(c>>>1)):(c>>>1);table[n]=c>>>0;}
  function crc32(bytes){
    let crc=0xFFFFFFFF;
    for(let i=0;i<bytes.length;i++)crc=table[(crc^bytes[i])&255]^(crc>>>8);
    return (crc^0xFFFFFFFF)>>>0;
  }
  function safe(value){
    return String(value||'Unknown').replace(/[\\/:*?"<>|\u0000-\u001f]/g,'_').replace(/^\.+$/,'_').trim().slice(0,72)||'Unknown';
  }
  function archivePath(photo){
    const loc=photo.location||{};
    const folder=loc.group==='facilities'
      ? 'Facilities/'+safe(loc.path||loc.facility)
      : safe(loc.building||'Unknown building')+'/'+safe(loc.area==='office'?'Office Lease':loc.area==='boiler'?'Boiler Room':loc.area==='apartment'?'Apartment':loc.area==='hallways'?'Hallways':loc.area==='laundry'?'Laundry Room':'Exterior')
        +(loc.area==='apartment'?'/'+safe('Apartment '+(loc.unit||'Unknown')):'');
    if(!root.WC_PHOTO_NAMING)throw new Error('Photo naming module is unavailable.');
    return folder+'/'+root.WC_PHOTO_NAMING.photoFileName(photo);
  }
  function dosDateTime(value){
    const d=new Date(value||Date.now());
    const year=Math.max(1980,Math.min(2107,d.getFullYear()));
    const date=(year-1980)<<9|(d.getMonth()+1)<<5|d.getDate();
    const time=d.getHours()<<11|d.getMinutes()<<5|(d.getSeconds()>>1);
    return {date,time};
  }
  async function makeZip(photos){
    if(!Array.isArray(photos)||!photos.length)throw new Error('No photos to export.');
    const entries=photos.map(p=>({path:archivePath(p),blob:p.blob,time:p.createdAt}));
    const manifest={
      format:'Work Camera local photo archive v1',
      exportedAt:new Date().toISOString(),
      photos:photos.map((p,i)=>({id:p.id,path:entries[i].path,exportedFilename:root.WC_PHOTO_NAMING.photoFileName(p),originalFilename:p.filename||null,takenAt:new Date(p.createdAt).toISOString(),recordedAtUtc:new Date(p.createdAt).toISOString(),recordedTimezoneOffsetMinutes:Number.isInteger(p.createdTimezoneOffsetMinutes)?p.createdTimezoneOffsetMinutes:null,location:p.location.path,bytes:p.blob.size}))
    };
    entries.push({path:'manifest.json',blob:new Blob([JSON.stringify(manifest,null,2)],{type:'application/json'}),time:Date.now()});
    if(entries.length>65535)throw new Error('Too many files for one ZIP archive.');
    const body=[]; const directory=[]; let offset=0;let dirSize=0;
    for(const entry of entries){
      if(!(entry.blob instanceof Blob)||entry.blob.size>0xFFFFFFFF)throw new Error('Invalid or oversized photo.');
      const name=encoder.encode(entry.path);
      if(name.length>65535)throw new Error('Archive path is too long.');
      const bytes=new Uint8Array(await entry.blob.arrayBuffer());
      const crc=crc32(bytes);
      const n=bytes.length;
      const t=dosDateTime(entry.time);
      const local=new Uint8Array(30+name.length);
      const h=new DataView(local.buffer);
      h.setUint32(0,0x04034b50,true);h.setUint16(4,20,true);h.setUint16(6,0x0800,true);h.setUint16(8,0,true);
      h.setUint16(10,t.time,true);h.setUint16(12,t.date,true);h.setUint32(14,crc,true);
      h.setUint32(18,n,true);h.setUint32(22,n,true);h.setUint16(26,name.length,true);h.setUint16(28,0,true);
      local.set(name,30);body.push(local,entry.blob);
      const central=new Uint8Array(46+name.length);
      const c=new DataView(central.buffer);
      c.setUint32(0,0x02014b50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);
      c.setUint16(8,0x0800,true);c.setUint16(10,0,true);c.setUint16(12,t.time,true);c.setUint16(14,t.date,true);
      c.setUint32(16,crc,true);c.setUint32(20,n,true);c.setUint32(24,n,true);
      c.setUint16(28,name.length,true);c.setUint16(30,0,true);c.setUint16(32,0,true);c.setUint16(34,0,true);
      c.setUint16(36,0,true);c.setUint32(38,0,true);c.setUint32(42,offset,true);
      central.set(name,46);directory.push(central);dirSize+=central.length;
      offset+=local.length+n;
      if(offset>0xFFFFFFFF)throw new Error('ZIP is too large. Use smaller batches.');
    }
    const end=new Uint8Array(22);const e=new DataView(end.buffer);
    e.setUint32(0,0x06054b50,true);
    e.setUint16(8,entries.length,true);e.setUint16(10,entries.length,true);
    e.setUint32(12,dirSize,true);e.setUint32(16,offset,true);
    return new Blob([...body,...directory,end],{type:'application/zip'});
  }
  root.WC_BACKUP={makeZip,archivePath,crc32};
})(window);
