const state = { baseTrip: null, trip: null, edits: null };
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));
const todayISO = () => new Date().toISOString().slice(0,10);
const clone = v => JSON.parse(JSON.stringify(v));

async function fetchTrip(path){ const r=await fetch(path); if(!r.ok) throw new Error(`Unable to load ${path}`); return r.json(); }
function normalizeTrip(t){
  return {
    ...t,
    schemaVersion:Math.max(3, Number(t.schemaVersion)||3),
    id:t.id||crypto.randomUUID(), name:t.name||'Untitled Trip', travelers:t.travelers||[],
    startDate:t.startDate||'', endDate:t.endDate||'', homeTimeZone:t.homeTimeZone||'America/New_York',
    regions:t.regions||[], legs:t.legs||[], itinerary:(t.itinerary||[]).map(x=>({...x,id:x.id||crypto.randomUUID()})), places:t.places||[],
    transport:(t.transport||[]).map(normalizeTransport), pocket:t.pocket||{}, preferences:t.preferences||{},
    unresolved:t.unresolved||[]
  };
}
function normalizeTransport(t){ return {...t,id:t.id||crypto.randomUUID(),status:t.status||'unknown',responsibleParty:t.responsibleParty||{},booking:t.booking||{},links:t.links||[]}; }
function editKey(tripId){ return `veyos.tripEdits.${tripId}`; }
function defaultEdits(){ return {transport:{}, itinerary:{}, addedItinerary:[], readiness:{}}; }
function loadEdits(tripId){ try{return {...defaultEdits(),...(JSON.parse(localStorage.getItem(editKey(tripId))||'{}'))};}catch{return defaultEdits();} }
function saveEdits(){ if(!state.baseTrip) return; localStorage.setItem(editKey(state.baseTrip.id),JSON.stringify(state.edits)); rebuildTrip(); }
function deepMerge(target, patch){
  const out={...target};
  Object.entries(patch||{}).forEach(([k,v])=>{ out[k]=(v&&typeof v==='object'&&!Array.isArray(v))?deepMerge(target?.[k]||{},v):v; });
  return out;
}
function applyEdits(base, edits){
  const trip=clone(base);
  trip.transport=trip.transport.map(t=>edits.transport?.[t.id]?deepMerge(t,edits.transport[t.id]):t);
  trip.itinerary=trip.itinerary.map(x=>edits.itinerary?.[x.id]?deepMerge(x,edits.itinerary[x.id]):x);
  trip.itinerary=[...trip.itinerary,...(edits.addedItinerary||[])].sort((a,b)=>`${a.date||''} ${a.time||''}`.localeCompare(`${b.date||''} ${b.time||''}`));
  return trip;
}
function rebuildTrip(){ state.trip=state.baseTrip?applyEdits(state.baseTrip,state.edits||defaultEdits()):null; if(state.trip)localStorage.setItem('veyos.activeTrip',JSON.stringify(state.baseTrip)); renderAll(); }
function setTrip(raw){ state.baseTrip=normalizeTrip(raw); state.edits=loadEdits(state.baseTrip.id); rebuildTrip(); }
function resetEdits(){ if(!state.baseTrip)return; localStorage.removeItem(editKey(state.baseTrip.id)); state.edits=defaultEdits(); rebuildTrip(); }

function activeLeg(date=todayISO()){
  if(!state.trip) return null;
  return state.trip.legs.find(x=>date>=x.startDate&&date<=x.endDate) || state.trip.legs.find(x=>date<=x.endDate) || state.trip.legs.at(-1) || null;
}
function activeRegion(){ const leg=activeLeg(); return state.trip&&leg ? state.trip.regions.find(r=>r.id===leg.regionId)||state.trip.regions.find(r=>r.country===leg.country)||null:null; }
function todaysItems(){ if(!state.trip)return[]; const d=todayISO(); const exact=state.trip.itinerary.filter(x=>x.date===d); if(exact.length)return exact; const leg=activeLeg(); return leg?state.trip.itinerary.filter(x=>x.legId===leg.id).slice(0,6):[]; }
function activeTransport(){ if(!state.trip)return[]; const d=todayISO(); const exact=state.trip.transport.filter(t=>t.date===d); if(exact.length)return exact.slice(0,6); const leg=activeLeg(); return leg?state.trip.transport.filter(t=>t.legId===leg.id).slice(0,6):state.trip.transport.slice(0,6); }
function appleMapUrl(p){ const q=p.lat&&p.lon?`${p.lat},${p.lon}`:[p.name,p.address].filter(Boolean).join(' '); return `https://maps.apple.com/?q=${encodeURIComponent(q)}`; }
function datePretty(s){ if(!s)return''; const d=new Date(`${s}T12:00:00`); return d.toLocaleDateString(undefined,{month:'short',day:'numeric'}); }
function serviceLink(service){ return service?.webUrl||service?.appStoreUrl||'#'; }
function actionButton(label,href,cls='mini'){ return href&&href!=='#'?`<a class="${cls}" href="${esc(href)}" target="_blank" rel="noopener">${esc(label)}</a>`:''; }

