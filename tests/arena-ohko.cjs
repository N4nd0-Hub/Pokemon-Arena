/* OHKO rules use one fixed d100 roll in both Arena damage systems. */
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const blocks=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)];
const data=Object.fromEntries(blocks.filter(b=>/application\/json/.test(b[1])).map(b=>[b[1].match(/id="([^"]+)"/)[1],b[2]]));
const context={document:{getElementById:id=>({textContent:data[id]})},structuredClone,Math:Object.create(Math),module:{exports:{}}};
context.Math.random=()=>.5;
vm.runInNewContext(blocks.find(b=>b[2].includes('const HH = (() =>'))[2],context);
const H=context.module.exports,SD=JSON.parse(data.smogonSnapshot);
const names=Object.values(SD.moves).filter(m=>m.ohko).map(m=>m.name);
let checks=0;
const eq=(a,b,m)=>{assert.deepStrictEqual(JSON.parse(JSON.stringify(a)),JSON.parse(JSON.stringify(b)),m);checks++;};
const ok=(v,m)=>{assert(v,m);checks++;};
const P={kind:'pass'},A=n=>({kind:'move',moveId:H.normalizeName(n)});
const move=name=>{const d=SD.moves[H.normalizeName(name)];return {id:H.normalizeName(name),name:d.name,type:d.type,category:d.category,power:d.basePower,accuracy:d.accuracy===true?90:d.accuracy,alwaysHits:d.accuracy===true,active:true};};
function mon(id,moves,props={}){return {id,name:id,type1:'Normal',level:36,maxHp:400,stats:{hp:400,atk:100,def:100,spa:100,spd:100,spe:id==='attacker'?200:100},moves:moves.map(move),...props};}
function game(system,n,props={},enemy={}){context.Math.random=()=>.5;return H.newGame([mon('attacker',[n,'Mind Reader','Lock-On','Tackle'],props),mon('reserve-a',['Tackle'])],[mon('target',['Tackle','Protect','Substitute','Endure'],enemy),mon('reserve-b',['Tackle'])],{damageSystem:system});}
function attempt(g,n,r,evade='none',enemyAction=P){let calls=0;context.Math.random=()=>{calls++;return (r-.5)/100;};H.resolve(g,A(n),{...enemyAction,evade});return calls;}
eq(names.sort(),['Fissure','Guillotine','Horn Drill','Sheer Cold'],'All catalog OHKO moves are covered');
for(const system of ['standard','matrix-v0.2']){
 for(const n of names){
  let hits=0;
  for(let r=1;r<=100;r++){
   const g=game(system,n,{level:r%2?1:100},{level:r%2?100:1});
   const a=H.active(g,0),d=H.active(g,1),m=a.moves[0];
   // Old imports, editor overrides and stage extremes must not alter the rule.
   m.accuracy=r%2?1:100;m.power=300;m.alwaysHits=true;
   H.stage(g,0,'accuracy',r%2?-6:6,null,'test');H.stage(g,1,'evasion',r%2?6:-6,null,'test');
   eq(attempt(g,n,r,['none','reactive','active'][r%3]),1,n+' uses exactly one roll');
   eq(d.hp,r<=25?0:400,n+' fixed 25% boundary, unaffected by levels, overrides or dodge');
   eq(g.needSwitch[1],r<=25,n+' enters the forced replacement phase only on KO');
   ok(!g.log.some(x=>x.kind==='critical'),n+' never uses normal accuracy criticals');
   eq(g.log.filter(x=>x.kind==='ko').length,r<=25?1:0,n+' records the knockout exactly once');
   if(d.hp===0)hits++;
  }
  eq(hits,25,n+' succeeds on exactly 25 of the 100 equiprobable results');
  let g=game(system,n),m=H.active(g,0).moves[0];
  eq([m.power,m.accuracy,m.alwaysHits],[0,25,false],n+' normalized as OHKO');
  const effective=H.effectiveMove(g,0,m);
  eq([effective.power,effective.accuracy,effective.fixedDamage],[0,25,true],n+' has no regular base damage');
  eq(H.matrixProfile(H.active(g,0),H.active(g,1),{...m,power:300}),null,n+' has no matrix dice preview');
  ok(H.describeSpecial(m).includes('25%')&&!H.describeSpecial(m).includes('6d6'),n+' description uses the current rule');
  eq(H.moveCoverage(m),'auto',n+' is automated');
  H.active(g,1).hp=37;H.active(g,1).flags.ironDefense=true;g.screens[1]={reflect:{level:100},light:{level:100},veil:{level:100}};H.active(g,1).abilityName='Multiscale';
  attempt(g,n,25);eq(H.active(g,1).hp,0,n+' bypasses ordinary damage reduction');
  for(const side of [0,1]){g=game(system,n);H.active(g,side).abilityName='No Guard';eq(attempt(g,n,100,'active'),0,'No Guard on either side guarantees OHKO without a roll');eq(H.active(g,1).hp,0,'No Guard hit knocks out');}
  for(const aim of ['Mind Reader','Lock-On']){
   g=game(system,n);H.resolve(g,A(aim),P);ok(H.active(g,0).flags.fx.lockon,'Targeting effect is active');
   eq(attempt(g,n,100,'active'),0,aim+' guarantees the next OHKO without a roll');eq(H.active(g,1).hp,0,aim+' guarantees KO');ok(!H.active(g,0).flags.fx.lockon,aim+' is consumed');
   g=game(system,n);H.resolve(g,A(aim),P);H.resolve(g,P,P);attempt(g,n,100);eq(H.active(g,1).hp,400,aim+' expires after the next round');
   g=game(system,n);H.resolve(g,A(aim),P);H.switchTo(g,1,1);H.switchTo(g,1,0);ok(!H.active(g,0).flags.fx.lockon,aim+' ends when target leaves, even if it returns');attempt(g,n,100);eq(H.active(g,1).hp,400,'A returning target is not guaranteed');
   g=game(system,n);H.resolve(g,A(aim),P);H.switchTo(g,0,1);H.switchTo(g,0,0);attempt(g,n,100);eq(H.active(g,1).hp,400,aim+' ends when user leaves');
  }
  // A KO replacement must not let a queued enemy attack hit the incoming Pokémon.
  g=game(system,n);attempt(g,n,25,'none',A('Tackle'));eq(H.active(g,0).hp,400,'Knocked-out target cannot attack');const turn=g.turn;H.resolve(g,P,{kind:'switch',index:1});eq(g.turn,turn,'Replacement does not spend a new combat round');eq(H.active(g,1).hp,400,'Replacement does not take a free hit');
 }
 for(const ability of ['Hustle','Solar Power','Light Metal']){
  const g=game(system,'Guillotine',{abilityName:ability},{abilityName:'Light Metal'});H.setWeather(g,'sun',0);H.active(g,0).flags.focus=true;H.active(g,0).flags.dracoAccuracy=true;
  eq(attempt(g,'Guillotine',26,'active'),ability==='Solar Power'?2:1,'Accuracy abilities do not add an OHKO roll (Solar Power has its own recoil die)');eq(H.active(g,1).hp,400,'Accuracy abilities and Focus Energy do not rescue a failed OHKO');
 }
 for(const fx of ['telekinesis','glaiverush']){const g=game(system,'Guillotine');H.active(g,1).flags.fx={[fx]:{until:99,started:1}};g.field={gravity:{until:99}};eq(attempt(g,'Guillotine',26),1,fx+' does not guarantee OHKO');eq(H.active(g,1).hp,400,'Gravity and non-targeting effects do not change 25%');}
 // Existing immunity and survival protections keep their own rules.
 let g=game(system,'Guillotine',{}, {type1:'Ghost'});attempt(g,'Guillotine',25);eq(H.active(g,1).hp,400,'Ghost immunity still applies');
 g=game(system,'Fissure',{}, {type1:'Flying'});attempt(g,'Fissure',25);eq(H.active(g,1).hp,400,'Flying immunity still applies');
 for(const hp of [400,37]){g=game(system,'Guillotine',{}, {abilityName:'Sturdy'});H.active(g,1).hp=hp;attempt(g,'Guillotine',25);eq(H.active(g,1).hp,hp,'Sturdy prevents OHKO at any HP');}
 g=game(system,'Guillotine',{abilityName:'Mold Breaker'},{abilityName:'Sturdy'});attempt(g,'Guillotine',25);eq(H.active(g,1).hp,0,'Mold Breaker bypasses Sturdy immunity');
 g=game(system,'Guillotine',{}, {heldItem:'Focus Sash'});attempt(g,'Guillotine',25);eq(H.active(g,1).hp,1,'Focus Sash survives a landed OHKO');eq(H.active(g,1).heldItem,'','Focus Sash is consumed');
 g=game(system,'Guillotine');attempt(g,'Guillotine',25,'none',A('Endure'));eq(H.active(g,1).hp,1,'Endure survives a landed OHKO');
 g=game(system,'Guillotine',{abilityName:'No Guard'});eq(attempt(g,'Guillotine',100,'none',A('Protect')),0,'Protect blocks before the accuracy check');eq(H.active(g,1).hp,400,'Guaranteed accuracy does not bypass Protect');
 g=game(system,'Guillotine');H.active(g,1).flags.substitute=100;H.active(g,1).hp=37;attempt(g,'Guillotine',25);eq(H.active(g,1).hp,37,'Substitute takes the OHKO hit');eq(H.active(g,1).flags.substitute,0,'The entire Substitute is destroyed even if actual HP is low');
 g=game(system,'Guillotine');H.active(g,1).flags.charging={hidden:'fly',move:move('Fly')};eq(attempt(g,'Guillotine',25),0,'Out-of-range target has no hit roll');eq(H.active(g,1).hp,400,'Ordinary OHKO cannot reach Fly');
 for(const aim of ['Mind Reader','Lock-On']){g=game(system,'Guillotine');H.resolve(g,A(aim),P);H.active(g,1).flags.charging={hidden:'fly',move:move('Fly')};attempt(g,'Guillotine',100);eq(H.active(g,1).hp,0,aim+' reaches the locked target during Fly');}
 g=game(system,'Guillotine',{abilityName:'No Guard'});H.active(g,1).flags.charging={hidden:'fly',move:move('Fly')};attempt(g,'Guillotine',100);eq(H.active(g,1).hp,0,'No Guard reaches Fly');
 g=game(system,'Fissure');H.active(g,1).flags.charging={hidden:'dig',move:move('Dig')};eq(attempt(g,'Fissure',25),1,'Fissure reaches Dig but still rolls 25%');eq(H.active(g,1).hp,0,'Fissure can KO underground');
 // Normal attacks keep their usual accuracy calculation.
 g=game(system,'Tackle');H.active(g,0).moves[0].accuracy=90;ok(attempt(g,'Tackle',26)>1,'Ordinary Tackle still rolls accuracy and damage dice');ok(H.active(g,1).hp<400,'Ordinary attacks are unaffected by the OHKO rule');
}
const old=H.normalizePokemon(mon('legacy',['Guillotine']));old.moves[0]={...old.moves[0],power:120,accuracy:90,alwaysHits:true,description:'6d6 base and second KO roll'};
const restored=H.normalizeImport({pokemon:[old]})[0].moves[0];
eq([restored.power,restored.accuracy,restored.alwaysHits],[0,25,false],'Legacy imported OHKO overrides are corrected');
ok(restored.description.includes('25%')&&!restored.description.includes('6d6'),'Legacy imported descriptions use the new rule');
console.log(checks+' OHKO assertions passed in standard and experimental modes.');
