(function (root, factory) {
  const rules = factory();
  if (typeof module === 'object' && module.exports) module.exports = rules;
  else root.GeoFilterRules = rules;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const minYear = -3500, maxYear = 2026;
  const eras = {ancient:[minYear,1499],'16c':[1500,1599],'17c':[1600,1699],'18c':[1700,1799],'19c':[1800,1899],'20c':[1900,1999],'21c':[2000,maxYear]};
  function normalizeRange(start, end) {
    const normalize = value => Math.max(minYear,Math.min(maxYear,Math.round(Number(value)||1)));
    return [normalize(start),normalize(end)].sort((a,b)=>a-b);
  }
  function periodRanges(meta) {
    const keys = meta.eras || [];
    if(keys.includes('multi')) return {type:'multi',ranges:[]};
    if(keys.includes('unknown')) return {type:'unknown',ranges:[]};
    let period = String(meta.period || '').replace(/[–—−]/g,'-').trim();
    if(/^跨时期/.test(period)) return {type:'multi',ranges:[]};
    if(/^(?:年代)?未注明$|^虚构设定/.test(period)) return {type:'unknown',ranges:[]};
    if(/^当代|^现代复刻/.test(period)) return {type:'dated',ranges:[[2000,maxYear]],coarse:true};
    period = period.replace(/^约\s*/,'');
    if(/及当代/.test(period)) {
      const historic=periodRanges({...meta,period:period.replace(/及当代.*$/,''),eras:keys.filter(key=>key!=='21c')});
      return {type:'dated',ranges:[...historic.ranges,[2000,maxYear]],coarse:true};
    }
    let match = period.match(/^公元前(\d+)-(公元)?(\d+)年/);
    if(match) return {type:'dated',ranges:[[-Number(match[1]),(match[2]?1:-1)*Number(match[3])].sort((a,b)=>a-b)]};
    match = period.match(/^(公元前|公元)?(\d+)(?:至|-)(\d+)世纪/);
    if(match) {
      const a=Number(match[2]), b=Number(match[3]);
      return {type:'dated',ranges:[match[1]==='公元前'?[-Math.max(a,b)*100,-(Math.min(a,b)-1)*100-1]:[(Math.min(a,b)-1)*100,Math.max(a,b)*100-1]],coarse:true};
    }
    match = period.match(/^(公元前|公元)?(\d+)世纪(?:$|[，（前中后初末晚])/);
    if(match) {
      const century=Number(match[2]);
      // Other named centuries in the same description retain their full bounds.
      const rest=[...period.matchAll(/(\d+)世纪/g)].map(m=>Number(m[1]));
      const laterYears=[...period.matchAll(/至(\d{3,4})(年代|年)/g)].map(m=>Number(m[1])+(m[2]==='年代'?9:0));
      const lastYear=/至当代|至今/.test(period)?maxYear:Math.max(Math.max(...rest)*100-1,...laterYears);
      return {type:'dated',ranges:[match[1]==='公元前'?[-century*100,-(century-1)*100-1]:[(Math.min(...rest)-1)*100,lastYear]],coarse:true};
    }
    match = period.match(/^(公元前|公元)?(\d{1,4})(?:年代|年)?(?:至|-)(公元前|公元)?(\d{1,4})(年代|年)(?:$|[，；（及])/);
    if(match) {
      const negative=match[1]==='公元前';
      const a=(negative?-1:1)*Number(match[2]);
      const b=(match[3]==='公元前'||(negative&&!match[3])?-1:1)*(Number(match[4])+(match[5]==='年代'?9:0));
      return {type:'dated',ranges:[[a,b].sort((x,y)=>x-y)]};
    }
    match = period.match(/^(\d{3,4})(?:年代|年)?(?:至今|至当代)/);
    if(match) return {type:'dated',ranges:[[Number(match[1]),maxYear]],coarse:true};
    if(/^(?:(?:公元前|公元)?\d{1,4}年?[、，])+\d{1,4}年(?:等)?$/.test(period)) {
      return {type:'dated',ranges:[...period.matchAll(/\d{1,4}/g)].map(m=>[Number(m[0]),Number(m[0])])};
    }
    match = period.match(/^(公元前|公元)?(\d{1,4})(年代|年)(?:$|[，（])/);
    if(match) {
      const year=(match[1]==='公元前'?-1:1)*Number(match[2]);
      return {type:'dated',ranges:[[year,year+(match[3]==='年代'?9:0)]]};
    }
    const ranges=keys.filter(key=>eras[key]).map(key=>eras[key].slice());
    return ranges.length?{type:'dated',ranges,coarse:true}:{type:'unknown',ranges:[]};
  }
  function matchesTime(meta, state) {
    const date=periodRanges(meta);
    if(date.type==='multi') return !!state.includeMulti;
    if(date.type==='unknown') return !!state.includeUnknown;
    return date.ranges.some(([a,b])=>a<=state.end && b>=state.start);
  }
  function signedArea(ring) {
    let sum=0;
    for(let i=0;i<ring.length;i++) {const a=ring[i],b=ring[(i+1)%ring.length];sum+=a[0]*b[1]-b[0]*a[1];}
    return Math.abs(sum)/2;
  }
  function clipRing(ring, rectangle) {
    let points=ring;
    const boundaries=[[0,rectangle.x,true],[0,rectangle.x+rectangle.width,false],[1,rectangle.y,true],[1,rectangle.y+rectangle.height,false]];
    for(const [axis,bound,greater] of boundaries) {
      if(!points.length) break;
      const result=[],inside=point=>greater?point[axis]>=bound:point[axis]<=bound;
      let previous=points[points.length-1];
      for(const current of points) {
        const prevInside=inside(previous),currInside=inside(current);
        if(prevInside!==currInside) {
          const t=(bound-previous[axis])/(current[axis]-previous[axis]);
          result.push([previous[0]+t*(current[0]-previous[0]),previous[1]+t*(current[1]-previous[1])]);
        }
        if(currInside) result.push(current);
        previous=current;
      }
      points=result;
    }
    return points;
  }
  function overlapFraction(polygons, rectangle) {
    let total=0,overlap=0;
    for(const polygon of polygons) polygon.forEach((ring,index)=>{
      const sign=index===0?1:-1;
      total+=sign*signedArea(ring);overlap+=sign*signedArea(clipRing(ring,rectangle));
    });
    return total>0?Math.max(0,Math.min(1,overlap/total)):0;
  }
  return {minYear,maxYear,normalizeRange,periodRanges,matchesTime,overlapFraction};
});