const TRANSPORT_STATES={confirmed:{label:'Confirmed',symbol:'✓',className:'confirmed'},provider_confirmed:{label:'Provider owns it',symbol:'◐',className:'provider'},action_required:{label:'Action required',symbol:'⚠',className:'action'},unbooked:{label:'Not booked',symbol:'?',className:'missing'},unknown:{label:'Needs detail',symbol:'?',className:'missing'}};
function transportState(t){ return TRANSPORT_STATES[t.status]||TRANSPORT_STATES.unknown; }
function partyLabel(t){ const p=t.responsibleParty||{}; return p.organization||p.name||(p.type==='traveler'?'Me':p.type==='supplier'?'Supplier':'Unassigned'); }
function bookingPrimary(t){ const b=t.booking||{}; return [b.carrier,b.serviceNumber].filter(Boolean).join(' ')||t.mode||'Transport'; }
function bookingDetails(t){ const b=t.booking||{}, bits=[]; if(b.confirmation)bits.push(`Confirmation ${b.confirmation}`); if(b.ticketNumber)bits.push(`Ticket ${b.ticketNumber}`); if(b.seat)bits.push(`Seat ${b.seat}`); if(b.car)bits.push(`Car ${b.car}`); if(b.terminal)bits.push(`Terminal ${b.terminal}`); if(b.gate)bits.push(`Gate ${b.gate}`); return bits; }
function transportLinks(t){ const b=t.booking||{}, links=[]; if(b.statusUrl)links.push(actionButton('Live status',b.statusUrl,'mini primary')); if(b.bookingUrl)links.push(actionButton('View booking',b.bookingUrl)); if(b.ticketUrl)links.push(actionButton('View ticket',b.ticketUrl)); (t.links||[]).forEach(l=>links.push(actionButton(l.label,l.url))); return links.join(''); }
function renderTransportCard(t,{editable=false}={}){
  const s=transportState(t),details=bookingDetails(t),owner=partyLabel(t),b=t.booking||{}; const schedule=[b.departureTime,b.arrivalTime].filter(Boolean).join(' → '),links=transportLinks(t);
  return `<div class="card transport-card ${esc(s.className)}"><div class="transport-head"><div><div class="kicker">${esc(bookingPrimary(t))}${t.date?` · ${esc(datePretty(t.date))}`:''}${schedule?` · ${esc(schedule)}`:''}</div><h3>${esc(t.from||'Origin')} → ${esc(t.to||'Destination')}</h3></div><span class="transport-status ${esc(s.className)}">${esc(s.symbol)} ${esc(s.label)}</span></div><div class="transport-owner"><span>Who gets me there</span><b>${esc(owner)}</b>${t.responsibleParty?.contact?`<small>${esc(t.responsibleParty.contact)}</small>`:''}</div>${details.length?`<div class="booking-grid">${details.map(x=>`<span>${esc(x)}</span>`).join('')}</div>`:''}${t.localDestination?`<p class="local-address">${esc(t.localDestination)}</p>`:''}${t.note?`<p>${esc(t.note)}</p>`:''}<div class="inline-actions">${links}${editable?`<button class="mini edit-btn" data-edit-transport="${esc(t.id)}">Edit</button>`:''}</div></div>`;
}

