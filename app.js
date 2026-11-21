firebase.initializeApp(firebaseConfig);
const auth = firebase.auth(), db = firebase.firestore(), FV = firebase.firestore.FieldValue;
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const toast = t => { const m=$('msg'); m.textContent=t; m.style.display='block'; setTimeout(()=>m.style.display='none',2800); };
const STL = {pending:'⏳ Aguardando aprovação',approved:'✅ Aprovada · em andamento',won:'🏆 GANHOU',lost:'❌ PERDEU',rejected:'🚫 Recusada (valor devolvido)'};

let users=[], me=null, isAdmin=false, teams=[], myBets=[], allBets=[], cfg={}, unsubs=[], signup=false, tab='rank';

function toggleAuth(){
  signup=!signup;
  $('nm').classList.toggle('hide',!signup);
  $('atitle').textContent=signup?'Criar conta':'Entrar';
  $('alink').textContent=signup?'Já tem conta? Entrar':'Não tem conta? Criar conta';
}
async function doAuth(){
  const e=$('em').value.trim(), p=$('pw').value;
  try{
    if(signup){
      const n=$('nm').value.trim(); if(!n) return toast('Digite seu nome');
      const c=await auth.createUserWithEmailAndPassword(e,p);
      await db.collection('users').doc(c.user.uid).set({name:n,email:e,balance:START_COINS});
    } else await auth.signInWithEmailAndPassword(e,p);
  }catch(err){ toast('Erro: '+err.message); }
}

auth.onAuthStateChanged(u=>{
  unsubs.forEach(f=>f()); unsubs=[];
  if(!u){ me=null; $('authv').classList.remove('hide'); $('app').classList.add('hide'); $('top').classList.add('hide'); return; }
  isAdmin = u.email.toLowerCase()===ADMIN_EMAIL.toLowerCase();
  $('authv').classList.add('hide'); $('app').classList.remove('hide'); $('top').classList.remove('hide');
  unsubs.push(db.collection('users').doc(u.uid).onSnapshot(d=>{
    me={uid:u.uid,...d.data()}; $('who').textContent=(me.name||'')+(isAdmin?' (admin)':''); $('bal').textContent='🪙 '+(me.balance||0).toFixed(2); render();
  }));
  unsubs.push(db.collection('teams').onSnapshot(s=>{teams=s.docs.map(d=>({id:d.id,...d.data()})); render();}));
  unsubs.push(db.collection('config').doc('main').onSnapshot(d=>{cfg=d.data()||{}; render();}));
  unsubs.push(db.collection('bets').where('uid','==',u.uid).onSnapshot(s=>{myBets=s.docs.map(d=>({id:d.id,...d.data()})); render();}));
  if(isAdmin) unsubs.push(db.collection('users').onSnapshot(s=>{users=s.docs.map(d=>({id:d.id,...d.data()})); render();}));
  if(isAdmin) unsubs.push(db.collection('bets').onSnapshot(s=>{allBets=s.docs.map(d=>({id:d.id,...d.data()})); render();}));
  buildTabs();
});

function buildTabs(){
  const t=[['rank','🏅 Classificação'],['bet','🎯 Apostar'],['mine','🧾 Minhas apostas']];
  if(isAdmin) t.push(['adm','⚙️ Admin']);
  $('tabs').innerHTML=t.map(([k,l])=>`<button class="${k===tab?'on':''}" onclick="go('${k}')">${l}</button>`).join('');
}
function go(k){ tab=k; ['rank','bet','mine','adm'].forEach(x=>$('t-'+x).classList.toggle('hide',x!==k)); buildTabs(); render(); }
const sorted=()=>[...teams].sort((a,b)=>(b.points||0)-(a.points||0));
const tname=id=>(teams.find(t=>t.id===id)||{}).name||'?';
const stTag=t=>t.status==='eliminated'?'<span class="tag lost">Eliminado</span>':cfg.champion===t.id?'<span class="tag won">🏆 Campeão</span>':'<span class="tag approved">Na disputa</span>';

