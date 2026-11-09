/* Work Camera — consistent, readable export/share filenames.
 * Renaming applies only to exported File objects and ZIP entries; IndexedDB originals stay unchanged.
 */
(function(root){
  'use strict';
  const AREAS={
    apartment:'Apartment',exterior:'Exterior',hallways:'Hallways',
    laundry:'Laundry_Room',boiler:'Boiler_Room',office:'Office_Lease'
  };
  const MIME_EXT={
    'image/jpeg':'.jpg','image/jpg':'.jpg','image/png':'.png',
    'image/heic':'.heic','image/heif':'.heif',
    'image/webp':'.webp','image/avif':'.avif',
    'image/gif':'.gif','image/tiff':'.tiff','image/bmp':'.bmp'
  };
  function label(value){
    return String(value??'Unknown').normalize('NFKD')
      .replace(/[\u0300-\u036f]/g,'')
      .replace(/[^A-Za-z0-9]+/g,'_').replace(/^_+|_+$/g,'').slice(0,75)||'Unknown';
  }
  function fileExtension(photo){
    const mime=String(photo?.blob?.type||photo?.mime||'').toLowerCase();
    if(MIME_EXT[mime])return MIME_EXT[mime];
    const suffix=String(photo?.filename||'').match(/\.([A-Za-z0-9]{2,5})$/);
    return suffix?'.'+suffix[1].toLowerCase():'.jpg';
  }
  function localTimestamp(photo){
    const milliseconds=Number(photo?.createdAt);
    if(!Number.isFinite(milliseconds)||milliseconds<=0)return 'Date_Unknown_Time_Unknown';
    const offset=photo?.createdTimezoneOffsetMinutes;
    const anchored=Number.isInteger(offset)&&Math.abs(offset)<=14*60;
    const d=new Date(milliseconds-(anchored?offset*60000:0));
    const get=(method)=>d[(anchored?'getUTC':'get')+method]();
    if(!Number.isFinite(d.getTime()))return 'Date_Unknown_Time_Unknown';
    const pad=n=>String(n).padStart(2,'0');
    return String(get('FullYear')).padStart(4,'0')+'-'+pad(get('Month')+1)+'-'+pad(get('Date'))+
      '_'+pad(get('Hours'))+'-'+pad(get('Minutes'))+'-'+pad(get('Seconds'));
  }
  function photoFileName(photo){
    const loc=photo?.location||{};
    let prefix;
    if(loc.group==='facilities'){
      prefix='Facility_'+label(loc.path||loc.facility);
    }else{
      const b='Building_'+label(loc.building);
      const area=loc.area==='apartment'
        ?'Apt_'+label(loc.unit)
        :(AREAS[loc.area]||'Area_'+label(loc.area));
      prefix=b+'_'+area;
    }
    // The stable ID avoids collisions for photos taken in the same second.
    const suffix=label(photo?.id||'NoID').slice(0,18);
    return prefix+'_'+localTimestamp(photo)+'_'+suffix+fileExtension(photo);
  }
  root.WC_PHOTO_NAMING={photoFileName,localTimestamp,fileExtension};
})(window);
