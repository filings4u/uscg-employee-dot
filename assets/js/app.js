(()=>{'use strict';
const C=window.PORTAL_CONFIG;
const sb=window.supabase.createClient(C.workforceUrl,C.workforceKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const $=(s,r=document)=>r.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=v=>String(v||'').toLowerCase().replaceAll('-','_');
const pretty=v=>String(v??'—').replaceAll('_',' ').replace(/\b\w/g,x=>x.toUpperCase());
const fmt=v=>{if(!v)return'—';const d=new Date(v);return Number.isNaN(d.getTime())?esc(v):new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric'}).format(d)};
const money=v=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(v||0));
const statusClass=v=>/active|complete|completed|paid|eligible|final|negative|acknowledged|available|enabled/i.test(String(v))?'good':/cancel|inactive|terminated|positive|suspended|overdue|failed|closed/i.test(String(v))?'bad':'warn';
const badge=v=>`<span class="badge ${statusClass(v)}">${esc(pretty(v))}</span>`;
const page=()=>location.pathname.split('/').pop()?.replace('.html','')||'dashboard';
const storageKey=()=>`s4u_${C.portalCode}_membership`;
const brandCacheKey=id=>`s4u_${C.portalCode}_branding_${id||'default'}`;
function readBrandCache(id){if(!id)return null;try{const x=JSON.parse(localStorage.getItem(brandCacheKey(id))||'null');if(!x||Date.now()-Number(x.saved_at||0)>1800000)return null;return x}catch{return null}}
function writeBrandCache(id,branding){if(!id)return;try{localStorage.setItem(brandCacheKey(id),JSON.stringify({saved_at:Date.now(),branding:branding||null}))}catch{}}
function primeBranding(b){if(!b)return;const primary=/^#[0-9a-f]{6}$/i.test(b.primary_color||'')?b.primary_color:'#24467f',accent=/^#[0-9a-f]{6}$/i.test(b.accent_color||'')?b.accent_color:'#ff6b00',root=document.documentElement;root.style.setProperty('--navy',primary);root.style.setProperty('--navy2',darkenHex(primary,.3));root.style.setProperty('--blue',primary);root.style.setProperty('--orange',accent)}
const SUPPORT_CTX_KEY='s4u_support_context';
function supportCtxRead(){try{return JSON.parse(sessionStorage.getItem(SUPPORT_CTX_KEY)||'{}')||{}}catch{return{}}}
function supportCtxWrite(patch={}){try{sessionStorage.setItem(SUPPORT_CTX_KEY,JSON.stringify({...supportCtxRead(),...patch}))}catch{}}
function rememberSupportPage(){if(page()==='support')return;supportCtxWrite({page_url:location.href,page_title:document.title,page_id:page(),captured_at:new Date().toISOString()})}
function rememberSupportError(message,source='page'){const m=String(message||'').trim();if(!m||m.length<2)return;supportCtxWrite({error_message:m.slice(0,12000),error_source:source,error_at:new Date().toISOString(),page_url:location.href,page_title:document.title,page_id:page()})}
function installSupportDiagnostics(){
  window.addEventListener('error',e=>rememberSupportError(e?.message||e?.error?.message||'JavaScript error','window.error'),true);
  window.addEventListener('unhandledrejection',e=>rememberSupportError(e?.reason?.message||e?.reason||'Unhandled promise rejection','unhandledrejection'));
  const scan=()=>{if(page()==='support')return;const sels=['#error','[data-error]','.testing-modal-error','.documents-error','.selection-error','[role="alert"]'];for(const el of document.querySelectorAll(sels.join(','))){const t=String(el.textContent||'').trim();if(t&&!el.hidden&&t.length>1){rememberSupportError(t,'page-message');break}}};
  const start=()=>{rememberSupportPage();scan();const mo=new MutationObserver(scan);mo.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['hidden','class']});};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
}
installSupportDiagnostics();
const stored=()=>localStorage.getItem(storageKey())||'';
const saveMid=v=>{if(v)localStorage.setItem(storageKey(),v)};
let NAV=[];
const cfgPage=id=>NAV.find(x=>norm(x.id)===norm(id))||{id,label:pretty(id),icon:'•',href:`/${id}.html`};

let activeSession=null;async function getSession(){if(activeSession&&(!activeSession.expires_at||activeSession.expires_at*1000-Date.now()>30000))return activeSession;const {data:{session},error}=await sb.auth.getSession();if(error)throw error;activeSession=session||null;return activeSession}
async function invoke(name,body={}){
  const s=await getSession();if(!s)throw Object.assign(new Error('AUTH_REQUIRED'),{status:401});
  const r=await fetch(`${C.workforceUrl}/functions/v1/${name}`,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${s.access_token}`,'apikey':C.workforceKey},body:JSON.stringify({portal_code:C.portalCode,membership_id:stored()||undefined,...body})});
  const d=await r.json().catch(()=>({}));
  if(!r.ok||d.error)throw Object.assign(new Error(d.error||`Request failed (${r.status}).`),{status:r.status,payload:d});
  return d;
}
async function access(){const b={requested_portal_code:C.portalCode,requested_page:page()};if(stored())b.membership_id=stored();return invoke('workforce-session-context',b)}
function darkenHex(hex,amount=.22){const m=/^#([0-9a-f]{6})$/i.exec(String(hex||''));if(!m)return'#0b2747';const n=parseInt(m[1],16),f=1-amount,r=Math.max(0,Math.round(((n>>16)&255)*f)),g=Math.max(0,Math.round(((n>>8)&255)*f)),b=Math.max(0,Math.round((n&255)*f));return'#'+[r,g,b].map(x=>x.toString(16).padStart(2,'0')).join('')}
function setBrandLogo(src,alt){const logo=document.querySelector('.brand img');if(!logo)return;const fallback='/assets/img/logo.png';logo.classList.remove('brand-logo-ready');logo.alt=alt||C.label;logo.onload=()=>logo.classList.add('brand-logo-ready');logo.onerror=()=>{if(logo.dataset.fallback==='1'){logo.classList.add('brand-logo-ready');return}logo.dataset.fallback='1';logo.alt=C.label;logo.src=fallback};logo.dataset.fallback=src===fallback?'1':'0';logo.src=src||fallback;if(logo.complete&&logo.naturalWidth)logo.classList.add('brand-logo-ready')}
function applyBranding(b,ctx){if(!b)return;const primary=/^#[0-9a-f]{6}$/i.test(b.primary_color||'')?b.primary_color:'#24467f',accent=/^#[0-9a-f]{6}$/i.test(b.accent_color||'')?b.accent_color:'#ff6b00',name=isCtpaCustomer(ctx)?ctpaName(ctx):(b.portal_name||(C.kind==='agency'?ctx?.membership?.organization_name:null)||ctx?.subscription?.plan_name||C.label),root=document.documentElement;root.style.setProperty('--navy',primary);root.style.setProperty('--navy2',darkenHex(primary,.3));root.style.setProperty('--blue',primary);root.style.setProperty('--orange',accent);document.body.dataset.whiteLabel='true';const navTitle=document.querySelector('.nav-title');if(navTitle)navTitle.textContent=name;const crumb=document.querySelector('.crumb');if(crumb)crumb.textContent=`${name} / ${cfgPage(page()).label}`;const kicker=document.querySelector('.hero-kicker');if(kicker)kicker.textContent=name;const foot=document.querySelector('.side-foot div:last-child');if(foot)foot.textContent='Employer Portal';document.title=`${cfgPage(page()).label} | ${name}`;const meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.setAttribute('content',primary)}
function applyPlatformBranding(ctx){const root=document.documentElement;for(const k of ['--navy','--navy2','--blue','--orange'])root.style.removeProperty(k);delete document.body.dataset.whiteLabel;const plan=isCtpaCustomer(ctx)?ctpaName(ctx):(String((C.kind==='agency'?ctx?.membership?.organization_name:null)||ctx?.subscription?.plan_name||C.label)),navTitle=document.querySelector('.nav-title');if(navTitle)navTitle.textContent=plan;const crumb=document.querySelector('.crumb');if(crumb)crumb.textContent=`${plan} / ${cfgPage(page()).label}`;const kicker=document.querySelector('.hero-kicker');if(kicker)kicker.textContent=plan;document.title=`${cfgPage(page()).label} | ${plan}`;const meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.setAttribute('content','#102f55')}
async function fetchBranding(){return invoke('workforce-employer-management',{action:'branding'})}
async function loadBranding(ctx,prefetched=null){let branding=null;try{const d=prefetched?await prefetched:await fetchBranding();if(d?.customer_ctpa)setCtpaRelationship(ctx,d.customer_ctpa);branding=d?.branding||null;writeBrandCache(ctx?.membership?.id,branding);if(branding)applyBranding(branding,ctx);else applyPlatformBranding(ctx);refreshCustomerName(ctx)}catch(e){console.warn('Employer branding unavailable',e);const cached=readBrandCache(ctx?.membership?.id);branding=cached?.branding||null;if(branding)applyBranding(branding,ctx);refreshCustomerName(ctx)}const name=isCtpaCustomer(ctx)?ctpaName(ctx):(branding?.portal_name||(C.kind==='agency'?ctx?.membership?.organization_name:null)||ctx?.subscription?.plan_name||C.label);setBrandLogo(branding?.logo_path||'/assets/img/logo.png',name);return branding}

function shell(ctx){
  const current=page();
  document.body.dataset.portalPage=norm(current);
  NAV=Array.isArray(ctx?.navigation)?ctx.navigation:[];
  const planLabel=isCtpaCustomer(ctx)?ctpaName(ctx):(String((C.kind==='agency'?ctx?.membership?.organization_name:null)||ctx?.subscription?.plan_name||C.label));
  const links=NAV.map(x=>`<a href="${esc(x.href||('/'+x.id+'.html'))}" class="${norm(current)===norm(x.id)?'active':''}"${norm(current)===norm(x.id)?' aria-current="page"':''}><span class="ico">${esc(x.icon||'•')}</span><span>${esc(x.label||pretty(x.id))}</span></a>`).join('');
  document.title=`${cfgPage(current).label} | ${planLabel}`;
  document.body.className='loading';
  document.body.innerHTML=`<div class="app"><aside class="side" id="side"><div class="brand"><img class="brand-logo" alt="" aria-hidden="true"></div><nav class="nav"><div class="nav-title">${esc(planLabel)}</div>${links}</nav><div class="side-foot"><div style="font-size:9px;color:#9fb3c7">Portal</div><div style="font-size:11px;font-weight:800;color:#fff;margin-top:3px">${esc(C.domain)}</div></div></aside><main class="main"><header class="top"><div class="top-left"><button class="menu" id="menu" type="button" aria-label="Open navigation" aria-expanded="false" aria-controls="mobileNav"><span class="menu-bars" aria-hidden="true"><span></span><span></span><span></span></span></button><span class="crumb">${esc(planLabel)} / ${esc(cfgPage(current).label)}</span></div><div class="top-right"><span class="pill">${esc(C.kind==='self'?'Self Service':'Management')}</span>${C.agency?`<span class="pill">${esc(C.agency)}</span>`:''}<button class="top-support${norm(current)==='support'?' active':''}" id="supportShortcut" type="button"${norm(current)==='support'?' aria-current="page"':''}>Support</button><button class="signout" id="logout">Sign out</button></div></header><section class="mobile-nav" id="mobileNav" aria-hidden="true" aria-label="Portal navigation"><div class="mobile-nav-inner"><div class="mobile-nav-head"><div><span>Portal navigation</span><strong>${esc(planLabel)}</strong></div><span class="mobile-nav-current">${esc(cfgPage(current).label)}</span></div><nav class="mobile-nav-links">${links}</nav><div class="mobile-nav-foot"><span>${esc(C.domain)}</span><small>Select a page to close this menu.</small></div></div></section><div class="content"><div id="error"></div><section class="hero"><span class="hero-kicker">${esc(planLabel)}</span><h1>${esc(cfgPage(current).label)}</h1><p id="subtitle">Loading portal workspace.</p><div class="hero-actions" id="actions"></div></section><section class="section" id="content"><div class="panel"><div class="loading-msg">Loading…</div></div></section></div></main></div>`;
  const menuBtn=$('#menu'),mobileNav=$('#mobileNav');
  const setMobileNav=open=>{
    const isMobile=window.matchMedia('(max-width: 820px)').matches;
    const next=!!open&&isMobile;
    mobileNav?.classList.toggle('open',next);
    document.body.classList.toggle('mobile-nav-open',next);
    menuBtn?.classList.toggle('open',next);
    menuBtn?.setAttribute('aria-expanded',String(next));
    menuBtn?.setAttribute('aria-label',next?'Close navigation':'Open navigation');
    mobileNav?.setAttribute('aria-hidden',String(!next));
  };
  if(menuBtn&&mobileNav){
    menuBtn.onclick=()=>setMobileNav(!mobileNav.classList.contains('open'));
    mobileNav.addEventListener('click',e=>{if(e.target.closest('a'))setMobileNav(false)});
    window.addEventListener('resize',()=>{if(window.innerWidth>820)setMobileNav(false)},{passive:true});
    document.addEventListener('keydown',e=>{if(e.key==='Escape')setMobileNav(false)});
  }
  const supportShortcut=$('#supportShortcut');
  if(supportShortcut)supportShortcut.onclick=()=>{
    if(norm(current)!=='support')supportCtxWrite({page_url:location.href,page_title:document.title,page_id:current,captured_at:new Date().toISOString(),opened_from:'top_support'});
    if(norm(current)!=='support')location.href='/support.html';
  };
  $('#logout').onclick=async()=>{await sb.auth.signOut();location.replace('/login.html')};
}
function metric(label,value,note=''){return `<div class="metric"><small>${esc(label)}</small><strong>${esc(value)}</strong><span>${esc(note)}</span></div>`}
function read(o,keys){for(const k of keys){let v=o;for(const p of k.split('.'))v=v?.[p];if(v!==undefined&&v!==null&&v!=='')return v}return'—'}
const dateCell=v=>fmt(v),moneyCell=v=>money(v),badgeCell=v=>badge(v);
const COLS={
  employers:[['Employer',['legal_name','workforce_display_name']],['Status',['status'],badgeCell],['USDOT',['dot_number']],['Contact',['primary_contact_email']],['State',['state']]],
  employees:[['Name',['display_name','first_name']],['Employee #',['employee_number']],['Position',['job_title']],['Agency',['dot_agency']],['Status',['employment_status'],badgeCell]],
  programs:[['Program',['name']],['Type',['program_type'],badgeCell],['Agency',['dot_agency']],['Category',['regulatory_category']],['Status',['status'],badgeCell]],
  pools:[['Pool',['name']],['Type',['pool_type']],['Agency',['dot_agency']],['Drug Rate',['drug_random_rate']],['Status',['status'],badgeCell]],
  selections:[['Date',['selection_date','selected_at'],dateCell],['Type',['selection_type']],['Population',['population_size']],['Drug',['drug_selection_count','drug_selected']],['Status',['status'],badgeCell]],
  testing:[['Order',['order_number']],['Reason',['reason']],['Type',['test_type']],['Program',['programs.name','program_type']],['Status',['status'],badgeCell]],
  results:[['Order',['testing_orders.order_number','order_number']],['Result',['final_status','verified_result'],badgeCell],['Date',['result_date','finalized_at'],dateCell],['MRO',['mro_status'],badgeCell],['Status',['notification_status'],badgeCell]],
  compliance:[['Case',['case_number']],['Event',['event_type']],['Priority',['priority'],badgeCell],['Opened',['opened_at','created_at'],dateCell],['Status',['status'],badgeCell]],
  documents:[['File',['file_name','title']],['Type',['document_type']],['Uploaded',['uploaded_at','created_at'],dateCell],['Expires',['expires_at'],dateCell],['Access',['access_level'],badgeCell]],
  notifications:[['Subject',['subject','event_type']],['Channel',['channel']],['Status',['status'],badgeCell],['Queued',['queued_at'],dateCell]],
  invoices:[['Invoice',['invoice_number']],['Status',['status'],badgeCell],['Total',['total'],moneyCell],['Paid',['amount_paid'],moneyCell],['Due',['amount_due'],moneyCell]],
  credentials:[['Credential',['credential_type']],['Number',['credential_number']],['State',['issuing_state']],['Expires',['expires_at'],dateCell],['Status',['status'],badgeCell]],
  training:[['Training',['training_title','title']],['Provider',['provider']],['Status',['status'],badgeCell],['Completed',['completed_at'],dateCell],['Expires',['expires_at'],dateCell]],
  policies:[['Policy',['policy_name','ctpa_policy_documents.title']],['Status',['status'],badgeCell],['Distributed',['distributed_at'],dateCell],['Acknowledged',['acknowledged_at'],dateCell]],
  accidents:[['Occurred',['occurred_at'],dateCell],['Type',['accident_type']],['Required',['testing_required'],v=>badge(v===true?'required':v===false?'not required':'pending')],['Drug',['drug_test_required'],v=>badge(v===true?'required':'—')],['Alcohol',['alcohol_test_required'],v=>badge(v===true?'required':'—')]],
  members:[['User',['profiles.display_name','profiles.first_name','user_id']],['Role',['roles.name','roles.code']],['Status',['status'],badgeCell],['Primary',['is_primary'],v=>badge(v===true?'yes':'no')]]
};
function table(title,rows,cols){
  const body=rows.length?rows.map(r=>`<tr>${cols.map(c=>`<td>${c[2]?c[2](read(r,c[1])):esc(read(r,c[1]))}</td>`).join('')}</tr>`).join(''):`<tr><td colspan="${cols.length}"><div class="empty">No records available.</div></td></tr>`;
  return `<div class="panel"><div class="panel-head"><div><h2>${esc(title)}</h2></div><span class="badge">${rows.length} record${rows.length===1?'':'s'}</span></div><div class="table-wrap"><table><thead><tr>${cols.map(c=>`<th>${esc(c[0])}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table></div></div>`;
}
function workerFields(d,x={}){
  const fields=[
    {name:'first_name',label:'First name',required:true,value:x.first_name||''},{name:'middle_name',label:'Middle name',value:x.middle_name||''},{name:'last_name',label:'Last name',required:true,value:x.last_name||''},
    {name:'employee_number',label:'Employee / driver number',value:x.employee_number||''},{name:'date_of_birth',label:'Date of birth',type:'date',value:x.date_of_birth||''},{name:'hire_date',label:'Hire date',type:'date',value:x.hire_date||''},
    {name:'email',label:'Email',type:'email',value:x.email||''},{name:'mobile',label:'Mobile phone',type:'tel',value:x.mobile||''},{name:'job_title',label:'Job title',value:x.job_title||''},
    {name:'address_line1',label:'Address line 1',full:true,value:x.address_line1||''},{name:'address_line2',label:'Address line 2',full:true,value:x.address_line2||''},{name:'city',label:'City',value:x.city||''},{name:'state',label:'State',value:x.state||''},{name:'postal_code',label:'ZIP / postal code',value:x.postal_code||''},{name:'country',label:'Country',value:x.country||'US'},
    {name:'cdl_number',label:'CDL number',value:x.cdl_number||''},{name:'cdl_state',label:'CDL state',value:x.cdl_state||''},
    {name:'employment_status',label:'Employment status',type:'select',value:x.employment_status||'active',options:['active','leave','inactive','suspended','terminated'].map(v=>({value:v,label:pretty(v)}))}
  ];
  if((d.locations||[]).length)fields.push({name:'location_id',label:'Work location',type:'select',value:x.location_id||'',options:[{value:'',label:'No location assigned'},...(d.locations||[]).map(v=>({value:v.id,label:v.name||v.id}))]});
  const positions=(d.position_catalog||[]).filter(v=>!C.agency||String(v.agency_code||'').toUpperCase()===String(C.agency).toUpperCase());
  if(C.surface==='dot'&&positions.length)fields.push({name:'dot_position_id',label:'DOT safety-sensitive position',type:'select',required:true,value:x.dot_position_id||'',options:[{value:'',label:'Choose position'},...positions.map(v=>({value:v.id,label:v.title||v.code}))]});
  if(C.surface==='dot'&&!C.agency)fields.push({name:'dot_agency',label:'DOT Agency',type:'select',value:x.dot_agency||'FMCSA',options:['FMCSA','FAA','FRA','FTA','PHMSA','USCG'].map(v=>({value:v,label:v}))});
  if(x.id&&x.termination_date)fields.push({name:'termination_date',label:'Termination date',type:'date',value:x.termination_date});
  return fields;
}
function dPositionTitle(r,d){return (d.position_catalog||[]).find(x=>String(x.id)===String(r.dot_position_id))?.title||''}
function employeeTable(title,rows){
  const body=rows.length?rows.map(r=>`<tr><td><strong>${esc([r.first_name,r.middle_name,r.last_name].filter(Boolean).join(' ')||r.display_name||'—')}</strong>${r.email?`<small>${esc(r.email)}</small>`:''}</td><td>${esc(r.employee_number||'—')}</td><td>${esc((dPositionTitle(r,d)||r.job_title||'—'))}</td><td>${esc(r.dot_agency||'—')}</td><td>${badgeCell(r.employment_status||'—')}</td><td class="worker-actions"><button class="mini-btn" type="button" data-edit-worker="${esc(r.id)}">Edit</button></td></tr>`).join(''):`<tr><td colspan="6"><div class="empty">No records available.</div></td></tr>`;
  return `<div class="panel people-panel"><div class="panel-head"><div><h2>${esc(title)}</h2></div><span class="badge">${rows.length} record${rows.length===1?'':'s'}</span></div><div class="table-wrap"><table><thead><tr><th>Name</th><th>Employee #</th><th>Position</th><th>Agency</th><th>Status</th><th>Actions</th></tr></thead><tbody>${body}</tbody></table></div></div>`;
}
function bindWorkerEdits(d){
  document.querySelectorAll('[data-edit-worker]').forEach(btn=>btn.onclick=()=>{
    const worker=(d.employees||[]).find(x=>String(x.id)===String(btn.dataset.editWorker));if(!worker)return;
    modal('Edit Driver / Employee',workerFields(d,worker),async v=>invoke('workforce-employer-management',{action:'save_employee',employee:{...v,id:worker.id,dot_covered:true,safety_sensitive:worker.safety_sensitive!==false}}));
  });
}
function modal(title,fields,onSave){
  const b=document.createElement('div');b.className='modal-backdrop';
  const fieldHtml=fields.map(f=>{let input;if(f.type==='select')input=`<select name="${esc(f.name)}" ${f.required?'required':''}>${(f.options||[]).map(o=>`<option value="${esc(o.value)}" ${String(o.value)===String(f.value??'')?'selected':''}>${esc(o.label)}</option>`).join('')}</select>`;else if(f.type==='textarea')input=`<textarea name="${esc(f.name)}" rows="4" ${f.required?'required':''}>${esc(f.value||'')}</textarea>`;else input=`<input type="${esc(f.type||'text')}" name="${esc(f.name)}" value="${esc(f.value||'')}" ${f.required?'required':''}>`;return `<div class="field ${f.full?'full':''}"><label>${esc(f.label)}</label>${input}</div>`}).join('');
  b.innerHTML=`<form class="modal${fields.length>=10?' modal-wide':''}"><h2>${esc(title)}</h2><div class="modal-grid">${fieldHtml}</div><div class="modal-actions"><button type="button" class="btn ghost" data-cancel>Cancel</button><button type="submit" class="btn primary">Save</button></div></form>`;
  document.body.appendChild(b);b.querySelector('[data-cancel]').onclick=()=>b.remove();
  b.querySelector('form').onsubmit=async e=>{e.preventDefault();try{const v=Object.fromEntries(new FormData(e.currentTarget).entries());await onSave(v);b.remove();await render(window.portalCtx)}catch(err){alert(err.message||String(err))}};
}
function setSubtitle(v){$('#subtitle').textContent=v}
function addAction(label,fn,secondary=false){const b=document.createElement('button');b.className=`btn ${secondary?'secondary':'primary'}`;b.textContent=label;b.onclick=fn;$('#actions').appendChild(b)}

function isUtilityPage(p){return ['integrations','audit-history','locations','users-roles'].includes(norm(p).replaceAll('_','-'))}
async function utilityData(p){
  p=norm(p).replaceAll('_','-');
  if(C.kind==='self'){
    const a={integrations:'portal_integrations','audit-history':'audit_history',locations:'locations','users-roles':'users_roles'}[p];
    return invoke('workforce-employee-portal',{action:a,membership_id:stored()});
  }
  if(C.kind==='ctpa'){
    if(p==='integrations')return invoke('workforce-ctpa-admin',{action:'workspace',scope:'integrations'}).catch(e=>({integrations:[],not_enabled:true,message:e.message||String(e),access_mode:'view_only'}));
    if(p==='audit-history')return invoke('workforce-ctpa-admin',{action:'workspace',scope:'audit'});
    if(p==='locations')return invoke('workforce-ctpa-admin',{action:'workspace',scope:'locations'});
    if(p==='users-roles')return invoke('workforce-ctpa-admin',{action:'workspace',scope:'staff'}).then(x=>({...x,access_mode:x.can_manage?'manage':'view_only'})).catch(e=>({members:[],roles:[],not_enabled:true,message:e.message||String(e),access_mode:'view_only'}));
  }
  if(p==='integrations')return invoke('workforce-employer-advanced',{action:'integrations'}).catch(e=>({integrations:[],not_enabled:true,message:e.message||String(e),access_mode:'view_only'}));
  if(p==='audit-history')return invoke('workforce-employer-management',{action:'audit'});
  if(p==='locations')return invoke('workforce-employer-management',{action:'locations'});
  if(p==='users-roles')return invoke('workforce-employer-management',{action:'members'}).then(x=>({...x,access_mode:window.portalCtx?.membership?.role_code==='employer_admin'?'manage':'limited'}));
  return {};
}
function utilityPersonName(m){const p=m?.profile||m?.profiles||m?.actor_profile||{};return p.full_name||p.display_name||[p.first_name,p.last_name].filter(Boolean).join(' ')||m?.user_id||m?.actor_user_id||'Portal user'}
function utilityIntegrationsView(d){
  if(d?.not_enabled)return `<div class="notice"><strong>Integrations</strong><br>${esc(d.message||'Integrations are not enabled for this account yet.')}</div>`;
  const catalog=d.catalog||[],enable=d.enablements||[],legacy=d.integrations||[];
  const em=new Map(enable.map(x=>[String(x.integration_catalog_id),x]));
  const cards=catalog.map(x=>{const e=em.get(String(x.id)),on=e?.enabled===true||['active','enabled','connected'].includes(norm(e?.status));return `<article class="card utility-card"><div class="panel-head"><div><h3>${esc(x.name||x.code)}</h3><p>${esc(x.provider||x.category||'Integration')}</p></div>${badge(on?'enabled':(e?.status||'available'))}</div><p>${esc(x.description||'Connect this service to your DOT workspace.')}</p><small>${esc(x.category||'Integration')}</small></article>`}).join('');
  const rows=legacy.map(x=>`<tr><td><strong>${esc(x.name||x.provider||'Integration')}</strong><small>${esc(x.provider||x.integration_type||'')}</small></td><td>${badge(x.status||'unknown')}</td><td>${fmt(x.last_sync_at)}</td><td>${fmt(x.updated_at)}</td>${d.can_manage?`<td><button class="mini-btn" data-integration-id="${esc(x.id)}">Manage</button></td>`:''}</tr>`).join('');
  return `${cards?`<div class="cards utility-grid">${cards}</div>`:'<div class="panel"><div class="empty">No integration catalog entries are available.</div></div>'}${legacy.length?`<div class="section panel"><div class="panel-head"><div><h2>Connected Integrations</h2><p>Current tenant-level integration connections.</p></div></div><div class="table-wrap"><table><thead><tr><th>Integration</th><th>Status</th><th>Last Sync</th><th>Updated</th>${d.can_manage?'<th></th>':''}</tr></thead><tbody>${rows}</tbody></table></div></div>`:''}`;
}
function utilityAuditView(d){
  const rows=d.audit_events||d.events||[];
  const body=rows.map(x=>`<tr><td>${fmt(x.event_at)}</td><td><strong>${esc(pretty(x.action||'activity'))}</strong></td><td>${esc(pretty(x.resource_type||'record'))}<small>${esc(x.resource_id||'')}</small></td><td>${esc(utilityPersonName(x))}</td></tr>`).join('');
  return `<div class="panel"><div class="panel-head"><div><h2>Audit History</h2><p>Recorded portal activity for this workspace.</p></div><span class="badge">${rows.length} event${rows.length===1?'':'s'}</span></div><div class="table-wrap"><table><thead><tr><th>Date</th><th>Action</th><th>Resource</th><th>Actor</th></tr></thead><tbody>${body||'<tr><td colspan="4"><div class="empty">No audit events are available for this workspace.</div></td></tr>'}</tbody></table></div></div>`;
}
function utilityLocationsView(d){
  const rows=d.locations||[];
  const body=rows.map(x=>{const employer=x.employer?.legal_name||x.employer?.dba_name||'';const addr=[x.address_line1,x.address_line2,x.city,x.state,x.postal_code].filter(Boolean).join(', ');return `<tr><td><strong>${esc(x.name||'Location')}</strong><small>${esc(employer||pretty(x.location_type||'work site'))}</small></td><td>${esc(addr||'—')}</td><td>${esc(x.phone||'—')}</td><td>${badge(x.status||'active')}</td><td>${x.is_primary?'<span class="badge good">Primary</span>':'—'}</td>${d.access_mode==='manage'&&C.kind!=='ctpa'&&C.kind!=='self'?`<td><button class="mini-btn" data-location-id="${esc(x.id)}">Edit</button></td>`:''}</tr>`}).join('');
  const note=d.assigned_only?'<div class="notice">This page shows the location currently assigned to your employee record.</div>':'';
  return `${note}<div class="panel"><div class="panel-head"><div><h2>Locations</h2><p>${C.kind==='ctpa'?'Work sites for Employers managed by this C/TPA.':'Company work sites and operating locations.'}</p></div><span class="badge">${rows.length} location${rows.length===1?'':'s'}</span></div><div class="table-wrap"><table><thead><tr><th>Location</th><th>Address</th><th>Phone</th><th>Status</th><th>Primary</th>${d.access_mode==='manage'&&C.kind!=='ctpa'&&C.kind!=='self'?'<th></th>':''}</tr></thead><tbody>${body||'<tr><td colspan="6"><div class="empty">No locations are configured yet.</div></td></tr>'}</tbody></table></div></div>`;
}
function utilityUsersRolesView(d){
  if(d?.not_enabled)return `<div class="notice"><strong>Users & Roles</strong><br>${esc(d.message||'User management is not enabled for this account yet.')}</div>`;
  const rows=d.members||[],manage=d.access_mode==='manage'||d.can_manage===true;
  const body=rows.map(m=>`<tr><td><strong>${esc(utilityPersonName(m))}</strong><small>${esc((m.profile||m.profiles||{}).email||'')}</small></td><td>${esc(m.roles?.name||pretty(m.roles?.code||'user'))}</td><td>${badge(m.status||'active')}</td><td>${m.is_primary?'<span class="badge good">Primary</span>':'—'}</td><td>${m.accepted_at?fmt(m.accepted_at):(m.invited_at?'Invite pending':'—')}</td>${manage&&String(m.user_id)!==String(d.current_user_id||'')?`<td><button class="mini-btn" data-user-role="${esc(m.id)}">Manage</button></td>`:(manage?'<td>—</td>':'')}</tr>`).join('');
  return `<div class="panel"><div class="panel-head"><div><h2>Users & Roles</h2><p>Portal access, assigned roles, and membership status for this workspace.</p></div><span class="badge">${rows.length} user${rows.length===1?'':'s'}</span></div><div class="table-wrap"><table><thead><tr><th>User</th><th>Role</th><th>Status</th><th>Primary</th><th>Access</th>${manage?'<th></th>':''}</tr></thead><tbody>${body||'<tr><td colspan="6"><div class="empty">No portal users are available.</div></td></tr>'}</tbody></table></div></div>`;
}
function renderUtilityPage(p,d){
  p=norm(p).replaceAll('_','-');
  if(p==='integrations')return utilityIntegrationsView(d);
  if(p==='audit-history')return utilityAuditView(d);
  if(p==='locations')return utilityLocationsView(d);
  if(p==='users-roles')return utilityUsersRolesView(d);
  return '<div class="panel"><div class="empty">No utility data available.</div></div>';
}
function bindUtilityPage(p,d,ctx){
  p=norm(p).replaceAll('_','-');
  if(p==='locations'&&d.access_mode==='manage'&&C.kind!=='ctpa'&&C.kind!=='self'){
    const openLocation=(x={})=>modal(x.id?'Edit Location':'Add Location',[
      {name:'name',label:'Location name',value:x.name||'',required:true},{name:'location_type',label:'Location type',value:x.location_type||'work_site'},
      {name:'address_line1',label:'Address line 1',value:x.address_line1||'',full:true},{name:'address_line2',label:'Address line 2',value:x.address_line2||'',full:true},
      {name:'city',label:'City',value:x.city||''},{name:'state',label:'State',value:x.state||''},{name:'postal_code',label:'ZIP / postal code',value:x.postal_code||''},
      {name:'phone',label:'Phone',type:'tel',value:x.phone||''},{name:'timezone',label:'Timezone',value:x.timezone||''},
      {name:'status',label:'Status',type:'select',value:x.status||'active',options:[{value:'active',label:'Active'},{value:'inactive',label:'Inactive'}]},
      {name:'is_primary',label:'Primary location',type:'select',value:x.is_primary?'true':'false',options:[{value:'false',label:'No'},{value:'true',label:'Yes'}]}
    ],async v=>invoke('workforce-employer-management',{action:'save_location',location:{...v,id:x.id||undefined,is_primary:String(v.is_primary)==='true'}}));
    addAction('Add Location',()=>openLocation({}));
    document.querySelectorAll('[data-location-id]').forEach(b=>b.onclick=()=>{const x=(d.locations||[]).find(y=>String(y.id)===String(b.dataset.locationId));if(x)openLocation(x)});
  }
  if(p==='users-roles'){
    const manage=d.access_mode==='manage'||d.can_manage===true;
    if(manage&&C.kind==='ctpa')addAction('Invite User',()=>modal('Invite C/TPA User',[{name:'first_name',label:'First name',required:true},{name:'last_name',label:'Last name',required:true},{name:'email',label:'Email',type:'email',required:true},{name:'role_code',label:'Role',type:'select',value:'ctpa_staff',options:[{value:'ctpa_staff',label:'C/TPA Staff'},{value:'ctpa_admin',label:'C/TPA Administrator'}]}],async v=>invoke('workforce-ctpa-admin',{action:'invite_staff',member:v})));
    document.querySelectorAll('[data-user-role]').forEach(b=>b.onclick=()=>{const m=(d.members||[]).find(x=>String(x.id)===String(b.dataset.userRole));if(!m)return;const opts=(d.roles||[]).map(r=>({value:r.id,label:r.name||pretty(r.code)}));modal('Manage User Role',[{name:'role_id',label:'Role',type:'select',value:m.role_id,options:opts},{name:'status',label:'Status',type:'select',value:m.status||'active',options:[{value:'active',label:'Active'},{value:'suspended',label:'Suspended'},{value:'revoked',label:'Revoked'}]}],async v=>{if(C.kind==='ctpa')return invoke('workforce-ctpa-admin',{action:'save_staff',member:{id:m.id,...v}});return invoke('workforce-employer-management',{action:'save_member_role',member:{id:m.id,...v}})})});
  }
  if(p==='integrations'&&d.can_manage&&C.kind==='ctpa'){
    document.querySelectorAll('[data-integration-id]').forEach(b=>b.onclick=()=>{const x=(d.integrations||[]).find(y=>String(y.id)===String(b.dataset.integrationId));if(!x)return;modal('Manage Integration',[{name:'status',label:'Status',type:'select',value:x.status||'inactive',options:[{value:'active',label:'Active'},{value:'inactive',label:'Inactive'},{value:'disabled',label:'Disabled'}]}],async v=>invoke('workforce-ctpa-admin',{action:'save_integration_status',integration:{id:x.id,status:v.status}}))});
  }
}

async function ctpaData(p){
  if(p==='people'||p==='programs')return invoke('workforce-ctpa-employees-programs',{action:'workspace'});
  if(p==='pools')return invoke('workforce-ctpa-pools',{action:'workspace'});
  if(p==='testing')return invoke('workforce-ctpa-testing',{action:'workspace'});
  if(p==='compliance')return invoke('workforce-ctpa-compliance',{action:'workspace'});
  if(p==='documents')return invoke('workforce-ctpa-documents',{action:'workspace'});
  if(p==='notifications')return invoke('workforce-ctpa-notifications',{action:'workspace'});
  const scope={dashboard:'dashboard',employers:'all',selections:'selections',results:'results',reports:'reports',billing:'dashboard'}[p]||'dashboard';
  return invoke('workforce-ctpa-portal',{action:'workspace',scope});
}
async function employerData(p){
  if(C.kind==='employer'&&C.agency&&['dashboard','people','programs'].includes(p))return invoke('workforce-employer-management',{action:'agency_workspace',agency_code:C.agency});
  if(C.kind==='agency'){
    if(p==='testing')return invoke('workforce-employer-testing',{action:'list'});
    if(p==='randoms'){const [w,h]=await Promise.all([invoke('workforce-employer-pools',{action:'workspace'}),invoke('workforce-employer-pools',{action:'selection_history'}).catch(()=>({events:[],members:[]}))]);return {...w,selection_events:h.events||[],selection_members:h.members||[]}}
    if(p==='documents')return invoke('workforce-employer-documents',{action:'workspace'});
    if(p==='notifications')return invoke('workforce-employer-notifications',{action:'workspace'}).catch(()=>invoke('workforce-employer-management',{action:'notifications'}));
    if(p==='support')return invoke('workforce-support',{action:'workspace'});
    if(p==='billing')return invoke('workforce-invoice-portal',{action:'list'});
    if(p==='branding')return invoke('workforce-employer-management',{action:'branding'});
    if(p==='consents')return invoke('workforce-employer-management',{action:'consent_workspace'});
    if(p==='team')return invoke('workforce-employer-members',{action:'list'});
    if(p==='company')return invoke('workforce-employer-management',{action:'settings'});
    if(p==='reports'||p==='mis-reports')return invoke('workforce-employer-management',{action:'reports'});
    return invoke('workforce-employer-management',{action:'agency_workspace',agency_code:C.agency});
  }
  if(p==='testing')return invoke('workforce-employer-testing',{action:'list'}).catch(()=>invoke('workforce-employer-management',{action:'overview'}));
  if(p==='pools')return invoke('workforce-employer-pools',{action:'workspace'});
  if(p==='selections')return invoke('workforce-employer-pools',{action:'selection_history'}).catch(()=>invoke('workforce-employer-management',{action:'selection_history'}));
  if(p==='documents')return invoke('workforce-employer-documents',{action:'workspace'});
  if(p==='results')return invoke('workforce-employer-results',{action:'workspace'}).catch(()=>invoke('workforce-employer-management',{action:'results'}));
  if(p==='notifications')return invoke('workforce-employer-notifications',{action:'workspace'}).catch(()=>invoke('workforce-employer-management',{action:'notifications'}));
  if(p==='support')return invoke('workforce-support',{action:'workspace'});
  if(p==='billing'){const ctpaCustomer=!!window.portalCtx?.customer_ctpa;return ctpaCustomer?invoke('workforce-employer-management',{action:'invoices'}):invoke('workforce-invoice-portal',{action:'list'});}
  if(p==='branding')return invoke('workforce-employer-management',{action:'branding'});
  if(p==='consents')return invoke('workforce-employer-management',{action:'consent_workspace'});
  if(p==='order-services'&&isCtpaCustomer(window.portalCtx))return invoke('workforce-employer-management',{action:'service_catalog'});
  const map={dashboard:'overview',company:'settings',people:'overview',programs:'overview',pools:'overview',selections:'selection_history',compliance:'compliance_detail',reports:'reports','post-accident':'overview'};
  return invoke('workforce-employer-management',{action:map[p]||'overview'});
}
async function selfData(){return invoke('workforce-employee-portal',{action:'workspace',membership_id:stored()})}
function dotScoped(d){
  if(!d||typeof d!=='object')return d;
  const o={...d},isDot=v=>String(v||'DOT').toUpperCase()==='DOT',agency=C.agency?String(C.agency||'').toUpperCase():null,agencyOk=v=>!agency||String(v||'').toUpperCase()===agency;
  if(Array.isArray(d.employees))o.employees=d.employees.filter(x=>x.dot_covered!==false&&agencyOk(x.dot_agency));
  if(Array.isArray(d.programs))o.programs=d.programs.filter(x=>isDot(x.program_type)&&agencyOk(x.dot_agency));
  if(Array.isArray(d.pools))o.pools=d.pools.filter(x=>isDot(x.program_type)&&agencyOk(x.dot_agency));
  if(Array.isArray(d.random_pools))o.random_pools=d.random_pools.filter(x=>isDot(x.program_type)&&agencyOk(x.dot_agency));
  if(Array.isArray(d.testing_orders))o.testing_orders=d.testing_orders.filter(x=>isDot(x.program_type||x.programs?.program_type)&&agencyOk(x.programs?.dot_agency||x.dot_agency));
  if(Array.isArray(d.orders))o.orders=d.orders.filter(x=>isDot(x.program_type||x.programs?.program_type)&&agencyOk(x.programs?.dot_agency||x.dot_agency));
  if(Array.isArray(d.employee_programs))o.employee_programs=d.employee_programs.filter(x=>isDot(x.program_type||x.programs?.program_type));
  if(Array.isArray(d.pool_memberships))o.pool_memberships=d.pool_memberships.filter(x=>isDot(x.random_pools?.program_type));
  if(Array.isArray(d.selection_events))o.selection_events=d.selection_events.filter(x=>isDot(x.random_pools?.program_type||x.program_type));
  if(Array.isArray(d.selection_members))o.selection_members=d.selection_members.filter(x=>isDot(x.selection_events?.random_pools?.program_type||x.program_type));
  return o;
}
async function serviceCatalog(){const r=await fetch(`${C.mainUrl}/functions/v1/portal-order-catalog`,{headers:{apikey:C.mainKey}});const d=await r.json().catch(()=>({}));if(!r.ok||d.error)throw new Error(d.error||'Unable to load services.');return d}

function dashboard(ctx,d){
  let m=[];
  if(C.kind==='self')m=[['Testing',(d.testing_orders||[]).length,'My testing orders'],['Results',(d.results||d.result_reports||[]).length,'My available results'],['Documents',(d.documents||[]).length,'My documents'],['Training',(d.training||[]).length,'My training records']];
  else if(C.kind==='ctpa')m=[['Employers',(d.employers||[]).length,'Managed employers'],['People',(d.employees||[]).length,'Covered people'],['Programs',(d.programs||[]).length,'Testing programs'],['Testing',(d.testing_orders||[]).length,'Testing orders']];
  else m=[['People',(d.employees||[]).length,'Company roster'],['Programs',(d.programs||[]).length,'Programs'],['Testing',(d.testing_orders||d.orders||[]).length,'Orders'],['Compliance',(d.compliance_cases||d.cases||[]).filter(x=>!['closed','resolved'].includes(norm(x.status))).length,'Open cases']];
  const quick=NAV.filter(x=>!['dashboard','profile','company'].includes(norm(x.id))).slice(0,6);
  return `<div class="metrics">${m.map(x=>metric(...x)).join('')}</div><div class="section"><div class="cards">${quick.map(x=>`<a class="card" href="/${x.id}.html"><strong>${esc(x.label)}</strong><span>Open ${esc(x.label.toLowerCase())}.</span></a>`).join('')}</div></div>`;
}
function profileView(d){const x=d.employee||d.employer||{};return `<div class="metrics profile-metrics">${metric('Name',x.legal_name||[x.first_name,x.last_name].filter(Boolean).join(' ')||'—')}${metric('Email',x.email||x.primary_contact_email||'—')}${metric('Phone',x.mobile||x.phone||'—')}${metric('Status',pretty(x.employment_status||x.status||'—'))}</div>`}
function pickManagementRows(p,d){
  if(C.kind==='ctpa'){
    if(p==='employers')return[d.employers||[],'employers'];
    if(p==='people')return[d.employees||[],'employees'];
    if(p==='programs')return[d.programs||[],'programs'];
    if(p==='pools')return[d.pools||[],'pools'];
    if(p==='selections')return[d.selection_members||d.selection_events||[],'selections'];
    if(p==='testing')return[d.orders||d.testing_orders||[],'testing'];
    if(p==='results')return[d.results||[],'results'];
    if(p==='compliance')return[d.compliance_cases||d.cases||[],'compliance'];
    if(p==='documents')return[d.documents||[],'documents'];
    if(p==='notifications')return[d.notifications||[],'notifications'];
    if(p==='billing')return[d.invoices||[],'invoices'];
  }
  if(C.kind==='agency'){
    if(['drivers','covered-workers','mariners'].includes(p))return[d.employees||[],'employees'];
    if(p==='programs')return[d.programs||[],'programs'];
    if(p==='randoms')return[d.selections||[],'selections'];
    if(p==='testing')return[d.testing_orders||[],'testing'];
    if(['post-accident','serious-marine-incident','toxicology'].includes(p))return[d.post_accident_events||[],'accidents'];
    if(p==='compliance')return[d.compliance_cases||[],'compliance'];
    if(p==='documents')return[d.documents||[],'documents'];
  }
  if(p==='people')return[d.employees||[],'employees'];
  if(p==='programs')return[d.programs||[],'programs'];
  if(p==='pools')return[d.pools||[],'pools'];
  if(p==='selections')return[d.selection_members||[],'selections'];
  if(p==='testing')return[d.orders||d.testing_orders||[],'testing'];
  if(p==='results')return[d.results||[],'results'];
  if(p==='compliance')return[d.cases||d.compliance_cases||[],'compliance'];
  if(p==='documents')return[d.documents||[],'documents'];
  if(p==='notifications')return[d.notifications||[],'notifications'];
  if(p==='billing')return[d.invoices||[],'invoices'];
  if(p==='team')return[d.members||[],'members'];
  return[[],null];
}

function wireSelfActions(p,d,ctx){
  if(p==='consents'){
    const pending=(d.policies||[]).find(x=>!x.acknowledged_at);
    if(pending)addAction('Acknowledge Required Policy',()=>modal('Acknowledge Policy',[{name:'acknowledged_name',label:'Type your full name',required:true}],async v=>invoke('workforce-employee-portal',{action:'acknowledge_policy',membership_id:stored(),acknowledgment_id:pending.id,acknowledged_name:v.acknowledged_name})));
  }
}
function isCtpaCustomer(ctx=window.portalCtx){return !!ctx?.customer_ctpa||!!ctx?.membership?.ctpa_id||String(ctx?.subscription?.source||'').toLowerCase().startsWith('ctpa_')}
function ctpaName(ctx=window.portalCtx){return ctx?.customer_ctpa?.display_name||ctx?.customer_ctpa?.brand_name||ctx?.customer_ctpa?.dba_name||ctx?.customer_ctpa?.legal_name||window.__ctpaCustomerName||'Your C/TPA'}
function setCtpaRelationship(ctx,rel){if(!ctx||!rel)return;ctx.customer_ctpa={...(ctx.customer_ctpa||{}),...rel};window.portalCtx=ctx;window.__ctpaCustomerName=ctx.customer_ctpa?.display_name||ctx.customer_ctpa?.brand_name||ctx.customer_ctpa?.dba_name||ctx.customer_ctpa?.legal_name||window.__ctpaCustomerName||''}
function refreshCustomerName(ctx=window.portalCtx){if(!isCtpaCustomer(ctx))return;const name=ctpaName(ctx),label=cfgPage(page()).label,navTitle=document.querySelector('.nav-title'),crumb=document.querySelector('.crumb'),kicker=document.querySelector('.hero-kicker');if(navTitle)navTitle.textContent=name;if(crumb)crumb.textContent=`${name} / ${label}`;if(kicker)kicker.textContent=name;document.title=`${label} | ${name}`}
function selfManaged(ctx=window.portalCtx){return !isCtpaCustomer(ctx)}
function wireManagementActions(p,d,ctx){
  const ctpaCustomer=C.kind==='employer'&&isCtpaCustomer(ctx);
  if(C.kind==='employer'&&p==='company'){
    const e=d.employer||{};
    addAction('Edit Company Contact',()=>modal('Edit Company Contact',[{name:'phone',label:'Phone',value:e.phone||''},{name:'website',label:'Website',value:e.website||''},{name:'primary_contact_name',label:'Primary contact',value:e.primary_contact_name||''},{name:'primary_contact_email',label:'Primary contact email',type:'email',value:e.primary_contact_email||''},{name:'billing_contact_name',label:'Billing contact',value:e.billing_contact_name||''},{name:'billing_contact_email',label:'Billing contact email',type:'email',value:e.billing_contact_email||''}],async v=>invoke('workforce-employer-management',{action:'save_settings',settings:v})));
    if(!ctpaCustomer)addAction(e.applicable_dot_agency?'Update DOT Agency':'Set DOT Agency',()=>modal('DOT Agency Affiliation',[{name:'agency_code',label:'DOT Agency',type:'select',required:true,value:e.applicable_dot_agency||'FMCSA',options:['FMCSA','FAA','FRA','FTA','PHMSA','USCG'].map(x=>({value:x,label:x}))},{name:'account_identifier',label:'Agency account / identifier'},{name:'employee_category',label:'Regulated category',value:'general'},{name:'effective_date',label:'Effective date',type:'date',value:new Date().toISOString().slice(0,10)}],async v=>invoke('workforce-employer-management',{action:'save_agency_registration',agency_code:v.agency_code,registration:{...v,is_primary:true,status:'active'}})),true);
  }
  if(C.kind==='agency'){
    if(p==='company'){
      const e=d.employer||{};
      addAction('Edit Company Contact',()=>modal('Edit Company Contact',[{name:'phone',label:'Phone',value:e.phone||''},{name:'website',label:'Website',value:e.website||''},{name:'primary_contact_name',label:'Primary contact',value:e.primary_contact_name||''},{name:'primary_contact_email',label:'Primary contact email',type:'email',value:e.primary_contact_email||''},{name:'billing_contact_name',label:'Billing contact',value:e.billing_contact_name||''},{name:'billing_contact_email',label:'Billing contact email',type:'email',value:e.billing_contact_email||''}],async v=>invoke('workforce-employer-management',{action:'save_settings',settings:v})));
    }
    if(p==='agency-configuration'||['authorizations','contractors','random-plan','policy','anti-drug-plan','alcohol-misuse-plan','periodic-testing','clearinghouse','new-entrant'].includes(p)){
      const r=(d.registrations||[])[0]||{},cfg=r.configuration||{};
      addAction('Edit Agency Configuration',()=>modal(`${C.agency} Configuration`,[{name:'account_identifier',label:'Agency account / identifier',value:r.account_identifier||''},{name:'employee_category',label:'Regulated category',value:r.employee_category||'general'},{name:'effective_date',label:'Effective date',type:'date',value:r.effective_date||new Date().toISOString().slice(0,10)}],async v=>invoke('workforce-employer-management',{action:'save_agency_registration',agency_code:C.agency,registration:{agency_code:C.agency,...v,configuration:cfg,status:'active'}})));
    }
    if(p==='programs')addAction('Add Program',()=>modal(`Add ${C.agency} Program`,[{name:'name',label:'Program name',required:true},{name:'regulatory_category',label:'Regulatory category'},{name:'testing_method',label:'Testing method',value:'Urine / Breath'},{name:'effective_date',label:'Effective date',type:'date',value:new Date().toISOString().slice(0,10)}],async v=>invoke('workforce-employer-management',{action:'save_agency_program',agency_code:C.agency,program:{dot_agency:C.agency,...v,status:'active'}})));
    if(['drivers','covered-workers','mariners'].includes(p)){
      addAction('Add Covered Worker',()=>modal('Add Covered Worker',workerFields(d,{first_name:'',last_name:'',dot_agency:C.agency}),async v=>invoke('workforce-employer-management',{action:'save_employee',employee:{...v,dot_covered:true,dot_agency:C.agency,safety_sensitive:true,employment_status:v.employment_status||'active'}})));
      addAction('Invite to Employee / Driver Portal',()=>{const people=(d.employees||[]).filter(x=>x.dot_covered!==false);modal('Invite Employee / Driver',[{name:'employee_id',label:'Employee / Driver',type:'select',required:true,options:people.map(x=>({value:x.id,label:[x.first_name,x.last_name].filter(Boolean).join(' ')||x.employee_number||x.id}))},{name:'email',label:'Portal email (leave blank to use employee email)',type:'email'}],async v=>invoke('workforce-employer-management',{action:'invite_employee',employee:{id:v.employee_id,email:v.email}}))},true);
    }
    if(p==='testing'&&!ctpaCustomer)addAction('Create Testing Order',()=>{
      const employees=(d.employees||[]),programs=(d.programs||[]);
      modal('Create Testing Order',[{name:'employee_id',label:'Covered employee',type:'select',required:true,options:employees.map(x=>({value:x.id,label:[x.first_name,x.last_name].filter(Boolean).join(' ')||x.employee_number||x.id}))},{name:'program_id',label:'Program',type:'select',required:true,options:programs.map(x=>({value:x.id,label:x.name||x.id}))},{name:'reason',label:'Reason',type:'select',value:'pre_employment',options:['pre_employment','reasonable_suspicion','post_accident','return_to_duty','follow_up','other'].map(x=>({value:x,label:pretty(x)}))},{name:'test_type',label:'Test type',type:'select',value:'drug_and_alcohol',options:[{value:'drug',label:'Drug'},{value:'alcohol',label:'Alcohol'},{value:'drug_and_alcohol',label:'Drug + Alcohol'}]}],async v=>invoke('workforce-employer-testing',{action:'create',test:v}));
    });
    if(p==='randoms'&&d.entitlements?.random_selections){
      const pools=(d.pools||[]).filter(x=>String(x.status||'active').toLowerCase()==='active');
      if(pools.length)addAction('Run Random Selection',()=>modal(`Run ${C.agency} Random Selection`,[{name:'pool_id',label:'Random pool',type:'select',required:true,options:pools.map(x=>({value:x.id,label:x.name||x.id}))},{name:'drug_count',label:'Drug selections',type:'number',value:'1'},{name:'alcohol_count',label:'Alcohol selections',type:'number',value:'0'}],async v=>invoke('workforce-employer-pools',{action:'run_selection',pool_id:v.pool_id,drug_count:Number(v.drug_count||0),alcohol_count:Number(v.alcohol_count||0)})));
    }
    return;
  }
  if(p==='people')addAction(C.surface==='dot'?'Add Driver / Employee':'Add Employee',()=>{
    const fields=C.kind==='ctpa'?[{name:'employer_id',label:'Client Employer',type:'select',required:true,options:(d.employers||[]).map(x=>({value:x.id,label:x.legal_name||x.dba_name||x.id}))},...workerFields(d,{})]:workerFields(d,{});
    modal('Add Driver / Employee',fields,async v=>{
      if(C.kind==='ctpa')return invoke('workforce-ctpa-employees-programs',{action:'save_employee',employee:{...v,dot_covered:C.surface==='dot',employment_status:'active',safety_sensitive:C.surface==='dot'}});
      return invoke('workforce-employer-management',{action:'save_employee',employee:{...v,dot_covered:C.surface==='dot',dot_agency:C.agency||v.dot_agency||null,employment_status:'active',safety_sensitive:C.surface==='dot'}});
    });
  });
  if(C.kind==='employer'&&p==='people'){addAction('Invite to Employee Portal',()=>{const people=(d.employees||[]).filter(x=>x.dot_covered!==false);modal('Invite Employee / Driver',[{name:'employee_id',label:'Employee / Driver',type:'select',required:true,options:people.map(x=>({value:x.id,label:[x.first_name,x.last_name].filter(Boolean).join(' ')||x.employee_number||x.id}))},{name:'email',label:'Portal email (leave blank to use employee email)',type:'email'}],async v=>invoke('workforce-employer-management',{action:'invite_employee',employee:{id:v.employee_id,email:v.email}}))},true);}
  if(p==='programs'&&!(C.kind==='employer'&&ctpaCustomer))addAction('Add Program',()=>{
    const fields=[];
    if(C.kind==='ctpa')fields.push({name:'employer_id',label:'Client Employer',type:'select',required:true,options:(d.employers||[]).map(x=>({value:x.id,label:x.legal_name||x.dba_name||x.id}))});
    fields.push({name:'name',label:'Program name',required:true},{name:'testing_method',label:'Testing method'},{name:'effective_date',label:'Effective date',type:'date',value:new Date().toISOString().slice(0,10)});
    if(C.surface==='dot')fields.push({name:'dot_agency',label:'DOT Agency',type:'select',value:'FMCSA',options:['FMCSA','FAA','FRA','FTA','PHMSA','USCG'].map(x=>({value:x,label:x}))});
    modal('Add Program',fields,async v=>{
      const program={...v,program_type:C.surface==='dot'?'DOT':'NON_DOT',status:'active'};
      if(C.kind==='ctpa')return invoke('workforce-ctpa-employees-programs',{action:'save_program',program});
      return invoke('workforce-employer-management',{action:'save_program',program});
    });
  });
  if(p==='testing'&&!ctpaCustomer)addAction('Create Testing Order',()=>{
    const employees=(d.employees||[]).filter(x=>x.dot_covered!==false),programs=(d.programs||[]).filter(x=>String(x.program_type||'DOT').toUpperCase()==='DOT'),employers=d.employers||[];
    const fields=[];
    if(C.kind==='ctpa')fields.push({name:'employer_id',label:'Client Employer',type:'select',required:true,options:employers.map(x=>({value:x.id,label:x.legal_name||x.id}))});
    fields.push({name:'employee_id',label:C.surface==='dot'?'Driver / Employee':'Employee',type:'select',required:true,options:employees.map(x=>({value:x.id,label:[x.first_name,x.last_name].filter(Boolean).join(' ')||x.employee_number||x.id}))},{name:'program_id',label:'Program',type:'select',required:true,options:programs.map(x=>({value:x.id,label:x.name||x.id}))},{name:'reason',label:'Reason',type:'select',value:'pre_employment',options:['pre_employment','reasonable_suspicion','post_accident','return_to_duty','follow_up','other'].map(x=>({value:x,label:pretty(x)}))},{name:'test_type',label:'Test type',type:'select',value:C.surface==='dot'?'drug_and_alcohol':'drug',options:[{value:'drug',label:'Drug'},{value:'alcohol',label:'Alcohol'},{value:'drug_and_alcohol',label:'Drug + Alcohol'}]});
    modal('Create Testing Order',fields,async v=>{
      if(C.kind==='ctpa')return invoke('workforce-ctpa-testing',{action:'create',test:v});
      return invoke('workforce-employer-testing',{action:'create',test:v});
    });
  });
  if(C.kind==='employer'&&p==='team'&&d.can_manage!==false){addAction('Add Staff User',()=>modal('Add Staff User',[{name:'first_name',label:'First name',required:true},{name:'last_name',label:'Last name',required:true},{name:'email',label:'Email',type:'email',required:true},{name:'role_code',label:'Role',type:'select',required:true,value:'supervisor',options:(d.roles||[]).map(r=>({value:r.code,label:r.name||pretty(r.code)}))}],async v=>invoke('workforce-employer-members',{action:'invite',member:v})));}
  if(p==='pools'&&!window.PortalPools&&!(C.kind==='employer'&&ctpaCustomer))addAction('Add Pool',()=>{
    const fields=[];
    if(C.kind==='ctpa')fields.push({name:'employer_id',label:'Client Employer',type:'select',options:(d.employers||[]).map(x=>({value:x.id,label:x.legal_name||x.id}))});
    if(C.kind==='ctpa')fields.push({name:'name',label:'Pool name',required:true},{name:'pool_type',label:'Pool type',type:'select',value:'consortium',options:[{value:'consortium',label:'Consortium'}]},{name:'program_type',label:'Program type',type:'select',value:'DOT',options:[{value:'DOT',label:'DOT'}]});
    else fields.push({name:'name',label:'Pool name',required:true},{name:'pool_type',label:'Pool type',type:'select',value:'employer',options:[{value:'employer',label:'Employer Pool'}]},{name:'program_type',label:'Program type',type:'select',value:'DOT',options:[{value:'DOT',label:'DOT'}]});
    fields.push({name:'dot_agency',label:'DOT Agency',type:'select',value:'FMCSA',options:['FMCSA','FAA','FRA','FTA','PHMSA','USCG'].map(x=>({value:x,label:x}))});
    modal('Add Pool',fields,async v=>{
      if(C.kind==='ctpa')return invoke('workforce-ctpa-pools',{action:'save_pool',pool:v});
      return invoke('workforce-employer-pools',{action:'save_pool',pool:v});
    });
  });
}

function ctpaServiceRequestModal(d,service){
  const seller=d?.seller?.legal_name||ctpaName(window.portalCtx),employees=d?.employees||[],employer=d?.employer||{};
  const fields=[
    {name:'employee_id',label:'Driver / employee',type:'select',options:[{value:'',label:'Company-level request'},...employees.map(x=>({value:x.id,label:[x.first_name,x.middle_name,x.last_name].filter(Boolean).join(' ')||x.employee_number||x.id}))]},
    {name:'contact_name',label:'Contact name',required:true,value:employer.primary_contact_name||''},
    {name:'contact_email',label:'Contact email',type:'email',required:true,value:employer.primary_contact_email||''},
    {name:'contact_phone',label:'Contact phone',type:'tel',value:employer.phone||''},
    {name:'requested_date',label:'Preferred date',type:'date'},
    {name:'notes',label:'Request details',type:'textarea',full:true}
  ];
  modal(`Request ${service.name}`,fields,async v=>{
    const out=await invoke('workforce-employer-management',{action:'order_ctpa_service',service_id:service.id,...v});
    alert(`Service request ${out.order?.order_number||''} was sent to ${seller}.`);
  });
}
function bindCtpaServices(d){document.querySelectorAll('[data-ctpa-service]').forEach(b=>b.onclick=()=>{const service=(d.services||[]).find(x=>String(x.id)===String(b.dataset.ctpaService));if(service)ctpaServiceRequestModal(d,service)})}
async function render(ctx){
  $('#actions').innerHTML='';const p=page();let d;
  if(C.kind==='self')d=await selfData();else if(C.kind==='ctpa')d=await ctpaData(p);else d=dotScoped(await employerData(p));
  if(isUtilityPage(p))d=await utilityData(p);
  if(C.kind==='self')setSubtitle('View your own records and complete only the actions assigned to you.');
  else if(C.kind==='agency')setSubtitle(`${C.agency} company management workspace. Changes apply only to your company.`);
  else setSubtitle(isCtpaCustomer(ctx)?`Manage your company, staff, and ${C.agency||'DOT'} covered workers. Your C/TPA manages the regulated program, pools, selections, and testing workflow.`:'Manage your DOT company records, covered drivers/employees, programs, testing and compliance.');
  let html='';
  if(isUtilityPage(p))html=renderUtilityPage(p,d);
  else if(p==='dashboard')html=dashboard(ctx,d);
  else if(p==='pools'&&window.PortalPools){setSubtitle(C.kind==='ctpa'?'Create consortium pools and manage eligible pool membership.':'Manage random pools and pool participation for this Employer.');html=window.PortalPools.render(d,ctx);}
  else if(p==='order-services'){
    if(isCtpaCustomer(ctx)){
      const seller=d?.seller?.display_name||d?.seller?.brand_name||d?.seller?.dba_name||d?.seller?.legal_name||ctpaName(window.portalCtx);window.__ctpaCustomerName=seller;refreshCustomerName(ctx);const cards=(d.services||[]).map(s=>`<article class="service"><span class="service-source">Available from ${esc(seller)}</span><h3>${esc(s.name)}</h3><p>${esc(s.description||s.category||'DOT service')}</p><div class="service-meta">${esc(s.category||'DOT Service')}</div><button class="btn primary" type="button" data-ctpa-service="${esc(s.id)}">Request from ${esc(seller)}</button></article>`).join('');
      setSubtitle(`Request DOT services directly from ${seller}.`);
      html=`<div class="notice ctpa-service-notice"><strong>${esc(seller)} is your service provider.</strong> Available services are provided by ${esc(seller)}. Requests from this page are sent directly to ${esc(seller)}.</div><div class="section service-grid">${cards||'<div class="panel service-empty"><div class="empty">No services are currently available from your C/TPA.</div></div>'}</div>`;
    }else{
      const cat=await serviceCatalog();
      const cards=(cat.services||[]).map(s=>{const href=(cat.seller?.checkout_base||'https://screenings4u.com/')+String(s.order_url||'');return `<article class="service"><h3>${esc(s.name)}</h3><p>${esc(s.description||s.category||'DOT service')}</p><div class="price">${s.amount==null?'Request quote':money(s.amount)}</div><div class="seller">Seller: ${esc(s.seller_legal_name||'screenings4u, LLC')}</div><a class="btn primary" href="${esc(href)}" target="_blank" rel="noopener">Order from screenings4u</a></article>`}).join('');
      html=`<div class="notice">Services on this page are sold by <strong>screenings4u, LLC</strong>.</div><div class="section service-grid">${cards}</div>`;
    }
  }
  else if(C.kind==='self'){
    if(p==='profile')html=profileView(d);
    else if(p==='my-testing')html=table('My Testing',d.testing_orders||[],COLS.testing);
    else if(p==='my-results')html=table('My Results',d.results||d.result_reports||[],COLS.results);
    else if(p==='documents')html=table('My Documents',d.documents||[],COLS.documents);
    else if(p==='credentials')html=table('My Credentials',d.credentials||[],COLS.credentials);
    else if(p==='training')html=table('Training Records',d.training||[],COLS.training)+`<div class="section"><a class="btn primary" href="https://training.screenings4u.com/" target="_blank" rel="noopener">Open Training Portal</a></div>`;
    else if(p==='consents')html=table('Consents & Acknowledgments',d.policies||[],COLS.policies);
    else if(p==='medical')html=`<div class="notice">Medical records are view-only here. Use Order Services to purchase a DOT physical from screenings4u, LLC.</div><div class="section">${table('Credentials',d.credentials||[],COLS.credentials)}</div>`;
    else html=dashboard(ctx,d);
    wireSelfActions(p,d,ctx);
  }
  else if(C.kind==='agency'){
    if(p==='support'&&window.EmployerSupport){setSubtitle('Get help from screenings4u and track your support requests.');html=window.EmployerSupport.render(d,ctx);}
    else if(p==='billing'&&window.EmployerBilling){setSubtitle(`View, download, and pay invoices for your ${C.agency} management plan.`);html=window.EmployerBilling.render(d,ctx);}
    else if(p==='branding'&&window.EmployerBranding){setSubtitle('Customize your employee / driver portal branding. Enterprise plans include white label.');html=window.EmployerBranding.render(d,ctx);}
    else if(p==='notifications'&&window.EmployerNotifications){setSubtitle('Review screenings4u notifications and reply to platform messages.');html=window.EmployerNotifications.render(d,ctx);}
    else if(p==='consents'&&window.EmployerConsents){setSubtitle(`Create, edit, send, and track ${C.agency}-specific consent forms and acknowledgments.`);html=window.EmployerConsents.render(d,ctx);}
    else if(p==='company'){html=profileView(d)+`<div class="section notice"><strong>${esc(C.agency)} management portal.</strong> This workspace manages only your company and your ${esc(C.agency)} regulated program.</div>`;}
    else if(p==='randoms'&&window.PortalPools){setSubtitle(`Manage ${C.agency} random pools, membership, and selections.`);html=window.PortalPools.render(d,ctx)+`<div class=\"section\">${table('Selection History',d.selection_members||[],COLS.selections)}</div>`;}
    else if(p==='agency-configuration'||['authorizations','contractors','random-plan','policy','anti-drug-plan','alcohol-misuse-plan','periodic-testing','clearinghouse','new-entrant'].includes(p)){
      const r=(d.registrations||[])[0]||{};
      html=`<div class="panel"><div class="panel-head"><div><h2>${esc(C.agency)} Configuration</h2><p>${esc(d.agency?.primary_regulation||'Agency configuration')}</p></div></div><div style="padding:16px"><div class="metrics">${metric('Account',r.account_identifier||'—')}${metric('Category',pretty(r.employee_category||'—'))}${metric('Status',pretty(r.status||'Not configured'))}${metric('Effective',fmt(r.effective_date))}</div><div class="section notice">${esc(d.agency?.metadata?.covered_workforce||'Agency-specific employer configuration.')}</div></div></div>`;
    }
    else if(p==='mis-reports'||p==='reports')html=`<div class="metrics">${metric('Testing',(d.testing||[]).length)}${metric('Program Enrollments',(d.program_enrollment||[]).length)}${metric('Pool Memberships',(d.pool_membership||[]).length)}${metric('Compliance',(d.compliance||[]).length)}</div>`;
    else if(['drivers','covered-workers','mariners'].includes(p))html=employeeTable(cfgPage(p).label,d.employees||[]);
    else {const [rows,key]=pickManagementRows(p,d);html=key?table(cfgPage(p).label,rows,COLS[key]):`<div class="panel"><div class="empty">No records available.</div></div>`}
    wireManagementActions(p,d,ctx);
  }
  else {
    if(p==='support'&&window.EmployerSupport){setSubtitle(isCtpaCustomer(ctx)?`Get help from ${ctpaName(ctx)} and track your support requests.`:'Get help from screenings4u, create support requests, and track ticket status.');html=window.EmployerSupport.render(d,ctx);}
    else if(p==='billing'&&window.EmployerBilling){setSubtitle(isCtpaCustomer(ctx)?`View invoices issued to your company by ${ctpaName(ctx)}.`:'View, download, and pay invoices issued to your company by screenings4u.');html=window.EmployerBilling.render(d,ctx);}
    else if(p==='branding'&&window.EmployerBranding){setSubtitle('Customize the DOT Employee / Driver portal with your company logo and colors.');html=window.EmployerBranding.render(d,ctx);}
    else if(p==='notifications'&&window.EmployerNotifications){setSubtitle(isCtpaCustomer(ctx)?`Review notifications and communicate with ${ctpaName(ctx)}.`:'Review screenings4u notifications and reply to platform messages.');html=window.EmployerNotifications.render(d,ctx);}
    else if(p==='consents'&&window.EmployerConsents){setSubtitle('Create, edit, send, and track DOT agency-specific consent forms and acknowledgments for your covered employees.');html=window.EmployerConsents.render(d,ctx);}
    else if(p==='company'){html=profileView(d)+(isCtpaCustomer(ctx)?`<div class="section notice"><strong>${esc(ctpaName(ctx))} manages this DOT program.</strong> You can manage company contacts, staff users, and covered workers. Programs, pools, random selections, and regulated testing are coordinated by your C/TPA.</div>`:(!d.employer?.applicable_dot_agency?`<div class="section notice"><strong>DOT agency setup required.</strong> Choose FMCSA, FAA, FRA, FTA, PHMSA, or USCG before creating regulated DOT activity.</div>`:''));}
    else if(p==='reports')html=`<div class="metrics">${metric('Testing',(d.testing||d.testing_orders||[]).length)}${metric('Programs',(d.program_enrollment||d.programs||[]).length)}${metric('Pools',(d.pool_membership||d.pools||[]).length)}${metric('Compliance',(d.compliance||d.cases||[]).length)}</div>`;
    else if(p==='post-accident')html=`<div class="notice">Post-accident activity is managed through Testing and Compliance. DOT service purchases are available from Order Services.</div><div class="section">${table('Post-Accident Testing',(d.testing_orders||[]).filter(x=>norm(x.reason)==='post_accident'),COLS.testing)}</div>`;
    else {const [rows,key]=pickManagementRows(p,d);html=p==='people'?employeeTable(cfgPage(p).label,rows):(key?table(cfgPage(p).label,rows,COLS[key]):`<div class="panel"><div class="empty">No records available.</div></div>`)}
    wireManagementActions(p,d,ctx);
  }
  $('#content').innerHTML=html||`<div class="panel"><div class="empty">No data available.</div></div>`;
  if(isUtilityPage(p))bindUtilityPage(p,d,ctx);
  if((p==='people'&&C.kind==='employer')||(C.kind==='agency'&&['drivers','covered-workers','mariners'].includes(p)))bindWorkerEdits(d);
  if((p==='pools'||(C.kind==='agency'&&p==='randoms'))&&window.PortalPools)window.PortalPools.bind(d,ctx);
  if(p==='notifications'&&window.EmployerNotifications)window.EmployerNotifications.bind(d,ctx);
  if(p==='support'&&window.EmployerSupport)window.EmployerSupport.bind(d,ctx);
  if(p==='billing'&&window.EmployerBilling)window.EmployerBilling.bind(d,ctx);
  if(p==='branding'&&window.EmployerBranding)window.EmployerBranding.bind(d,ctx);
  if(p==='consents'&&window.EmployerConsents)window.EmployerConsents.bind(d,ctx);
  if(p==='order-services'&&isCtpaCustomer(ctx))bindCtpaServices(d);
}

async function init(){
  try{
    const s=await getSession();if(!s){location.replace('/login.html');return}
    const startingMid=stored(),startingCache=readBrandCache(startingMid);if(startingCache?.branding)primeBranding(startingCache.branding);
    const prefetchedBrand=startingMid?fetchBranding().catch(e=>{console.warn('Branding prefetch unavailable',e);return null}):null;
    const ctx=await access();if(ctx.requires_workspace_selection){location.replace('/workspace.html');return}if(!ctx.has_access)throw new Error(ctx.reason||'Portal access denied.');if(ctx.portal_code!==C.portalCode||ctx.business_surface!=='dot'||ctx.membership?.organization_type!=='employer')throw new Error('This account is not authorized for this DOT management portal.');if(C.kind==='agency'){const expected=`dot_${String(C.agency||'').toLowerCase()}_`;if(!String(ctx.subscription?.plan_code||'').startsWith(expected))throw new Error(`This subscription does not include the ${C.agency} management portal.`)}else if(ctx.subscription?.plan_code&&!String(ctx.subscription.plan_code).startsWith('dot_employer_'))throw new Error('This subscription is not a DOT Employer plan.');
    saveMid(ctx.membership?.id);window.portalCtx=ctx;
    const cache=readBrandCache(ctx.membership?.id);if(cache?.branding)primeBranding(cache.branding);
    shell(ctx);
    if(cache){if(cache.branding)applyBranding(cache.branding,ctx);else applyPlatformBranding(ctx);setBrandLogo(cache.branding?.logo_path||'/assets/img/logo.png',cache.branding?.portal_name||ctx?.subscription?.plan_name||C.label);document.body.classList.remove('loading')}
    const renderPromise=render(ctx);
    const brandPromise=loadBranding(ctx,startingMid===ctx.membership?.id?prefetchedBrand:null);
    if(!cache){await brandPromise;document.body.classList.remove('loading')}else brandPromise.catch(()=>{});
    await renderPromise;
  }
  catch(e){if(e.status===401||e.message==='AUTH_REQUIRED'){await sb.auth.signOut();location.replace('/login.html');return}document.body.className='login-page';document.body.innerHTML=`<main class="login-card"><img class="login-logo" src="/assets/img/logo.png"><h1>Portal unavailable</h1><p>${esc(e.message||String(e))}</p><a class="btn primary" href="/login.html">Return to login</a></main>`}
}
window.Portal={invoke,sb,refresh:()=>render(window.portalCtx)};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
