// ============================================================
// KLOPSE NIGHTMARE — Retro Arcade Game
// ============================================================
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

// Responsive canvas sizing
const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
let scale = 1;
function resizeCanvas() {
  const maxW = Math.min(480, window.innerWidth - 16);
  const maxH = Math.min(640, window.innerHeight - (isMobile ? 160 : 80));
  const ratio = 480 / 640;
  let w = maxW, h = maxW / ratio;
  if (h > maxH) { h = maxH; w = maxH * ratio; }
  canvas.width = 480; canvas.height = 640;
  canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
  scale = 480 / w;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

const W = 480, H = 640;

// Mobile controls
const touchCtrl = document.getElementById('touch-controls');
const ctrlText = document.getElementById('controls-text');
if (isMobile) {
  touchCtrl.classList.add('active');
  ctrlText.textContent = 'TOUCH-STEUERUNG AKTIV';
}

// ---- GAME STATE ----
let gameState = 'nameEntry'; // nameEntry, title, cutscene, playing, gameover
let score = 0, lives = 3, wave = 1, waveTimer = 0;
let shakeTimer = 0, shakeIntensity = 0, flashTimer = 0;
let comboCount = 0, comboTimer = 0;
let starField = [], dreamParticles = [], frameCount = 0;
let spawnTimer = 0, spawnInterval = 90, titlePulse = 0;
let playerName = '';
let nameInputActive = true;
let cursorBlink = 0;

// Cutscene state
let cutscenePhase = 0; // 0=zoom in, 1=speech, 2=shrink, 3=ready
let cutsceneTimer = 0;
let cutsceneCharX = W/2, cutsceneCharY = H/2 - 40, cutsceneCharScale = 3;
let speechText = '';
let speechIndex = 0;
let speechFull = 'Oh nein... Königsberger Klopse!\nDie greifen mich an!\nIch HASSE Kapern... aber\nich muss sie benutzen!';
let speechLines = [];

// Leaderboard
function getLeaderboard() {
  try { return JSON.parse(localStorage.getItem('klopseLeaderboard') || '[]'); } catch(e) { return []; }
}
function saveScore(name, sc) {
  const lb = getLeaderboard();
  lb.push({ name: name.substring(0,12), score: sc, date: new Date().toLocaleDateString('de-DE') });
  lb.sort((a,b) => b.score - a.score);
  localStorage.setItem('klopseLeaderboard', JSON.stringify(lb.slice(0, 20)));
}

// ---- INPUT ----
const keys = {};
window.addEventListener('keydown', e => {
  keys[e.code] = true;
  if (gameState === 'nameEntry') {
    if (e.key === 'Enter' && playerName.length > 0) { gameState = 'title'; nameInputActive = false; }
    else if (e.key === 'Backspace') playerName = playerName.slice(0, -1);
    else if (e.key.length === 1 && playerName.length < 12) playerName += e.key.toUpperCase();
    e.preventDefault();
  } else e.preventDefault();
});
window.addEventListener('keyup', e => { keys[e.code] = false; });

// Touch controls
const touchState = { left: false, right: false, fire: false };
function addTouch(id, key) {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('touchstart', e => { e.preventDefault(); touchState[key] = true; }, {passive:false});
  el.addEventListener('touchend', e => { e.preventDefault(); touchState[key] = false; }, {passive:false});
  el.addEventListener('touchcancel', e => { touchState[key] = false; });
}
addTouch('btn-left','left'); addTouch('btn-right','right'); addTouch('btn-fire','fire');

// Touch on canvas for name entry / start
canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  if (gameState === 'title') { keys['Enter'] = true; setTimeout(()=>keys['Enter']=false,100); }
  if (gameState === 'cutscene' && cutscenePhase === 3) { keys['Enter'] = true; setTimeout(()=>keys['Enter']=false,100); }
  if (gameState === 'gameover') { keys['Enter'] = true; setTimeout(()=>keys['Enter']=false,100); }
}, {passive:false});

// ---- ENTITIES ----
let player = { x:W/2, y:H-90, w:40, h:40, speed:4, invincible:0, shootCooldown:0 };
let capers=[], klopse=[], particles=[], floatingTexts=[], powerUps=[];

const C = { // Colors
  bed:'#8B4513', blanket:'#ff69b4', blanketDark:'#c44b8a', pillow:'#fff5ee',
  skin:'#ffdbac', hair:'#4a2800', nightgown:'#e8b4e8',
  klops:'#c8a070', klopsLight:'#dbb88a', sauce:'#f0e0c0',
  caper:'#4a7a2a', caperLight:'#6aaa3a',
  neon:'#ff00ff', neonBlue:'#00ffff', neonGreen:'#00ff88', neonYellow:'#ffff00'
};

