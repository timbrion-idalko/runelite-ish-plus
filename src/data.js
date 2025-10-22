export const DB = {
  player: {
    pos: { x:0, y:2, z:0 },
    rotY: 0,
    hp: 30, maxhp: 30,
    stamina: 100,
    hotbarIndex: 0,
    inventory: [
      { id:'bronze-axe', name:'Bronze Hatchet', slot:'tool', power:1, req:{ woodcutting:1 } },
      { id:'bronze-pick', name:'Bronze Pickaxe', slot:'tool', power:1, req:{ mining:1 } },
      { id:'bronze-sword', name:'Bronze Sword', slot:'weapon', power:2, req:{ combat:1 } },
      { id:'bread', name:'Bread', slot:'food', heal:8 }
    ],
    equipment: { weapon: null, head: null, body: null },
    skills: {
      woodcutting: { level:1, xp:0 },
      mining: { level:1, xp:0 },
      crafting: { level:1, xp:0 },
      smithing: { level:1, xp:0 },
      fishing: { level:1, xp:0 },
      combat: { level:1, xp:0 }
    },
    quests: { active: [], completed: [] }
  },
  items: {
    log: { name:'Log', stack:true },
    fiber: { name:'Plant Fiber', stack:true },
    ore: { name:'Copper Ore', stack:true },
    bar: { name:'Bronze Bar', stack:true },
    stick: { name:'Stick', stack:true },
    'slime-goo': { name:'Slime Goo', stack:true },
    bread: { name:'Bread', slot:'food', heal:8 },
    'bronze-axe': { name:'Bronze Hatchet', slot:'tool', power:1, req:{ woodcutting:1 } },
    'iron-axe': { name:'Iron Hatchet', slot:'tool', power:2, req:{ woodcutting:5 } },
    'steel-axe': { name:'Steel Hatchet', slot:'tool', power:3, req:{ woodcutting:10 } },
    'bronze-pick': { name:'Bronze Pickaxe', slot:'tool', power:1, req:{ mining:1 } },
    'iron-pick': { name:'Iron Pickaxe', slot:'tool', power:2, req:{ mining:5 } },
    'steel-pick': { name:'Steel Pickaxe', slot:'tool', power:3, req:{ mining:10 } },
    'bronze-sword': { name:'Bronze Sword', slot:'weapon', power:2, req:{ combat:1 } },
    'iron-sword': { name:'Iron Sword', slot:'weapon', power:3, req:{ combat:6 } },
    'steel-sword': { name:'Steel Sword', slot:'weapon', power:5, req:{ combat:12 } },
    'leather-cap': { name:'Leather Cap', slot:'head', armor:1, req:{ combat:2 } },
    'iron-helm': { name:'Iron Helm', slot:'head', armor:2, req:{ combat:8 } }
  },
  recipes: [
    { out:{ id:'stick', qty:2 }, in:[{id:'log',qty:1}], skill:'crafting', xp:5, name:'Split Log → Sticks' },
    { out:{ id:'bar', qty:1 }, in:[{id:'ore',qty:2}], skill:'smithing', xp:8, name:'Smelt Bronze' },
    { out:{ id:'iron-axe', qty:1 }, in:[{id:'bar',qty:2},{id:'stick',qty:1}], skill:'smithing', xp:15, name:'Forge Iron Hatchet' },
    { out:{ id:'iron-pick', qty:1 }, in:[{id:'bar',qty:2},{id:'stick',qty:1}], skill:'smithing', xp:15, name:'Forge Iron Pickaxe' },
    { out:{ id:'iron-sword', qty:1 }, in:[{id:'bar',qty:3},{id:'stick',qty:1}], skill:'smithing', xp:20, name:'Forge Iron Sword' },
    { out:{ id:'bread', qty:1 }, in:[{id:'fiber',qty:3}], skill:'crafting', xp:4, name:'Bake Bread (simple)' }
  ],
  quests: [
    { id:'first-steps', name:'First Steps', desc:'Chop 3 logs and mine 3 ore. Return to the Guide.',
      goals:[{ kind:'gather', item:'log', qty:3 }, { kind:'gather', item:'ore', qty:3 }],
      rewards:[{id:'bar',qty:2},{id:'stick',qty:2}], xp:{ woodcutting:10, mining:10 } },
    { id:'apprentice-smith', name:'Apprentice Smith', desc:'Smelt a bar and forge an iron tool.',
      goals:[{ kind:'craft', item:'bar', qty:1 }, { kind:'craft', item:'iron-axe', qty:1, or:'iron-pick' }],
      rewards:[{id:'iron-helm',qty:1}], xp:{ smithing:20 } },
    { id:'slime-buster', name:'Slime Buster', desc:'Defeat 3 slimes around the hub.',
      goals:[{ kind:'slay', item:'slime', qty:3 }], rewards:[{id:'iron-sword',qty:1}], xp:{ combat:30 } }
  ]
};

export function xpToNext(level) {
  const next = Math.floor(level + 300 * Math.pow(2, level/7));
  return Math.floor(next/4);
}

export function addXP(player, skill, amount) {
  const s = player.skills[skill];
  s.xp += amount;
  while (s.xp >= xpToNext(s.level)) {
    s.xp -= xpToNext(s.level);
    s.level++;
    const el = document.getElementById('notif');
    if (el) { el.textContent = 'Level up! ' + skill + ' is now ' + s.level + '.'; el.style.display='block'; setTimeout(()=>{el.style.display='none';},1500); }
  }
}

export function toast(msg) {
  const el = document.getElementById('notif');
  el.textContent = msg; el.style.display = 'block';
  setTimeout(()=>{ el.style.display='none'; }, 1500);
}

export function save(db) { localStorage.setItem('rs-plus-save', JSON.stringify(db.player)); }
export function load(db) {
  const raw = localStorage.getItem('rs-plus-save'); if (!raw) return;
  try { const p = JSON.parse(raw); Object.assign(db.player, p); } catch(e){}
}
