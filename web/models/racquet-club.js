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
    ['hopper','Ball Hopper',3,8000,{balls:10}], ['basket','Wilson Ball Basket',3,30000,{balls:20}],
    ['cart','Pro Ball Cart',3,85000,{balls:35}], ['machine','Golden Ball Machine',3,240000,{balls:50}],
  ].map(([id,name,slot,price,effect])=>({id,name,slot,price,effect}));
  const racquet = id => racquets[Number(id) - 1];
  const accessory = id => accessories.find(item => item.id === id);
  const config = {maxLuck:50, bonusEvery:10, dailyLimit:50, rewards:{
    player:{amount:2,cap:20,cooldown:1500}, tab:{amount:1,cap:5,cooldown:2500},
    comparison:{amount:3,cap:5,cooldown:3000}, filter:{amount:1,cap:7,cooldown:3000},
  }};
  const fuel = [
    ['banana','Rally Banana',300,'luck',{luck:1.5},1],
    ['gel','Energy Gel',900,'luck',{luck:2},1],
    ['match','Match Point Gel',3000,'luck',{luck:3},1],
    ['slam','Grand Slam Fuel',12000,'luck',{luck:5},1],
    ['training','Training Banana Pack',2000,'luck',{luck:1.5},5],
    ['tournament','Tournament Gel Pack',7500,'luck',{luck:2},5],
    ['champion','Champion Fuel Pack',28000,'luck',{luck:3},10],
    ['electrolyte','Electrolyte Drink',2500,'luck',{luck:1.5},0,10],
    ['hydration','Court Hydration Mix',9000,'luck',{luck:2},0,10],
    ['recovery','Pro Recovery Fuel',20000,'luck',{luck:2.5},0,15],
    ['mutation','Mutation Gel',2000,'mutation',{mutation:1.5},3],
    ['ball','Ball Boost Banana',1800,'balls',{balls:25},0,10],
    ['shake','Club Cash Shake',2400,'sale',{sale:1.25},3],
    ['precision','Precision Fuel',10500,'luck',{luck:2,mutation:1.2},3],
  ].map(([id,name,price,slot,effect,charges,minutes])=>({id,name,price,slot,effect,charges,minutes}));
  const fuelItem = id => fuel.find(item => item.id === id);
  const recipes = {
    match:{ingredients:{gel:2},fee:500},
    tournament:{ingredients:{gel:3},fee:3000},
    slam:{ingredients:{match:2},fee:5000},
    hydration:{ingredients:{electrolyte:2},fee:3500},
    champion:{ingredients:{tournament:2},fee:12000},
    precision:{ingredients:{match:1,mutation:1},fee:4000},
  };
  const keyTiers = [2,3,4,5,6,7];
  const keyName = tier => tiers[tier][0] + ' Racquet Key';
  const initial = () => ({
    enabled:false, skip:false, balls:0, cash:0, spins:0, bonusSpins:0, earned:0, cashEarned:0,
    cashSpent:0, duplicatesSold:0, items:{}, gear:{}, equipped:{}, favourite:null, daily:{}, last:null, keys:[], nextKey:1, keysEarned:{}, keysRedeemed:0, lastKey:null,
    fuel:{}, boosts:{}, fuelBought:0, fuelCrafted:0, fuelUsed:0, strongestLuck:0, ballRemainder:0
  });

  function effects(state) {
    const result = {luck:1, duration:5, sale:1, mutation:1, bonus:2, titanium:false, balls:0};
    slots.forEach((_, slot) => {
      const item = accessory(state.equipped[slot]);
      if (!item || item.slot !== slot || !state.gear[item.id]) return;
      const e = item.effect;
      result.luck *= e.luck || 1;
      result.sale *= e.sale || 1;
      result.mutation *= e.mutation || 1;
      result.balls += e.balls || 0;
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

  function activeBoosts(state, now) {
    return Object.entries(state.boosts).flatMap(([slot, boost]) => {
      const item = fuelItem(boost.id);
      if (!item || item.slot !== slot || (boost.expires ? boost.expires <= now : boost.remaining <= 0)) return [];
      return [{...item, ...boost}];
    });
  }

  function combined(state, now) {
    const result = effects(state);
    const boosts = activeBoosts(state, now);
    for (const boost of boosts) {
      result.luck *= boost.effect.luck || 1;
      result.mutation *= boost.effect.mutation || 1;
      result.sale *= boost.effect.sale || 1;
      result.balls += boost.effect.balls || 0;
    }
    return {...result, boosts};
  }

  function next(state, now = Date.now()) {
    const equipped = effects(state), all = combined(state, now);
    const bonusSpin = (state.spins + 1) % config.bonusEvery === 0;
    const uncappedLuck = all.luck * (bonusSpin ? all.bonus : 1);
    return {...all, gearLuck:equipped.luck, bonusSpin, uncappedLuck, effectiveLuck:Math.min(config.maxLuck, uncappedLuck)};
  }

  function tierWeights(weights, tier) {
    return racquets.filter(r => r.tier === tier).map(r => ({id:r.id, weight:weights[r.id - 1]}));
  }

  function wheel(weights) {
    return [
      ...racquets.filter(r => r.tier < 2).map(r => ({id:r.id, tier:r.tier, weight:weights[r.id - 1]})),
      ...keyTiers.map(tier => ({tier, key:true, weight:tierWeights(weights,tier).reduce((sum,r)=>sum+r.weight,0)})),
    ];
  }

  function select(entries, random) {
    let remaining = random;
    for (const entry of entries) {
      remaining -= entry.weight;
      if (remaining < 0) return entry;
    }
    return entries.at(-1);
  }

  function award(state, id, now) {
    const item = state.items[id] ||= {count:0, pulled:0, first:now, last:now, locked:false};
    item.count++;
    item.pulled++;
    item.last = now;
    return item.pulled === 1;
  }

  function makeKey(state, tier, weights, now) {
    const within = tierWeights(weights, tier);
    const total = within.reduce((sum, r) => sum + r.weight, 0);
    const key = {id:state.nextKey++, tier, acquired:now,
      weights:within.map(r => ({id:r.id, weight:r.weight / total}))};
    state.keys.push(key);
    state.keysEarned[tier] = (state.keysEarned[tier] || 0) + 1;
    return key;
  }

  function consume(state, slot) {
    const boost = state.boosts[slot];
    if (boost && !boost.expires && --boost.remaining <= 0) delete state.boosts[slot];
  }

  function spin(state, random, now) {
    if (state.balls < 1) return null;
    const setup = next(state, now);
    const weights = probabilities(setup.effectiveLuck, setup.mutation);
    const result = select(wheel(weights),random);
    state.balls--;
    state.spins++;
    if (setup.bonusSpin) state.bonusSpins++;
    state.strongestLuck = Math.max(state.strongestLuck, setup.effectiveLuck);
    for (const boost of setup.boosts) if (boost.slot === 'luck' || boost.slot === 'mutation') consume(state,boost.slot);
    const last = {id:result.id, tier:result.tier, key:!!result.key, odds:result.weight, bonusSpin:setup.bonusSpin,
      effectiveLuck:setup.effectiveLuck, mutation:setup.mutation, duration:setup.duration, titanium:setup.titanium};
    if (result.key) makeKey(state,result.tier,weights,now);
    else last.new = award(state,result.id,now);
    return state.last = last;
  }

  function redeem(state, id, random, now) {
    const index = state.keys.findIndex(key => key.id === id);
    if (index < 0) return null;
    const key = state.keys[index];
    const result = select(key.weights,random);
    state.keys.splice(index,1);
    state.keysRedeemed++;
    const {duration,titanium} = effects(state);
    return state.lastKey = {id:result.id,tier:key.tier,odds:result.weight,new:award(state,result.id,now),
      duration,titanium};
  }

  function buyFuel(state, id) {
    const item = fuelItem(id);
    if (!item || state.cash < item.price) return false;
    state.cash -= item.price;
    state.cashSpent += item.price;
    state.fuel[id] = (state.fuel[id] || 0) + 1;
    state.fuelBought++;
    return true;
  }

  function craft(state, id) {
    const recipe = Object.hasOwn(recipes,id) && recipes[id];
    if (!recipe || state.cash < recipe.fee) return false;
    const ingredients = Object.entries(recipe.ingredients);
    if (ingredients.some(([item,count]) => (state.fuel[item] || 0) < count)) return false;
    for (const [item,count] of ingredients) state.fuel[item] -= count;
    state.cash -= recipe.fee;
    state.cashSpent += recipe.fee;
    state.fuel[id] = (state.fuel[id] || 0) + 1;
    state.fuelCrafted++;
    return true;
  }

  function activate(state, id, now, replace = false) {
    const item = fuelItem(id);
    if (!item || !state.fuel[id]) return false;
    const current = activeBoosts(state,now).find(boost => boost.slot === item.slot);
    if (current && !replace) return false;
    state.fuel[id]--;
    state.fuelUsed++;
    state.boosts[item.slot] = item.minutes ? {id,expires:now + item.minutes * 60000} : {id,remaining:item.charges};
    return true;
  }

  function reward(state, action, key, now) {
    const rule = config.rewards[action];
    if (!rule || !key) return 0;
    const day = new Intl.DateTimeFormat('en-CA', {timeZone:'Australia/Melbourne', year:'numeric', month:'2-digit', day:'2-digit'}).format(now);
    if (state.daily.day !== day) state.daily = {day, balls:0, actions:{}};
    const daily = state.daily;
    const group = daily.actions[action] ||= {last:0, keys:[]};
    if (now - group.last < rule.cooldown || group.keys.length >= rule.cap || group.keys.includes(key)) return 0;
    const available = config.dailyLimit - daily.balls;
    if (available <= 0) return 0;
    const units = rule.amount * (100 + combined(state,now).balls) + state.ballRemainder;
    const amount = Math.min(Math.floor(units / 100), available);
    state.ballRemainder = units % 100;
    if (amount <= 0) return 0;
    group.last = now;
    group.keys.push(key);
    daily.balls += amount;
    state.balls += amount;
    state.earned += amount;
    return amount;
  }

  function sellValue(state, id, now = Date.now()) {
    return Math.round(racquet(id).value * combined(state,now).sale);
  }

  function sell(state, id, quantity, confirmed = false, now = Date.now(), useBoost = true) {
    const item = state.items[id], catalog = racquet(id);
    if (!catalog || !item || item.locked || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > item.count) return 0;
    if (catalog.tier >= 3 && quantity === item.count && !confirmed) return 0;
    const payout = quantity * sellValue(state, id,now);
    if (useBoost && activeBoosts(state,now).some(b=>b.slot==='sale')) consume(state,'sale');
    state.duplicatesSold += Math.min(quantity, item.count - 1);
    item.count -= quantity;
    if (!item.count && state.favourite === catalog.id) state.favourite = null;
    state.cash += payout;
    state.cashEarned += payout;
    return payout;
  }

  function sellDuplicates(state) {
    const now = Date.now();
    const payout = racquets.reduce((sum, r) => sum + sell(state, r.id, (state.items[r.id]?.count || 0) - 1,false,now,false), 0);
    if (payout && activeBoosts(state,now).some(b=>b.slot==='sale')) consume(state,'sale');
    return payout;
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
    pick, next, spin, reward, sellValue, sell, sellDuplicates, equip, buy, keyName, keyTiers, wheel, select,
    makeKey, redeem, fuel, fuelItem, recipes, buyFuel, craft, activate, activeBoosts};
  if (typeof module === 'object') module.exports = api;
  else root.BRTARacquetModel = api;
})(globalThis);