// ---- INIT ----
function initStars() {
  starField = [];
  for (let i=0;i<80;i++) starField.push({x:Math.random()*W,y:Math.random()*H,size:Math.random()*2+.5,speed:Math.random()*.3+.1,twinkle:Math.random()*Math.PI*2,color:['#ffff88','#88ccff','#ff88ff','#fff'][Math.floor(Math.random()*4)]});
}
function initDream() {
  dreamParticles = [];
  for (let i=0;i<20;i++) dreamParticles.push({x:Math.random()*W,y:Math.random()*H,size:Math.random()*30+10,speedX:(Math.random()-.5)*.3,speedY:Math.random()*-.2-.1,alpha:Math.random()*.1+.02,phase:Math.random()*Math.PI*2});
}
initStars(); initDream();

// ---- DRAWING HELPERS ----
function pRect(x,y,w,h,c){ctx.fillStyle=c;ctx.fillRect(Math.floor(x),Math.floor(y),w,h);}
function pCirc(cx,cy,r,c){ctx.fillStyle=c;ctx.beginPath();ctx.arc(Math.floor(cx),Math.floor(cy),r,0,Math.PI*2);ctx.fill();}

function drawBackground() {
  const gr=ctx.createLinearGradient(0,0,0,H);
  gr.addColorStop(0,'#0a0520');gr.addColorStop(.3,'#1a0a40');gr.addColorStop(.6,'#150830');gr.addColorStop(1,'#0d0620');
  ctx.fillStyle=gr;ctx.fillRect(0,0,W,H);
  dreamParticles.forEach(d=>{d.x+=d.speedX;d.y+=d.speedY;d.phase+=.01;if(d.y<-d.size){d.y=H+d.size;d.x=Math.random()*W;}const a=d.alpha*(.5+Math.sin(d.phase)*.5);const g=ctx.createRadialGradient(d.x,d.y,0,d.x,d.y,d.size);g.addColorStop(0,`rgba(120,60,200,${a})`);g.addColorStop(1,'rgba(120,60,200,0)');ctx.fillStyle=g;ctx.fillRect(d.x-d.size,d.y-d.size,d.size*2,d.size*2);});
  starField.forEach(s=>{s.twinkle+=.03;s.y+=s.speed;if(s.y>H){s.y=0;s.x=Math.random()*W;}ctx.fillStyle=s.color;ctx.globalAlpha=.3+Math.sin(s.twinkle)*.4;ctx.fillRect(Math.floor(s.x),Math.floor(s.y),Math.ceil(s.size),Math.ceil(s.size));});
  ctx.globalAlpha=1;
}

// ---- DRAW PLAYER ----
function drawPlayerAt(px, py, sc) {
  sc = sc || 1;
  ctx.save(); ctx.translate(px, py); ctx.scale(sc, sc);
  const bob = Math.sin(frameCount*.05)*3/sc;
  const bx=-20, by=bob;
  // Glow
  const glow=ctx.createRadialGradient(0,by+20,5,0,by+20,40);glow.addColorStop(0,'rgba(160,80,255,.3)');glow.addColorStop(1,'rgba(160,80,255,0)');ctx.fillStyle=glow;ctx.fillRect(-40,by,80,40);
  // Bed
  pRect(bx-4,by+10,48,6,C.bed);pRect(bx-6,by+6,4,16,'#a0522d');pRect(bx+42,by+6,4,16,'#a0522d');
  pRect(bx-4,by+16,4,6,'#6b3410');pRect(bx+40,by+16,4,6,'#6b3410');
  // Blanket
  pRect(bx+4,by+2,32,10,C.blanket);pRect(bx+6,by+4,28,6,C.blanketDark);
  for(let i=0;i<4;i++)pRect(bx+8+i*8,by+5,4,2,'#ff88b4');
  // Pillow
  pRect(bx+2,by-2,14,6,C.pillow);pRect(bx+3,by-1,12,4,'#ffe8d8');
  // Head
  pCirc(bx+9,by-5,6,C.skin);
  pRect(bx+3,by-12,13,5,C.hair);pRect(bx+2,by-10,3,6,C.hair);pRect(bx+14,by-10,3,4,C.hair);
  // Eyes
  const ef=Math.floor(frameCount/30)%3;
  if(ef!==2){pRect(bx+6,by-6,2,2,'#fff');pRect(bx+11,by-6,2,2,'#fff');pRect(bx+7,by-6,1,1,'#222');pRect(bx+12,by-6,1,1,'#222');}
  else{pRect(bx+6,by-5,3,1,'#222');pRect(bx+11,by-5,3,1,'#222');}
  pRect(bx+8,by-2,4,1,'#cc6666');
  // Arms + gun
  pRect(bx+16,by-4,8,3,C.nightgown);pRect(bx+24,by-6,4,3,C.skin);
  pRect(bx+28,by-8,6,3,'#555');pRect(bx+30,by-10,2,3,'#777');
  // Z's
  const zp=frameCount*.03;
  ctx.fillStyle=`rgba(150,150,255,${.3+Math.sin(zp)*.2})`;ctx.font='8px "Press Start 2P"';
  ctx.fillText('z',bx+16+Math.sin(zp)*5,by-16-Math.abs(Math.sin(zp*1.5))*8);
  ctx.font='6px "Press Start 2P"';ctx.fillText('z',bx+22+Math.sin(zp+1)*3,by-22-Math.abs(Math.sin(zp*1.2))*6);
  ctx.restore();
}