function deriveGaps(){
  if(!state.trip)return[];
  const gaps=[];
  state.trip.transport.forEach(t=>{
    const b=t.booking||{}, p=t.responsibleParty||{}, label=`${t.from||'Origin'} → ${t.to||'Destination'}`;
    if(['action_required','unbooked','unknown'].includes(t.status)) gaps.push({severity:'critical',kind:'transport',transportId:t.id,title:label,detail:TRANSPORT_STATES[t.status]?.label||'Needs detail'});
    if(!p.name&&!p.organization&&!['carrier','rail'].includes(p.type||'')) gaps.push({severity:'critical',kind:'transport',transportId:t.id,title:label,detail:'Who gets you there is not assigned'});
    if(t.mode==='Flight'&&t.status==='confirmed'&&!b.confirmation) gaps.push({severity:'detail',kind:'transport',transportId:t.id,title:label,detail:`${b.serviceNumber||'Flight'} confirmation number missing`});
    if((t.mode||'').toLowerCase().includes('ktx')&&t.status!=='confirmed') gaps.push({severity:'critical',kind:'transport',transportId:t.id,title:label,detail:'Rail segment is not ticketed'});
    if(t.status==='provider_confirmed'&&!p.contact) gaps.push({severity:'detail',kind:'transport',transportId:t.id,title:label,detail:`${partyLabel(t)} contact not stored`});
    if(['provider_confirmed','confirmed'].includes(t.status)&&!b.departureTime&&t.mode!=='Car') gaps.push({severity:'detail',kind:'transport',transportId:t.id,title:label,detail:'Departure time missing'});
    if(t.status==='provider_confirmed'&&!b.departureTime&&(t.mode||'').toLowerCase().includes('car')) gaps.push({severity:'detail',kind:'transport',transportId:t.id,title:label,detail:'Pickup time missing'});
  });
  state.trip.itinerary.filter(x=>['Supplier','Work'].includes(x.type)).forEach(x=>{
    const loc=(x.location||'').toLowerCase();
    if(!x.location||loc.includes('not supplied')||loc.includes('add ')) gaps.push({severity:'critical',kind:'event',eventId:x.id,title:x.title,detail:'Business location missing'});
    if(!x.time) gaps.push({severity:'detail',kind:'event',eventId:x.id,title:x.title,detail:'Start time missing'});
    if(!x.endTime) gaps.push({severity:'detail',kind:'event',eventId:x.id,title:x.title,detail:'End time missing — leisure window cannot be calculated'});
  });
  return gaps;
}
function readinessMetrics(){
  const gaps=deriveGaps(); const critical=gaps.filter(g=>g.severity==='critical').length, detail=gaps.length-critical; const baseChecks=Math.max(8,(state.trip?.transport?.length||0)*2+(state.trip?.itinerary?.filter(x=>['Supplier','Work'].includes(x.type)).length||0)*2); const score=Math.max(0,Math.round(100-(critical*8+detail*3)*100/baseChecks)); return {score,critical,detail,total:gaps.length};
}
function freeTimeWindows(){
  if(!state.trip)return[];
  const out=[]; const dates=[...new Set(state.trip.itinerary.map(x=>x.date).filter(Boolean))].sort();
  dates.forEach(date=>{
    const items=state.trip.itinerary.filter(x=>x.date===date&&x.time).sort((a,b)=>a.time.localeCompare(b.time));
    if(!items.length)return;
    const last=items.at(-1); if(last.endTime){ const [h,m]=last.endTime.split(':').map(Number); const mins=h*60+m; if(mins<20*60+30) out.push({date,start:last.endTime,end:'22:30',minutes:22*60+30-mins}); }
  });
  return out.filter(w=>w.minutes>=60).slice(0,5);
}
function renderGap(g){ const fix=g.transportId?`<button class="mini edit-btn" data-edit-transport="${esc(g.transportId)}">Fix</button>`:g.eventId?`<button class="mini edit-btn" data-edit-event="${esc(g.eventId)}">Fix</button>`:''; return `<div class="gap-row ${esc(g.severity)}"><div><div class="gap-title">${g.severity==='critical'?'⚠':'○'} ${esc(g.title)}</div><small>${esc(g.detail)}</small></div>${fix}</div>`; }
function renderPrep(){
  const el=$('#prep'); if(!state.trip){el.innerHTML=empty();return;}
  const gaps=deriveGaps(), m=readinessMetrics(), windows=freeTimeWindows();
  el.innerHTML=`<div class="prep-hero"><div class="kicker">Trip readiness</div><div class="prep-score"><strong>${m.score}%</strong><div><b>${m.critical} critical gaps</b><small>${m.detail} details missing</small></div></div><div class="progress"><span style="width:${m.score}%"></span></div><div class="prep-actions"><button id="addEvent" class="primary-btn">+ Add itinerary item</button><button data-jump="journey" class="secondary-inline">Review travel chain</button></div></div>
  <div class="section-title">Travel prep gaps</div>${gaps.length?`<div class="card gap-list">${gaps.map(renderGap).join('')}</div>`:'<div class="card success-card">✓ No derived travel gaps. Your imported itinerary and local prep data are complete enough for execution.</div>'}
  <div class="section-title">Leisure when time allows</div>${windows.length?windows.map(w=>`<div class="card leisure-window"><div><div class="kicker">${datePretty(w.date)}</div><h3>${esc(w.start)}–${esc(w.end)} free</h3><p>${Math.floor(w.minutes/60)}h ${w.minutes%60}m after your last timed commitment.</p></div><button class="mini" data-jump="explore">Explore</button></div>`).join(''):'<div class="card"><h3>Free time not calculable yet</h3><p>Add start/end times to business commitments and VEYOS will surface usable leisure windows automatically.</p></div>'}
  <div class="section-title">Base itinerary additions</div><div class="card"><p>Your imported itinerary remains the baseline. Items you add here are stored as local overlays on this device and survive app reloads.</p><button id="addEvent2" class="mini primary">+ Add meeting, dinner, pickup or personal item</button></div>`;
  bindCommon(); bindEditButtons(); $('#addEvent')?.addEventListener('click',()=>openEventDialog()); $('#addEvent2')?.addEventListener('click',()=>openEventDialog());
}

