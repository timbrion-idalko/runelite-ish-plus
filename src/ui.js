import { DB, addXP, save, toast } from './data.js';

export function renderUI() {
  renderInventory(); renderSkills(); renderToolbar(); renderQuests(); renderEquip();
  document.getElementById('stats').innerHTML = statsHTML();
  updateHealthBar();
}

export function statsHTML(){
  const p = DB.player;
  return 'Pos: ' + p.pos.x.toFixed(1) + ', ' + p.pos.y.toFixed(1) + ', ' + p.pos.z.toFixed(1) +
         '<br/>HP: ' + p.hp + '/' + p.maxhp + ' | Stamina: ' + p.stamina.toFixed(0) + ' | Active slot: ' + (p.hotbarIndex+1);
}

export function renderInventory() {
  const inv = DB.player.inventory;
  const el = document.getElementById('inventory');
  el.innerHTML = '<b>Inventory</b> (' + inv.length + ') <button id=\"openCraft\">Crafting</button><hr/>' + inv.map((it,i)=>{
    const req = it.req ? '(' + Object.entries(it.req).map(([k,v])=>k + ' ' + v).join(', ') + ')' : '';
    const eatBtn = it.slot==='food' ? '<button data-i=\"' + i + '\" data-act=\"eat\">Eat</button>' : '';
    return '<div>' + (it.name || it.id) + ' ' + req +
      ' <button data-i=\"' + i + '\" data-act=\"equip\">Equip</button>' +
      ' <button data-i=\"' + i + '\" data-act=\"drop\">Drop</button> ' + eatBtn + '</div>';
  }).join('') + '<hr/><b>Tips:</b> Craft basic gear, then explore. Combat grants combat XP.';

  el.querySelector('#openCraft').onclick = ()=> showCrafting();
  el.querySelectorAll('button[data-act=\"equip\"]').forEach(btn=>{ btn.onclick = ()=> equipItem(parseInt(btn.dataset.i)); });
  el.querySelectorAll('button[data-act=\"drop\"]').forEach(btn=>{ btn.onclick = ()=> { inv.splice(parseInt(btn.dataset.i),1); renderUI(); save(); }; });
  el.querySelectorAll('button[data-act=\"eat\"]').forEach(btn=>{ btn.onclick = ()=> { const i = parseInt(btn.dataset.i); eatFood(i); }; });
}

export function eatFood(i) {
  const it = DB.player.inventory[i];
  if (!it || it.slot!=='food') return;
  DB.player.hp = Math.min(DB.player.maxhp, DB.player.hp + (it.heal||5));
  DB.player.inventory.splice(i,1);
  updateHealthBar();
  toast('Nom nom. Restored some HP.');
  renderInventory(); save();
}

export function renderEquip() {
  const el = document.getElementById('equip');
  const eq = DB.player.equipment;
  el.innerHTML = '<b>Equipment</b><hr/>' +
    '<div>Weapon: ' + (eq.weapon?.name || '-') + '</div>' +
    '<div>Head: ' + (eq.head?.name || '-') + '</div>' +
    '<div>Body: ' + (eq.body?.name || '-') + '</div>';
}

export function renderSkills() {
  const el = document.getElementById('skills');
  el.innerHTML = '<b>Skills</b><hr/>' + Object.entries(DB.player.skills).map(([k,v])=>{
    return '<div style=\"display:flex;justify-content:space-between;gap:8px\"><span>' + k + '</span><span>Lv ' + v.level + ' (' + v.xp + '/' + Math.max(1, v.level*25) + ')</span></div>';
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
  el.innerHTML = '<b>Quests</b><hr/>' + active.map(q=>{
    const prog = q.goals.map(g=>{
      const cur = (g.progress||0); const need = g.qty;
      return '<div>' + g.kind + ' ' + g.item + (g.or?(' / ' + g.or):'') + ': ' + cur + '/' + need + '</div>';
    }).join('');
    return '<div><b>' + q.name + '</b><br/><small>' + q.desc + '</small>' + prog + '</div>';
  }).join('<hr/>') + (completed.length? ('<hr/><b>Completed</b><br/>' + completed.map(q=>q.name).join(', ')) : '');
}

export function equipItem(i) {
  const it = DB.player.inventory[i]; if (!it) return;
  if (it.req) { for (const [skill,lvl] of Object.entries(it.req)) { if ((DB.player.skills[skill]?.level ?? 1) < lvl) { toast('Requires ' + skill + ' ' + lvl); return; } } }
  if (it.slot==='weapon' || it.slot==='head' || it.slot==='body') {
    DB.player.equipment[it.slot] = it; toast('Equipped ' + (it.name || it.id));
  } else {
    DB.player.inventory.splice(i,1); DB.player.inventory.unshift(it); DB.player.hotbarIndex = 0; toast('Equipped ' + (it.name || it.id) + ' to hotbar');
  }
  renderToolbar(); renderInventory(); renderEquip(); save();
}

export function updateXPBar(skill='combat') {
  const s = DB.player.skills[skill];
  const pct = Math.min(99, (s.xp / Math.max(1, s.level*25))*100);
  document.getElementById('xpBar').style.width = pct+'%';
}

export function addToInventory(id, qty=1, atlas) {
  for (let i=0;i<qty;i++) DB.player.inventory.push(atlas[id] ? { id, ...(atlas[id]) } : { id });
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

export function showCrafting() {
  const modal = document.getElementById('craftModal');
  modal.style.display = 'block';
  modal.innerHTML = '<b>Crafting</b> <button id=\"closeCraft\">X</button><hr/>' + renderCraftingList();
  modal.querySelector('#closeCraft').onclick = ()=> { modal.style.display='none'; };
}

export function renderCraftingList() {
  const recipes = window.GAME_DATA.recipes;
  const inv = DB.player.inventory;
  return recipes.map((r, idx)=>{
    const can = r.in.every(req => inv.filter(i=>i.id===req.id).length >= req.qty);
    const reqStr = r.in.map(req => req.id + '×' + req.qty).join(', ');
    return '<div style=\"margin-bottom:6px\"><b>' + r.name + '</b> — <small>' + reqStr + '</small> ' +
      '<button data-r=\"' + idx + '\" ' + (can?'':'disabled') + '>Craft</button></div>';
  }).join('');
}

export function bindCraftingHandlers(recipes, addItemCb, addXPCb) {
  const modal = document.getElementById('craftModal');
  modal.querySelectorAll('button[data-r]').forEach(btn=>{
    btn.onclick = ()=> {
      const r = recipes[parseInt(btn.dataset.r)]; const inv = DB.player.inventory;
      for (const req of r.in) {
        let need = req.qty;
        for (let i=inv.length-1; i>=0 && need>0; i--) { if (inv[i].id===req.id) { inv.splice(i,1); need--; } }
      }
      for (let i=0;i<r.out.qty;i++) addItemCb(r.out.id, 1);
      addXPCb(DB.player, r.skill, r.xp);
      modal.innerHTML = '<b>Crafting</b> <button id=\"closeCraft\">X</button><hr/>' + renderCraftingList();
      modal.querySelector('#closeCraft').onclick = ()=> { modal.style.display='none'; };
    };
  });
}

export function updateHealthBar(){
  const pct = Math.max(0, Math.min(100, (DB.player.hp/DB.player.maxhp)*100));
  document.getElementById('healthBar').style.width = pct+'%';
}