function drawPlayer() {
  if(player.invincible>0&&Math.floor(frameCount/4)%2===0)return;
  drawPlayerAt(player.x, player.y, 1);
}

// ---- DRAW KLOPS ----
function drawKlops(k) {
  const{x,y,size,type,phase}=k;const bob=Math.sin(frameCount*.08+phase)*2;const px=Math.floor(x),py=Math.floor(y+bob);
  const glow=ctx.createRadialGradient(px,py,size*.3,px,py,size*1.5);glow.addColorStop(0,'rgba(200,160,100,.2)');glow.addColorStop(1,'rgba(200,160,100,0)');ctx.fillStyle=glow;ctx.fillRect(px-size*1.5,py-size*1.5,size*3,size*3);
  pCirc(px,py,size,C.klops);pCirc(px-2,py-2,size*.85,C.klopsLight);
  ctx.fillStyle=C.sauce;ctx.beginPath();ctx.ellipse(px,py+size*.3,size*1.1,size*.5,0,0,Math.PI);ctx.fill();
  for(let i=0;i<3;i++)pCirc(px-size+(i+.5)*size*.7,py+size+2+Math.sin(frameCount*.1+i)*2,2,C.sauce);
  if(type==='boss'){
    pRect(px-5,py-4,4,4,'#fff');pRect(px+2,py-4,4,4,'#fff');pRect(px-4,py-3,2,2,'#f00');pRect(px+3,py-3,2,2,'#f00');
    pRect(px-6,py-7,5,2,'#4a2800');pRect(px+2,py-7,5,2,'#4a2800');pRect(px-4,py+2,9,2,'#8a0000');
    const hp=k.hp/k.maxHp;pRect(px-20,py-size-10,40,4,'#333');pRect(px-20,py-size-10,40*hp,4,hp>.3?'#ff0':'#f00');
  } else {
    pRect(px-4,py-3,3,3,'#fff');pRect(px+2,py-3,3,3,'#fff');pRect(px-3,py-2,2,2,'#333');pRect(px+3,py-2,2,2,'#333');
    pRect(px-5,py-5,4,1,'#4a2800');pRect(px+2,py-5,4,1,'#4a2800');pRect(px-3,py+2,7,1,'#6a3a1a');
  }
  pCirc(px-size*.5,py-size*.3,2,'#2a5a1a');pCirc(px+size*.4,py+size*.1,2,'#2a5a1a');pCirc(px+size*.1,py-size*.5,1.5,'#2a5a1a');
}

function drawCaper(c) {
  const px=Math.floor(c.x),py=Math.floor(c.y);
  const t=ctx.createRadialGradient(px,py+4,1,px,py+4,8);t.addColorStop(0,'rgba(100,200,80,.4)');t.addColorStop(1,'rgba(100,200,80,0)');ctx.fillStyle=t;ctx.fillRect(px-8,py-4,16,16);
  pCirc(px,py,4,C.caper);pCirc(px-1,py-1,2.5,C.caperLight);pRect(px-1,py-2,1,1,'#afa');
  pRect(px-1,py+4,2,3,'rgba(100,200,80,.5)');
}

// ---- PARTICLES ----
function spawnP(x,y,color,n,spd){for(let i=0;i<n;i++){const a=Math.PI*2/n*i+Math.random()*.5,v=spd*(.5+Math.random());particles.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:1,decay:.02+Math.random()*.02,size:2+Math.random()*3,color});}}
function spawnText(x,y,t,c){floatingTexts.push({x,y,text:t,color:c,life:1,vy:-1.5});}

