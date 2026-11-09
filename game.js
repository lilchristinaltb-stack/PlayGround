(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const W = 960, H = 540, WORLD = 4480;
  const overlay = document.getElementById('overlay');
  const overlayContent = document.getElementById('overlayContent');
  const hud = document.getElementById('hud');
  const frame = document.querySelector('.game-frame');
  const cellCount = document.getElementById('cellCount');
  const livesNode = document.getElementById('lives');
  const toast = document.getElementById('toast');
  const keys = Object.create(null);
  let state = 'menu', last = 0, time = 0, camera = 0, soundOn = false, audioContext = null;
  let player, cells, enemies, particles, lives, collected, checkpoint = 70, checkpointY = 438, invulnerable = 0;
  const platforms = [
    [0,500,630,40],[720,500,520,40],[1330,500,550,40],[1990,500,440,40],[2540,500,520,40],[3150,500,490,40],[3730,500,750,40],
    [250,408,130,18],[455,350,120,18],[790,405,145,18],[1015,340,125,18],[1190,405,120,18],
    [1450,410,135,18],[1650,350,150,18],[1880,405,145,18],[2080,345,135,18],[2280,405,120,18],
    [2610,410,135,18],[2810,350,145,18],[3020,405,120,18],[3240,350,145,18],[3460,405,140,18],
    [3820,405,140,18],[4020,345,125,18],[4210,405,125,18]
  ].map(([x,y,w,h])=>({x,y,w,h}));
  const cellSpots = [[290,365],[495,307],[850,362],[1060,297],[1225,362],[1500,367],[1700,307],[1930,362],[2130,302],[2320,362],[2860,307],[3290,307],[3880,362],[4070,302],[4270,362]];
  const starfield = Array.from({length:110},(_,i)=>({x:(i*173+37)%WORLD,y:(i*83+21)%330,r:(i%4===0)?1.7:0.8,a:.25+(i%6)*.1,p:i%8}));
  const buildingSet = Array.from({length:68},(_,i)=>({x:i*76-100,w:28+(i*19)%54,h:35+(i*37)%120,seed:i}));

  function setOverlay(type) {
    overlay.classList.remove('is-hidden');
    if(type==='menu') {
      overlayContent.innerHTML = '<div class="eyebrow">A NOVA/ARCADE ORIGINAL</div><h1>STARBOUND<br><em>RUNNER</em></h1><p class="subtitle">The last beacon is fading. Leap across a lost world, gather its energy cells, and bring the frontier back to life.</p><button class="primary-button" id="startButton">START MISSION <span>↗</span></button><div class="control-note"><span><b class="keycap">←</b><b class="keycap">→</b> MOVE</span><span><b class="keycap">SPACE</b> JUMP</span></div>';
      document.getElementById('startButton').onclick=startGame;
    } else if(type==='paused') {
      overlayContent.innerHTML='<div class="eyebrow">MISSION ON HOLD</div><h1>TAKE A<br><em>BREATHER.</em></h1><p class="overlay-small">Your beacon can wait. The void is very patient.</p><button class="primary-button" id="resumeButton">RESUME MISSION <span>▶</span></button><div class="control-note"><span>PRESS <b class="keycap">ESC</b> TO RESUME</span></div>';
      document.getElementById('resumeButton').onclick=resume;
    } else if(type==='win') {
      overlayContent.innerHTML='<div class="eyebrow">BEACON RESTORED · SECTOR 07</div><h1>YOU ARE<br><em>THE LIGHT.</em></h1><p class="overlay-small">The frontier is alive again. You recovered <b>'+collected+'</b> energy cells and made it home.</p><button class="primary-button" id="againButton">PLAY AGAIN <span>↻</span></button>';
      document.getElementById('againButton').onclick=startGame;
    } else {
      overlayContent.innerHTML='<div class="eyebrow">SIGNAL LOST</div><h1>NOT THE<br><em>END.</em></h1><p class="overlay-small">The frontier is still out there. Suit up and give it another go.</p><button class="primary-button" id="againButton">RETRY MISSION <span>↻</span></button>';
      document.getElementById('againButton').onclick=startGame;
    }
  }
  function startGame(){
    state='playing'; camera=0; lives=3; collected=0; checkpoint=70; checkpointY=438; invulnerable=0;
    player={x:70,y:438,w:28,h:42,vx:0,vy:0,onGround:false,face:1,walk:0};
    cells=cellSpots.map(([x,y])=>({x,y,got:false,phase:Math.random()*6}));
    enemies=[{x:520,y:468,home:520,min:470,max:600,v:38,alive:true},{x:1120,y:468,home:1120,min:1040,max:1210,v:42,alive:true},{x:1760,y:468,home:1760,min:1690,max:1820,v:48,alive:true},{x:2360,y:468,home:2360,min:2280,max:2400,v:46,alive:true},{x:2960,y:468,home:2960,min:2870,max:3000,v:50,alive:true},{x:3550,y:468,home:3550,min:3480,max:3610,v:45,alive:true},{x:4140,y:468,home:4140,min:4080,max:4200,v:52,alive:true}];
    particles=[]; hud.hidden=false; overlay.classList.add('is-hidden'); toastMsg('COLLECT CELLS · REACH THE BEACON'); updateHud();
  }
  function pause(){if(state==='playing'){state='paused';setOverlay('paused')}}
  function resume(){state='playing';overlay.classList.add('is-hidden');last=performance.now()}
  document.getElementById('pauseButton').addEventListener('click',()=>state==='paused'?resume():pause());
  document.getElementById('soundButton').addEventListener('click',e=>{soundOn=!soundOn;if(soundOn){const Audio=window.AudioContext||window.webkitAudioContext;if(Audio){audioContext=audioContext||new Audio();audioContext.resume();tone(660,.1)}}e.currentTarget.innerHTML=(soundOn?'♫':'♪')+' <span>'+(soundOn?'SOUND ON':'SOUND')+'</span>';toastMsg(soundOn?'AUDIO ENABLED':'AUDIO MUTED')});
  window.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','ArrowUp','Space'].includes(e.code))e.preventDefault();keys[e.code]=true;if(e.code==='Escape'){state==='playing'?pause():state==='paused'?resume():null}if((e.code==='Enter'||e.code==='Space')&&state==='menu')startGame();if(e.code==='KeyR'&&(state==='dead'||state==='win'))startGame()});
  window.addEventListener('keyup',e=>keys[e.code]=false);
  document.querySelectorAll('[data-control]').forEach(button=>{
    const control=button.dataset.control;
    const down=e=>{e.preventDefault();button.classList.add('pressed');keys['touch-'+control]=true};
    const up=e=>{e.preventDefault();button.classList.remove('pressed');keys['touch-'+control]=false};
    button.addEventListener('pointerdown',down);button.addEventListener('pointerup',up);button.addEventListener('pointercancel',up);button.addEventListener('pointerleave',up);
  });
  function toastMsg(text){toast.textContent=text;toast.classList.add('show');clearTimeout(toastMsg.timer);toastMsg.timer=setTimeout(()=>toast.classList.remove('show'),1800)}
  function tone(frequency,duration,wave='sine'){if(!soundOn||!audioContext)return;const oscillator=audioContext.createOscillator(),gain=audioContext.createGain();oscillator.type=wave;oscillator.frequency.setValueAtTime(frequency,audioContext.currentTime);gain.gain.setValueAtTime(.055,audioContext.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audioContext.currentTime+duration);oscillator.connect(gain);gain.connect(audioContext.destination);oscillator.start();oscillator.stop(audioContext.currentTime+duration)}
  function updateHud(){cellCount.textContent=String(collected).padStart(2,'0');livesNode.textContent=Array.from({length:3},(_,i)=>i<lives?'♥':'♡').join(' ')}
  function held(...codes){return codes.some(code=>keys[code])}
  function update(dt){
    time+=dt; if(state!=='playing')return;
    const left=held('ArrowLeft','KeyA','touch-left'),right=held('ArrowRight','KeyD','touch-right'),jump=held('Space','ArrowUp','KeyW','KeyZ','touch-jump');
    const accel=left?-1:right?1:0; if(accel){player.vx+=accel*1250*dt;player.face=accel;player.walk+=dt*10}else{player.vx*=Math.pow(.001,dt)}
    player.vx=Math.max(-245,Math.min(245,player.vx));
    if(jump&&player.onGround){player.vy=-540;player.onGround=false;burst(player.x+14,player.y+40,'#61edff',7);tone(300,.11,'square')}
    player.vy=Math.min(800,player.vy+1500*dt);
    const oldY=player.y;player.x=Math.max(0,Math.min(WORLD-player.w,player.x+player.vx*dt));player.y+=player.vy*dt;player.onGround=false;
    for(const p of platforms){if(player.x+player.w>p.x&&player.x<p.x+p.w&&oldY+player.h<=p.y+4&&player.y+player.h>=p.y&&player.vy>=0){player.y=p.y-player.h;player.vy=0;player.onGround=true}}
    if(player.y>H+100){hurt(true)}
    if(invulnerable>0)invulnerable-=dt;
    for(const e of enemies){if(!e.alive)continue;e.x+=e.v*dt;if(e.x<e.min||e.x>e.max)e.v*=-1;e.y=468;
      if(invulnerable<=0&&player.x+player.w>e.x-13&&player.x<e.x+18&&player.y+player.h>e.y-30&&player.y+player.h<e.y+12&&player.vy>50){e.alive=false;player.vy=-360;burst(e.x,e.y-15,'#ff659d',12)}
      else if(invulnerable<=0&&player.x+player.w>e.x-12&&player.x<e.x+18&&player.y+player.h>e.y-30&&player.y<e.y+7)hurt(false);
    }
    for(const c of cells){if(c.got)continue;c.phase+=dt*3;if(Math.abs(player.x+14-c.x)<24&&Math.abs(player.y+19-c.y)<28){c.got=true;collected++;updateHud();burst(c.x,c.y,'#ffe66d',12);tone(740+collected*24,.16,'triangle');if(collected===cells.length)toastMsg('ALL CELLS RECOVERED!')}}
    if(player.onGround&&player.x>checkpoint+850){checkpoint=Math.floor(player.x/800)*800;checkpointY=player.y;toastMsg('BEACON CHECKPOINT SYNCED')}
    for(const p of particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=220*dt;p.life-=dt}particles=particles.filter(p=>p.life>0);
    if(player.x>WORLD-175){state='win';setOverlay('win')}
    camera=Math.max(0,Math.min(WORLD-W,(player.x+player.w/2)-W*.38));
  }
  function hurt(fell){if(invulnerable>0)return;tone(140,.3,'sawtooth');lives--;updateHud();burst(player.x+14,player.y+20,'#ff648b',14);if(lives<=0){state='dead';setOverlay('dead');return}player.x=checkpoint;player.y=checkpointY;player.vx=0;player.vy=-240;invulnerable=1.6;if(fell)toastMsg('SUIT REBOOT · KEEP MOVING')}
  function burst(x,y,color,n){for(let i=0;i<n;i++){const a=Math.random()*Math.PI*2,s=35+Math.random()*150;particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:.35+Math.random()*.5,color})}}
  function rect(x,y,w,h,color){ctx.fillStyle=color;ctx.fillRect(x,y,w,h)}
  function drawBackground(){
    const grad=ctx.createLinearGradient(0,0,0,H);grad.addColorStop(0,'#101735');grad.addColorStop(.55,'#1c2850');grad.addColorStop(1,'#392956');ctx.fillStyle=grad;ctx.fillRect(0,0,W,H);
    const planetX=690-camera*.11, planetY=153;ctx.save();ctx.globalAlpha=.7;ctx.shadowColor='#ad77ff';ctx.shadowBlur=38;ctx.fillStyle='#8174b8';ctx.beginPath();ctx.arc(planetX,planetY,75,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;ctx.globalAlpha=.55;ctx.fillStyle='#c1a8da';ctx.beginPath();ctx.ellipse(planetX,planetY+12,68,24,0,0,Math.PI*2);ctx.fill();ctx.globalAlpha=.65;ctx.fillStyle='#7765aa';ctx.beginPath();ctx.arc(planetX-24,planetY-25,17,0,Math.PI*2);ctx.fill();ctx.restore();
    for(const s of starfield){let x=(s.x-camera*.22)%WORLD;if(x<0)x+=WORLD;x=(x/WORLD)*W;if(x<0||x>W)continue;ctx.globalAlpha=s.a*(.78+.22*Math.sin(time*1.6+s.p));ctx.fillStyle=s.p===2?'#8aefff':'#fff';ctx.beginPath();ctx.arc(x,s.y,s.r,0,Math.PI*2);ctx.fill()}ctx.globalAlpha=1;
    // Distant mountain silhouettes
    ctx.fillStyle='#17213d';ctx.beginPath();ctx.moveTo(0,368);for(let x=0;x<=W+40;x+=40){const wx=x+camera*.32;ctx.lineTo(x,320+Math.sin(wx*.018)*22+Math.sin(wx*.042)*13)}ctx.lineTo(W,H);ctx.lineTo(0,H);ctx.fill();
    for(const b of buildingSet){let x=(b.x-camera*.53)%5400;if(x< -100)x+=5400;x=x/5400*W;let y=460-b.h;rect(x,y,b.w,b.h,'#111a35');rect(x+5,y+9,2,4,'#405079');for(let wy=y+18;wy<452;wy+=15)if((b.seed+Math.floor(wy))%3!==0)rect(x+12,wy,3,5,(b.seed%4===0)?'#e780b744':'#60d7e333');rect(x,y,b.w,2,'#37446a')}
    // Horizon glow
    const glow=ctx.createLinearGradient(0,335,0,455);glow.addColorStop(0,'#ff60bb00');glow.addColorStop(1,'#ff60bb1d');ctx.fillStyle=glow;ctx.fillRect(0,335,W,120);
  }
  function drawPlatform(p){const x=Math.floor(p.x-camera);if(x+p.w<0||x>W)return;const ground=p.y>=490;rect(x,p.y,p.w,p.h,ground?'#17233b':'#1c2a48');rect(x,p.y,p.w,5,'#4de2e8');rect(x,p.y+5,p.w,2,'#8effff');ctx.fillStyle='#111a30';ctx.beginPath();ctx.moveTo(x+7,p.y+p.h);ctx.lineTo(x+18,p.y+p.h);ctx.lineTo(x+25,p.y+p.h-5);ctx.lineTo(x+39,p.y+p.h-5);ctx.lineTo(x+45,p.y+p.h);ctx.fill();for(let bx=x+11;bx<x+p.w-8;bx+=34){rect(bx,p.y+12,12,2,'#405273');rect(bx+3,p.y+16,4,2,'#273955')}if(ground){for(let bx=x+24;bx<x+p.w;bx+=80){rect(bx,p.y+22,29,3,'#334462');rect(bx+8,p.y+32,7,3,'#253550')}}}
  function drawCell(c){if(c.got)return;const x=c.x-camera,y=c.y+Math.sin(c.phase)*4;ctx.save();ctx.translate(x,y);ctx.rotate(Math.sin(c.phase)*.12);ctx.shadowColor='#ffe66d';ctx.shadowBlur=15;ctx.fillStyle='#fff0a1';ctx.beginPath();ctx.moveTo(0,-11);ctx.lineTo(9,-2);ctx.lineTo(0,10);ctx.lineTo(-9,-2);ctx.closePath();ctx.fill();ctx.shadowBlur=0;ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(-2,-3,2,0,Math.PI*2);ctx.fill();ctx.restore()}
  function drawEnemy(e){if(!e.alive)return;const x=e.x-camera;ctx.save();ctx.translate(x,e.y);ctx.fillStyle='#ff568e';ctx.shadowColor='#ff568e';ctx.shadowBlur=14;ctx.beginPath();ctx.ellipse(0,-12,16,14+Math.sin(time*8+e.home)*2,0,Math.PI,0);ctx.lineTo(16,0);ctx.ellipse(0,0,16,6,0,0,Math.PI);ctx.fill();ctx.shadowBlur=0;ctx.fillStyle='#fff1f6';ctx.fillRect(-7,-17,4,5);ctx.fillRect(4,-17,4,5);ctx.fillStyle='#151830';ctx.fillRect(-6,-15,2,3);ctx.fillRect(5,-15,2,3);ctx.restore()}
  function drawPlayer(){if(!player)return;const x=player.x-camera,y=player.y;ctx.save();if(invulnerable>0&&Math.floor(time*15)%2)ctx.globalAlpha=.35;ctx.translate(x+player.w/2,y+player.h/2);ctx.scale(player.face,1);const bob=player.onGround&&Math.abs(player.vx)>10?Math.sin(player.walk)*2:0;
    // compact astronaut silhouette
    ctx.shadowColor='#42e9ff';ctx.shadowBlur=13;ctx.fillStyle='#e7f6ff';ctx.beginPath();ctx.roundRect(-11,-9+bob,22,25,7);ctx.fill();ctx.shadowBlur=0;
    ctx.fillStyle='#52e6f4';ctx.beginPath();ctx.roundRect(-12,-19+bob,24,23,10);ctx.fill();ctx.fillStyle='#10213b';ctx.beginPath();ctx.ellipse(1,-8+bob,8,7,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#a5fbff';ctx.fillRect(2,-11+bob,5,2);
    ctx.fillStyle='#ffb46f';ctx.fillRect(-8,10+bob,6,6);ctx.fillRect(3,10+bob,6,6);ctx.fillStyle='#a8bfd8';ctx.fillRect(-14,-3+bob,4,12);ctx.fillRect(10,-2+bob,4,10);
    // backpack and beacon badge
    ctx.fillStyle='#fa70ae';ctx.fillRect(-15,-12+bob,5,16);ctx.fillStyle='#ffe880';ctx.beginPath();ctx.arc(1,1+bob,2.4,0,Math.PI*2);ctx.fill();ctx.restore()}
  function drawBeacon(){const x=WORLD-130-camera;ctx.save();ctx.shadowColor='#60f5ff';ctx.shadowBlur=24;ctx.strokeStyle='#55efff';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(x,498);ctx.lineTo(x,297);ctx.stroke();ctx.fillStyle='#f8fdff';ctx.beginPath();ctx.arc(x,289+Math.sin(time*3)*4,12,0,Math.PI*2);ctx.fill();ctx.fillStyle='#49e8ff';ctx.beginPath();ctx.arc(x,289+Math.sin(time*3)*4,6,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;ctx.fillStyle='#ff66ac';ctx.beginPath();ctx.moveTo(x,310);ctx.lineTo(x+50,326);ctx.lineTo(x,343);ctx.closePath();ctx.fill();ctx.restore();}
  function draw(){drawBackground();for(const p of platforms)drawPlatform(p);drawBeacon();for(const c of cells||[])drawCell(c);for(const e of enemies||[])drawEnemy(e);drawPlayer();for(const p of particles||[]){ctx.globalAlpha=Math.max(0,p.life*2);ctx.fillStyle=p.color;ctx.fillRect(p.x-camera,p.y,3,3)}ctx.globalAlpha=1;}
  function loop(now){const dt=Math.min(.033,(now-last)/1000||0);last=now;update(dt);draw();requestAnimationFrame(loop)}
  const mobile=matchMedia('(pointer: coarse)').matches; if(mobile)frame.classList.add('mobile-controls');
  setOverlay('menu');requestAnimationFrame(loop);
})();
