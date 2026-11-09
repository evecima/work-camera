/* Apartment lookup over the exact 500-unit Apartment Finder catalog copied into Work Camera.
 * Never alter catalog entries or guess a building if a unit is not present.
 */
(function(root){
  'use strict';
  function normalize(value){
    let text=String(value??'').normalize('NFKC').trim().toUpperCase();
    text=text.replace(/^(?:(?:APARTMENT|APT|UNIT)\.?\s*#?\s*|#\s*)/,'');
    text=text.replace(/[\s-]/g,'');
    const match=text.match(/^0*(\d+)([A-Z]?)$/);
    return match?(String(Number(match[1]))+match[2]):text;
  }
  function search(value,catalog,limit=7){
    const query=normalize(value);
    if(!query)return {query,empty:true,invalid:false,exact:[],matches:[],more:0};
    if(!/^\d{1,4}[A-Z]?$/.test(query))return {query,empty:false,invalid:true,exact:[],matches:[],more:0};
    const withLetter=/[A-Z]$/.test(query);
    const n=Number(query.replace(/[A-Z]$/,''));
    const exact=catalog.filter(p=>withLetter?String(p.unit).toUpperCase()===query:Number(p.number)===n);
    const suggestions=withLetter?[]:catalog.filter(p=>String(p.number).startsWith(query)&&Number(p.number)!==n).sort((a,b)=>a.number-b.number);
    const merged=[...exact,...suggestions];
    const bounded=Math.max(1,Math.min(20,limit));
    return {query,empty:false,invalid:false,exact,matches:merged.slice(0,bounded),more:Math.max(0,merged.length-bounded)};
  }
  root.WC_APT_LOOKUP={normalize,search};
})(window);
