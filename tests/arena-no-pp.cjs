const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8'),blocks=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)],data=Object.fromEntries(blocks.filter(b=>/application\/json/.test(b[1])).map(b=>[b[1].match(/id="([^"]+)"/)[1],b[2]]));
const ctx={document:{getElementById:id=>({textContent:data[id]})},structuredClone,Math:Object.create(Math),module:{exports:{}}};ctx.Math.random=()=>.5;
vm.runInNewContext(blocks.find(b=>b[2].includes('const HH = (() =>'))[2]+';module.exports.locale=HHLocale;',ctx);
const H=ctx.module.exports,SD=JSON.parse(data.smogonSnapshot),P={kind:'pass'},A=n=>({kind:'move',moveId:H.normalizeName(n)});let checks=0;
function eq(a,b,msg){assert.deepStrictEqual(JSON.parse(JSON.stringify(a)),JSON.parse(JSON.stringify(b)),msg);checks++;}
function ok(v,msg){assert(v,msg);checks++;}
function move(n){const m=SD.moves[H.normalizeName(n)];return {...H.locale.move(m),id:H.normalizeName(n)};}
function mon(names,id='A',props={}){return {id,name:id,type1:'Normal',level:36,maxHp:9000,stats:{hp:9000,atk:100,def:100,spa:100,spd:100,spe:id==='A'?200:100},moves:names.map(move),...props};}
function game(names,enemy=['Tackle'],damageSystem='standard',props={}){return H.newGame([mon(names,'A',props),mon(['Tackle'],'ReserveA')],[mon(enemy,'B'),mon(['Tackle'],'ReserveB')],{damageSystem});}
function noPP(g,msg){for(const team of g.team)for(const f of team){ok(!Object.hasOwn(f,'pp')&&!Object.hasOwn(f,'originalPP'),msg);ok(f.moves.every(m=>!Object.hasOwn(m,'pp')&&!Object.hasOwn(m,'maxPP')),msg+' moves');}}
for(const system of ['standard','matrix-v0.2']){
 let g=game(['Tackle'],['Tackle'],system,{pp:{tackle:0},moves:[{...move('Tackle'),pp:0,maxPP:1}]});
 noPP(g,'Legacy imports do not create PP state');
 for(let i=0;i<45;i++)H.resolve(g,A('Tackle'),P);
 eq(g.turn,46,'Repeated moves never run out');ok(H.active(g,1).hp<9000,'Repeated attacks resolve damage');eq(H.moveBlockReason(g,0,H.active(g,0).moves[0]),'','Move remains usable');
 noPP(g,'Battle serialization contains no PP state');
 for(const name of ['Spite','Grudge']){g=game([name],['Tackle'],system,{moves:[{...move(name),description:'Remove todos os PP.'}]});ok(H.active(g,0).moves[0].description.includes('Sem efeito'),name+' legacy description is replaced');ok(H.moveBlockReason(g,0,H.active(g,0).moves[0]).includes('Sem efeito'),name+' is unavailable');eq(H.moveCoverage(H.active(g,0).moves[0]),'manual',name+' is not advertised automatic');assert.throws(()=>H.resolve(g,A(name),A('Tackle')),/Ação inválida/);checks++;ok(!H.active(g,0).flags.fx?.grudge,name+' creates no PP effect');noPP(g,name+' never creates PP');}
 g=game(['Eerie Spell'],['Tackle'],system);H.resolve(g,P,A('Tackle'));H.resolve(g,A('Eerie Spell'),P);ok(H.active(g,1).hp<9000,'Eerie Spell retains its attack');eq(H.moveCoverage(H.active(g,0).moves[0]),'auto','Eerie Spell attack is automatic');noPP(g,'Eerie Spell cannot drain PP');
 g=game(['Trump Card'],['Tackle'],system);ok(H.moveBlockReason(g,0,H.active(g,0).moves[0]).includes('Power'),'Trump Card has no invented PP scale');H.active(g,0).moves[0].power=60;eq(H.effectiveMove(g,0,H.active(g,0).moves[0]).power,60,'Editor Power is respected');H.resolve(g,A('Trump Card'),P);ok(H.active(g,1).hp<9000,'Explicit Trump Card adaptation can attack');
 g=game(['Transform'],['Tackle'],system);H.resolve(g,A('Transform'),P);eq(H.active(g,0).moves[0].name,'Tackle','Transform copies moves');for(let i=0;i<8;i++)H.resolve(g,A('Tackle'),P);ok(H.active(g,1).hp<9000,'Transformed move exceeds the old five-use limit');H.switchTo(g,0,1);H.switchTo(g,0,0);eq(H.active(g,0).moves[0].name,'Transform','Transform restoration still works');noPP(g,'Transform creates no PP');
 for(const name of ['Mimic','Sketch']){g=game([name],['Tackle'],system);H.resolve(g,P,A('Tackle'));H.resolve(g,A(name),P);eq(H.active(g,0).moves[0].name,'Tackle',name+' copies a move');for(let i=0;i<8;i++)H.resolve(g,A(name),P);noPP(g,name+' copies without a PP limit');}
 g=game(['Instruct'],['Tackle'],system);H.resolve(g,P,A('Tackle'));const hp=H.active(g,0).hp;H.resolve(g,A('Instruct'),P);ok(H.active(g,0).hp<hp,'Instruct repeats the target attack');noPP(g,'Instruct creates no PP');
 g=game(['Lunar Dance'],['Tackle'],system);g.team[0][1].hp=10;g.team[0][1].status={id:'poison'};H.resolve(g,A('Lunar Dance'),P);ok(H.replacementSides(g)[0],'Lunar Dance forces replacement');H.resolve(g,{kind:'switch',index:1},P);eq(H.active(g,0).hp,9000,'Lunar Dance heals the replacement');eq(H.active(g,0).status,null,'Lunar Dance cures status');noPP(g,'Lunar Dance restores no PP');
 g=game(['Stuff Cheeks'],['Tackle'],system,{heldItem:'Leppa Berry'});H.active(g,0).hp=4500;H.resolve(g,A('Stuff Cheeks'),P);eq(H.active(g,0).hp,4500,'Leppa Berry cannot become a HP heal');eq(H.active(g,0).heldItem,'','Stuff Cheeks can still consume the berry');eq(H.stages(H.active(g,0),'def'),2,'Stuff Cheeks retains its own Defense boost');
 g=game(['Tackle'],['Tackle'],system);H.active(g,1).abilityName='Pressure';H.resolve(g,A('Tackle'),P);H.resolve(g,A('Tackle'),P);ok(H.active(g,0).disabled.tackle>0,'Compendium Pressure still disables repeated moves');noPP(g,'Pressure does not introduce PP');
 g=game(['Tackle'],['Tackle'],system);H.active(g,0).disabled.tackle=4;H.resolve(g,{kind:'move',moveId:'__struggle'},P);ok(H.active(g,1).hp<9000,'Struggle still works when real restrictions block all moves');
}
for(const name of ['Ether','Max Ether','Elixir','Max Elixir','PP Up','PP Max','Leppa Berry','Hopo Berry'])ok(H.locale.itemText(name).includes('este sistema não usa PP'),name+' explains the absent mechanic');
ok(!html.includes(' · PP ${'),'Battle buttons have no PP counter');
console.log(checks+' no-PP assertions passed in both damage modes.');