function render(){
  if(!me) return;
  // Classificação
  $('t-rank').innerHTML=`<div class="card"><h2>Classificação</h2>${cfg.finished?`<p class="won">🏆 Campeão: ${esc(tname(cfg.champion))}</p>`:''}`+
    (sorted().map((t,i)=>`<div class="row"><span class="pos">${i+1}º</span><b style="flex:1">${esc(t.name)}</b>${stTag(t)}<span class="mu">${t.points||0} pts</span><span class="odd">${Number(t.odd).toFixed(2)}x</span></div>`).join('')||'<p class="mu">Nenhum time cadastrado ainda.</p>')+`</div>`;
  // Apostar
  if(tab==='bet' && !$('t-bet').dataset.keep){
    const act=sorted().filter(t=>t.status!=='eliminated');
    $('t-bet').innerHTML=`<div class="card"><h2>Apostar no campeão</h2>`+(cfg.finished?'<p class="mu">Apostas encerradas.</p>':
      `<select id="bt">${act.map(t=>`<option value="${t.id}">${esc(t.name)} — ${Number(t.odd).toFixed(2)}x</option>`).join('')}</select>
      <input id="bv" type="number" min="1" placeholder="Valor (moedas)">
      <button style="width:100%;margin-top:6px" onclick="placeBet()">Enviar aposta</button>
      <p class="mu">Sua aposta fica pendente até o admin aprovar. A odd fica travada no momento da aposta.</p>`)+`</div>`;
    $('t-bet').dataset.keep='1';
  }
  if(tab!=='bet') delete $('t-bet').dataset.keep;
  // Minhas apostas
  $('t-mine').innerHTML=`<div class="card"><h2>Minhas apostas</h2>`+(myBets.sort((a,b)=>(b.at||0)-(a.at||0)).map(b=>{
    const t=teams.find(x=>x.id===b.team); let s=b.status, extra='';
    if(s==='approved'&&t&&t.status==='eliminated'){s='lost';extra=' (time eliminado)';}
    return `<div class="row"><div><b>${esc(b.teamName)}</b> <span class="mu">· ${b.amount} @ ${Number(b.odd).toFixed(2)}x</span><br><span class="mu">Retorno possível: ${(b.amount*b.odd).toFixed(2)}</span></div><span class="${s}">${STL[s]}${extra}</span></div>`;
  }).join('')||'<p class="mu">Você ainda não apostou.</p>')+`</div>`;
  if(isAdmin) renderAdmin();
}

async function placeBet(){
  const id=$('bt').value, v=parseFloat($('bv').value), t=teams.find(x=>x.id===id);
  if(!t||!(v>0)) return toast('Preencha corretamente');
  if(v>me.balance) return toast('Saldo insuficiente');
  const b=db.batch();
  b.update(db.collection('users').doc(me.uid),{balance:FV.increment(-v)});
  b.set(db.collection('bets').doc(),{uid:me.uid,userName:me.name,team:id,teamName:t.name,odd:Number(t.odd),amount:v,status:'pending',at:Date.now()});
  try{await b.commit(); $('bv').value=''; toast('Aposta enviada! ⚡'); go('mine');}catch(e){toast('Erro: '+e.message);}
}