// ---- HUD ----
function drawHUD() {
  ctx.font='10px "Press Start 2P"';ctx.fillStyle=C.neonYellow;ctx.textAlign='left';ctx.fillText('PUNKTE',10,22);ctx.fillStyle='#fff';ctx.fillText(`${score}`,10,38);
  ctx.fillStyle=C.neon;ctx.textAlign='right';ctx.fillText(`WELLE ${wave}`,W-10,22);
  ctx.fillStyle=C.neonBlue;ctx.textAlign='center';ctx.fillText(playerName,W/2,22);
  for(let i=0;i<lives;i++){pRect(W-14-i*16,30,10,10,C.blanket);pCirc(W-9-i*16,28,4,C.skin);}
  if(comboTimer>0&&comboCount>1){ctx.fillStyle=C.neonGreen;ctx.textAlign='center';ctx.font=`${10+comboCount}px "Press Start 2P"`;ctx.globalAlpha=comboTimer/120;ctx.fillText(`COMBO x${comboCount}!`,W/2,70);ctx.globalAlpha=1;}
}

// ---- NAME ENTRY SCREEN ----
function drawNameEntry() {
  drawBackground();
  ctx.textAlign='center';
  ctx.font='16px "Press Start 2P"';ctx.fillStyle=C.neon;ctx.fillText('KLOPSE',W/2,120);
  ctx.fillStyle=C.neonBlue;ctx.fillText('NIGHTMARE',W/2,150);
  ctx.font='8px "Press Start 2P"';ctx.fillStyle='#ff88cc';ctx.fillText('~ Sweet60 Edition ~',W/2,175);

  // Name input box
  ctx.font='10px "Press Start 2P"';ctx.fillStyle='#aaa';ctx.fillText('WIE HEIßT DU?',W/2,250);
  pRect(W/2-100,265,200,30,'rgba(255,255,255,.1)');
  ctx.strokeStyle=C.neon;ctx.lineWidth=2;ctx.strokeRect(W/2-100,265,200,30);
  ctx.fillStyle='#fff';ctx.font='12px "Press Start 2P"';
  cursorBlink+=.05;
  const cursor=Math.sin(cursorBlink*3)>0?'_':'';
  ctx.fillText(playerName+cursor,W/2,285);

  if(playerName.length>0){const blink=Math.sin(frameCount*.08)>0;if(blink){ctx.font='8px "Press Start 2P"';ctx.fillStyle=C.neonYellow;ctx.fillText('ENTER ZUM STARTEN',W/2,330);}}

  // Mobile keyboard hint
  if(isMobile){ctx.font='7px "Press Start 2P"';ctx.fillStyle='#666';ctx.fillText('TIPPE UM ZU SCHREIBEN',W/2,360);}

  // Leaderboard
  const lb=getLeaderboard();
  if(lb.length>0){
    ctx.font='10px "Press Start 2P"';ctx.fillStyle=C.neonYellow;ctx.fillText('★ BESTENLISTE ★',W/2,420);
    ctx.font='7px "Press Start 2P"';
    const top=lb.slice(0,8);
    top.forEach((e,i)=>{
      const medal=i===0?'🥇':i===1?'🥈':i===2?'🥉':` ${i+1}.`;
      ctx.fillStyle=i<3?[C.neonYellow,'#ccc','#cd7f32'][i]:'#888';
      ctx.textAlign='left';ctx.fillText(`${medal} ${e.name}`,W/2-120,448+i*20);
      ctx.textAlign='right';ctx.fillText(`${e.score}`,W/2+100,448+i*20);
      ctx.fillStyle='#555';ctx.fillText(e.date||'',W/2+120,448+i*20+10);
    });
  }
}

// Mobile name entry
if(isMobile){
  canvas.addEventListener('click',()=>{
    if(gameState==='nameEntry'){
      const name=prompt('Wie heißt du?');
      if(name&&name.trim()){playerName=name.trim().toUpperCase().substring(0,12);gameState='title';}
    }
  });
}

