// Stable IDs keep device-local overlays attached when the same baseline trip is re-imported.
(function(){
  function stableId(prefix, obj, index){
    const seed=[prefix,obj?.date,obj?.time,obj?.title,obj?.from,obj?.to,obj?.mode,obj?.location,index].map(v=>v??'').join('|');
    let h=2166136261;
    for(let i=0;i<seed.length;i++){ h^=seed.charCodeAt(i); h=Math.imul(h,16777619); }
    return `${prefix}-${(h>>>0).toString(36)}`;
  }
  const baseSetTrip=setTrip;
  setTrip=function(raw){
    const trip=JSON.parse(JSON.stringify(raw||{}));
    trip.itinerary=(trip.itinerary||[]).map((x,i)=>({...x,id:x.id||stableId('evt',x,i)}));
    trip.transport=(trip.transport||[]).map((x,i)=>({...x,id:x.id||stableId('tx',x,i)}));
    return baseSetTrip(trip);
  };
})();
