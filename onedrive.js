/* Work Camera OneDrive connector — SPA OAuth authorization-code + PKCE.
 * No client secret, refresh token or access token is stored on disk.
 * Supported target: personal Microsoft accounts with Files.ReadWrite.AppFolder.
 * Real Microsoft Entra SPA app registration with exact redirect URL is required.
 */
(function () {
  'use strict';
  const GRAPH = 'https://graph.microsoft.com/v1.0';
  const AUTH = 'https://login.microsoftonline.com/consumers/oauth2/v2.0';
  const SCOPES = 'Files.ReadWrite.AppFolder openid profile';
  const CLIENT_KEY = 'work-camera:onedrive-client-id';
  const FLOW_KEY = 'work-camera:pkce-flow-v2';
  let accessToken = null;
  let expires = 0;
  let busy = false;
  let appRootId = null;
  const folderCache = new Map();
  const short = value => String(value ?? '').trim();
  const idPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const urlEncoded = name => encodeURIComponent(name).replace(/'/g,'%27');
  const rand = size => {const a=new Uint8Array(size);crypto.getRandomValues(a);return a;};
  const base64url = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  const redirectUri = () => location.origin + location.pathname;
  function getClientId(){return localStorage.getItem(CLIENT_KEY)||'';}
  function setClientId(value){
    const v=short(value);
    if(v&&!idPattern.test(v)) throw new Error('Microsoft application ID must be a valid GUID.');
    if(v)localStorage.setItem(CLIENT_KEY,v);else localStorage.removeItem(CLIENT_KEY);
    accessToken=null;expires=0;appRootId=null;folderCache.clear();
  }
  function connected(){return !!accessToken && Date.now()<expires-60000;}
  async function startSignIn(){
    if(!crypto?.subtle)throw new Error('HTTPS is needed for secure Microsoft sign-in.');
    const clientId=getClientId(); if(!clientId)throw new Error('Enter and save the Microsoft Application (client) ID first.');
    const verifier=base64url(rand(32));
    const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier));
    const state=base64url(rand(24));
    sessionStorage.setItem(FLOW_KEY,JSON.stringify({verifier,state,created:Date.now(),redirectUri:redirectUri()}));
    const u=new URL(AUTH+'/authorize');
    for(const [k,v] of Object.entries({client_id:clientId,response_type:'code',redirect_uri:redirectUri(),response_mode:'query',scope:SCOPES,code_challenge:base64url(new Uint8Array(digest)),code_challenge_method:'S256',state,prompt:'select_account'}))u.searchParams.set(k,v);
    location.assign(u.toString());
  }
  async function completeSignIn(){
    const qp=new URLSearchParams(location.search);
    if(!qp.has('code')&&!qp.has('error'))return {handled:false};
    const code=qp.get('code'), state=qp.get('state'), oauthError=qp.get('error_description')||qp.get('error');
    qp.delete('code');qp.delete('state');qp.delete('session_state');qp.delete('error');qp.delete('error_description');
    history.replaceState(null,'',location.pathname+(qp.size?'?'+qp.toString():'')+location.hash);
    const raw=sessionStorage.getItem(FLOW_KEY);
    sessionStorage.removeItem(FLOW_KEY);
    if(oauthError)throw new Error('Microsoft sign-in: '+oauthError);
    if(!raw)throw new Error('Sign-in session expired. Retry Connect OneDrive.');
    let record;try{record=JSON.parse(raw);}catch{throw new Error('Invalid sign-in session.');}
    if(record.state!==state||record.redirectUri!==redirectUri()||Date.now()-record.created>10*60*1000)throw new Error('Microsoft sign-in check failed. Restart connection.');
    if(!code)throw new Error('Microsoft did not return an authorization code.');
    const data=new URLSearchParams({client_id:getClientId(),grant_type:'authorization_code',code,redirect_uri:record.redirectUri,code_verifier:record.verifier,scope:SCOPES});
    const res=await fetch(AUTH+'/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:data.toString(),cache:'no-store'});
    const json=await res.json();
    if(!res.ok||!json.access_token)throw new Error(json.error_description||json.error||'Unable to get OneDrive access token.');
    accessToken=json.access_token;expires=Date.now()+Math.max(0,Number(json.expires_in)||3600)*1000;
    return {handled:true,connected:true};
  }
  function disconnect(){accessToken=null;expires=0;appRootId=null;folderCache.clear();}
  async function graph(path,init={}){
    if(!connected())throw new Error('OneDrive sign-in is required (or session expired). Connect again.');
    const headers={Authorization:'Bearer '+accessToken,...(init.headers||{})};
    const r=await fetch(GRAPH+path,{...init,headers,cache:'no-store'});
    if(!r.ok){let reason='';try{const data=await r.json();reason=data.error?.message||data.error_description||'';}catch{}if(r.status===401)disconnect();throw new Error('OneDrive HTTP '+r.status+(reason?' — '+reason:''));}
    return r.status===204?null:r.json();
  }
  function safeSegment(text){
    const s=short(text);
    if(!s || s==='.'||s==='..'||/[\\/:*?"<>|]/.test(s))throw new Error('Invalid folder or file name.');
    return s;
  }
  function folderParts(loc){
    if(loc.group==='facilities'){
      const map={school:'3613 - Montessori School',pool:'Swimming Pool',tennis:'Tennis Courts'};
      if(!map[loc.facility])throw new Error('Unrecognized facility.');
      return ['Facilities',map[loc.facility]];
    }
    if(loc.group!=='buildings'||!/^\d{4}$/.test(String(loc.building)))throw new Error('Invalid building location.');
    if(loc.building==='3615'){
      if(!['office','boiler'].includes(loc.area))throw new Error('3615 only supports Office Lease or Boiler Room.');
      return [loc.building,loc.area==='office'?'Office Lease':'Boiler Room'];
    }
    const areas={apartment:'Apartments',exterior:'Exterior',hallways:'Hallways',laundry:'Laundry Room',boiler:'Boiler Room'};
    if(!areas[loc.area])throw new Error('Unknown location area.');
    if(loc.area==='apartment'){
      if(!loc.unit || !/^\d+[A-Z]$/.test(String(loc.unit)))throw new Error('Apartment number missing.');
      return [loc.building,'Apartments',`Apt ${loc.unit}`];
    }
    return [loc.building,areas[loc.area]];
  }
  async function appRoot(){
    if(appRootId)return appRootId;
    const folder=await graph('/me/drive/special/approot?$select=id,name,folder');
    if(!folder?.id)throw new Error('OneDrive App Folder was not returned.');
    appRootId=folder.id;return folder.id;
  }
  async function childFolder(parentId,name){
    const key=parentId+'|'+name;
    if(folderCache.has(key))return folderCache.get(key);
    const data=await graph('/me/drive/items/'+encodeURIComponent(parentId)+'/children?$select=id,name,folder&$top=999');
    let target=data.value?.find(x=>x.name===name&&x.folder);
    if(!target){
      try{target=await graph('/me/drive/items/'+encodeURIComponent(parentId)+'/children',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,folder:{},'@microsoft.graph.conflictBehavior':'fail'})});}
      catch(e){if(!String(e.message).includes('409'))throw e;
        const retry=await graph('/me/drive/items/'+encodeURIComponent(parentId)+'/children?$select=id,name,folder&$top=999');
        target=retry.value?.find(x=>x.name===name&&x.folder);
        if(!target)throw e;
      }
    }
    if(!target?.id)throw new Error('Could not create OneDrive folder '+name);
    folderCache.set(key,target.id);return target.id;
  }
  async function ensureDestination(location){
    let parent=await appRoot();
    for(const folder of ['Work Camera Photos',...folderParts(location)])parent=await childFolder(parent,safeSegment(folder));
    return parent;
  }
  async function sendImage(folderId, filename, blob){
    const base='/me/drive/items/'+encodeURIComponent(folderId)+':/'+urlEncoded(filename)+':';
    if(blob.size<=8*1024*1024){
      return graph(base+'/content',{method:'PUT',headers:{'Content-Type':blob.type||'image/jpeg'},body:blob});
    }
    const session=await graph(base+'/createUploadSession',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({item:{'@microsoft.graph.conflictBehavior':'fail',name:filename}})});
    if(!session?.uploadUrl||!session.uploadUrl.startsWith('https://'))throw new Error('OneDrive upload session not available.');
    // 5 MiB is exactly divisible by 320 KiB; last chunk may be smaller.
    const CHUNK=5*1024*1024;
    for(let start=0;start<blob.size;start+=CHUNK){
      const end=Math.min(start+CHUNK,blob.size);
      const r=await fetch(session.uploadUrl,{method:'PUT',headers:{'Content-Range':`bytes ${start}-${end-1}/${blob.size}`},body:blob.slice(start,end)});
      if(!r.ok)throw new Error('OneDrive upload interrupted at byte '+start+' (HTTP '+r.status+'). Retry sync.');
      if(end===blob.size)return r.json();
    }
    throw new Error('Upload session finished without confirmation.');
  }
  async function upload(photo){
    if(busy)throw new Error('OneDrive is busy uploading a previous photo.');
    busy=true;
    try{
      const folderId=await ensureDestination(photo.location);
      const ext=photo.mime==='image/png'?'png':photo.mime==='image/heic'?'heic':photo.mime==='image/webp'?'webp':'jpg';
      const cleanId=String(photo.id).replace(/[^a-zA-Z0-9-]/g,'');
      const date=new Date(photo.createdAt).toISOString().replace(/[.:]/g,'-');
      const filename=safeSegment(`WC_${date}_${cleanId}.${ext}`);
      const item=await sendImage(folderId,filename,photo.blob);
      if(!item?.id)throw new Error('OneDrive did not return a file ID; keep local photo.');
      // Read back cloud metadata: only then mark as uploaded. Not a cryptographic content hash.
      const verify=await graph('/me/drive/items/'+encodeURIComponent(item.id)+'?$select=id,name,size,webUrl');
      if(verify?.id!==item.id||Number(verify.size)!==photo.blob.size||verify.name!==filename)throw new Error('Cloud metadata verification failed; local photo preserved.');
      return {driveItemId:verify.id,webUrl:verify.webUrl||null,name:verify.name,size:verify.size,verifiedAt:Date.now()};
    }finally{busy=false;}
  }
  window.WC_ONEDRIVE={getClientId,setClientId,connected,startSignIn,completeSignIn,disconnect,upload,folderParts};
})();