// ---- CUTSCENE ----
function drawCutscene() {
  drawBackground();
  cutsceneTimer++;

  if(cutscenePhase===0){
    // Zoom in - woman big in center
    cutsceneCharScale=3;
    drawPlayerAt(W/2,H/2-20,cutsceneCharScale);
    // Exclamation marks appearing
    if(cutsceneTimer>30){
      ctx.font='20px "Press Start 2P"';ctx.fillStyle='#ff4444';ctx.textAlign='center';
      ctx.fillText('! ! !',W/2,H/2-120);
    }
    if(cutsceneTimer>90){cutscenePhase=1;cutsceneTimer=0;speechIndex=0;speechText='';speechLines=speechFull.split('\n');}
  }
  else if(cutscenePhase===1){
    // Speech bubble
    drawPlayerAt(W/2,H/2-20,3);
    // Draw speech bubble
    const bx=W/2-10,by=H/2-180,bw=220,bh=100;
    ctx.fillStyle='#fff';ctx.strokeStyle='#333';ctx.lineWidth=3;
    ctx.beginPath();ctx.roundRect(bx-bw/2,by-bh/2,bw,bh,10);ctx.fill();ctx.stroke();
    // Bubble tail
    ctx.fillStyle='#fff';ctx.beginPath();ctx.moveTo(bx-10,by+bh/2);ctx.lineTo(bx,by+bh/2+15);ctx.lineTo(bx+10,by+bh/2);ctx.fill();
    ctx.strokeStyle='#333';ctx.beginPath();ctx.moveTo(bx-10,by+bh/2);ctx.lineTo(bx,by+bh/2+15);ctx.lineTo(bx+10,by+bh/2);ctx.stroke();

    // Typewriter text
    const charsPerFrame=0.5;
    const totalChars=speechFull.replace(/\n/g,'').length;
    const shown=Math.min(Math.floor(cutsceneTimer*charsPerFrame),totalChars);
    ctx.font='7px "Press Start 2P"';ctx.fillStyle='#222';ctx.textAlign='left';
    let charCount=0;
    speechLines.forEach((line,li)=>{
      let display='';
      for(let ci=0;ci<line.length;ci++){if(charCount<shown){display+=line[ci];}charCount++;}
      ctx.fillText(display,bx-bw/2+12,by-bh/2+22+li*16);
    });

    // Klopse appearing from sides
    if(cutsceneTimer>40){
      const k1={x:80+Math.sin(frameCount*.03)*20,y:H/2-60+Math.sin(frameCount*.05)*10,size:16,type:'normal',phase:0};
      const k2={x:W-80+Math.sin(frameCount*.03+2)*20,y:H/2-30+Math.sin(frameCount*.05+1)*10,size:14,type:'normal',phase:2};
      drawKlops(k1);drawKlops(k2);
    }
    if(cutsceneTimer>60){
      const k3={x:60+Math.sin(frameCount*.04)*15,y:H/2+40,size:12,type:'normal',phase:4};
      drawKlops(k3);
    }

    if(cutsceneTimer>200){cutscenePhase=2;cutsceneTimer=0;}
  }
  else if(cutscenePhase===2){
    // Shrink and move to bottom
    const t=Math.min(cutsceneTimer/60,1);
    const ease=t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2; // easeInOutQuad
    cutsceneCharScale=3-2*ease;
    cutsceneCharX=W/2;
    cutsceneCharY=(H/2-20)+(H-90-(H/2-20))*ease;
    drawPlayerAt(cutsceneCharX,cutsceneCharY,cutsceneCharScale);

    // Klopse from top
    for(let i=0;i<4;i++){
      const ky=-10+Math.min(cutsceneTimer*1.5,200);
      const k={x:60+i*120+Math.sin(frameCount*.04+i)*20,y:ky+Math.sin(frameCount*.06+i)*15,size:12+i*2,type:'normal',phase:i};
      if(ky>0)drawKlops(k);
    }

    if(t>=1){cutscenePhase=3;cutsceneTimer=0;}
  }
  else if(cutscenePhase===3){
    // Ready - waiting for input
    drawPlayerAt(W/2,H-90,1);
    // Klopse at top
    for(let i=0;i<4;i++){
      const k={x:60+i*120+Math.sin(frameCount*.04+i)*20,y:60+Math.sin(frameCount*.06+i)*15,size:12+i*2,type:'normal',phase:i};
      drawKlops(k);
    }

    const blink=Math.sin(frameCount*.08)>0;
    ctx.textAlign='center';ctx.font='10px "Press Start 2P"';
    ctx.fillStyle=C.neonYellow;ctx.fillText('BEREIT?',W/2,H/2-10);
    if(blink){ctx.font='8px "Press Start 2P"';ctx.fillStyle=C.neonGreen;
    ctx.fillText(isMobile?'TIPPE ZUM KÄMPFEN!':'ENTER ZUM KÄMPFEN!',W/2,H/2+20);}
  }
}