/* ====== ADMIN ====== */
function renderAdmin(){
  if(tab!=='adm') return;
  const focus=document.activeElement&&document.activeElement.closest&&document.activeElement.closest('#t-adm');
  if(focus) return; // não recarrega enquanto digita
  const pend=allBets.filter(b=>b.status==='pending').sort((a,b)=>a.at-b.at);
  $('t-adm').innerHTML=`
  <div class="card"><h2>Contas e saldos (${users.length})</h2>${[...users].sort((x,y)=>(x.name||'').localeCompare(y.name||'')).map(u=>`<div class="row"><div style="flex:1;min-width:130px"><b>${esc(u.name||'')}</b><br><span class="mu">${esc(u.email||'')}</span></div><span class="bal">🪙 ${(u.balance||0).toFixed(2)}</span><input id="u${u.id}" type="number" step="0.01" placeholder="valor" style="width:90px"><button class="s" onclick="setBal('${u.id}',false)">Definir</button><button class="s g" onclick="setBal('${u.id}',true)">+ Somar</button></div>`).join('')||'<p class="mu">Nenhuma conta ainda.</p>'}<p class="mu">"Definir" troca o saldo pelo valor. "+ Somar" adiciona (use negativo para remover).</p></div>
  <div class="card"><h2>Solicitações de aposta (${pend.length})</h2>${pend.map(b=>`<div class="row"><div><b>${esc(b.userName)}</b> → ${esc(b.teamName)}<br><span class="mu">${b.amount} @ ${Number(b.odd).toFixed(2)}x</span></div><div><button class="s" onclick="decide('${b.id}',true)">Aprovar</button> <button class="r s" onclick="decide('${b.id}',false)">Recusar</button></div></div>`).join('')||'<p class="mu">Nenhuma pendente.</p>'}</div>
  <div class="card"><h2>Times (${teams.length}/${MAX_TEAMS})</h2>
  ${teams.map(t=>`<div class="row"><b style="flex:1;min-width:90px">${esc(t.name)}</b>
    <label class="mu">Odd<input id="o${t.id}" type="number" step="0.01" value="${t.odd}" style="width:80px"></label>
    <label class="mu">Pts<input id="p${t.id}" type="number" value="${t.points||0}" style="width:70px"></label>
    <select id="s${t.id}" style="width:120px"><option value="active" ${t.status!=='eliminated'?'selected':''}>Na disputa</option><option value="eliminated" ${t.status==='eliminated'?'selected':''}>Eliminado</option></select>
    <button class="s" onclick="saveTeam('${t.id}')">Salvar</button><button class="r s" onclick="delTeam('${t.id}')">X</button></div>`).join('')}
  ${teams.length<MAX_TEAMS?`<div class="grid" style="margin-top:10px"><input id="nn" placeholder="Nome do time"><input id="no" type="number" step="0.01" placeholder="Odd (ex: 2.5)"><button onclick="addTeam()">Adicionar</button></div>`:''}</div>
  <div class="card"><h2>Encerrar campeonato</h2>${cfg.finished?`<p class="won">Encerrado. Campeão: ${esc(tname(cfg.champion))}</p><button class="g" onclick="reopen()">Reabrir</button>`:
  `<select id="ch">${teams.map(t=>`<option value="${t.id}">${esc(t.name)}</option>`).join('')}</select><button style="width:100%;margin-top:6px" onclick="finish()">Definir campeão e pagar apostas</button><p class="mu">Apostas aprovadas no campeão ganham; as demais perdem.</p>`}</div>`;
}
async function decide(id,ok){
  const b=allBets.find(x=>x.id===id); if(!b) return;
  const w=db.batch();
  w.update(db.collection('bets').doc(id),{status:ok?'approved':'rejected'});
  if(!ok) w.update(db.collection('users').doc(b.uid),{balance:FV.increment(b.amount)});
  await w.commit(); toast(ok?'Aprovada':'Recusada e devolvida');
}
async function addTeam(){
  const n=$('nn').value.trim(), o=parseFloat($('no').value);
  if(!n||!(o>=1)) return toast('Nome e odd (≥1)');
  await db.collection('teams').add({name:n,odd:o,points:0,status:'active'}); toast('Time criado');
}
async function saveTeam(id){
  await db.collection('teams').doc(id).update({odd:parseFloat($('o'+id).value),points:parseInt($('p'+id).value)||0,status:$('s'+id).value});
  toast('Salvo'); document.activeElement.blur(); render();
}
async function delTeam(id){ if(confirm('Apagar time?')){await db.collection('teams').doc(id).delete();} }
async function finish(){
  const ch=$('ch').value; if(!confirm('Encerrar e pagar apostas?')) return;
  const w=db.batch();
  allBets.filter(b=>b.status==='approved').forEach(b=>{
    if(b.team===ch){ w.update(db.collection('bets').doc(b.id),{status:'won'}); w.update(db.collection('users').doc(b.uid),{balance:FV.increment(b.amount*b.odd)}); }
    else w.update(db.collection('bets').doc(b.id),{status:'lost'});
  });
  w.set(db.collection('config').doc('main'),{finished:true,champion:ch},{merge:true});
  await w.commit(); toast('Campeonato encerrado! 🏆');
}
async function reopen(){ await db.collection('config').doc('main').set({finished:false,champion:null},{merge:true}); toast('Reaberto (apostas já pagas não são revertidas)'); }
document.addEventListener('focusout',()=>setTimeout(render,200));

async function setBal(id,add){
  const v=parseFloat($('u'+id).value); if(isNaN(v)) return toast('Digite um valor');
  if(!add&&v<0) return toast('Saldo não pode ser negativo');
  await db.collection('users').doc(id).update({balance:add?FV.increment(v):v});
  toast(add?'Saldo somado':'Saldo definido'); document.activeElement.blur(); render();
}