function regionKey(region){ return `${state.trip?.id||'trip'}:${region?.id||'region'}:readiness`; }
function readinessState(region){ if(!region)return{}; try{return JSON.parse(localStorage.getItem(regionKey(region))||'{}')}catch{return{}}; }
function setReady(region,id,value){ const r=readinessState(region);r[id]=value;localStorage.setItem(regionKey(region),JSON.stringify(r));renderAll(); }
function renderRegionStrip(region){ if(!region)return''; const services=(region.services||[]).slice(0,3); return `<div class="region-strip"><div><div class="kicker">Local toolkit · ${esc(region.name)}</div><div class="tool-row">${services.map(s=>actionButton(s.name,serviceLink(s),'tool-pill')).join('')}</div></div><button class="mini" data-jump="pocket">Details</button></div>`; }
function renderReadiness(region){ if(!region?.readiness?.length)return''; const saved=readinessState(region), complete=region.readiness.filter(x=>saved[x.id]===true).length; return `<div class="section-title">${esc(region.name)} readiness · ${complete}/${region.readiness.length}</div><div class="card readiness">${region.readiness.map(x=>`<label class="ready-row"><input type="checkbox" data-ready="${esc(x.id)}" ${saved[x.id]===true?'checked':''}/><span><b>${esc(x.label)}</b>${x.note?`<small>${esc(x.note)}</small>`:''}</span>${x.required?'<em>Required</em>':''}</label>`).join('')}</div>`; }
function renderToday(){
  const el=$('#today'); if(!state.trip){el.innerHTML=empty();return;} const leg=activeLeg(),region=activeRegion(),items=todaysItems(),transport=activeTransport(),place=leg?.city||leg?.name||state.trip.name;
  el.innerHTML=`<div class="hero"><div class="kicker">${esc(leg?.country||'Active journey')}</div><h1>${esc(place)}</h1><div class="muted">${esc(state.trip.travelers.join(' + '))}${leg?.stay?.name?` · ${esc(leg.stay.name)}`:''}</div><div class="actions"><button class="action" data-jump="prep">Prep<small>gaps + additions</small></button><button class="action" data-jump="journey">Travel<small>handoffs + bookings</small></button><button class="action" data-jump="explore">Free time<small>use this leg's places</small></button><button class="action" id="openStay">Home base<small>${esc(leg?.stay?.name||'not set')}</small></button></div></div>${renderRegionStrip(region)}${transport.length?`<div class="section-title">Getting from A → B</div>${transport.map(t=>renderTransportCard(t,{editable:true})).join('')}`:''}<div class="section-title">${items.length?'Today / current leg':'No itinerary items'}</div>${items.map(renderItem).join('')||'<div class="empty">Import or add itinerary items to populate Today.</div>'}${renderReadiness(region)}`;
  bindCommon(); bindEditButtons(); $('#openStay')?.addEventListener('click',()=>{if(leg?.stay)location.href=appleMapUrl({name:leg.stay.name,address:leg.stay.address,lat:leg.stay.lat,lon:leg.stay.lon});}); $$('[data-ready]').forEach(x=>x.onchange=()=>setReady(region,x.dataset.ready,x.checked));
}
function renderItem(x){ const links=(x.links||[]).map(l=>actionButton(l.label,l.url)).join(''); return `<div class="card row"><div class="time">${esc(x.time||'')}</div><div class="grow"><h3>${esc(x.title)}</h3>${x.endTime?`<p>${esc(x.time||'')}–${esc(x.endTime)}</p>`:''}${x.location?`<p>${esc(x.location)}</p>`:''}${x.localAddress?`<p class="local-address">${esc(x.localAddress)}</p>`:''}${x.note?`<p>${esc(x.note)}</p>`:''}${x.type?`<span class="chip">${esc(x.type)}</span>`:''}<div class="inline-actions">${links}<button class="mini edit-btn" data-edit-event="${esc(x.id)}">Edit</button></div></div></div>`; }
function transportReadinessSummary(){ const ts=state.trip?.transport||[], counts={confirmed:0,provider_confirmed:0,action_required:0,unbooked:0,unknown:0};ts.forEach(t=>counts[t.status]=(counts[t.status]||0)+1);const problem=counts.action_required+counts.unbooked+counts.unknown; return `<div class="readiness-summary"><span><b>${ts.length}</b><small>transport legs</small></span><span><b>${counts.confirmed+counts.provider_confirmed}</b><small>covered</small></span><span class="${problem?'warn-text':''}"><b>${problem}</b><small>need attention</small></span></div>`; }
function renderJourney(){ const el=$('#journey');if(!state.trip){el.innerHTML=empty();return;} const transport=state.trip.transport||[]; el.innerHTML=`<div class="section-title">${esc(state.trip.name)} · ${datePretty(state.trip.startDate)}–${datePretty(state.trip.endDate)}</div>${transportReadinessSummary()}<div class="timeline">${state.trip.legs.map(l=>`<div class="leg"><div class="kicker">${datePretty(l.startDate)}–${datePretty(l.endDate)}</div><h3>${esc(l.city||l.name)}${l.country?`, ${esc(l.country)}`:''}</h3>${l.purpose?`<p class="muted">${esc(l.purpose)}</p>`:''}${l.stay?.name?`<div class="chip">Stay · ${esc(l.stay.name)}</div>`:''}</div>`).join('')}</div>${transport.length?`<div class="section-title">Transport chain of custody</div>${transport.map(t=>renderTransportCard(t,{editable:true})).join('')}`:''}`; bindEditButtons(); }
function renderExplore(){ const el=$('#explore');if(!state.trip){el.innerHTML=empty();return;} const leg=activeLeg(),region=activeRegion(),places=state.trip.places.filter(p=>!p.legId||!leg||p.legId===leg.id),localMap=(region?.services||[]).find(s=>s.role==='maps'),windows=freeTimeWindows().filter(w=>activeLeg(w.date)?.id===leg?.id); el.innerHTML=`${windows.length?`<div class="section-title">Known free windows</div>${windows.map(w=>`<div class="card leisure-window"><div><h3>${datePretty(w.date)} · ${w.start}–${w.end}</h3><p>${Math.floor(w.minutes/60)}h ${w.minutes%60}m available after business.</p></div></div>`).join('')}`:''}<div class="section-title">Explore · ${esc(leg?.city||state.trip.name)}</div>${places.map(p=>`<div class="card place-card"><div><h3>${esc(p.name)}</h3><p>${esc(p.blurb||p.address||'')}</p>${p.localAddress?`<p class="local-address">${esc(p.localAddress)}</p>`:''}${p.category?`<span class="chip">${esc(p.category)}</span>`:''}${p.zone?`<span class="chip">${esc(p.zone)}</span>`:''}</div><div class="place-actions">${actionButton('Apple Maps',appleMapUrl(p))}${localMap?actionButton(localMap.name,serviceLink(localMap)):''}</div></div>`).join('')||'<div class="empty">No places loaded for this leg.</div>'}`; }
function renderPocket(){ const el=$('#pocket');if(!state.trip){el.innerHTML=empty();return;} const leg=activeLeg(),region=activeRegion(),p=state.trip.pocket||{},docs=(p.documents||[]).map(d=>`<div class="card doc"><div><h3>${esc(d.title)}</h3><p>${esc(d.note||d.type||'')}</p></div><span class="status">${d.status?'✓ '+esc(d.status):''}</span></div>`).join(''),services=(region?.services||[]).map(s=>`<div class="card service-card"><div><div class="kicker">${esc(s.role||'Local service')}</div><h3>${esc(s.name)}</h3><p>${esc(s.note||'')}</p></div><div class="service-actions">${actionButton('Open',s.webUrl)}${actionButton('App Store',s.appStoreUrl)}</div></div>`).join(''),guidance=(region?.guidance||[]).map(g=>`<div class="card"><h3>${esc(g.title)}</h3><p>${esc(g.text)}</p></div>`).join(''); el.innerHTML=`<div class="section-title">Current leg</div>${leg?.stay?`<div class="card"><h3>${esc(leg.stay.name)}</h3><p>${esc(leg.stay.address||'')}</p>${leg.stay.localAddress?`<p class="local-address">${esc(leg.stay.localAddress)}</p>`:''}<a class="chip" href="${appleMapUrl({name:leg.stay.name,address:leg.stay.address})}">Open in Apple Maps</a></div>`:''}${region?`<div class="section-title">${esc(region.name)} local toolkit</div>${services||'<div class="empty">No regional services loaded.</div>'}${guidance}`:''}${(p.quick||[]).map(q=>`<div class="card"><h3>${esc(q.label)}</h3><p>${esc(q.value)}</p>${q.local?`<p class="local-address">${esc(q.local)}</p>`:''}</div>`).join('')}<div class="section-title">Documents</div>${docs||'<div class="empty">No pocket documents loaded.</div>'}`; }