// ---- TITLE SCREEN ----
function drawTitle() {
  drawBackground();
  titlePulse+=.03;
  ctx.textAlign='center';ctx.font='20px "Press Start 2P"';
  ctx.fillStyle='#4a0060';ctx.fillText('KLOPSE',W/2+2,162);ctx.fillText('NIGHTMARE',W/2+2,192);
  const ga=.6+Math.sin(titlePulse)*.4;
  ctx.fillStyle=`rgba(255,0,255,${ga})`;ctx.fillText('KLOPSE',W/2,160);
  ctx.fillStyle=`rgba(0,255,255,${ga})`;ctx.fillText('NIGHTMARE',W/2,190);
  ctx.font='8px "Press Start 2P"';ctx.fillStyle='#ff88cc';ctx.fillText('~ Der Alptraum der Kapern ~',W/2,220);

  // Preview
  const tk1={x:W/2-60+Math.sin(titlePulse*.7)*20,y:290,size:18,type:'normal',phase:0};
  const tk2={x:W/2+60+Math.sin(titlePulse*.7+2)*20,y:300,size:14,type:'normal',phase:2};
  drawKlops(tk1);drawKlops(tk2);
  drawPlayerAt(W/2,380,1);

  ctx.font='10px "Press Start 2P"';ctx.fillStyle=C.neonBlue;ctx.fillText(`HALLO ${playerName}!`,W/2,440);

  const blink=Math.sin(titlePulse*2)>0;
  if(blink){ctx.font='8px "Press Start 2P"';ctx.fillStyle=C.neonYellow;ctx.fillText(isMobile?'TIPPE ZUM STARTEN':'ENTER DRÜCKEN',W/2,480);}
  ctx.fillStyle='#8866aa';ctx.font='7px "Press Start 2P"';
  ctx.fillText('Schieße Kapern auf die Klopse!',W/2,530);
  ctx.fillText('Sie HASST Kapern!',W/2,548);

  const lb=getLeaderboard();
  if(lb.length>0){ctx.fillStyle=C.neonYellow;ctx.font='8px "Press Start 2P"';ctx.fillText(`REKORD: ${lb[0].name} - ${lb[0].score}`,W/2,590);}
}

// ---- GAME OVER ----
function drawGameOver() {
  drawBackground();drawHUD();
  ctx.fillStyle='rgba(0,0,0,.6)';ctx.fillRect(0,0,W,H);
  ctx.textAlign='center';ctx.font='16px "Press Start 2P"';ctx.fillStyle='#f44';ctx.fillText('AUFGEWACHT!',W/2,H/2-60);
  ctx.font='10px "Press Start 2P"';ctx.fillStyle='#ff88cc';ctx.fillText('Der Alptraum ist vorbei',W/2,H/2-30);
  ctx.fillStyle=C.neonYellow;ctx.fillText(`PUNKTE: ${score}`,W/2,H/2+10);

  // Position in leaderboard
  const lb=getLeaderboard(); const pos=lb.findIndex(e=>e.name===playerName&&e.score===score);
  if(pos===0){ctx.fillStyle=C.neonGreen;ctx.font='8px "Press Start 2P"';ctx.fillText('★ NEUER REKORD! ★',W/2,H/2+40);}
  else if(pos>=0){ctx.fillStyle='#aaa';ctx.font='8px "Press Start 2P"';ctx.fillText(`PLATZ ${pos+1}`,W/2,H/2+40);}

  // Mini leaderboard
  if(lb.length>0){
    ctx.font='7px "Press Start 2P"';ctx.fillStyle=C.neonYellow;ctx.fillText('BESTENLISTE',W/2,H/2+70);
    lb.slice(0,5).forEach((e,i)=>{
      ctx.fillStyle=e.name===playerName&&e.score===score?C.neonGreen:'#888';
      ctx.fillText(`${i+1}. ${e.name} - ${e.score}`,W/2,H/2+90+i*16);
    });
  }

  if(Math.sin(frameCount*.08)>0){ctx.font='8px "Press Start 2P"';ctx.fillStyle='#aaf';ctx.fillText(isMobile?'TIPPE FÜR NEUES SPIEL':'ENTER FÜR NEUES SPIEL',W/2,H/2+180);}
}

