(async()=>{
  const C=window.PORTAL_CONFIG,sb=window.supabase.createClient(C.workforceUrl,C.workforceKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  const {data:{session}}=await sb.auth.getSession();if(!session){location.replace('/login.html');return}
  const id=new URLSearchParams(location.search).get('id')||'';
  const r=await fetch(`${C.workforceUrl}/functions/v1/workforce-session-context`,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${session.access_token}`,'apikey':C.workforceKey},body:JSON.stringify({requested_portal_code:C.portalCode,membership_id:id})});
  const d=await r.json().catch(()=>({}));
  if(!r.ok){document.getElementById('msg').textContent=d.error||d.reason||'Unable to load workspace.';return}
  if(d.requires_workspace_selection){const seen=new Set();const rows=(d.workspaces||[]).filter(w=>{const k=String(w.organization_id||w.membership_id||'');if(seen.has(k))return false;seen.add(k);return true});document.getElementById('choices').innerHTML=rows.map(w=>{const ctpa=w.customer_ctpa?.display_name||w.customer_ctpa?.dba_name||w.customer_ctpa?.legal_name||'',sub=ctpa?`${ctpa} Customer`:(w.plan_name||'DOT Employer Plan');return `<a class="card workspace-choice" style="display:block;margin:8px 0" href="/workspace.html?id=${encodeURIComponent(w.membership_id)}"><strong>${w.organization_name||'DOT Employer'}</strong><span style="display:block;margin-top:4px;color:#66758a;font-size:12px">${sub}</span></a>`}).join('');return}
  if(d.membership?.id)localStorage.setItem(`s4u_${C.portalCode}_membership`,d.membership.id);
  location.replace('/dashboard.html');
})();
