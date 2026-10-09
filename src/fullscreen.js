// Native fullscreen where allowed; an in-page expanded layout elsewhere.
export function mountFullscreen(shell,button,{onEnter=()=>{}}={}){
 let expanded=false,busy=false,scroll=0;
 const native=()=>document.fullscreenElement===shell;
 function layout(value){expanded=value;shell.classList.toggle('game-expanded',value);document.body.classList.toggle('game-expanded-body',value);button.textContent=value?'Exit full screen':'Full screen';button.setAttribute('aria-pressed',String(value));if(!value){shell.classList.remove('build-menu-open');shell.querySelector('#expanded-build')?.setAttribute('aria-pressed','false');window.scrollTo(0,scroll);button.focus();}}
 async function exit(){if(native())await document.exitFullscreen();else layout(false);}
 button.onclick=async()=>{if(busy)return;busy=true;try{if(expanded||native()){await exit();return;}scroll=window.scrollY;layout(true);onEnter();if(typeof shell.requestFullscreen==='function'&&document.fullscreenEnabled){try{await shell.requestFullscreen();}catch{/* Keep the expanded layout when native fullscreen is restricted. */}}}finally{busy=false;}};
 document.addEventListener('fullscreenchange',()=>{if(native()){if(!expanded){scroll=window.scrollY;layout(true);onEnter();}}else if(expanded)layout(false);});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&expanded&&!document.querySelector('.scrim')){event.preventDefault();exit();}});
}
