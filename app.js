const state = { trip: null };
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));
const todayISO = () => new Date().toISOString().slice(0,10);

async function fetchTrip(path){ const r=await fetch(path); if(!r.ok) throw new Error(`Unable to load ${path}`); return r.json(); }
function setTrip(trip){
  state.trip = normalizeTrip(trip);
  localStorage.setItem('veyos.activeTrip', JSON.stringify(state.trip));
  renderAll();
}
function normalizeTrip(t){
  return {
    ...t,
    schemaVersion:3,
    id:t.id||crypto.randomUUID(), name:t.name||'Untitled Trip', travelers:t.travelers||[],
    startDate:t.startDate||'', endDate:t.endDate||'', homeTimeZone:t.homeTimeZone||'America/New_York',
    regions:t.regions||[], legs:t.legs||[], itinerary:t.itinerary||[], places:t.places||[],
    transport:(t.transport||[]).map(normalizeTransport), pocket:t.pocket||{}, preferences:t.preferences||{},
    unresolved:t.unresolved||[]
  };
}
function normalizeTransport(t){
  return {
    ...t,
    id:t.id||crypto.randomUUID(),
    status:t.status||'unknown',
    responsibleParty:t.responsibleParty||{},
    booking:t.booking||{},
    links:t.links||[]
  };
}
function activeLeg(){
  if(!state.trip) return null; const d=todayISO();
  return state.trip.legs.find(x=>d>=x.startDate&&d<=x.endDate) || state.trip.legs.find(x=>d<=x.endDate) || state.trip.legs.at(-1) || null;
}
function activeRegion(){
  const leg=activeLeg(); if(!state.trip||!leg) return null;
  return state.trip.regions.find(r=>r.id===leg.regionId) || state.trip.regions.find(r=>r.country===leg.country) || null;
}
function todaysItems(){
  if(!state.trip) return []; const d=todayISO();
  const exact=state.trip.itinerary.filter(x=>x.date===d);
  if(exact.length) return exact;
  const leg=activeLeg(); return leg ? state.trip.itinerary.filter(x=>x.legId===leg.id).slice(0,6) : [];
}
function activeTransport(){
  if(!state.trip) return [];
  const leg=activeLeg();
  const d=todayISO();
  const exact=state.trip.transport.filter(t=>t.date===d);
  if(exact.length) return exact.slice(0,4);
  return leg ? state.trip.transport.filter(t=>t.legId===leg.id).slice(0,4) : state.trip.transport.slice(0,4);
}
function appleMapUrl(p){
  const q = p.lat&&p.lon ? `${p.lat},${p.lon}` : [p.name,p.address].filter(Boolean).join(' ');
  return `https://maps.apple.com/?q=${encodeURIComponent(q)}`;
}
function datePretty(s){ if(!s) return ''; const d=new Date(`${s}T12:00:00`); return d.toLocaleDateString(undefined,{month:'short',day:'numeric'}); }
function regionKey(region){ return `${state.trip?.id||'trip'}:${region?.id||'region'}:readiness`; }
function readinessState(region){
  if(!region) return {}; try{return JSON.parse(localStorage.getItem(regionKey(region))||'{}')}catch{return {}};
}
function setReady(region,id,value){
  const r=readinessState(region); r[id]=value; localStorage.setItem(regionKey(region),JSON.stringify(r)); renderAll();
}
function serviceLink(service){ return service?.webUrl || service?.appStoreUrl || '#'; }
function actionButton(label,href,cls='mini'){ return href&&href!=='#' ? `<a class="${cls}" href="${esc(href)}" target="_blank" rel="noopener">${esc(label)}</a>` : ''; }

