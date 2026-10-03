const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8'),blocks=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)];
const data=Object.fromEntries(blocks.filter(b=>/application\/json/.test(b[1])).map(b=>[b[1].match(/id="([^"]+)"/)[1],b[2]]));
const context={document:{getElementById:id=>({textContent:data[id]})},structuredClone,Math:Object.create(Math),module:{exports:{}}};context.Math.random=()=>.5;
vm.runInNewContext(blocks.find(b=>b[2].includes('const HH = (() =>'))[2],context);const H=context.module.exports,SD=JSON.parse(data.smogonSnapshot);
let checks=0;const eq=(a,b,m)=>{assert.deepStrictEqual(JSON.parse(JSON.stringify(a)),JSON.parse(JSON.stringify(b)),m);checks++;},ok=(v,m)=>{assert(v,m);checks++;};
const P={kind:'pass'},A=name=>({kind:'move',moveId:H.normalizeName(name)});
const move=name=>{const d=SD.moves[H.normalizeName(name)];return {id:H.normalizeName(name),name:d.name,type:d.type,category:d.category,power:d.basePower,accuracy:90,alwaysHits:true,active:true};};
const mon=(id,moves,spe)=>({id,name:id,type1:'Normal',level:36,maxHp:1000,stats:{hp:1000,atk:100,def:100,spa:100,spd:100,spe},moves:moves.map(move)});
function game(system,enemy=['Tackle','Growl','Quick Attack'],side=0){const teams=[[mon('Punch',['Sucker Punch','U-turn','Baton Pass'],100),mon('Punch reserve',['Tackle'],100)],[mon('Target',enemy,200),mon('Target reserve',['Tackle'],200)]];return H.newGame(...(side?teams.reverse():teams),{damageSystem:system});}
function resolve(g,side,punch=A('Sucker Punch'),enemy=A('Tackle')){const turn=g.turn;H.resolve(g,...(side?[enemy,punch]:[punch,enemy]));eq(g.turn,turn+1,'A legal Sucker Punch command always resolves the round');ok(!('_queued' in g)&&!('_queuedActors' in g),'Queued actions and actor identities are cleared');}
function failed(g,side,reason){eq(H.active(g,1-side).hp,1000,'Conditional failure deals no damage');ok(g.log.some(x=>x.kind==='miss'&&x.text.includes('Sucker Punch falhou:')&&x.text.includes(reason)),'Conditional failure has a useful battle-log explanation');}
for(const system of ['standard','matrix-v0.2'])for(const side of [0,1]){
 let g=game(system,undefined,side);resolve(g,side);ok(H.active(g,1-side).hp<1000,'Sucker Punch hits an opposing attack');eq(g.visualEvents.filter(x=>x.kind==='move')[0].side,side,'Priority +1 beats the faster ordinary attack');
 for(const switchIndex of [0,99,null]){g=game(system,undefined,side);resolve(g,side,{...A('Sucker Punch'),switchIndex});ok(H.active(g,1-side).hp<1000,'Unused legacy switch payload cannot invalidate a regular attack');eq(g.active[side],0,'Sucker Punch never performs a pivot');}
 g=game(system,undefined,side);g.team[side][1].hp=0;resolve(g,side,{...A('Sucker Punch'),switchIndex:1});ok(H.active(g,1-side).hp<1000,'Dead reserve in a legacy payload cannot invalidate Sucker Punch');
 for(const enemy of [A('Growl'),P,{kind:'active'},{kind:'switch',index:1}]){g=game(system,undefined,side);resolve(g,side,A('Sucker Punch'),enemy);failed(g,side,enemy.kind==='move'?'Status':'não escolheu um ataque');}
 g=game(system,undefined,side);resolve(g,side,A('Sucker Punch'),A('Quick Attack'));failed(g,side,'já agiu');
 g=game(system,['U-turn'],side);H.active(g,1-side).abilityName='Gale Wings';H.active(g,1-side).moves[0].type='Flying';resolve(g,side,A('Sucker Punch'),{...A('U-turn'),switchIndex:1});failed(g,side,'entrou por troca');eq(g.active[1-side],1,'Sucker Punch cannot hit the reserve after the original attacker pivots first');
 g=game(system,['Sucker Punch'],side);resolve(g,side,A('Sucker Punch'),A('Sucker Punch'));failed(g,side,'já agiu');ok(H.active(g,side).hp<1000,'Only the faster of two Sucker Punch users hits');
 g=game(system,['Protect'],side);H.active(g,side).abilityName='No Guard';resolve(g,side,A('Sucker Punch'),A('Protect'));failed(g,side,'Status');
 g=game(system,undefined,side);H.active(g,1-side).flags.recharge=true;resolve(g,side);failed(g,side,'não escolheu um ataque');
 g=game(system,['Tackle'],side);H.active(g,1-side).disabled.tackle=4;resolve(g,side,A('Sucker Punch'),{kind:'move',moveId:'__struggle'});ok(H.active(g,1-side).hp<750,'Struggle counts as an opposing offensive command');
 g=game(system,undefined,side);H.active(g,side).flags.fx={lockon:{targetId:H.active(g,1-side).id,until:g.turn+1}};resolve(g,side,A('Sucker Punch'),A('Growl'));failed(g,side,'Status');ok(H.active(g,side).flags.fx.lockon,'A failed condition does not spend a targeting effect on an accuracy roll');
 g=game(system,undefined,side);const target=H.active(g,1-side);target.hp=500;g.bag[1-side].Potion=1;resolve(g,side,A('Sucker Punch'),{kind:'item',itemName:'Potion',targetIndex:0});eq(target.hp,520,'Sucker Punch fails against an item but the item action still resolves');ok(g.log.some(x=>x.text.includes('Sucker Punch falhou:')),'Item turn explains the failed punch');
 // A legitimate pivot must still reject an invalid target and accept a living reserve.
 g=game(system,undefined,side);assert.throws(()=>H.resolve(g,...(side?[P,{...A('U-turn'),switchIndex:99}]:[{...A('U-turn'),switchIndex:99},P])),/Ação inválida/);checks++;
 resolve(g,side,{...A('U-turn'),switchIndex:1},P);eq(g.active[side],1,'Valid U-turn retains the selected reserve');
 for(const name of ['Sucker Punch','Tackle','Baton Pass','U-turn'])eq(H.usesSwitchTarget(move(name)),['Baton Pass','U-turn'].includes(name),'Only moves that switch the user carry a switch target');
 ok(H.describeSpecial(move('Sucker Punch')).includes('rodada continua normalmente'),'Description explains the condition without treating failure as invalid input');
 // Both physical and special attacks qualify, and the ordinary hit roll is preserved.
 g=game(system,['Flamethrower'],side);resolve(g,side,A('Sucker Punch'),A('Flamethrower'));ok(H.active(g,1-side).hp<1000,'Special attacks qualify');
 g=game(system,undefined,side);H.active(g,side).moves[0].alwaysHits=false;H.active(g,side).moves[0].accuracy=1;context.Math.random=()=>.99;resolve(g,side);eq(H.active(g,1-side).hp,1000,'Meeting the condition does not guarantee an accuracy hit');context.Math.random=()=>.5;
}
console.log(checks+' Sucker Punch assertions passed on both sides and in both damage modes.');
