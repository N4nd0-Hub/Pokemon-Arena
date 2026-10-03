/* npm install --no-save jsdom fake-indexeddb */
const fs=require('fs'),path=require('path'),assert=require('assert');
const {JSDOM,VirtualConsole}=require('jsdom'),{IDBFactory,IDBKeyRange}=require('fake-indexeddb');
const html=fs.readFileSync(process.env.ARENA_TEST_HTML||path.join(__dirname,'..','index.html'),'utf8').replace(/<script id="arenaPeerLibrary">[\s\S]*?<\/script>/,'').replace(/<script\b[^>]*\bsrc=[^>]*><\/script>/g,'').replace('window.ArenaBridge={','window.ArenaTest={game:()=>structuredClone(game)};window.ArenaBridge={');
const peers=new Map(),packets=[];let guestCount=0,checks=0;
class Events{constructor(){this.events={};}on(n,f){(this.events[n]??=[]).push(f);return this;}emit(n,...args){for(const f of this.events[n]||[])f(...args);}}
class Connection extends Events{constructor(){super();this.open=false;}send(packet){packets.push(structuredClone(packet));setTimeout(()=>this.other?.emit('data',structuredClone(packet)),0);}close(){this.open=false;}}
class Peer extends Events{constructor(id){super();this.id=typeof id==='string'?id:'guest-'+(++guestCount);setTimeout(()=>{peers.set(this.id,this);this.emit('open',this.id);},1);}connect(id){const c=new Connection();setTimeout(()=>{const other=new Connection();c.other=other;other.other=c;peers.get(id).emit('connection',other);c.open=other.open=true;other.emit('open');c.emit('open');},1);return c;}destroy(){peers.delete(this.id);}}
function make(){const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));const d=new JSDOM(html,{url:'https://n4nd0-hub.github.io/Pokemon-Arena/',runScripts:'dangerously',virtualConsole:vc,pretendToBeVisual:true,beforeParse(w){w.Math.random=()=>.5;w.structuredClone=structuredClone;w.indexedDB=new IDBFactory();w.IDBKeyRange=IDBKeyRange;w.Peer=Peer;w.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};w.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};w.scrollTo=()=>{};w.matchMedia=()=>({matches:false,addEventListener(){}});w.HTMLElement.prototype.scrollIntoView=()=>{};w.HTMLElement.prototype.animate=()=>({});w.HTMLMediaElement.prototype.pause=()=>{};w.HTMLMediaElement.prototype.play=()=>Promise.resolve();w.confirm=()=>true;}});d.errors=errors;return d;}
const el=(d,id)=>d.window.document.getElementById(id),click=(d,id)=>el(d,id).click(),game=d=>d.window.ArenaTest.game();
const sleep=t=>new Promise(r=>setTimeout(r,t));async function wait(f,label){for(let i=0;i<500;i++){if(f())return;await sleep(10);}throw Error('Timed out: '+label);}
const ok=(v,m)=>{assert(v,m);checks++;},eq=(a,b,m)=>{assert.deepStrictEqual(a,b,m);checks++;};
const move=name=>({id:name.toLowerCase().replace(/[^a-z0-9]/g,''),name,type:name==='Sucker Punch'?'Dark':name==='U-turn'?'Bug':'Normal',category:name==='Growl'?'Status':'Physical',power:name==='Growl'?0:name==='Sucker Punch'?70:40,accuracy:90,alwaysHits:true,active:true});
const mon=(id,moves,spe=100)=>({id,name:id,type1:'Normal',level:36,maxHp:9000,stats:{hp:9000,atk:100,def:100,spa:100,spd:100,spe},moves:moves.map(move)});
const settled=d=>el(d,'readyStatus').textContent==='SELECIONE SEU COMANDO';
let h,g,local;
(async()=>{
 h=make();g=make();await sleep(25);
 h.window.ArenaBridge.addPokemon(mon('Host',['Sucker Punch','Tackle','Quick Attack','U-turn'],200));h.window.ArenaBridge.addPokemon(mon('Host reserve',['Tackle']));
 g.window.ArenaBridge.addPokemon(mon('Guest',['Sucker Punch','Tackle','Growl']));g.window.ArenaBridge.addPokemon(mon('Guest reserve',['Tackle']));
 click(h,'heroToImport');click(h,'hostBtn');await wait(()=>/^[A-Z2-9]{6}$/.test(el(h,'roomCode').textContent),'create room');const code=el(h,'roomCode').textContent;
 click(g,'heroToImport');el(g,'joinCode').value=code;click(g,'joinBtn');await wait(()=>!el(h,'startOnlineBtn').disabled,'join');el(h,'battleAnimations').checked=false;el(g,'battleAnimations').checked=false;click(h,'startOnlineBtn');await wait(()=>game(g)&&settled(h)&&settled(g),'start online match');
 async function round(hostMove,guestMove){const turn=game(h).turn;el(h,'myMoves').querySelector(`[data-move="${hostMove}"]`).click();el(g,'myMoves').querySelector(`[data-move="${guestMove}"]`).click();await wait(()=>game(h).turn===turn+1&&game(g).turn===turn+1&&settled(h)&&settled(g),'resolved Sucker Punch turn');eq(game(g).team,game(h).team,'Host and guest receive the same resolved combatants');ok(!packets.some(p=>p.t==='invalid'),'Sucker Punch never sends an invalid-action response');}
 for(const system of ['standard','matrix-v0.2']){
  if(system==='matrix-v0.2'){click(h,'damageModeToggle');await wait(()=>game(g).damageSystem===system,'synchronize experimental mode');}
  // Simulate a stale reserve selector. A regular attack must not transmit it.
  el(g,'pivotTarget').innerHTML='<option value="0">Stale active slot</option>';let hp=game(h).team[0][0].hp;await round('tackle','suckerpunch');ok(game(h).team[0][0].hp<hp,'Guest Sucker Punch damages the opposing attacker');
  const packet=packets.findLast(p=>p.t==='choice'&&p.action.moveId==='suckerpunch');eq(packet.action.switchIndex,undefined,'Sucker Punch payload omits the unrelated reserve selector');
  hp=game(h).team[1][0].hp;await round('suckerpunch','growl');eq(game(h).team[1][0].hp,hp,'Sucker Punch fails against Status without damage');ok(el(h,'battleLog').textContent.includes('Sucker Punch falhou: o alvo escolheu um Move de Status'),'Host log explains conditional failure');ok(el(g,'battleLog').textContent.includes('Sucker Punch falhou:'),'Guest receives the same failure explanation');
  hp=game(h).team[0][0].hp;await round('quickattack','suckerpunch');eq(game(h).team[0][0].hp,hp,'Slower Sucker Punch does not hit after the target has attacked');ok(el(g,'battleLog').textContent.includes('o alvo já agiu nesta rodada'),'Guest sees the already-acted explanation');
  eq(h.window.ArenaBridge.roomContext().code,code,'The room remains connected through successful and failed punches');
 }
 await round('uturn','tackle');eq(game(h).active[0],1,'A real pivot still uses its reserve target');
 ok(!h.errors.length&&!g.errors.length,'No errors in the online Sucker Punch UI');
 local=make();await sleep(25);local.window.ArenaBridge.addPokemon(mon('Local punch',['Sucker Punch']));local.window.ArenaBridge.addPokemon(mon('Local status',['Growl']));
 click(local,'heroToImport');const opponent=local.window.ArenaBridge.getLibrary().find(e=>e.p.name==='Local status');el(local,'localOpponent').value=opponent.key;el(local,'battleAnimations').checked=false;click(local,'localStartBtn');await wait(()=>game(local)&&settled(local),'local match');
 for(const system of ['standard','matrix-v0.2']){if(system==='matrix-v0.2')click(local,'damageModeToggle');el(local,'pivotTarget').innerHTML='<option value="0">Stale active slot</option>';const turn=game(local).turn;el(local,'myMoves').querySelector('[data-move="suckerpunch"]').click();await wait(()=>game(local).turn===turn+1&&+el(local,'roundNumber').textContent===turn+1&&settled(local),'local failed punch resolves');eq(game(local).team[1][0].hp,9000,'Local Status target receives no Sucker Punch damage');ok(el(local,'battleLog').textContent.includes('Sucker Punch falhou:'),'Local battle log explains the failure');ok(!el(local,'toast').textContent.includes('Ação inválida'),'Local Sucker Punch does not produce an invalid-action toast');}
 ok(!local.errors.length,'No errors in the local Sucker Punch UI');
 console.log(checks+' Sucker Punch local/online UI assertions passed in both damage modes.');
})().catch(e=>{console.error(e);for(const d of [h,g,local].filter(Boolean))console.error({turn:game(d)?.turn,toast:el(d,'toast').textContent,errors:d.errors});process.exitCode=1;}).finally(()=>{for(const d of [h,g,local].filter(Boolean))d.window.close();peers.clear();});
