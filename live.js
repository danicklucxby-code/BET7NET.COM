firebase.initializeApp(firebaseConfig);
const auth=firebase.auth(), db=firebase.firestore();
const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const toast=t=>{const m=$('msg');m.textContent=t;m.style.display='block';setTimeout(()=>m.style.display='none',2800);};
let teams=[],bets=[],cfg={},unsubs=[],isAdmin=false,lastUrl=null;

function embed(u){
  if(!u) return '';
  try{
    const x=new URL(u), h=x.hostname.replace('www.','');
    let id=null;
    if(h==='youtu.be') id=x.pathname.slice(1);
    else if(h.includes('youtube.com')){
      id=x.searchParams.get('v');
      const m=x.pathname.match(/\/(live|embed|shorts)\/([^/?]+)/); if(!id&&m) id=m[2];
    }
    if(id) return 'https://www.youtube.com/embed/'+id+'?autoplay=1&mute=1&playsinline=1';
    if(h==='twitch.tv'){const c=x.pathname.split('/')[1]; return 'https://player.twitch.tv/?channel='+c+'&parent='+location.hostname+'&muted=true';}
    return u;
  }catch(e){return '';}
}
function renderVideo(){
  const url=cfg.streamUrl||'';
  if(url===lastUrl) return; lastUrl=url;
  const src=embed(url);
  $('vid').innerHTML=src?`<div class="video"><iframe src="${esc(src)}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe></div>`:'<p class="mu">Nenhuma transmissão no momento.</p>';
}
function renderRank(){
  const tot={};
  teams.forEach(t=>tot[t.id]={t,amt:0,n:0});
  bets.filter(b=>b.status!=='rejected').forEach(b=>{if(tot[b.team]){tot[b.team].amt+=b.amount;tot[b.team].n++;}});
  const list=Object.values(tot).sort((a,b)=>b.amt-a.amt);
  const sum=list.reduce((s,x)=>s+x.amt,0), max=list[0]?list[0].amt:0, nb=list.reduce((s,x)=>s+x.n,0);
  $('stats').innerHTML=`<div class="stat"><div><b>${nb}</b><span class="mu">apostas</span></div><div><b>🪙 ${sum.toFixed(0)}</b><span class="mu">total apostado</span></div></div>`;
  $('rank').innerHTML=list.map((x,i)=>{
    const pct=sum?Math.round(x.amt/sum*100):0, w=max?x.amt/max*100:0;
    return `<div class="row ${i===0&&max>0?'lead':''}" style="padding:12px;border-radius:12px;margin-bottom:8px;border:1px solid var(--line)">
      <span class="pos">${i+1}º</span><b style="flex:1">${esc(x.t.name)}${i===0&&max>0?' 🔥':''}</b>
      <span class="odd">${Number(x.t.odd).toFixed(2)}x</span>
      <div style="width:100%"><div class="bar"><i style="width:${w}%"></i></div>
      <span class="mu">🪙 ${x.amt.toFixed(0)} · ${pct}% · ${x.n} aposta${x.n===1?'':'s'}</span></div></div>`;
  }).join('')||'<p class="mu">Nenhum time cadastrado.</p>';
}
auth.onAuthStateChanged(u=>{
  unsubs.forEach(f=>f());unsubs=[];
  $('needlogin').classList.toggle('hide',!!u);$('main').classList.toggle('hide',!u);
  if(!u) return;
  isAdmin=u.email.toLowerCase()===ADMIN_EMAIL.toLowerCase();
  $('admlink').classList.toggle('hide',!isAdmin);
  unsubs.push(db.collection('teams').onSnapshot(s=>{teams=s.docs.map(d=>({id:d.id,...d.data()}));renderRank();}));
  unsubs.push(db.collection('bets').onSnapshot(s=>{bets=s.docs.map(d=>d.data());renderRank();}));
  unsubs.push(db.collection('config').doc('main').onSnapshot(d=>{cfg=d.data()||{};renderVideo();}));
});
async function saveStream(){
  const v=$('surl').value.trim(); if(!v) return toast('Cole um link');
  await db.collection('config').doc('main').set({streamUrl:v},{merge:true});$('surl').value='';toast('Link salvo!');
}
async function clearStream(){await db.collection('config').doc('main').set({streamUrl:''},{merge:true});toast('Transmissão removida');}