function openTransportEditor(id){ const t=state.trip?.transport.find(x=>x.id===id);if(!t)return;const b=t.booking||{},p=t.responsibleParty||{}; $('#transportId').value=t.id;$('#transportStatus').value=t.status||'unknown';$('#transportDate').value=t.date||'';$('#transportFrom').value=t.from||'';$('#transportTo').value=t.to||'';$('#transportMode').value=t.mode||'';$('#ownerType').value=p.type||'other';$('#ownerName').value=p.name||'';$('#ownerOrganization').value=p.organization||'';$('#ownerContact').value=p.contact||'';$('#serviceNumber').value=b.serviceNumber||'';$('#confirmation').value=b.confirmation||'';$('#ticketNumber').value=b.ticketNumber||'';$('#seat').value=b.seat||'';$('#car').value=b.car||'';$('#departureTime').value=(b.departureTime||'').match(/^\d\d:\d\d$/)?b.departureTime:'';$('#arrivalTime').value=(b.arrivalTime||'').match(/^\d\d:\d\d$/)?b.arrivalTime:'';$('#terminal').value=b.terminal||'';$('#gate').value=b.gate||'';$('#localDestination').value=t.localDestination||'';$('#transportNote').value=t.note||'';$('#transportDialog').showModal(); }
function bindEditButtons(){ $$('[data-edit-transport]').forEach(b=>b.onclick=()=>openTransportEditor(b.dataset.editTransport)); $$('[data-edit-event]').forEach(b=>b.onclick=()=>openEventDialog(b.dataset.editEvent)); }
$('#transportForm').addEventListener('submit',e=>{e.preventDefault(); const id=$('#transportId').value, current=state.trip.transport.find(x=>x.id===id)||{}, oldB=current.booking||{}; state.edits.transport[id]={status:$('#transportStatus').value,date:$('#transportDate').value,from:$('#transportFrom').value,to:$('#transportTo').value,mode:$('#transportMode').value,responsibleParty:{type:$('#ownerType').value,name:$('#ownerName').value,organization:$('#ownerOrganization').value,contact:$('#ownerContact').value},booking:{...oldB,serviceNumber:$('#serviceNumber').value,confirmation:$('#confirmation').value,ticketNumber:$('#ticketNumber').value,seat:$('#seat').value,car:$('#car').value,departureTime:$('#departureTime').value,arrivalTime:$('#arrivalTime').value,terminal:$('#terminal').value,gate:$('#gate').value},localDestination:$('#localDestination').value,note:$('#transportNote').value}; saveEdits(); $('#transportDialog').close();});
function openEventDialog(id=''){ $('#eventForm').reset(); $('#eventId').value=id||''; const x=id?state.trip?.itinerary.find(i=>i.id===id):null; $('#eventDialogTitle').textContent=x?'Edit itinerary item':'Add itinerary item'; $('#eventDate').value=x?.date||todayISO(); $('#eventTime').value=x?.time||''; $('#eventEndTime').value=x?.endTime||''; $('#eventType').value=x?.type||'Work'; $('#eventTitle').value=x?.title||''; $('#eventLocation').value=x?.location||''; $('#eventLocalAddress').value=x?.localAddress||''; $('#eventNote').value=x?.note||''; $('#eventDialog').showModal(); }
$('#eventForm').addEventListener('submit',e=>{e.preventDefault(); const id=$('#eventId').value,date=$('#eventDate').value,leg=activeLeg(date),patch={legId:leg?.id||'',date,time:$('#eventTime').value,endTime:$('#eventEndTime').value,title:$('#eventTitle').value,type:$('#eventType').value,location:$('#eventLocation').value,localAddress:$('#eventLocalAddress').value,note:$('#eventNote').value}; if(id){ const addedIndex=(state.edits.addedItinerary||[]).findIndex(x=>x.id===id); if(addedIndex>=0)state.edits.addedItinerary[addedIndex]={...state.edits.addedItinerary[addedIndex],...patch}; else state.edits.itinerary[id]=patch; } else state.edits.addedItinerary.push({id:crypto.randomUUID(),...patch,source:'local'}); saveEdits(); $('#eventDialog').close();});
$$('[data-close-dialog]').forEach(b=>b.onclick=()=>$('#'+b.dataset.closeDialog).close());
function empty(){ return `<div class="empty"><h3>Load a trip</h3><p>Import a trip JSON package or load one of the samples from the ••• menu.</p></div>`; }
function bindCommon(){ $$('[data-jump]').forEach(b=>b.onclick=()=>switchView(b.dataset.jump)); }
function renderAll(){ $('#tripLabel').textContent=state.trip?.name||'No trip loaded';renderPrep();renderToday();renderJourney();renderExplore();renderPocket();bindCommon(); }
function switchView(id){ $$('.view').forEach(v=>v.classList.toggle('active',v.id===id));$$('.tab').forEach(t=>t.classList.toggle('active',t.dataset.view===id)); }
$$('.tab').forEach(t=>t.onclick=()=>switchView(t.dataset.view));
$('#tripMenuBtn').onclick=()=>$('#tripDialog').showModal();
$('#tripFile').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{setTrip(JSON.parse(await f.text()));$('#tripDialog').close();switchView('prep');}catch(err){alert('Trip file could not be loaded: '+err.message)}};
$('#loadAsia').onclick=async()=>{setTrip(await fetchTrip('trips/asia-2026.sample.json'));$('#tripDialog').close();switchView('prep');};
$('#loadAntigua').onclick=async()=>{setTrip(await fetchTrip('trips/antigua.sample.json'));$('#tripDialog').close();switchView('prep');};
$('#clearTrip').onclick=()=>{localStorage.removeItem('veyos.activeTrip');state.baseTrip=null;state.trip=null;state.edits=null;renderAll();$('#tripDialog').close();};
$('#resetEdits').onclick=()=>{if(confirm('Reset all changes you made on this device for this trip?'))resetEdits();$('#tripDialog').close();};
$('#exportTrip').onclick=()=>{if(!state.trip)return;const b=new Blob([JSON.stringify(state.trip,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=`${state.trip.id||'veyos-trip'}.working.json`;a.click();URL.revokeObjectURL(a.href);};
const saved=localStorage.getItem('veyos.activeTrip');if(saved){try{state.baseTrip=normalizeTrip(JSON.parse(saved));state.edits=loadEdits(state.baseTrip.id);state.trip=applyEdits(state.baseTrip,state.edits);}catch{}}
renderAll();
if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});
