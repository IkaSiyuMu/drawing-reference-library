(function(root,factory){
 const api=factory(typeof module==='object'&&module.exports?require('./地图筛选规则.js'):root.GeoFilterRules);
 if(typeof module==='object'&&module.exports)module.exports=api;else root.DrawingMapAdapter=api;
})(typeof globalThis==='undefined'?this:globalThis,function(rules){
 'use strict';
 const continentNames={europe:'欧洲',asia:'亚洲',africa:'非洲',northamerica:'北美洲',southamerica:'南美洲',oceania:'大洋洲'};
 const aliases={
  CN:['中国','China','Jingdezhen','Beijing','Guangzhou','Hunan','Shanghai','Lhasa','Tibet','Gyantse'],
  GB:['英国','英格兰','苏格兰','威尔士','United Kingdom','Great Britain','Britain','England','Scotland','Wales','Stoke-on-Trent','London','Norwich','Cambridge','Oxford','Birmingham','Glasgow','Edinburgh','Liverpool','Newcastle','Reigate','Portsea','Somerset','Gloucestershire','Derbyshire','Staffordshire','Hanley','Burslem','Lambeth','Etruria','Yorkshire','Barlaston','Lancaster','Burnley','Malvern','Wolverhampton','Hammersmith','Bristol'],
  US:['美国','United States','United States of America','U.S.A','America','Philadelphia','Pennsylvania','Baltimore','New York','Boston'],
  JP:['日本','Japan','Tokyo','Edo','Hasami','Arita','Yatsushiro'],
  KR:['韩国','South Korea'],KP:['朝鲜','North Korea'],DE:['德国','Germany','Berlin','Nuremberg','Augsburg','Darmstadt','Selb','Annaberg','München','Frankfurt','Solingen','Mittenwald'],
  FR:['法国','France','Paris','Lyon','Mâcon','Gannat','Saint-Dizier','Ile-de-France','Dieppe'],IT:['意大利','Italy','Rome','Naples','Venice','Florence','Padua','Pesaro','Aosta','Milan','Cremona','Bologna'],
  NL:['荷兰','Netherlands','Holland','Makkum','Rotterdam','Eindhoven','Amsterdam'],BE:['比利时','Belgium','Antwerp','Brussels'],
  IN:['印度','India','Delhi','Bombay','Mumbai','Gujarat','Madras'],TR:['土耳其','Turkey','Türkiye','Istanbul'],EG:['埃及','Egypt','Cairo','Karanis'],
  CH:['瑞士','Switzerland','Lausanne'],AT:['奥地利','Austria','Vienna'],DK:['丹麦','Denmark','Copenhagen'],IE:['爱尔兰','Ireland','Dublin'],
  RU:['俄罗斯','Russia','Russian Federation','Tula'],XK:['科索沃','Kosovo'],CZ:['捷克','Czechia','Czech Republic','波希米亚'],MA:['摩洛哥','Morocco','Maroc']
 };
 function dateOf(item,organization){
  const period=String(item.period||'');
  if(item.module==='nature'||/非历史断代/.test(period)||item.module==='people'&&(/^(现代照片|现代姿势|现代动作)/.test(period)||/^通用$/.test(item.region)&&/当代教材|当代研究/.test(period)))return {type:'timeless',ranges:[]};
  const nav=organization?.items[item.id];
  if(nav){
   if(Number.isFinite(nav.start)&&Number.isFinite(nav.end))return {type:'dated',ranges:[[nav.start,nav.end]],coarse:/世纪|约|ca\.|probably|年代/.test(nav.dateLabel||'')};
   return {type:/跨时期/.test(nav.era||'')?'multi':'unknown',ranges:[]};
  }
  if(/跨时期|跨阶段|历史建筑$|历史自然图谱/.test(period))return {type:'multi',ranges:[]};
  if(/未单列|未注明|不详|待定|\b(before|after|earlier|later)\b/i.test(period))return {type:'unknown',ranges:[]};
  const raw=period.replace(/^[^：]{1,80}：/,'').replace(/[–—−]/g,'-').trim();
  if(/^现代|^当代/.test(raw))return {type:'dated',ranges:[[1900,rules.maxYear]],coarse:true};
  return dateFromRaw(raw,organization);
 }
 function dateFromRaw(raw,organization){
  const parts=raw.split(/[；;]/);
  if(parts.length>1){
   const dates=parts.filter((part,index)=>index===0||/^\s*(?:约\s*|ca\.\s*)?\d{3,4}/i.test(part)).map(part=>dateFromRaw(part.trim(),organization));
   const ranges=dates.flatMap(date=>date.ranges);
   if(ranges.length)return {type:'dated',ranges,coarse:dates.some(date=>date.coarse)};
  }
  const century=raw.match(/(?:公元前|公元)?\d{1,2}(?:(?:-|至)\d{1,2})?世纪/);
  if(century){
   const full=rules.periodRanges({period:raw,eras:[]});
   const range=full.type==='dated'?full:rules.periodRanges({period:century[0],eras:[]});
   const years=[...raw.matchAll(/(\d{3,4})(年代|年)/g)].map(m=>[+m[1],+m[1]+(m[2]==='年代'?9:0)]);
   if(years.length&&range.ranges.length&&!/公元前/.test(raw))return {type:'dated',ranges:[[Math.min(...range.ranges.map(r=>r[0]),...years.map(r=>r[0])),Math.max(...range.ranges.map(r=>r[1]),...years.map(r=>r[1]))]],coarse:true};
   return range;
  }
  const parsed=rules.periodRanges({period:raw,eras:[]});
  if(parsed.type==='dated')return parsed;
  const span=raw.match(/(\d{3,4})\??\s*(?:-|to|and)\s*(\d{3,4})/i);
  if(span)return {type:'dated',ranges:[[+span[1],+span[2]].sort((a,b)=>a-b)],coarse:/约|\?|ca\.|approximately/.test(raw)};
  if(organization?.parseDate){const date=organization.parseDate(raw);if(Number.isFinite(date.start)&&Number.isFinite(date.end))return {type:'dated',ranges:[[date.start,date.end]],coarse:/ca\.|approximately|\?/.test(raw)};}
  const year=raw.match(/\b(\d{3,4})\b/);
  return year?{type:'dated',ranges:[[+year[1],+year[1]]],coarse:/约|\?|ca\.|approximately/.test(raw)}:{type:'unknown',ranges:[]};
 }
 function regionOf(item,organization,registry){
  const raw=String(organization?.items[item.id]?.country||item.region||'').trim();
  if(/归属待定|地未详|地区未详|未注明|未细分|unknown|undetermined|No place/i.test(raw)&&!/西欧|朝鲜半岛/.test(raw))return {tags:['unknown'],label:'地区未详'};
  if(item.module==='nature'&&/机构所在地|来源机构|资料机构|大学.*机构|具体.*(?:地点|分布).*见/.test(raw))return {tags:['general'],label:'通用／跨地区'};
  if(/全球|跨地区|^通用$|^世界$/.test(raw))return {tags:['general'],label:'通用／跨地区'};
  const text=raw.replace(/^制作\/出版地[：:]?/,'').replace(/\([^;；)]*/g,note=>/\bor\b|possibly|probably/i.test(note)?note:'').slice(0,180),lower=text.toLowerCase();
  if(/罗马地中海/.test(text))return {tags:['area:europe','area:africa','area:asia'],label:raw};
  if(/朝鲜半岛|^Korea$/i.test(text.trim()))return {tags:['country:KP','country:KR'],label:raw};
  const hits=[];
  for(const entry of registry){
   const names=[entry.name,entry.english,...(aliases[entry.code]||[])];
   for(const name of names){
    if(!name)continue;
    const token=name.toLowerCase(),start=lower.indexOf(token);if(start<0)continue;
    if(/[\u3400-\u9fff]/.test(name)?(start===0||/[\s／/、，,；;：:]/.test(lower[start-1])):new RegExp('(?:^|[^a-z])'+name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&').toLowerCase()+'(?:$|[^a-z])','i').test(lower))hits.push({code:entry.code,start,end:start+token.length});
   }
  }
  const tags=hits.filter(hit=>!hits.some(other=>other.code!==hit.code&&other.start<=hit.start&&other.end>=hit.end&&other.end-other.start>hit.end-hit.start)).map(hit=>'country:'+hit.code);
  if(tags.length)return {tags:[...new Set(tags)],label:raw};
  const continents=[];
  if(/欧洲|西欧|欧美/.test(text))continents.push('europe');
  if(/北美|欧美/.test(text))continents.push('northamerica');
  if(/南美/.test(text))continents.push('southamerica');
  if(/美洲/.test(text)&&!/[北南]美/.test(text))continents.push('northamerica','southamerica');
  if(/亚洲|东亚|南亚|西亚/.test(text))continents.push('asia');
  if(/非洲|北非/.test(text))continents.push('africa');
  if(/大洋洲/.test(text))continents.push('oceania');
  if(continents.length)return {tags:[...new Set(continents)].map(c=>'area:'+c),label:raw};
  if(/布拉班特|Brabant/.test(text))return {tags:['country:BE','country:NL'],label:raw};
  if(/罗马地中海/.test(text))return {tags:['area:europe','area:africa','area:asia'],label:raw};
  return {tags:['unknown'],label:'地区未详'};
 }
 function build(items,organization,registry){
  const countries=[...new Map(registry.map(entry=>[entry.code,entry])).values()];
  const records=items.map(original=>({id:original.id,original,regionTags:regionOf(original,organization,countries).tags,date:dateOf(original,organization)}));
  const used=new Set(records.flatMap(r=>r.regionTags));
  const simpleRegions=Object.entries(continentNames).map(([key,title])=>({key,title,tags:['area:'+key,...countries.filter(c=>c.continent===key).map(c=>'country:'+c.code)],at:({europe:[505,100],asia:[730,150],africa:[550,267],northamerica:[230,120],southamerica:[310,330],oceania:[875,363]})[key]}));
  const detailRegions=countries.filter(c=>used.has('country:'+c.code)).map(c=>({key:'country:'+c.code,title:c.name,tags:['country:'+c.code],code:c.code,at:c.at}));
  for(const [key,title] of Object.entries(continentNames))if(used.has('area:'+key))detailRegions.push({key:'area:'+key,title:title+'（未细分）',tags:['area:'+key],continent:key,at:simpleRegions.find(r=>r.key===key).at});
  const extras=[{key:'general',title:'通用／跨地区',tags:['general']},{key:'unknown',title:'地区未详',tags:['unknown']}];
  const detailKeys=registry.map(entry=>detailRegions.filter(d=>d.code===entry.code||d.continent===entry.continent).map(d=>d.key));
  return {records,byId:new Map(records.map(r=>[r.id,r])),simpleRegions,detailRegions,extras,featureKeys:(feature,mode,index)=>mode==='simple'?[feature.simple]:detailKeys[index]||[]};
 }
 return {dateOf,regionOf,build};
});
