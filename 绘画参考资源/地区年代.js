'use strict';
(function(){
 const items=window.DRAWING_ORGANIZATION_DATA||{};
 function isTarget(i){return i.module==='architecture'||i.module==='objects'&&i.category==='vessels'}
 function parseDate(raw,bounds){
  const s=String(raw||'').toLowerCase().replace(/[–—]/g,'-').trim();
  const unknown={start:null,end:null};if(!s||/\b(before|after|earlier|later)\b/.test(s))return unknown;
  const centuries=[...s.matchAll(/(\d{1,2})(?:st|nd|rd|th)\s+century/g)].map(m=>Number(m[1]));
  if(centuries.length&&/\b(mid|late|early)\b/.test(s)){const start=String(bounds?.earliest||'').match(/^(\d{4})-/),end=String(bounds?.latest||'').match(/^(\d{4})-/);return start&&end?{start:+start[1],end:+end[1]}:unknown;}
  if(centuries.length)return {start:(Math.min(...centuries)-1)*100+1,end:Math.max(...centuries)*100};
  const decade=s.match(/\b(\d{3}0)s(?:\s*-\s*(\d{3}0)s)?\b/);if(decade)return {start:+decade[1],end:+(decade[2]||decade[1])+9};
  const range=s.match(/\b(\d{3,4})\s*(?:-|to|and)\s*(\d{1,4})\b/);
  if(range){const start=+range[1],tail=range[2];let end=+tail;if(tail.length<range[1].length){const unit=10**tail.length;end=Math.floor(start/unit)*unit+end;if(end<start)end+=unit}return {start,end}}
  const year=s.match(/\b(\d{3,4})\b/);return year?{start:+year[1],end:+year[1]}:unknown;
 }
 function sort(input,direction='asc'){
  return [...input].sort((a,b)=>{const x=items[a.id],y=items[b.id];const xd=Number.isFinite(x?.start),yd=Number.isFinite(y?.start);if(xd!==yd)return xd?-1:1;if(xd&&x.start!==y.start)return (x.start-y.start)*(direction==='desc'?-1:1);return a.name.localeCompare(b.name,'zh-CN')});
 }
 function matches(i,filters){if(!isTarget(i))return Object.values(filters).every(v=>v==='all');const info=items[i.id];return !!info&&['region','country','era'].every(k=>!filters[k]||filters[k]==='all'||filters[k]===info[k])}
 window.DRAWING_ORGANIZATION={items,isTarget,parseDate,sort,matches,regions:['亚洲','欧洲','美洲','非洲','大洋洲','跨地区','地区待定']};
})();