// ---- GAME LOGIC ----
function spawnKlops(){
  const boss=wave>1&&Math.random()<.08;
  const sz=boss?22+wave*2:10+Math.random()*6+Math.min(wave,5);
  const sp=.5+Math.random()*.8+wave*.1;
  const hp=boss?8+wave*2:1+Math.floor(wave/3);
  klopse.push({x:30+Math.random()*(W-60),y:-sz*2,size:sz,speed:sp,hp,maxHp:hp,type:boss?'boss':'normal',phase:Math.random()*Math.PI*2,wobbleSpeed:.02+Math.random()*.03,wobbleAmp:20+Math.random()*30,baseX:0,hitFlash:0});
  klopse[klopse.length-1].baseX=klopse[klopse.length-1].x;
}

function shootCaper(){if(player.shootCooldown>0)return;player.shootCooldown=12;capers.push({x:player.x+14,y:player.y-10,vy:-7,vx:0});spawnP(player.x+14,player.y-14,C.caperLight,4,2);}

function checkCollisions(){
  for(let ci=capers.length-1;ci>=0;ci--){const c=capers[ci];for(let ki=klopse.length-1;ki>=0;ki--){const k=klopse[ki];const d=Math.hypot(c.x-k.x,c.y-k.y);if(d<k.size+4){k.hp--;k.hitFlash=6;capers.splice(ci,1);if(k.hp<=0){const pts=(k.type==='boss'?500:100)*(1+Math.floor(wave/2));const cb=comboCount>1?comboCount:1;score+=pts*cb;comboCount++;comboTimer=120;spawnP(k.x,k.y,C.klopsLight,12,3);spawnP(k.x,k.y,C.sauce,8,2);spawnText(k.x,k.y,`+${pts*cb}`,C.neonYellow);if(k.type==='boss'){spawnText(k.x,k.y-20,'BOSS K.O.!',C.neon);shakeTimer=15;shakeIntensity=6;flashTimer=8;}if(Math.random()<.1){powerUps.push({x:k.x,y:k.y,type:Math.random()<.5?'life':'rapid',vy:1,life:300});}klopse.splice(ki,1);}else{spawnP(c.x,c.y,C.caperLight,4,1.5);spawnText(c.x,c.y,'TREFFER!','#8fa');}break;}}}
  if(player.invincible<=0){for(let ki=klopse.length-1;ki>=0;ki--){const k=klopse[ki];if(Math.hypot(player.x-k.x,player.y-k.y)<k.size+16){lives--;player.invincible=120;shakeTimer=10;shakeIntensity=8;flashTimer=5;comboCount=0;comboTimer=0;spawnP(player.x,player.y,'#f44',10,3);spawnText(player.x,player.y-20,'IGITT!','#f44');klopse.splice(ki,1);if(lives<=0){gameState='gameover';saveScore(playerName,score);}break;}}}
  for(let pi=powerUps.length-1;pi>=0;pi--){const p=powerUps[pi];if(Math.hypot(player.x-p.x,player.y-p.y)<20){if(p.type==='life'){lives=Math.min(lives+1,5);spawnText(p.x,p.y,'+1 LEBEN!',C.neonGreen);}else{player.shootCooldown=-60;spawnText(p.x,p.y,'SCHNELLFEUER!',C.neonBlue);}spawnP(p.x,p.y,'#ff0',8,2);powerUps.splice(pi,1);}}
}

function startGame(){
  gameState='cutscene';cutscenePhase=0;cutsceneTimer=0;
  score=0;lives=3;wave=1;waveTimer=0;player.x=W/2;player.y=H-90;
  klopse=[];capers=[];particles=[];floatingTexts=[];powerUps=[];comboCount=0;comboTimer=0;
}

