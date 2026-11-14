(function (root) {
  'use strict';

  const tiers = [
    ['Common', 12, 0, 8, 35], ['Uncommon', 21, .35, 60, 140], ['Rare', 30, .65, 180, 550],
    ['Epic', 38, 1, 900, 2500], ['Legendary', 46, 1.05, 3000, 7500],
    ['Mythic', 52, 1.10, 9000, 20000], ['Collector', 58, 1.15, 25000, 55000],
    ['Ultimate', 60, 1.20, 80000, 120000],
  ];
  const rows = [
    [1, "Wilson Tour Slam", "Wilson", 0, 0],
    [2, "Head Ti.S6", "Head", 12, 0],
    [3, "Babolat Boost Drive", "Babolat", 13, 0],
    [4, "Artengo TR100", "Artengo", 14, 0],
    [5, "Yonex EZONE Ace", "Yonex", 15, 0],
    [6, "Pro Staff 103", "Wilson", 16, 0],
    [7, "Yonex Astrel 105", "Yonex", 17, 0],
    [8, "Pure Aero Team '26", "Babolat", 18, 0],
    [9, "VCORE 100L", "Yonex", 19, 0],
    [10, "Clash 100L v3", "Wilson", 20, 0],
    [11, "EZONE 100L", "Yonex", 21, 0],
    [12, "Extreme Team '26", "Head", 22, 0],
    [13, "Extreme MP '26", "Head", 45, 0],
    [14, "TF-X1 285", "Tecnifibre", 50, 0],
    [15, "Blackout 300", "Solinco", 55, 0],
    [16, "Shift 99", "Wilson", 60, 0],
    [17, "Gravity MP L", "Head", 65, 0],
    [18, "Prince Tour 100", "Prince", 75, 0],
    [19, "Dunlop CX 200", "Dunlop", 85, 0],
    [20, "FX 500 Tour", "Dunlop", 100, 0],
    [21, "Ultra 100 v5", "Wilson", 120, 0],
    [22, "Blade 100 v10", "Wilson", 150, 0],
    [23, "Pure Aero 98 '26", "Babolat", 170, 8],
    [24, "Pure Drive '25", "Babolat", 190, 0],
    [25, "EZONE 100", "Yonex", 215, 0],
    [26, "VCORE 100", "Yonex", 245, 0],
    [27, "Percept 100", "Yonex", 280, 0],
    [28, "Boom MP '26", "Head", 330, 0],
    [29, "Phantom 100X", "Prince", 400, 0],
    [30, "EZONE 98", "Yonex", 500, 0],
    [31, "Extreme Pro '26", "Head", 2500, 13],
    [32, "Speed Tour '26", "Head", 3000, 0],
    [33, "Percept 97", "Yonex", 3500, 0],
    [34, "Radical MP '25", "Head", 4000, 0],
    [35, "Pure Strike 98", "Babolat", 4800, 0],
    [36, "T-Fight 305S", "Tecnifibre", 5800, 0],
    [37, "Pro Staff 97", "Wilson", 7000, 0],
    [38, "CX 200 Tour", "Dunlop", 8500, 0],
    [39, "Speed MP '26", "Head", 10000, 0],
    [40, "Shift 99 Pro", "Wilson", 12000, 16],
    [41, "VCORE 95", "Yonex", 14000, 0],
    [42, "Whiteout 305 Camo", "Solinco", 16000, 0],
    [43, "Pure Drive 98", "Babolat", 18000, 0],
    [44, "VCORE 98", "Yonex", 20000, 26],
    [45, "Gravity Tour", "Head", 23000, 0],
    [46, "Volkl C10 Pro", "Völkl", 26000, 0],
    [47, "Pure Aero Rafa Origin", "Babolat", 30000, 0],
    [48, "Prince Phantom 93P", "Prince", 35000, 0],
    [49, "Speed Pro Legend", "Head", 40000, 39],
    [50, "Blade 98 v10", "Wilson", 50000, 0],
    [51, "EZONE 98 Espresso", "Yonex", 65000, 30],
    [52, "Gravity Tour Zverev", "Head", 80000, 45],
    [53, "Blade 98 US Open", "Wilson", 90000, 50],
    [54, "Wilson RF 01 Pro", "Wilson", 110000, 0],
    [55, "Pro Staff RF97", "Wilson", 130000, 0],
    [56, "EZONE 98 Tour", "Yonex", 150000, 0],
    [57, "Prestige MP", "Head", 180000, 0],
    [58, "Prestige MP Limited", "Head", 220000, 57],
    [59, "RF 01 Pro HOF", "Wilson", 300000, 0],
    [60, "Yonex REGNA 98", "Yonex", 400000, 0],
  ];
  const fallback = 1 - rows.slice(1).reduce((sum, row) => sum + 1 / row[3], 0);
  const racquets = rows.map(([id, name, brand, denominator, parent]) => {
    const tier = tiers.findIndex(row => id <= row[1]);
    const [rarity, end, exponent, minimum, maximum] = tiers[tier];
    const start = (tiers[tier - 1]?.[1] || 0) + 1;
    return {id, name, brand, denominator, parent, tier, rarity, exponent,
      base: denominator ? 1 / denominator : fallback,
      value: Math.round(minimum + (maximum - minimum) * (id - start) / (end - start))};
  });
  const slots = ['Strings', 'Grips', 'Dampeners', 'Special'];
  const accessories = [
    ['lynx','Head Lynx',0,250,{luck:1.2}], ['polytour','Yonex PolyTour Pro',0,1000,{luck:1.5}],
    ['hyperg','Solinco Hyper-G',0,3500,{luck:2}], ['rpm','Babolat RPM Blast',0,12000,{luck:3}],
    ['alu','Luxilon ALU Power',0,40000,{luck:4}],
    ['overgrip','Wilson Pro Overgrip',1,200,{duration:4.7}], ['grap','Yonex Super Grap',1,750,{duration:4.3}],
    ['tourna','Tourna Grip',1,2500,{duration:3.8}], ['original','Babolat VS Original',1,8000,{duration:3.2}],
    ['prime','Head Prime Tour',1,25000,{duration:2.5}],
    ['feel','Wilson Pro Feel',2,350,{sale:1.1}], ['damp','Babolat Custom Damp',2,1500,{sale:1.2}],
    ['stopper','Yonex Vibration Stopper',2,5500,{mutation:1.1}], ['logo','Head Logo Dampener',2,18000,{mutation:1.2}],
    ['lead','Lead Tape',3,12000,{bonus:3}], ['graphite','Graphite Tuning Kit',3,65000,{mutation:1.25}],
    ['titanium','Titanium Stabilizer',3,150000,{luck:1.3,titanium:true}], ['gold','Golden Grommet',3,275000,{bonus:5}],
  ].map(([id,name,slot,price,effect])=>({id,name,slot,price,effect}));
  const racquet = id => racquets[Number(id) - 1];
  const accessory = id => accessories.find(item => item.id === id);
  const config = {maxLuck:50, bonusEvery:10, dailyLimit:50, rewards:{
    player:{amount:2,cap:20,cooldown:1500}, tab:{amount:1,cap:5,cooldown:2500},
    comparison:{amount:3,cap:5,cooldown:3000}, filter:{amount:1,cap:7,cooldown:3000},
  }};
  const initial = () => ({
    enabled:false, skip:false, balls:0, cash:0, spins:0, bonusSpins:0, earned:0, cashEarned:0,
    cashSpent:0, duplicatesSold:0, items:{}, gear:{}, equipped:{}, favourite:null, daily:{}, last:null
  });

  function effects(state) {
    const result = {luck:1, duration:5, sale:1, mutation:1, bonus:2, titanium:false};
    slots.forEach((_, slot) => {
      const item = accessory(state.equipped[slot]);
      if (!item || item.slot !== slot || !state.gear[item.id]) return;
      const e = item.effect;
      result.luck *= e.luck || 1;
      result.sale *= e.sale || 1;
      result.mutation *= e.mutation || 1;
      if (e.duration) result.duration = e.duration;
      if (e.bonus) result.bonus = e.bonus;
      if (e.titanium) result.titanium = true;
    });
    return result;
  }

  function probabilities(luck = 1, mutation = 1) {
    luck = Math.min(config.maxLuck, Math.max(1, Number.isFinite(luck) ? luck : 1));
    mutation = Math.max(1, Number.isFinite(mutation) ? mutation : 1);
    if (luck === 1 && mutation === 1) return racquets.map(r => r.base);
    const weights = racquets.map(r => r.base * luck ** r.exponent * (r.parent ? mutation : 1));
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    return weights.map(weight => weight / total);
  }

  function pick(weights, random) {
    let remaining = random;
    for (let index = 0; index < weights.length - 1; index++) {
      remaining -= weights[index];
      if (remaining < 0) return racquets[index];
    }
    return racquets.at(-1);
  }

  function next(state) {
    const equipped = effects(state), bonus = (state.spins + 1) % config.bonusEvery === 0;
    return {...equipped, bonusSpin:bonus, effectiveLuck:Math.min(config.maxLuck, equipped.luck * (bonus ? equipped.bonus : 1))};
  }

  function spin(state, random, now) {
    if (state.balls < 1) return null;
    const setup = next(state);
    const weights = probabilities(setup.effectiveLuck, setup.mutation);
    const result = pick(weights, random);
    const item = state.items[result.id] ||= {count:0, pulled:0, first:now, last:now, locked:false};
    item.count++;
    item.pulled++;
    item.last = now;
    state.balls--;
    state.spins++;
    if (setup.bonusSpin) state.bonusSpins++;
    return state.last = {id:result.id, odds:weights[result.id - 1], new:item.pulled === 1, ...setup};
  }

  function reward(state, action, key, now) {
    const rule = config.rewards[action];
    if (!rule || !key) return 0;
    const day = new Intl.DateTimeFormat('en-CA', {timeZone:'Australia/Melbourne', year:'numeric', month:'2-digit', day:'2-digit'}).format(now);
    if (state.daily.day !== day) state.daily = {day, balls:0, actions:{}};
    const daily = state.daily;
    const group = daily.actions[action] ||= {last:0, keys:[]};
    if (now - group.last < rule.cooldown || group.keys.length >= rule.cap || group.keys.includes(key)) return 0;
    const amount = Math.min(rule.amount, config.dailyLimit - daily.balls);
    if (amount <= 0) return 0;
    group.last = now;
    group.keys.push(key);
    daily.balls += amount;
    state.balls += amount;
    state.earned += amount;
    return amount;
  }

  function sellValue(state, id) {
    return Math.round(racquet(id).value * effects(state).sale);
  }

  function sell(state, id, quantity, confirmed = false) {
    const item = state.items[id], catalog = racquet(id);
    if (!catalog || !item || item.locked || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > item.count) return 0;
    if (catalog.tier >= 3 && quantity === item.count && !confirmed) return 0;
    const payout = quantity * sellValue(state, id);
    state.duplicatesSold += Math.min(quantity, item.count - 1);
    item.count -= quantity;
    if (!item.count && state.favourite === catalog.id) state.favourite = null;
    state.cash += payout;
    state.cashEarned += payout;
    return payout;
  }

  function sellDuplicates(state) {
    return racquets.reduce((sum, r) => sum + sell(state, r.id, (state.items[r.id]?.count || 0) - 1), 0);
  }

  function equip(state, id) {
    const item = accessory(id);
    if (!item || !state.gear[id]) return false;
    state.equipped[item.slot] = id;
    return true;
  }

  function buy(state, id, equipNow = false) {
    const item = accessory(id);
    if (!item || state.gear[id] || state.cash < item.price) return false;
    state.cash -= item.price;
    state.cashSpent += item.price;
    state.gear[id] = true;
    if (equipNow) equip(state, id);
    return true;
  }

  const api = {config, tiers, slots, racquets, racquet, accessories, accessory, initial, effects, probabilities,
    pick, next, spin, reward, sellValue, sell, sellDuplicates, equip, buy};
  if (typeof module === 'object') module.exports = api;
  else root.BRTARacquetModel = api;
})(globalThis);