const TRANSPORT_STATES = {
  confirmed:{label:'Confirmed',symbol:'✓',className:'confirmed'},
  provider_confirmed:{label:'Provider owns it',symbol:'◐',className:'provider'},
  action_required:{label:'Action required',symbol:'⚠',className:'action'},
  unbooked:{label:'Not booked',symbol:'?',className:'missing'},
  unknown:{label:'Needs detail',symbol:'?',className:'missing'}
};
function transportState(t){ return TRANSPORT_STATES[t.status] || TRANSPORT_STATES.unknown; }
function partyLabel(t){
  const p=t.responsibleParty||{};
  return p.organization || p.name || (p.type==='traveler'?'Traveler':p.type==='supplier'?'Supplier':'Unassigned');
}
function bookingPrimary(t){
  const b=t.booking||{};
  return [b.carrier,b.serviceNumber].filter(Boolean).join(' ') || t.mode || 'Transport';
}
function bookingDetails(t){
  const b=t.booking||{};
  const bits=[];
  if(b.confirmation) bits.push(`Confirmation ${b.confirmation}`);
  if(b.ticketNumber) bits.push(`Ticket ${b.ticketNumber}`);
  if(b.seat) bits.push(`Seat ${b.seat}`);
  if(b.car) bits.push(`Car ${b.car}`);
  if(b.terminal) bits.push(`Terminal ${b.terminal}`);
  if(b.gate) bits.push(`Gate ${b.gate}`);
  return bits;
}
function transportLinks(t){
  const b=t.booking||{};
  const links=[];
  if(b.statusUrl) links.push(actionButton('Live status',b.statusUrl,'mini primary'));
  if(b.bookingUrl) links.push(actionButton('View booking',b.bookingUrl));
  if(b.ticketUrl) links.push(actionButton('View ticket',b.ticketUrl));
  (t.links||[]).forEach(l=>links.push(actionButton(l.label,l.url)));
  return links.join('');
}
function renderTransportCard(t){
  const s=transportState(t), details=bookingDetails(t), owner=partyLabel(t), b=t.booking||{};
  const schedule=[b.departureTime,b.arrivalTime].filter(Boolean).join(' → ');
  const links=transportLinks(t);
  return `<div class="card transport-card ${esc(s.className)}">
    <div class="transport-head">
      <div>
        <div class="kicker">${esc(bookingPrimary(t))}${t.date?` · ${esc(datePretty(t.date))}`:''}${schedule?` · ${esc(schedule)}`:''}</div>
        <h3>${esc(t.from||'Origin')} → ${esc(t.to||'Destination')}</h3>
      </div>
      <span class="transport-status ${esc(s.className)}">${esc(s.symbol)} ${esc(s.label)}</span>
    </div>
    <div class="transport-owner"><span>Who gets me there</span><b>${esc(owner)}</b>${t.responsibleParty?.contact?`<small>${esc(t.responsibleParty.contact)}</small>`:''}</div>
    ${details.length?`<div class="booking-grid">${details.map(x=>`<span>${esc(x)}</span>`).join('')}</div>`:''}
    ${t.localDestination?`<p class="local-address">${esc(t.localDestination)}</p>`:''}
    ${t.note?`<p>${esc(t.note)}</p>`:''}
    ${links?`<div class="inline-actions">${links}</div>`:''}
  </div>`;
}
function transportReadinessSummary(){
  const ts=state.trip?.transport||[];
  const counts={confirmed:0,provider_confirmed:0,action_required:0,unbooked:0,unknown:0};
  ts.forEach(t=>counts[t.status] = (counts[t.status]||0)+1);
  const problem=counts.action_required+counts.unbooked+counts.unknown;
  return `<div class="readiness-summary">
    <span><b>${ts.length}</b><small>transport legs</small></span>
    <span><b>${counts.confirmed+counts.provider_confirmed}</b><small>covered</small></span>
    <span class="${problem?'warn-text':''}"><b>${problem}</b><small>need attention</small></span>
  </div>`;
}

