const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {webcrypto}=require('node:crypto');
const {TextEncoder}=require('node:util');
class Store{constructor(){this.m=new Map();}getItem(k){return this.m.get(k)||null;}setItem(k,v){this.m.set(k,String(v));}removeItem(k){this.m.delete(k);}}
const localStorage=new Store(),sessionStorage=new Store();
const location={origin:'https://photos.example.test',pathname:'/work-camera/index.html',search:'',hash:'',assign(url){this.lastRedirect=url;}};
const history={replaceState(_,__,href){location.search='';location.lastReplaced=href;}};
const folderTree=new Map();folderTree.set('ROOT',[]);
let photoMeta=null;let requests=[];
function response(value,status=200){return {ok:status>=200&&status<300,status,json:async()=>value};}
async function fetchMock(url,options={}){
 requests.push({url:String(url),method:options.method||'GET'});
 if(String(url).endsWith('/token'))return response({access_token:'token-in-memory',expires_in:3600});
 const path=String(url).replace('https://graph.microsoft.com/v1.0','');
 if(path.startsWith('/me/drive/special/approot'))return response({id:'ROOT',name:'App Folder',folder:{}});
 const children=path.match(/^\/me\/drive\/items\/([^/]+)\/children/);
 if(children){const id=decodeURIComponent(children[1]);
  if((options.method||'GET')==='POST'){
   const name=JSON.parse(options.body).name;
   const item={id:'F-'+folderTree.size,name,folder:{}};
   folderTree.get(id).push(item);folderTree.set(item.id,[]);return response(item,201);
  }
  return response({value:folderTree.get(id)||[]});
 }
 const content=path.match(/^\/me\/drive\/items\/([^:]+):\/(.+):\/content$/);
 if(content&&options.method==='PUT'){
  const filename=decodeURIComponent(content[2]);
  photoMeta={id:'photo-1',name:filename,size:options.body.size,webUrl:'https://onedrive.live.com/?id=photo-1'};
  return response(photoMeta,201);
 }
 if(path.includes('/me/drive/items/photo-1?'))return response(photoMeta);
 throw new Error('Unhandled mock URL '+url);
}
const window={};
const sandbox={window,crypto:webcrypto,localStorage,sessionStorage,location,history,fetch:fetchMock,URL,URLSearchParams,TextEncoder,btoa:s=>Buffer.from(s,'binary').toString('base64'),Date,Uint8Array,String,Math,Map,Set,JSON,encodeURIComponent};
vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'..','onedrive.js'),'utf8'),sandbox);
const cloud=window.WC_ONEDRIVE;
(async()=>{
 assert.deepEqual(Array.from(cloud.folderParts({group:'buildings',building:'3615',area:'boiler'})),['3615','Boiler Room']);
 assert.deepEqual(Array.from(cloud.folderParts({group:'buildings',building:'3615',area:'office'})),['3615','Office Lease']);
 assert.deepEqual(Array.from(cloud.folderParts({group:'buildings',building:'3845',area:'apartment',unit:'20A'})),['3845','Apartments','Apt 20A']);
 assert.deepEqual(Array.from(cloud.folderParts({group:'facilities',facility:'pool'})),['Facilities','Swimming Pool']);
 assert.throws(()=>cloud.folderParts({group:'buildings',building:'3615',area:'apartment',unit:'1A'}));
 assert.throws(()=>cloud.setClientId('not-a-guid'));
 cloud.setClientId('00000000-1111-2222-3333-444444444444');
 await cloud.startSignIn();
 const query=new URL(location.lastRedirect).searchParams;
 assert.equal(query.get('code_challenge_method'),'S256');
 assert.equal(query.get('client_id'),'00000000-1111-2222-3333-444444444444');
 assert.equal(query.get('redirect_uri'),'https://photos.example.test/work-camera/index.html');
 assert.ok(!localStorage.getItem('work-camera:pkce-flow-v2'));
 location.search='?code=code-from-ms&state='+encodeURIComponent(query.get('state'));
 const result=await cloud.completeSignIn();
 assert.equal(result.connected,true);assert.equal(cloud.connected(),true);
 assert.ok(!location.search,'query code removed');
 const image=Buffer.from('fake image data');
 const photo={id:'photo-local-1',createdAt:Date.UTC(2026,9,31,12,0,0),blob:new Blob([image],{type:'image/jpeg'}),mime:'image/jpeg',location:{group:'buildings',building:'3615',area:'boiler'}};
 const receipt=await cloud.upload(photo);
 assert.equal(receipt.driveItemId,'photo-1');assert.equal(receipt.size,image.length);
 assert.equal(folderTree.get('ROOT')[0].name,'Work Camera Photos');
 assert.equal(folderTree.get('F-1')[0].name,'3615');
 assert.equal(folderTree.get('F-2')[0].name,'Boiler Room');
 assert.ok(requests.some(x=>x.method==='PUT'&&x.url.includes('/content')));
 cloud.disconnect();assert.equal(cloud.connected(),false);
 console.log('PASS: OAuth PKCE, no persisted token, scoped folders, 3615 categories, upload & cloud metadata readback');
})().catch(e=>{console.error(e);process.exit(1)});
