import { DB, addXP, save, toast } from './data.js';

/* ---------- UI bootstrap ---------- */
export function initUI(){
  // Tabs
  document.querySelectorAll('.tabbtn').forEach(btn=>{
    btn.onclick = ()=>{
      document.querySelectorAll('.tabbtn').forEach(b=>b.classList.remove('active'));
      document.querySelectorAll('.tabpanel').forEach(p=>p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('tab-'+btn.dataset.tab).classList.add('active');
    };
  });

  // Reset save
  const reset = ()=>{ localStorage.removeItem('rs-plus-save'); location.reload(); };
  const btn = document.getElementById('resetBtn');
  if (btn) btn.onclick = reset;
  window.addEventListener('keydown', e=>{
    if (e.shiftKey && e.code === 'KeyR') reset();
  });
}

export function renderUI() {
  renderInventory(); renderSkills(); renderToolbar(); renderQuests(); renderEquip();
  document.getElementById('stats').innerHTML = statsHTML();
  updateHealthBar();
}

export function statsHTML(){
  const p = DB.player;
  return `HP: ${p.hp}/${p.maxhp} &nbsp;|&nbsp; Stamina: ${p.stamina.toFixed(0)} &nbsp;|&nbsp; Active slot: ${p.hotbarIndex+1}`;
}

/* ---------- Inventory (stacked) ---------- */
function isStackable(it){ return it && (it.stack || (!it.slot && !it.power && !it.armor)); }

export function renderInventory() {
  const inv = DB.player.inventory;
  const el = document.getElementById('inventory');

  // Group into stacks for display
  const stacks = [];
  for (const it of inv){
    const key = it.id;
    const st = stacks.find(s=>s.id===key);
    if (st) st.qty += (it.qty||1);
    else stacks.push({ ...it, qty: (it.qty||1) });
  }

  el.innerHTML = stacks.map((it,i)=>{
    const name = it.name || it.id;
    const qty = it.qty>1 ? ` <small>×${it.qty}</small>` : '';
    const equipBtn = it.slot ? `<button data-i="${i}" data-act="equip">Equip</button>` : '';
    const eatBtn = it.slot==='food' ? `<button data-i="${i}" data-act="eat">Eat</button>` : '';
    const dropBtns = isStackable(it)
      ? `<button data-i="${i}" data-act="drop1">Drop 1</button><button data-i="${i}" data-act="dropall">Drop All</button>`
      : `<button data-i="${i}" data-act="drop">Drop</button>`;
    return `<div class="row"><div>${name}${qty}</div><div class="actions">${equipBtn}${eatBtn}${dropBtns}</div></div>`;
  }).join('');

  // Bind actions
  el.querySelectorAll('button[data-act="equip"]').forEach(b=> b.onclick = ()=> equipStack(parseInt(b.dataset.i), stacks));
  el.querySelectorAll('button[data-act="eat"]').forEach(b=> b.onclick = ()=> eatStack(parseInt(b.dataset.i), stacks));
  el.querySelectorAll('button[data-act="drop"]').forEach(b=> b.onclick = ()=> dropExact(stacks[parseInt(b.dataset.i)], Infinity));
  el.querySelectorAll('button[data-act="drop1"]').forEach(b=> b.onclick = ()=> dropExact(stacks[parseInt(b.dataset.i)], 1));
  el.querySelectorAll('button[data-act="dropall"]').forEach(b=> b.onclick = ()=> dropExact(stacks[parseInt(b.dataset.i)], Infinity));
}

function dropExact(stack, amount){
  // Remove up to "amount" items matching the id
  let need = amount;
  for (let i=DB.player.inventory.length-1; i>=0 && need>0; i--){
    const it = DB.player.inventory[i];
    if (it.id===stack.id){
      const take = Math.min(need, it.qty||1);
      if ((it.qty||1) > take) { it.qty -= take; need -= take; }
      else { DB.player.inventory.splice(i,1); need -= take; }
    }
  }
  save(); renderInventory();
}

function eatStack(idx, stacks){
  const st = stacks[idx]; if (!st || st.slot!=='food') return;
  DB.player.hp = Math.min(DB.player.maxhp, DB.player.hp + (st.heal||5));
  dropExact(st, 1);
  updateHealthBar();
  toast('Nom nom. Restored some HP.');
}

function equipStack(idx, stacks){
  const it = stacks[idx]; if (!it) return;
  if (it.req) for (const [skill,lvl] of Object.entries(it.req)) {
    if ((DB.player.skills[skill]?.level ?? 1) < lvl) { toast(`Requires ${skill} ${lvl}`); return; }
  }
  if (it.slot==='weapon' || it.slot==='head' || it.slot==='body') {
    DB.player.equipment[it.slot] = it;
    toast(`Equipped ${it.name||it.id}`);
  } else {
    // Tool → move one to hotbar (front of inventory)
    removeOneById(it.id);
    DB.player.inventory.unshift({ ...it, qty:1 });
    DB.player.hotbarIndex = 0;
    toast(`Equipped ${it.name||it.id} to hotbar`);
  }
  renderToolbar(); renderInventory(); renderEquip(); save();
}

function removeOneById(id){
  for (let i=DB.player.inventory.length-1; i>=0; i--){
    const it = DB.player.inventory[i];
    if (it.id===id){
      if (it.qty && it.qty>1) it.qty -= 1;
      else DB.player.inventory.splice(i,1);
      return;
    }
  }
}

export function renderEquip() {
  const el = document.getElementById('equip');
  const eq = DB.player.equipment;
  el.innerHTML = `<b>Equipment</b><hr style="border-color:#26263a"/>
    <div>Weapon: ${eq.weapon?.name || '-'}</div>
    <div>Head: ${eq.head?.name || '-'}</div>
    <div>Body: ${eq.body?.name || '-'}</div>`;
}

export function renderSkills() {
  const el = document.getElementById('skills');
  el.innerHTML = Object.entries(DB.player.skills).map(([k,v])=>{
    const pct = Math.min(100, (v.xp/Math.max(1, v.level*25))*100);
    return `<div class="row"><div style="min-width:90px">${k}</div>
      <div style="flex:1; background:#0b0d20; border:1px solid #1f2142; border-radius:6px; overflow:hidden; height:12px">
        <div style="height:12px;width:${pct}%;background:linear-gradient(90deg,#6ee7b7,#22d3ee)"></div>
      </div>
      <div style="min-width:84px; text-align:right">Lv ${v.level} — ${v.xp}</div></div>`;
  }).join('');
}

export function renderToolbar() {
  const bar = document.getElementById('toolbar');
  const inv = DB.player.inventory;
  bar.innerHTML = '';
  for (let i=0;i<5;i++) {
    const slot = document.createElement('div');
    slot.className = 'slot';
    slot.dataset.active = (i===DB.player.hotbarIndex);
    slot.textContent = inv[i]?.name || '-';
    bar.appendChild(slot);
  }
}

export function renderQuests() {
  const el = document.getElementById('questlog');
  const active = DB.player.quests.active;
  const completed = DB.player.quests.completed;
  el.innerHTML = active.map(q=>{
    const prog = q.goals.map(g=>{
      const cur = (g.progress||0), need = g.qty;
      return `<div>${g.kind} ${g.item}${g.or?(' / '+g.or):''}: <b>${cur}/${need}</b></div>`;
    }).join('');
    return `<div class="row"><div><b>${q.name}</b><br/><small>${q.desc}</small></div><div>${prog}</div></div>`;
  }).join('') + (completed.length? (`<hr style="border-color:#26263a"/><b>Completed:</b> ${completed.map(q=>q.name).join(', ')}`) : '');
}

export function updateXPBar(skill='combat') {
  const s = DB.player.skills[skill];
  const pct = Math.min(99, (s.xp / Math.max(1, s.level*25))*100);
  document.getElementById('xpBar').style.width = pct+'%';
}

export function addToInventory(id, qty=1, atlas={}) {
  const meta = atlas[id] || {};
  // Try to find existing stack first
  const stackable = meta.stack || (!meta.slot && !meta.power && !meta.armor);
  if (stackable){
    const found = DB.player.inventory.find(i=>i.id===id && (i.stack || (!i.slot && !i.power && !i.armor)));
    if (found){ found.qty = (found.qty||1) + qty; }
    else DB.player.inventory.push({ id, ...meta, qty });
  } else {
    for (let i=0;i<qty;i++) DB.player.inventory.push({ id, ...meta, qty:1 });
  }
  save(); renderInventory();
}

export function progressQuest(kind, id, qty=1) {
  for (const q of DB.player.quests.active) {
    for (const g of q.goals) {
      if (g.kind===kind && (g.item===id || (g.or && g.or===id))) { g.progress = (g.progress||0) + qty; }
    }
    const done = q.goals.every(g => (g.progress||0) >= g.qty);
    if (done) {
      DB.player.quests.completed.push(q);
      DB.player.quests.active = DB.player.quests.active.filter(a=>a.id!==q.id);
      (q.rewards||[]).forEach(r => addToInventory(r.id, r.qty, {}));
      Object.entries(q.xp||{}).forEach(([sk, xp]) => addXP(DB.player, sk, xp));
      toast('Quest complete: ' + q.name + '!');
    }
  }
  renderQuests();
}

export function showCenterMessage(txt, ms=1200) {
  const el = document.getElementById('centerMsg');
  el.textContent = txt; el.style.opacity = 1;
  setTimeout(()=>{ el.style.opacity=0; }, ms);
}

export function updateHealthBar(){
  const pct = Math.max(0, Math.min(100, (DB.player.hp/DB.player.maxhp)*100));
  document.getElementById('healthBar').style.width = pct+'%';
}
