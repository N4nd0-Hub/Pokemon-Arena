/* ============================================================
   Pokémon Arena — V2 (interações)
   - Texto da batalha aparece letra por letra
   - Teclas 1–5 escolhem o golpe; atalhos mostrados nos botões
   - Campo "Snow Warning" só para quem tem essa Ability
   - Poké Ball do Início balança ao clicar
   Não altera regras nem dados da batalha.
   ============================================================ */
(function(){
  "use strict";
  const $=id=>document.getElementById(id);
  const reduceMotion=()=>window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  const animationsOn=()=>!reduceMotion()&&($("battleAnimations")?.checked!==false);

  /* ---------- Caixa de texto da batalha ---------- */
  const caption=$("battleCaption");
  if(caption){
    // O observador é assíncrono: guardamos o último texto que NÓS escrevemos
    // para não reagir às próprias letras (senão a escrita recomeça sem fim).
    let typing=0,ownText=null;
    const observer=new MutationObserver(()=>{
      const full=caption.textContent;
      if(full===ownText)return;
      clearInterval(typing);
      if(!animationsOn()||!full){caption.classList.remove("v2-typing");ownText=null;return;}
      const speed=Math.max(.5,Number($("battleSpeed")?.value)||1);
      let i=0;
      caption.classList.add("v2-typing");
      const step=()=>{
        i=Math.min(full.length,i+Math.ceil(2*speed));
        ownText=full.slice(0,i);
        caption.textContent=ownText;
        if(i>=full.length){clearInterval(typing);caption.classList.remove("v2-typing");}
      };
      step();
      typing=setInterval(step,18);
    });
    observer.observe(caption,{childList:true,characterData:true,subtree:true});
  }

  /* ---------- Atalhos 1–5 para os golpes ---------- */
  const moves=$("myMoves");
  if(moves){
    const label=()=>{
      [...moves.querySelectorAll("button.move")].forEach((b,i)=>{
        if(i>8||b.querySelector("kbd.v2-key"))return;
        const k=document.createElement("kbd");
        k.className="v2-key";k.textContent=String(i+1);k.setAttribute("aria-hidden","true");
        b.appendChild(k);
        if(!b.getAttribute("aria-keyshortcuts"))b.setAttribute("aria-keyshortcuts",String(i+1));
      });
    };
    new MutationObserver(label).observe(moves,{childList:true});
    label();
    document.addEventListener("keydown",e=>{
      if(e.ctrlKey||e.metaKey||e.altKey||e.repeat)return;
      if(e.target.closest?.("input,textarea,select,[contenteditable]"))return;
      if(document.body.dataset.screen!=="battle"||document.querySelector("dialog[open]"))return;
      const n=Number(e.key);
      if(!Number.isInteger(n)||n<1||n>9)return;
      const b=moves.querySelectorAll("button.move")[n-1];
      if(b&&!b.disabled){e.preventDefault();b.focus({preventScroll:true});b.click();}
    });
  }

  /* ---------- Snow Warning só quando a Ability é Snow Warning ---------- */
  const ability=$("workAbility"),snow=$("workSnowWeather");
  if(ability&&snow){
    const field=snow.closest(".field");
    const norm=s=>String(s||"").toLowerCase().replace(/[^a-z]/g,"");
    const sync=()=>field?.classList.toggle("v2-hidden",norm(ability.value)!=="snowwarning");
    ["input","change"].forEach(ev=>ability.addEventListener(ev,sync));
    // O Workshop preenche o campo por código ao carregar modelos e builds.
    const desc=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value");
    if(desc?.set){
      Object.defineProperty(ability,"value",{
        configurable:true,
        get(){return desc.get.call(this);},
        set(v){desc.set.call(this,v);sync();}
      });
    }
    sync();
  }

  /* ---------- Poké Ball do Início ---------- */
  const ball=document.querySelector(".home-art .aligned-pokeball");
  if(ball){
    ball.addEventListener("click",()=>{
      if(reduceMotion())return;
      ball.classList.remove("v2-wobble");void ball.offsetWidth;ball.classList.add("v2-wobble");
    });
    ball.addEventListener("animationend",()=>ball.classList.remove("v2-wobble"));
  }
})();
