// Two independent filter views over the existing clothing records.
window.ClothingMapFilters = function (config) {
  'use strict';
  const rules = window.GeoFilterRules, world = window.REFERENCE_WORLD;
  const byId = id => document.getElementById(id);
  const safe = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const simple = config.simpleRegions || [
    {key:'europe',title:'欧洲',tags:['west'],at:[505,100]},
    {key:'asia',title:'亚洲',tags:['cn','jp','kr','southasia','seasia','centralasia','westasia'],at:[730,150]},
    {key:'africa',title:'非洲',tags:['westasia','africa'],at:[550,267]},
    {key:'northamerica',title:'北美洲',tags:['west','americas'],at:[230,120]},
    {key:'southamerica',title:'南美洲',tags:['americas'],at:[310,330]},
    {key:'oceania',title:'大洋洲',tags:['oceania'],at:[875,363]}
  ];
  const positions = {west:[488,90],cn:[785,159],jp:[900,154],kr:[856,156],southasia:[738,228],seasia:[808,281],centralasia:[749,114],westasia:[580,198],africa:[552,304],americas:[294,307],oceania:[887,363]};
  const detail = config.detailRegions || config.regions.filter(r=>!['game','other'].includes(r.key)).map(r=>({...r,tags:[r.key],at:positions[r.key]}));
  const extras = config.extras || config.regions.filter(r=>['game','other'].includes(r.key)).map(r=>({...r,tags:[r.key]}));
  const state = {detail:'simple',selected:new Set(),start:rules.minYear,end:rules.maxYear,includeMulti:true,includeUnknown:true,includeTimeless:true};
  const shared = {map:{q:'',favorites:false},text:config.getShared()};
  const controller = {active:true,state};
  let view = [0,0,1000,500], drag = null, preview = new Set(), hover = new Set();
  const dataRanges = new Map(config.records.map(item=>[item,config.getDate?config.getDate(item):rules.periodRanges(item.meta)]));
  const hasTimeless=[...dataRanges.values()].some(date=>date.type==='timeless');
  const facetDefs=config.facets||[
    {key:'garment',id:'mapGarment',title:'服装',options:[{key:'all',title:'全部服装'},...config.garments]},
    {key:'kind',id:'mapImage',title:'例图',options:[{key:'all',title:'全部例图类型'},...config.kinds]},
    {key:'group',id:'mapGroup',title:'大类',options:[{key:'all',title:'全部大类'},{key:'history',title:'历史考据'},{key:'howto',title:'穿着规范'}]},
    {key:'level',id:'mapLevel',title:'级别',options:[{key:'all',title:'全部级别'},...['S','A','B','C'].map(key=>({key,title:key+' 级'})),{key:'Q',title:'待定'},{key:'bad',title:'访问受限'}]}
  ];
  const featureKeys=(feature,mode,index)=>config.featureKeys?config.featureKeys(feature,mode,index):mode==='simple'?[feature.simple]:feature.detail;
  const groups = {simple:new Map(simple.map(d=>[d.key,[]])),detail:new Map(detail.map(d=>[d.key,[]]))};
  world.forEach((feature,index)=>{
    featureKeys(feature,'simple',index).forEach(key=>groups.simple.get(key)?.push(...feature.polygons));
    featureKeys(feature,'detail',index).forEach(key=>groups.detail.get(key)?.push(...feature.polygons));
  });
  const defs = () => state.detail==='simple'?simple:detail;
  const allDefs = () => [...defs(),...extras];
  function rangeLabel() {return state.start===rules.minYear&&state.end===rules.maxYear?'全部年代':yearLabel(state.start)+' — '+yearLabel(state.end);}
  function yearLabel(year) {return year<0?'公元前'+Math.abs(year)+'年':year+'年';}
  function conditionSummary() {
    const selected=allDefs().filter(d=>state.selected.has(d.key)).map(d=>d.title);
    const facets=facetDefs.filter(field=>byId(field.id).value!==(field.default||'all')).map(field=>field.title+'：'+field.options.find(option=>option.key===byId(field.id).value)?.title);
    return (selected.length?selected.join('、'):'全部地区')+' · '+rangeLabel()+(state.includeMulti?' · 含跨时期':'')+(state.includeUnknown?' · 含年代未注明':'')+(hasTimeless&&state.includeTimeless?' · 含不限定年代':'')+(facets.length?' · '+facets.join(' · '):'');
  }
  byId('mapPanel').innerHTML = `
    <div class="map-panel-head"><div><h2>在地图上找参考</h2><p>点击或框选地区，再调整年代范围<a href="#list" id="mapResultJump" class="map-result-jump">查看资料 ↓</a></p></div><div><div class="map-detail-switch" role="group" aria-label="地图分区精细程度"><button type="button" data-map-detail="simple" aria-pressed="true">简易 · 大洲</button><button type="button" data-map-detail="detail" aria-pressed="false">详细 · 资料区域</button></div><span class="map-reset-hint">切换分区会清空地区，保留年代</span></div></div>
    <div class="map-stage" id="mapStage"><div class="map-texture map-texture-old"></div><div class="map-texture map-texture-new"></div><svg id="worldMap" viewBox="0 0 1000 500" aria-label="世界地图：左键点击或框选，右键移动；也可用下方地区按钮选择" role="img"><title>世界地图资料筛选</title><g class="map-graticule" id="mapGraticule"></g><g id="mapLand"></g><g id="mapLabels"></g><rect id="mapSelectionBox" class="map-selection-box" hidden></rect></svg><span class="map-coordinates">左键点选／框选 · 右键移动</span><div class="map-controls" role="group" aria-label="地图视野"><button type="button" id="mapZoomOut" aria-label="缩小地图">−</button><button type="button" id="mapZoomIn" aria-label="放大地图">＋</button><button type="button" id="mapHome">回到全球</button></div></div>
    <div id="mapHitChoices" class="map-hit-choices" hidden></div>
    <div class="map-region-wrap"><div class="map-region-list" id="mapRegions" role="group" aria-label="地图地区选择"></div><p id="mapSelectionStatus" class="map-selection-status" aria-live="polite">尚未选区，显示全部地区。</p></div>
    <div class="map-time"><div class="map-time-heading"><strong id="mapTimeLabel">全部年代</strong><span id="mapEraMood" class="map-era-mood"></span></div><div class="map-year-inputs"><label>从<input type="number" id="mapStartNumber" min="-3500" max="2026" step="1" aria-label="起始年份"></label><span>—</span><label>到<input type="number" id="mapEndNumber" min="-3500" max="2026" step="1" aria-label="结束年份"></label><span class="map-year-note">负数表示公元前；宽年代保留原始说明</span></div><div class="map-dual-range"><div class="map-range-track"></div><div id="mapRangeFill" class="map-range-fill"></div><input type="range" id="mapStartRange" min="-3500" max="2026" step="1" aria-label="滑动选择起始年份"><input type="range" id="mapEndRange" min="-3500" max="2026" step="1" aria-label="滑动选择结束年份"></div><div class="map-time-ticks"><span>公元前3500</span><span>公元1年</span><span>2026</span></div><div class="map-time-options"><label><input type="checkbox" id="mapIncludeMulti" checked>包含跨时期</label><label><input type="checkbox" id="mapIncludeUnknown" checked>包含年代未注明</label><button type="button" id="mapAllYears">恢复全部年代</button></div></div>
    <details class="map-more"><summary>更多条件：${facetDefs.map(field=>safe(field.title)).join('／')}</summary><div class="map-more-fields">${facetDefs.map(field=>`<label>${safe(field.title)}<select id="${field.id}"></select></label>`).join('')}</div></details>
    <div class="map-footnote"><span id="mapResults" role="status" aria-live="polite"></span><span>地图空白表示暂未收录 · <a href="https://www.naturalearthdata.com/downloads/110m-cultural-vectors/110m-admin-0-countries/" target="_blank" rel="noopener noreferrer">地理轮廓：Natural Earth</a></span></div>`;
  const svg=byId('worldMap'),stage=byId('mapStage');
  facetDefs.forEach(field=>{byId(field.id).innerHTML=field.options.map(option=>`<option value="${safe(option.key)}">${safe(option.title)}</option>`).join('');byId(field.id).value=field.default||'all';});
  if(hasTimeless){const label=document.createElement('label');label.innerHTML='<input type="checkbox" id="mapIncludeTimeless" checked>包含不限定年代';byId('mapAllYears').before(label);label.querySelector('input').addEventListener('change',event=>{state.includeTimeless=event.target.checked;config.onChange();});}
  if(config.note){const note=document.createElement('p');note.className='map-selection-status';note.textContent=config.note;byId('mapTimeLabel').closest('.map-time').append(note);}
  let grid='';
  for(let x=0;x<=1000;x+=1000/12) grid+=`<path d="M${x.toFixed(2)},0V500"/>`;
  for(let y=0;y<=500;y+=500/6) grid+=`<path d="M0,${y.toFixed(2)}H1000"/>`;
  byId('mapGraticule').innerHTML=grid;
  const pathData=polygons=>polygons.map(poly=>poly.map(ring=>ring.map((point,index)=>(index?'L':'M')+point.join(',')).join('')+'Z').join('')).join('');
  byId('mapLand').innerHTML=world.map((feature,index)=>`<path class="map-land" data-feature="${index}" d="${pathData(feature.polygons)}"><title></title></path>`).join('');
  const paths=[...byId('mapLand').children];
  const keysByFeature={simple:world.map((feature,index)=>featureKeys(feature,'simple',index)),detail:world.map((feature,index)=>featureKeys(feature,'detail',index))};
  const indexByFeature=new Map(world.map((feature,index)=>[feature,index]));
  function keysFor(feature) {return keysByFeature[state.detail][indexByFeature.get(feature)];}
  function paintMap() {
    paths.forEach((path,index)=>{
      const keys=keysFor(world[index]);
      path.classList.toggle('is-selected',keys.some(key=>state.selected.has(key)));
      path.classList.toggle('is-preview',keys.some(key=>preview.has(key)));
      path.classList.toggle('is-hovered',!drag && keys.some(key=>hover.has(key)));
      path.classList.toggle('has-data',keys.length>0);
      path.querySelector('title').textContent=keys.map(key=>allDefs().find(d=>d.key===key)?.title||key).join('／')||'暂无可定位的地区资料';
    });
    byId('mapRegions').querySelectorAll('button').forEach(button=>{
      const selected=state.selected.has(button.dataset.regionKey);
      button.classList.toggle('is-selected',selected);button.classList.toggle('is-preview',preview.has(button.dataset.regionKey));
      button.setAttribute('aria-pressed',String(selected));button.querySelector('.region-mark').textContent=selected?'✓':'+';
    });
  }
  function renderRegions() {
    stage.classList.toggle('is-simple',state.detail==='simple');
    byId('mapRegions').innerHTML=allDefs().map(d=>`<button type="button" class="map-region" data-region-key="${d.key}" aria-pressed="false"><span class="region-mark" aria-hidden="true">+</span>${safe(d.title)}<span class="region-n">0</span></button>`).join('');
    byId('mapRegions').classList.toggle('is-long',allDefs().length>14);
    renderLabels();
    paintMap();
    sizeLabels();
  }
  function renderLabels(){
    byId('mapLabels').innerHTML='<text class="map-ocean" x="125" y="285">太平洋</text><text class="map-ocean" x="423" y="280">大西洋</text><text class="map-ocean" x="704" y="360">印度洋</text>'+defs().filter(d=>d.at&&(state.detail==='simple'||defs().length<=14||state.selected.has(d.key))).map(d=>`<text class="map-continent" x="${d.at[0]}" y="${d.at[1]}">${safe(config.detailRegions||state.detail==='simple'?d.title:({west:'欧洲 · 北美',cn:'中国',jp:'日本',kr:'韩国',southasia:'南亚',seasia:'东南亚',centralasia:'中亚 · 蒙古',westasia:'西亚 · 北非',africa:'撒哈拉以南',americas:'美洲原住民',oceania:'大洋洲'}[d.key]))}</text>`).join('');
    sizeLabels();
  }
  function sizeLabels() {
    const scale=svg.getScreenCTM()?.a||1;
    byId('mapLabels').querySelectorAll('.map-continent').forEach(label=>label.style.fontSize=(state.detail==='simple'?12:10)/scale+'px');
    byId('mapLabels').querySelectorAll('.map-ocean').forEach(label=>label.style.fontSize=10/scale+'px');
  }
  function syncTime() {
    for(const [id,value] of [['mapStartRange',state.start],['mapStartNumber',state.start],['mapEndRange',state.end],['mapEndNumber',state.end]]) byId(id).value=value;
    byId('mapIncludeMulti').checked=state.includeMulti;byId('mapIncludeUnknown').checked=state.includeUnknown;
    if(hasTimeless)byId('mapIncludeTimeless').checked=state.includeTimeless;
    byId('mapTimeLabel').textContent=rangeLabel();
    const length=rules.maxYear-rules.minYear;
    byId('mapRangeFill').style.left=(state.start-rules.minYear)/length*100+'%';
    byId('mapRangeFill').style.right=(rules.maxYear-state.end)/length*100+'%';
    const wide=state.end-state.start>600,center=(state.start+state.end)/2;
    const old=!wide&&center<1500,print=!wide&&center>=1500&&center<1900;
    stage.style.backgroundColor=old?'#efe1c2':print?'#eee8d8':'#e9ede6';
    stage.style.setProperty('--map-land',old?'#d4bd8c':print?'#cfc6aa':'#c7d5c6');
    stage.style.setProperty('--map-old-opacity',old?'.34':print?'.2':'.08');
    stage.style.setProperty('--map-new-opacity',old?'.04':print?'.08':'.22');
    byId('mapEraMood').textContent=wide?'宽年代 · 中性纸纹':old?'古典纸纹':print?'印刷纸纹':'现代浅纹';
  }
  function changed() {paintMap();renderLabels();config.onChange();}
  function toggleRegion(key) {state.selected.has(key)?state.selected.delete(key):state.selected.add(key);byId('mapHitChoices').hidden=true;changed();}
  function setDetail(mode) {
    if(mode===state.detail) return;
    cancelDrag();state.detail=mode;state.selected.clear();hover.clear();byId('mapHitChoices').hidden=true;
    document.querySelectorAll('[data-map-detail]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mapDetail===mode)));
    renderRegions();config.onChange();byId('mapSelectionStatus').textContent='已切换分区并清空地区，年代范围保留。';
  }
  function setMode(mode) {
    if((mode==='map')===controller.active) return;
    cancelDrag();shared[controller.active?'map':'text']=config.getShared();controller.active=mode==='map';
    config.setShared(shared[mode]);byId('mapPanel').hidden=!controller.active;byId('moreFilters').hidden=controller.active;
    if(!controller.active) byId('moreFilters').open=true;
    document.querySelectorAll('[data-filter-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.filterMode===mode)));
    byId('userStatus').textContent='';config.onChange();
  }
  function matchesTime(item) {
    const date=dataRanges.get(item);
    if(date.type==='timeless')return state.includeTimeless;
    if(date.type==='multi') return state.includeMulti;
    if(date.type==='unknown') return state.includeUnknown;
    return date.ranges.some(([a,b])=>a<=state.end&&b>=state.start);
  }
  function matchesRegion(item) {
    const tags=item.regionTags||[item.region];
    return !state.selected.size||allDefs().some(d=>state.selected.has(d.key)&&d.tags.some(tag=>tags.includes(tag)));
  }
  controller.matches=item=>matchesTime(item)&&matchesRegion(item);
  controller.facets=()=>Object.fromEntries(facetDefs.map(field=>[field.key,byId(field.id).value]));
  controller.activeCount=()=>state.selected.size+(state.start!==rules.minYear||state.end!==rules.maxYear?1:0)+Number(!state.includeMulti)+Number(!state.includeUnknown)+Number(hasTimeless&&!state.includeTimeless)+facetDefs.filter(field=>byId(field.id).value!==(field.default||'all')).length;
  controller.summary=conditionSummary;
  controller.update=(shown,eligible)=>{
    if(!controller.active) return;
    const counts=new Map(allDefs().map(d=>[d.key,0]));
    config.records.forEach(item=>{if(eligible(item)&&matchesTime(item)) allDefs().forEach(d=>{if(d.tags.some(tag=>(item.regionTags||[item.region]).includes(tag)))counts.set(d.key,counts.get(d.key)+1);});});
    byId('mapRegions').querySelectorAll('button').forEach(button=>{
      const n=counts.get(button.dataset.regionKey)||0;
      button.querySelector('.region-n').textContent=n;
      const title=allDefs().find(d=>d.key===button.dataset.regionKey)?.title;
      button.setAttribute('aria-label',`${title}，当前年代及其他条件下有${n}条资料`);
    });
    byId('mapResults').textContent=`当前找到 ${shown} 条资料`;
    const names=allDefs().filter(d=>state.selected.has(d.key)).map(d=>d.title);
    byId('mapSelectionStatus').textContent=names.length?'已选：'+names.join('、')+'。再次点击可取消。':'尚未选区，显示全部地区。';
    if(state.selected.size&&[...state.selected].some(key=>['west','westasia','europe','northamerica','africa','asia'].includes(key))) byId('mapSelectionStatus').textContent+=' 部分标签跨区域，匹配资料会保留完整的地区说明。';
  };
  controller.reset=()=>{
    cancelDrag();state.selected.clear();state.start=rules.minYear;state.end=rules.maxYear;state.includeMulti=state.includeUnknown=state.includeTimeless=true;
    facetDefs.forEach(field=>byId(field.id).value=field.default||'all');byId('mapHitChoices').hidden=true;syncTime();paintMap();renderLabels();
  };
  function screenPoint(event) {return new DOMPoint(event.clientX,event.clientY).matrixTransform(svg.getScreenCTM().inverse());}
  function refreshView() {
    view[0]=Math.max(-view[2]*.15,Math.min(1000-view[2]*.85,view[0]));view[1]=Math.max(-view[3]*.15,Math.min(500-view[3]*.85,view[1]));
    svg.setAttribute('viewBox',view.map(value=>Math.round(value*100)/100).join(' '));byId('mapZoomOut').disabled=view[2]>=1000;byId('mapZoomIn').disabled=view[2]<=1000/6;
    sizeLabels();
  }
  function zoom(factor,point={x:view[0]+view[2]/2,y:view[1]+view[3]/2}) {
    cancelDrag();const nextWidth=Math.max(1000/6,Math.min(1000,view[2]/factor)),ratio=nextWidth/view[2];
    view=[point.x-(point.x-view[0])*ratio,point.y-(point.y-view[1])*ratio,nextWidth,nextWidth/2];refreshView();
  }
  function cancelDrag() {
    if(drag&&svg.hasPointerCapture(drag.id)) svg.releasePointerCapture(drag.id);
    drag=null;preview.clear();byId('mapSelectionBox').hidden=true;svg.classList.remove('is-panning');paintMap();
  }
  function rectangleBetween(a,b) {return {x:Math.min(a.x,b.x),y:Math.min(a.y,b.y),width:Math.abs(a.x-b.x),height:Math.abs(a.y-b.y)};}
  function selectedIn(rectangle) {return new Set(defs().filter(d=>rules.overlapFraction(groups[state.detail].get(d.key)||[],rectangle)>.5).map(d=>d.key));}
  svg.addEventListener('contextmenu',event=>event.preventDefault());
  svg.addEventListener('pointerdown',event=>{
    if(event.button!==0&&event.button!==2) return;
    event.preventDefault();cancelDrag();byId('mapHitChoices').hidden=true;
    drag={id:event.pointerId,button:event.button,point:screenPoint(event),client:{x:event.clientX,y:event.clientY},view:view.slice(),feature:event.target.closest('[data-feature]')?.dataset.feature,moved:false};
    svg.setPointerCapture(event.pointerId);svg.classList.toggle('is-panning',event.button===2);
  });
  svg.addEventListener('pointermove',event=>{
    if(!drag) {const feature=event.target.closest('[data-feature]');hover=new Set(feature?keysFor(world[Number(feature.dataset.feature)]):[]);paintMap();return;}
    if(event.pointerId!==drag.id) return;
    const distance=Math.hypot(event.clientX-drag.client.x,event.clientY-drag.client.y);
    if(distance<4&&!drag.moved) return;
    drag.moved=true;
    if(drag.button===2) {
      const matrix=svg.getScreenCTM();view=[drag.view[0]-(event.clientX-drag.client.x)/matrix.a,drag.view[1]-(event.clientY-drag.client.y)/matrix.d,drag.view[2],drag.view[3]];refreshView();return;
    }
    const rectangle=rectangleBetween(drag.point,screenPoint(event));preview=selectedIn(rectangle);
    const box=byId('mapSelectionBox');box.hidden=false;Object.entries(rectangle).forEach(([key,value])=>box.setAttribute(key,value));paintMap();
    byId('mapSelectionStatus').textContent=preview.size?'松手将选择：'+defs().filter(d=>preview.has(d.key)).map(d=>d.title).join('、'):'框选需覆盖某个区域一半以上的陆地。';
  });
  svg.addEventListener('pointerup',event=>{
    if(!drag||event.pointerId!==drag.id) return;
    const completed=drag,chosen=completed.moved&&completed.button===0?selectedIn(rectangleBetween(completed.point,screenPoint(event))):null;
    cancelDrag();
    if(completed.button===2) return;
    if(chosen) {state.selected=chosen;changed();if(!chosen.size)byId('mapSelectionStatus').textContent='这个框未覆盖任何区域一半以上的陆地，已恢复全部地区。';return;}
    const keys=completed.feature===undefined?[]:keysFor(world[Number(completed.feature)]);
    if(keys.length===1) toggleRegion(keys[0]);
    else if(keys.length>1) {
      const choices=byId('mapHitChoices');choices.hidden=false;choices.innerHTML='此处涉及多个资料标签，请选择：'+keys.map(key=>`<button type="button" data-hit-key="${key}">${safe(allDefs().find(d=>d.key===key).title)}</button>`).join('');choices.querySelector('button').focus();
    }
  });
  svg.addEventListener('pointercancel',cancelDrag);
  svg.addEventListener('lostpointercapture',()=>{if(drag)cancelDrag();});
  svg.addEventListener('pointerleave',()=>{if(!drag){hover.clear();paintMap();}});
  svg.addEventListener('wheel',event=>{if(event.ctrlKey)return;event.preventDefault();zoom(event.deltaY<0?1.2:1/1.2,screenPoint(event));},{passive:false});
  byId('mapZoomIn').addEventListener('click',()=>zoom(1.4));byId('mapZoomOut').addEventListener('click',()=>zoom(1/1.4));
  byId('mapHome').addEventListener('click',()=>{cancelDrag();view=[0,0,1000,500];refreshView();});
  byId('mapRegions').addEventListener('click',event=>{const button=event.target.closest('[data-region-key]');if(button)toggleRegion(button.dataset.regionKey);});
  byId('mapRegions').addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){const button=event.target.closest('[data-region-key]');if(button){event.preventDefault();toggleRegion(button.dataset.regionKey);}}});
  byId('mapHitChoices').addEventListener('click',event=>{const button=event.target.closest('[data-hit-key]');if(button)toggleRegion(button.dataset.hitKey);});
  document.querySelectorAll('[data-map-detail]').forEach(button=>button.addEventListener('click',()=>setDetail(button.dataset.mapDetail)));
  document.querySelectorAll('[data-filter-mode]').forEach(button=>button.addEventListener('click',()=>setMode(button.dataset.filterMode)));
  for(const [id,side] of [['mapStartRange','start'],['mapEndRange','end']]) byId(id).addEventListener('input',()=>{
    let value=Math.round(Number(byId(id).value));if(value===0)value=side==='start'?1:-1;
    state[side]=side==='start'?Math.min(value,state.end):Math.max(value,state.start);syncTime();config.onChange();
  });
  for(const id of ['mapStartNumber','mapEndNumber']) byId(id).addEventListener('change',()=>{
    if(byId(id).value===''){syncTime();return;}
    [state.start,state.end]=rules.normalizeRange(byId('mapStartNumber').value,byId('mapEndNumber').value);syncTime();config.onChange();
  });
  for(const [id,key] of [['mapIncludeMulti','includeMulti'],['mapIncludeUnknown','includeUnknown']]) byId(id).addEventListener('change',()=>{state[key]=byId(id).checked;config.onChange();});
  byId('mapAllYears').addEventListener('click',()=>{state.start=rules.minYear;state.end=rules.maxYear;syncTime();config.onChange();});
  facetDefs.forEach(field=>byId(field.id).addEventListener('change',config.onChange));
  new ResizeObserver(sizeLabels).observe(svg);
  byId('moreFilters').hidden=true;renderRegions();syncTime();refreshView();
  return controller;
};