function renderRegionStrip(region){
  if(!region) return '';
  const services=(region.services||[]).slice(0,3);
  return `<div class="region-strip"><div><div class="kicker">Local toolkit · ${esc(region.name)}</div><div class="tool-row">${services.map(s=>actionButton(s.name,serviceLink(s),'tool-pill')).join('')}</div></div><button class="mini" data-jump="pocket">Details</button></div>`;
}
function renderReadiness(region){
  if(!region?.readiness?.length) return '';
  const saved=readinessState(region);
  const complete=region.readiness.filter(x=>saved[x.id]===true).length;
  return `<div class="section-title">${esc(region.name)} readiness · ${complete}/${region.readiness.length}</div>
    <div class="card readiness">${region.readiness.map(x=>`<label class="ready-row"><input type="checkbox" data-ready="${esc(x.id)}" ${saved[x.id]===true?'checked':''}/><span><b>${esc(x.label)}</b>${x.note?`<small>${esc(x.note)}</small>`:''}</span>${x.required?'<em>Required</em>':''}</label>`).join('')}</div>`;
}
function renderToday(){
  const el=$('#today'); if(!state.trip){el.innerHTML=empty();return;}
  const leg=activeLeg(), region=activeRegion(), items=todaysItems(), transport=activeTransport(), place=leg?.city||leg?.name||state.trip.name;
  el.innerHTML=`<div class="hero"><div class="kicker">${esc(leg?.country||'Active journey')}</div><h1>${esc(place)}</h1><div class="muted">${esc(state.trip.travelers.join(' + '))}${leg?.stay?.name?` · ${esc(leg.stay.name)}`:''}</div><div class="actions"><button class="action" data-jump="journey">Travel<small>handoffs + bookings</small></button><button class="action" data-jump="explore">Nearby<small>use this leg's places</small></button><button class="action" data-jump="pocket">Pocket<small>addresses + local tools</small></button><button class="action" id="openStay">Home base<small>${esc(leg?.stay?.name||'not set')}</small></button></div></div>
  ${renderRegionStrip(region)}
  ${transport.length?`<div class="section-title">Getting from A → B</div>${transport.map(renderTransportCard).join('')}`:''}
  <div class="section-title">${items.length?'Today / current leg':'No itinerary items'}</div>${items.map(renderItem).join('')||'<div class="empty">Import itinerary items to populate Today.</div>'}
  ${renderReadiness(region)}`;
  bindCommon();
  $('#openStay')?.addEventListener('click',()=>{if(leg?.stay) location.href=appleMapUrl({name:leg.stay.name,address:leg.stay.address,lat:leg.stay.lat,lon:leg.stay.lon});});
  $$('[data-ready]').forEach(x=>x.onchange=()=>setReady(region,x.dataset.ready,x.checked));
}
function renderItem(x){
  const links=(x.links||[]).map(l=>actionButton(l.label,l.url)).join('');
  return `<div class="card row"><div class="time">${esc(x.time||'')}</div><div class="grow"><h3>${esc(x.title)}</h3>${x.location?`<p>${esc(x.location)}</p>`:''}${x.localAddress?`<p class="local-address">${esc(x.localAddress)}</p>`:''}${x.note?`<p>${esc(x.note)}</p>`:''}${x.type?`<span class="chip">${esc(x.type)}</span>`:''}${links?`<div class="inline-actions">${links}</div>`:''}</div></div>`;
}
function renderJourney(){
  const el=$('#journey'); if(!state.trip){el.innerHTML=empty();return;}
  const transport=state.trip.transport||[], unresolved=state.trip.unresolved||[];
  el.innerHTML=`<div class="section-title">${esc(state.trip.name)} · ${datePretty(state.trip.startDate)}–${datePretty(state.trip.endDate)}</div>
  ${transportReadinessSummary()}
  <div class="timeline">${state.trip.legs.map(l=>`<div class="leg"><div class="kicker">${datePretty(l.startDate)}–${datePretty(l.endDate)}</div><h3>${esc(l.city||l.name)}${l.country?`, ${esc(l.country)}`:''}</h3>${l.purpose?`<p class="muted">${esc(l.purpose)}</p>`:''}${l.stay?.name?`<div class="chip">Stay · ${esc(l.stay.name)}</div>`:''}</div>`).join('')}</div>
  ${transport.length?`<div class="section-title">Transport chain of custody</div>${transport.map(renderTransportCard).join('')}`:''}
  ${unresolved.length?`<div class="section-title">Open travel items</div>${unresolved.map(x=>`<div class="card unresolved"><div class="kicker">${esc(x.date||'Open')}</div><h3>${esc(x.item||x.title||'Unresolved item')}</h3></div>`).join('')}`:''}`;
}
function renderExplore(){
  const el=$('#explore'); if(!state.trip){el.innerHTML=empty();return;}
  const leg=activeLeg(), region=activeRegion(); const places=state.trip.places.filter(p=>!p.legId||!leg||p.legId===leg.id);
  const localMap=(region?.services||[]).find(s=>s.role==='maps');
  el.innerHTML=`<div class="section-title">Explore · ${esc(leg?.city||state.trip.name)}</div>${places.map(p=>`<div class="card place-card"><div><h3>${esc(p.name)}</h3><p>${esc(p.blurb||p.address||'')}</p>${p.localAddress?`<p class="local-address">${esc(p.localAddress)}</p>`:''}${p.category?`<span class="chip">${esc(p.category)}</span>`:''}${p.zone?`<span class="chip">${esc(p.zone)}</span>`:''}</div><div class="place-actions">${actionButton('Apple Maps',appleMapUrl(p))}${localMap?actionButton(localMap.name,serviceLink(localMap)):''}</div></div>`).join('')||'<div class="empty">No places loaded for this leg.</div>'}`;
}
function renderPocket(){
  const el=$('#pocket'); if(!state.trip){el.innerHTML=empty();return;}
  const leg=activeLeg(), region=activeRegion(), p=state.trip.pocket||{};
  const docs=(p.documents||[]).map(d=>`<div class="card doc"><div><h3>${esc(d.title)}</h3><p>${esc(d.note||d.type||'')}</p></div><span class="status">${d.status?'✓ '+esc(d.status):''}</span></div>`).join('');
  const services=(region?.services||[]).map(s=>`<div class="card service-card"><div><div class="kicker">${esc(s.role||'Local service')}</div><h3>${esc(s.name)}</h3><p>${esc(s.note||'')}</p></div><div class="service-actions">${actionButton('Open',s.webUrl)}${actionButton('App Store',s.appStoreUrl)}</div></div>`).join('');
  const guidance=(region?.guidance||[]).map(g=>`<div class="card"><h3>${esc(g.title)}</h3><p>${esc(g.text)}</p></div>`).join('');
  el.innerHTML=`<div class="section-title">Current leg</div>${leg?.stay?`<div class="card"><h3>${esc(leg.stay.name)}</h3><p>${esc(leg.stay.address||'')}</p>${leg.stay.localAddress?`<p class="local-address">${esc(leg.stay.localAddress)}</p>`:''}<a class="chip" href="${appleMapUrl({name:leg.stay.name,address:leg.stay.address})}">Open in Apple Maps</a></div>`:''}
  ${region?`<div class="section-title">${esc(region.name)} local toolkit</div>${services||'<div class="empty">No regional services loaded.</div>'}${guidance}`:''}
  ${(p.quick||[]).map(q=>`<div class="card"><h3>${esc(q.label)}</h3><p>${esc(q.value)}</p>${q.local?`<p class="local-address">${esc(q.local)}</p>`:''}</div>`).join('')}<div class="section-title">Documents</div>${docs||'<div class="empty">No pocket documents loaded.</div>'}`;
}
function empty(){return `<div class="empty"><h3>Load a trip</h3><p>Import a trip JSON package or load one of the samples from the ••• menu.</p></div>`}
function bindCommon(){ $$('[data-jump]').forEach(b=>b.onclick=()=>switchView(b.dataset.jump)); }
function renderAll(){ $('#tripLabel').textContent=state.trip?.name||'No trip loaded'; renderToday();renderJourney();renderExplore();renderPocket(); bindCommon(); }
function switchView(id){ $$('.view').forEach(v=>v.classList.toggle('active',v.id===id)); $$('.tab').forEach(t=>t.classList.toggle('active',t.dataset.view===id)); }
$$('.tab').forEach(t=>t.onclick=()=>switchView(t.dataset.view));
$('#tripMenuBtn').onclick=()=>$('#tripDialog').showModal();
$('#tripFile').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{setTrip(JSON.parse(await f.text()));$('#tripDialog').close();}catch(err){alert('Trip file could not be loaded: '+err.message)}};
$('#loadAsia').onclick=async()=>{setTrip(await fetchTrip('trips/asia-2026.sample.json'));$('#tripDialog').close();};
$('#loadAntigua').onclick=async()=>{setTrip(await fetchTrip('trips/antigua.sample.json'));$('#tripDialog').close();};
$('#clearTrip').onclick=()=>{localStorage.removeItem('veyos.activeTrip');state.trip=null;renderAll();$('#tripDialog').close();};
$('#exportTrip').onclick=()=>{if(!state.trip)return;const b=new Blob([JSON.stringify(state.trip,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=`${state.trip.id||'veyos-trip'}.json`;a.click();URL.revokeObjectURL(a.href);};
const saved=localStorage.getItem('veyos.activeTrip'); if(saved){try{state.trip=normalizeTrip(JSON.parse(saved));}catch{}}
renderAll();
if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(()=>{});