// ---- UPDATE ----
function update(){
  frameCount++;
  if(gameState==='nameEntry')return;
  if(gameState==='title'){if(keys['Enter']||keys['Space']){startGame();}return;}
  if(gameState==='cutscene'){if(cutscenePhase===3&&(keys['Enter']||keys['Space'])){gameState='playing';keys['Enter']=false;keys['Space']=false;}return;}
  if(gameState==='gameover'){if(keys['Enter']){gameState='title';}return;}

  // Playing
  const ml=keys['ArrowLeft']||keys['KeyA']||touchState.left;
  const mr=keys['ArrowRight']||keys['KeyD']||touchState.right;
  const fire=keys['Space']||keys['ArrowUp']||keys['KeyW']||touchState.fire;
  if(ml)player.x-=player.speed;if(mr)player.x+=player.speed;
  player.x=Math.max(25,Math.min(W-25,player.x));
  if(fire)shootCaper();
  if(player.shootCooldown>0)player.shootCooldown--;
  if(player.invincible>0)player.invincible--;

  spawnTimer++;if(spawnTimer>=spawnInterval){spawnTimer=0;spawnKlops();}
  spawnInterval=Math.max(20,90-wave*8);

  for(let i=capers.length-1;i>=0;i--){capers[i].y+=capers[i].vy;capers[i].x+=capers[i].vx;if(capers[i].y<-10)capers.splice(i,1);}
  for(let i=klopse.length-1;i>=0;i--){const k=klopse[i];k.phase+=k.wobbleSpeed;k.x=k.baseX+Math.sin(k.phase)*k.wobbleAmp;k.y+=k.speed;if(k.hitFlash>0)k.hitFlash--;if(k.y>H+30)klopse.splice(i,1);}
  for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.x+=p.vx;p.y+=p.vy;p.vy+=.05;p.life-=p.decay;if(p.life<=0)particles.splice(i,1);}
  for(let i=floatingTexts.length-1;i>=0;i--){const t=floatingTexts[i];t.y+=t.vy;t.life-=.015;if(t.life<=0)floatingTexts.splice(i,1);}
  for(let i=powerUps.length-1;i>=0;i--){powerUps[i].y+=powerUps[i].vy;powerUps[i].life--;if(powerUps[i].y>H+20||powerUps[i].life<=0)powerUps.splice(i,1);}
  if(comboTimer>0){comboTimer--;if(comboTimer<=0)comboCount=0;}
  if(shakeTimer>0)shakeTimer--;if(flashTimer>0)flashTimer--;
  checkCollisions();
  waveTimer++;if(waveTimer>600+wave*200){wave++;waveTimer=0;flashTimer=15;spawnText(W/2,H/2,`WELLE ${wave}!`,C.neon);}
}

// ---- DRAW ----
function draw(){
  ctx.save();
  if(shakeTimer>0){ctx.translate((Math.random()-.5)*shakeIntensity,(Math.random()-.5)*shakeIntensity);}

  if(gameState==='nameEntry'){drawNameEntry();ctx.restore();return;}
  if(gameState==='title'){drawTitle();ctx.restore();return;}
  if(gameState==='cutscene'){drawCutscene();ctx.restore();return;}
  if(gameState==='gameover'){drawGameOver();ctx.restore();return;}

  drawBackground();
  ctx.strokeStyle='rgba(255,0,80,.15)';ctx.setLineDash([8,8]);ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(0,H-100);ctx.lineTo(W,H-100);ctx.stroke();ctx.setLineDash([]);

  powerUps.forEach(p=>{const bob=Math.sin(frameCount*.08)*3,px=Math.floor(p.x),py=Math.floor(p.y+bob);if(p.type==='life'){pCirc(px-3,py-2,4,'#f6a');pCirc(px+3,py-2,4,'#f6a');pRect(px-6,py,13,4,'#f6a');}else{pRect(px+1,py-6,4,4,C.neonBlue);pRect(px-1,py-2,6,3,C.neonBlue);pRect(px-3,py+1,4,4,C.neonBlue);}});
  klopse.forEach(k=>{if(k.hitFlash>0)ctx.globalAlpha=.5+Math.sin(frameCount*.5)*.5;drawKlops(k);ctx.globalAlpha=1;});
  capers.forEach(drawCaper);
  drawPlayer();
  particles.forEach(p=>{ctx.globalAlpha=p.life;pRect(p.x-p.size/2,p.y-p.size/2,p.size,p.size,p.color);});ctx.globalAlpha=1;
  floatingTexts.forEach(t=>{ctx.globalAlpha=t.life;ctx.fillStyle=t.color;ctx.font='8px "Press Start 2P"';ctx.textAlign='center';ctx.fillText(t.text,t.x,t.y);});ctx.globalAlpha=1;
  if(flashTimer>0){ctx.fillStyle=`rgba(255,255,255,${flashTimer*.05})`;ctx.fillRect(0,0,W,H);}
  drawHUD();
  if(waveTimer<120){const a=1-waveTimer/120;ctx.globalAlpha=a;ctx.fillStyle=C.neon;ctx.font='16px "Press Start 2P"';ctx.textAlign='center';ctx.fillText(`WELLE ${wave}`,W/2,H/2-20);ctx.font='8px "Press Start 2P"';ctx.fillStyle=C.neonBlue;ctx.fillText('Vernichte die Klopse!',W/2,H/2+10);ctx.globalAlpha=1;}
  ctx.restore();
}

function gameLoop(){update();draw();requestAnimationFrame(gameLoop);}
gameLoop();
