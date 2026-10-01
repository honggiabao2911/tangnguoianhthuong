'use strict';
(() => {
  const $=id=>document.getElementById(id), TAU=Math.PI*2;
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  const rand=(a,b)=>a+Math.random()*(b-a);
  const canvases={ambient:$('ambient'),party:$('celebrationFx'),heart:$('heartCanvas'),candle:$('candleCanvas'),universe:$('universeCanvas')};
  const ctx=Object.fromEntries(Object.entries(canvases).map(([k,c])=>[k,c.getContext('2d')]));
  let W=innerWidth,H=innerHeight,HW=W,HH=H,UW=W,UH=H,cakeSize=360;
  let scene='heart',paused=matchMedia('(prefers-reduced-motion: reduce)').matches,raf=0,last=0,clock=0,heartStart=0,blownAt=null,captionStage=-1;
  let stars=[],particles=[],textTargets=[],partyBits=[],scheduled=[],cakePoints=[],photoImages=[],photoHits=[];
  let greetingMode='heart',autoGreeting=true,morph=null,heartTouch=null,gathering=false,heartHoldTimer=null;
  let expanded=false,spreadMix=0,formation=false,formationMix=0,rotation=0,dragRotation=0,tilt=.2,dragging=false,down=null,lastPointerX=0;
  const pinks=['#af326c','#cd5284','#e189a2','#bf78a9','#ca9968'];
  function sprite(color,heart=false){
    const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d');
    if(heart){g.font='40px Arial';g.textAlign='center';g.textBaseline='middle';g.fillStyle=color;g.shadowColor=color;g.shadowBlur=11;g.fillText('♥',32,33);}
    else {const r=g.createRadialGradient(32,32,0,32,32,30);r.addColorStop(0,'#fff2fc');r.addColorStop(.13,color);r.addColorStop(.32,color+'a0');r.addColorStop(1,color+'00');g.fillStyle=r;g.fillRect(0,0,64,64);}
    return c;
  }
  const heartSprites=pinks.map(c=>sprite(c,true)),glowSprites=pinks.map(c=>sprite(c));
  const greetingSprites=['#ee1761','#ff387e','#d20d58','#fa538a','#ec2863'].map(c=>sprite(c,true));
  function fit(name,w,h){const ratio=Math.min(devicePixelRatio||1,1.5);const c=canvases[name];c.width=Math.max(1,Math.round(w*ratio));c.height=Math.max(1,Math.round(h*ratio));ctx[name].setTransform(ratio,0,0,ratio,0,0);}
  function makeTextTargets(){
    const c=document.createElement('canvas');const mobile=HW<650;
    c.width=Math.floor(Math.min(1000,HW*.9));c.height=Math.floor(Math.min(320,HH*.36));
    const g=c.getContext('2d'),lines=mobile?['CHÚC MỪNG','SINH NHẬT','EM YÊU']:['CHÚC MỪNG SINH NHẬT','EM YÊU'];
    let size=Math.min(mobile?58:78,c.width/(mobile?6.6:12.5));
    g.textAlign='center';g.textBaseline='middle';g.fillStyle='#fff';
    g.font=`500 ${size}px "Be Vietnam Pro", Arial, sans-serif`;
    while(Math.max(...lines.map(line=>g.measureText(line).width))>c.width*.95){size--;g.font=`500 ${size}px "Be Vietnam Pro", Arial, sans-serif`;}
    const lineHeight=size*1.4;
    g.strokeStyle='#fff';g.lineWidth=size*.036;g.lineJoin='round';lines.forEach((line,i)=>{const y=c.height/2+(i-(lines.length-1)/2)*lineHeight;g.strokeText(line,c.width/2,y);g.fillText(line,c.width/2,y);});
    const data=g.getImageData(0,0,c.width,c.height).data,targets=[],step=mobile?2.7:3.8;
    for(let y=0;y<c.height;y+=step)for(let x=(Math.round(y/step)%2)*step*.5;x<c.width;x+=step){if(data[(Math.floor(y)*c.width+Math.floor(x))*4+3]>125)targets.push({x:x-c.width/2+rand(-.32,.32),y:y-c.height/2+rand(-.32,.32)});}
    for(let i=targets.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[targets[i],targets[j]]=[targets[j],targets[i]];}
    textTargets=targets.length?targets:[{x:0,y:0}];
  }
  function makeHeart(){
    makeTextTargets();const count=HW<650?2800:4400,scale=Math.min(HW*.34,235,HH*.15);
    particles=Array.from({length:count},(_,i)=>{
      // Uniform filled silhouette: particle density no longer depends on the text mask.
      let x,y;do{x=rand(-1.14,1.14);y=rand(-1,1.24);}while((x*x+y*y-1)**3-x*x*y*y*y>0);
      const angle=i*2.399963,target=textTargets[i%textTargets.length];
      return {hx:x*scale,hy:-y*scale,tx:target.x,ty:target.y,angle,phase:rand(0,TAU),size:rand(HW<650?5.5:6,HW<650?8:10),color:i%5,
        x:Math.cos(angle)*HW*.75,y:Math.sin(angle)*HH*.7,fx:0,fy:0,distance:rand(.2,.53)*Math.min(HW,HH),delay:rand(0,.24)};
    });morph=null;captionStage=-1;
  }
  function changeGreeting(mode){
    greetingMode=mode;autoGreeting=false;gathering=false;morph=paused?null:{at:clock};
    for(const p of particles){p.fx=p.x;p.fy=p.y;}
    canvases.heart.dataset.shape=mode;canvases.heart.setAttribute('aria-label',mode==='heart'?'Trái tim hạt sáng. Chạm để ghép thành lời chúc.':'Chúc mừng sinh nhật em yêu. Chạm để ghép lại thành trái tim.');wake();
  }
  function resetGreeting(){clearTimeout(heartHoldTimer);heartStart=clock;greetingMode='heart';autoGreeting=true;heartTouch=null;gathering=false;canvases.heart.dataset.shape='heart';makeHeart();wake();}
  function resize(){
    W=innerWidth;H=innerHeight;fit('ambient',W,H);fit('party',W,H);
    stars=Array.from({length:W<600?75:140},()=>({x:rand(0,W),y:rand(0,H),s:rand(.5,1.6),phase:rand(0,TAU),speed:rand(2,7)}));
    const hr=$('scene-heart').getBoundingClientRect(),ur=$('universeStage').getBoundingClientRect();
    HW=hr.width||W;HH=hr.height||Math.max(640,H);UW=ur.width||W;UH=ur.height||Math.max(310,H*.49);
    fit('heart',HW,HH);fit('universe',UW,UH);
    cakeSize=$('cakeStage').getBoundingClientRect().width||Math.min(430,W*.9,H*.47);fit('candle',cakeSize,cakeSize);
    makeHeart();wake();
  }
  function drawAmbient(dt){
    const g=ctx.ambient;g.clearRect(0,0,W,H);
    for(const s of stars){if(!paused){s.y-=s.speed*dt;if(s.y<0)s.y=H;}
      g.globalAlpha=.16+(Math.sin(clock*.5+s.phase)+1)*.18;g.fillStyle='#ad547c';g.beginPath();g.arc(s.x,s.y,s.s,0,TAU);g.fill();
    }g.globalAlpha=1;
    if(scene!=='finale')for(let i=0;i<8;i++){const x=(Math.sin(i*5.2+clock*.065)*.43+.5)*W,y=((i*.159-clock*.009)%1+1)%1*H;g.globalAlpha=.18+Math.sin(i+clock*.4)*.06;const size=20+(i%3)*14;g.drawImage(heartSprites[i%3],x-size/2,y-size/2,size,size);}g.globalAlpha=1;
  }
  function drawHearts(dt){
    const g=ctx.heart;g.clearRect(0,0,HW,HH);const cx=HW/2,cy=HH*.51;
    if(heartTouch&&!gathering&&performance.now()-heartTouch.at>=240){gathering=true;heartTouch.held=true;autoGreeting=false;morph=null;}
    if(autoGreeting&&!heartTouch&&(clock-heartStart>2.8||paused))changeGreeting('text');
    const phase=gathering?'gather':morph&&clock-morph.at<2?'morph':greetingMode;
    if(captionStage!==phase){$('heartCaption').textContent={heart:'Cả trái tim này, dành riêng cho em. ♡',text:'Chúc mừng sinh nhật, người anh thương nhất. ♡',gather:'Giữ yêu thương trong lòng bàn tay…',morph:'Ngàn trái tim, một lời yêu.'}[phase];captionStage=phase;}
    const beat=paused?1:1+Math.pow(Math.max(0,Math.sin(clock*5.5)),6)*.045;
    const follow=paused?1:1-Math.exp(-dt*(gathering?8:10));
    const aura=g.createRadialGradient(cx,cy,0,cx,cy,Math.min(HW*.6,400));aura.addColorStop(0,'#ff77a52a');aura.addColorStop(1,'#ff94ba00');g.fillStyle=aura;g.fillRect(0,0,HW,HH);
    for(const p of particles){
      let x=greetingMode==='heart'?p.hx*beat:p.tx,y=greetingMode==='heart'?p.hy*beat:p.ty;
      if(morph&&!paused){const q=clamp((clock-morph.at-p.delay)/1.55,0,1),ease=q*q*(3-2*q),spray=Math.sin(Math.PI*q)*p.distance;
        x=p.fx*(1-ease)+x*ease+Math.cos(p.angle)*spray;y=p.fy*(1-ease)+y*ease+Math.sin(p.angle)*spray;
      }
      if(gathering&&heartTouch){const r=5+Math.sqrt((p.phase/TAU))*27,a=p.angle+clock*1.8;x=heartTouch.x-cx+Math.cos(a)*r;y=heartTouch.y-cy+Math.sin(a)*r;}
      const prevX=p.x,prevY=p.y;p.x+=(x-p.x)*follow;p.y+=(y-p.y)*follow;
      if(!paused&&p.color===0&&Math.hypot(p.x-prevX,p.y-prevY)>1.5){g.globalAlpha=.14;g.strokeStyle='#d51460';g.lineWidth=.7;g.beginPath();g.moveTo(cx+prevX,cy+prevY);g.lineTo(cx+p.x,cy+p.y);g.stroke();}
      const size=p.size*(greetingMode==='text'&&!gathering?.76:1);g.globalAlpha=(gathering?.38:.85)+Math.sin(clock*1.8+p.phase)*.1;
      g.drawImage(greetingSprites[p.color],cx+p.x-size/2,cy+p.y-size/2,size,size);
    }
    if(morph&&clock-morph.at>2)morph=null;
    if(gathering&&heartTouch){g.globalAlpha=.45;g.strokeStyle='#d62a6b';g.lineWidth=1;g.beginPath();g.arc(heartTouch.x,heartTouch.y,40+Math.sin(clock*3)*3,0,TAU);g.stroke();}
    g.globalAlpha=1;
  }
  function drawCandle(){
    const g=ctx.candle;g.clearRect(0,0,cakeSize,cakeSize);const x=cakeSize*.5004,y=cakeSize*.1834;
    const age=blownAt===null?-1:Math.max(paused?1:0,clock-blownAt);const power=age<0?1:Math.max(0,1-age/.65);
    if(power>0){const f=cakeSize*.062*power,sw=paused?0:Math.sin(clock*6)*1.3+Math.sin(clock*11)*.6;
      const glow=g.createRadialGradient(x,y-f*.5,0,x,y-f*.5,cakeSize*.17*power);glow.addColorStop(0,'#ffd38355');glow.addColorStop(.25,'#ffa94c18');glow.addColorStop(1,'#ffa94c00');g.fillStyle=glow;g.fillRect(0,0,cakeSize,cakeSize);
      const lit=g.createLinearGradient(x,y-f,x,y);lit.addColorStop(0,'#ffb85577');lit.addColorStop(.3,'#ffdd94');lit.addColorStop(.75,'#fff8da');lit.addColorStop(1,'#92b3e9');g.fillStyle=lit;g.shadowColor='#ffd093';g.shadowBlur=12*power;
      const bend=sw+(1-power)*18;g.beginPath();g.moveTo(x,y);g.bezierCurveTo(x-f*.4,y-f*.15,x-f*.1+bend,y-f*.6,x+bend,y-f);g.bezierCurveTo(x+f*.08+bend,y-f*.56,x+f*.4,y-f*.15,x,y);g.fill();g.shadowBlur=0;
    }
    if(age>.45&&age<3.2&&!paused){const p=(age-.45)/2.75;g.strokeStyle=`rgba(122,74,96,${.3*(1-p)})`;g.lineWidth=1+p*2;g.beginPath();g.moveTo(x,y-5);g.bezierCurveTo(x+15*Math.sin(p*4),y-25-p*25,x-22*p,y-40-p*40,x+20*p,y-60-p*55);g.stroke();}
    if(age<0)for(let i=0;i<7;i++){const a=i*TAU/7+clock*.13;const sx=x+Math.cos(a)*cakeSize*.43,sy=cakeSize*.53+Math.sin(a)*cakeSize*.3;const s=5+(Math.sin(clock*2+i)+1)*3;g.globalAlpha=.3;g.drawImage(glowSprites[i%4],sx-s,sy-s,s*2,s*2);}g.globalAlpha=1;
  }
  function addRing(radius,y,color,count=140){for(let i=0;i<count;i++){const a=i/count*TAU;cakePoints.push({x:Math.cos(a)*radius,y,z:Math.sin(a)*radius,c:color,s:rand(.8,1.7),phase:rand(0,TAU)});}}
  function makeCake(){
    cakePoints=[];
    for(const [r,bottom,top]of [[112,-76,-20],[85,-20,32],[59,32,77]]){
      for(let y=bottom;y<=top;y+=5.8)addRing(r,y,y===bottom||y+6>top?1:0,115);
      for(let r2=8;r2<r;r2+=9)addRing(r2,top,1,Math.max(30,Math.floor(r2*1.6)));
      for(let i=0;i<180;i++){const a=i/180*TAU;cakePoints.push({x:Math.cos(a)*(r+1),z:Math.sin(a)*(r+1),y:top-9-(Math.sin(a*12)+1)*5,c:2,s:1.5,phase:a});}
    }
    addRing(119,-80,3,180);addRing(121,-84,1,180);
    for(let i=0;i<5;i++){const a=i*TAU/5;const x=Math.cos(a)*39,z=Math.sin(a)*39;for(let y=80;y<=119;y+=3){cakePoints.push({x,y,z,c:3,s:1.4,phase:0});}for(let j=0;j<12;j++){cakePoints.push({x:x+rand(-2,2),y:122+j*.9,z:z+rand(-2,2),c:3,s:1.8-j*.065,phase:i+j});}}
    // Limit the rendered point count on narrow phones while retaining every contour.
    if(W<600)cakePoints=cakePoints.filter((p,i)=>i%2===0||p.y>80);
  }
  function preloadPhotos(){if(photoImages.length)return;photoImages=window.BIRTHDAY_CONFIG.photos.map(p=>{const img=new Image();img.decoding='async';img.src=p.src;img.onload=wake;return img;});}
  function worldProject(x,y,z,angle=rotation+dragRotation){
    const cs=Math.cos(angle),sn=Math.sin(angle),xx=x*cs+z*sn,zz=z*cs-x*sn;
    const yy=y*Math.cos(tilt)-zz*Math.sin(tilt),depth=y*Math.sin(tilt)+zz*Math.cos(tilt);
    const scale=Math.min(UW/460,UH/380,1.4),persp=600/(600-depth);
    return {x:UW/2+xx*scale*persp,y:UH*.535-yy*scale*persp,scale:scale*persp,z:depth};
  }
  function rounded(g,x,y,w,h,r){g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);g.arcTo(x+w,y+h,x,y+h,r);g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath();}
  function drawOrbitPhoto(o){
    const g=ctx.universe,img=photoImages[o.index];if(!img||!img.complete||!img.naturalWidth)return;
    const p=o.p,w=75*p.scale,h=103*p.scale,roll=Math.sin(o.angle)*.13;
    g.save();g.translate(p.x,p.y);g.rotate(roll);g.globalAlpha=clamp(.6+p.z/700,.45,1);g.shadowColor='#ff81d35a';g.shadowBlur=18*p.scale;
    rounded(g,-w/2,-h/2,w,h,3*p.scale);g.fillStyle='#ffeadf';g.fill();g.shadowBlur=0;
    const pad=4*p.scale,iw=w-pad*2,ih=h-pad*4;g.save();rounded(g,-w/2+pad,-h/2+pad,iw,ih,1);g.clip();
    const ir=img.naturalWidth/img.naturalHeight,box=iw/ih;let sx=0,sy=0,sw=img.naturalWidth,sh=img.naturalHeight;
    if(ir>box){sw=sh*box;sx=(img.naturalWidth-sw)/2;}else{sh=sw/box;sy=(img.naturalHeight-sh)/2;}
    g.drawImage(img,sx,sy,sw,sh,-w/2+pad,-h/2+pad,iw,ih);g.restore();g.fillStyle='#b56a8c';g.font=`${Math.max(8,10*p.scale)}px Georgia`;g.textAlign='center';g.fillText('♡',0,h/2-4*p.scale);g.restore();
    photoHits.push({x:p.x,y:p.y,w,h,index:o.index,z:p.z});
  }
  function drawUniverse(dt){
    const g=ctx.universe;g.clearRect(0,0,UW,UH);spreadMix=paused?Number(expanded):spreadMix+(Number(expanded)-spreadMix)*(1-Math.exp(-dt*2));if(!paused&&!dragging)rotation+=dt*.105;formationMix=paused?Number(formation):formationMix+(Number(formation)-formationMix)*(1-Math.exp(-dt*3));
    const cx=UW/2,cy=UH*.56;const glow=g.createRadialGradient(cx,cy,0,cx,cy,Math.min(UW*.7,410));glow.addColorStop(0,'#cd319a21');glow.addColorStop(.5,'#7f319411');glow.addColorStop(1,'#281a4000');g.fillStyle=glow;g.fillRect(0,0,UW,UH);
    photoHits=[];const orbit=[];
    for(let i=0;i<8;i++){const a=i*TAU/8+clock*.015;const r=(UW<600?225:310)*(1+spreadMix*.65);const y=Math.sin(a*2+.8)*100+9,t=i*TAU/8;const hx=16*Math.sin(t)**3*11,hy=(13*Math.cos(t)-5*Math.cos(2*t)-2*Math.cos(3*t)-Math.cos(4*t))*10+40;orbit.push({angle:a,index:i%photoImages.length,p:worldProject(Math.cos(a)*r*(1-formationMix)+hx*formationMix,y*(1-formationMix)+hy*formationMix,Math.sin(a)*r*(1-formationMix))});}
    orbit.sort((a,b)=>a.p.z-b.p.z);orbit.filter(o=>o.p.z<0).forEach(drawOrbitPhoto);
    g.save();g.globalCompositeOperation='source-over';
    const ringRadius=UW<600?175:220;
    for(let i=0;i<190;i++){const a=i/190*TAU;const p=worldProject(Math.cos(a)*ringRadius,-88+Math.sin(a*2)*17,Math.sin(a)*ringRadius);g.globalAlpha=.2+(Math.sin(a*8+clock)+1)*.1;g.fillStyle='#b95886';g.fillRect(p.x,p.y,1.3*p.scale,1.3*p.scale);}
    for(let i=0;i<cakePoints.length;i++){const point=cakePoints[i],p=worldProject(point.x,point.y,point.z);const a=clamp(.48+p.z/330, .2,.95);const twinkle=.8+Math.sin(clock*2.4+point.phase)*.2;const size=(point.s+1.5)*p.scale*twinkle;
      g.globalAlpha=a;g.drawImage(glowSprites[point.c],p.x-size,p.y-size,size*2,size*2);
    }
    for(let i=0;i<20;i++){const a=i*2.399+clock*.07,r=145+i%5*15,y=Math.sin(i*1.7+clock*.1)*155;const p=worldProject(Math.cos(a)*r,y,Math.sin(a)*r),s=(9+i%4*3)*p.scale;g.globalAlpha=.45;g.drawImage(heartSprites[i%4],p.x-s/2,p.y-s/2,s,s);}
    g.restore();orbit.filter(o=>o.p.z>=0).forEach(drawOrbitPhoto);
    for(let i=0;i<3;i++){const a=i*TAU/3+clock*.07;const p=worldProject(Math.cos(a)*155,120-Math.sin(a)*33,Math.sin(a)*155);g.globalAlpha=.38;g.font=`italic ${clamp(14*p.scale,10,22)}px Georgia`;g.textAlign='center';g.fillStyle='#a34571';g.fillText(['Happy Birthday','Thương em ♡','Always, with love'][i],p.x,p.y);}g.globalAlpha=1;
  }
  function burst(x,y,kind='spark'){if(paused)return;const n=W<600?70:110;for(let i=0;i<n;i++){const a=rand(0,TAU),v=rand(50,210);partyBits.push({x,y,px:x,py:y,vx:Math.cos(a)*v,vy:Math.sin(a)*v-30,life:rand(1.1,2.8),age:0,color:Math.floor(rand(0,5)),size:rand(1,2.7),heart:i%9===0,kind});}if(partyBits.length>650)partyBits=partyBits.slice(-650);}
  function fireworks(x,y){if(paused)return;if(x!==undefined){burst(x,y);return;}scheduled.push({at:clock,x:W*.3,y:H*.36},{at:clock+.5,x:W*.73,y:H*.3},{at:clock+1.1,x:W*.48,y:H*.42});wake();}
  function drawParty(dt){const g=ctx.party;g.clearRect(0,0,W,H);if(paused)return;
    scheduled=scheduled.filter(s=>{if(s.at<=clock){burst(s.x,s.y);return false;}return true;});
    for(const p of partyBits){p.age+=dt;p.px=p.x;p.py=p.y;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=35*dt;p.vx*=Math.pow(.981,dt*30);g.globalAlpha=Math.max(0,1-p.age/p.life);
      if(p.heart){const s=12;g.drawImage(heartSprites[p.color],p.x-s/2,p.y-s/2,s,s);}else{g.strokeStyle=pinks[p.color];g.lineWidth=p.size;g.beginPath();g.moveTo(p.px,p.py);g.lineTo(p.x,p.y);g.stroke();g.fillStyle=pinks[p.color];g.fillRect(p.x,p.y,1,1);}}
    g.globalAlpha=1;partyBits=partyBits.filter(p=>p.age<p.life);
  }
  function frame(now){raf=0;if(document.hidden)return;if(now-last<32){raf=requestAnimationFrame(frame);return;}const dt=Math.min((now-last)/1000,.06);last=now;if(!paused)clock+=dt;
    drawAmbient(dt);if(scene==='heart')drawHearts(dt);if(scene==='candle')drawCandle();if(scene==='finale'&&!window.Birthday3D?.ready)drawUniverse(dt);drawParty(dt);if(!paused)raf=requestAnimationFrame(frame);
  }
  function wake(){if(!raf&&!document.hidden)raf=requestAnimationFrame(frame);}
  function endHeartTouch(){clearTimeout(heartHoldTimer);heartTouch=null;gathering=false;wake();}
  const heartCanvas=canvases.heart;
  heartCanvas.addEventListener('pointerdown',e=>{if(scene!=='heart'||heartTouch||(e.pointerType==='mouse'&&e.button!==0))return;const r=heartCanvas.getBoundingClientRect();heartTouch={id:e.pointerId,x:e.clientX-r.left,y:e.clientY-r.top,startX:e.clientX,startY:e.clientY,at:performance.now(),held:false};heartCanvas.setPointerCapture(e.pointerId);heartHoldTimer=setTimeout(()=>{if(!heartTouch)return;gathering=true;heartTouch.held=true;autoGreeting=false;morph=null;wake();},240);wake();});
  heartCanvas.addEventListener('pointermove',e=>{if(!heartTouch||heartTouch.id!==e.pointerId)return;const r=heartCanvas.getBoundingClientRect();heartTouch.x=e.clientX-r.left;heartTouch.y=e.clientY-r.top;wake();});
  heartCanvas.addEventListener('pointerup',e=>{if(!heartTouch||heartTouch.id!==e.pointerId)return;const tap=!heartTouch.held&&performance.now()-heartTouch.at<240&&Math.hypot(e.clientX-heartTouch.startX,e.clientY-heartTouch.startY)<12;endHeartTouch();if(tap)changeGreeting(greetingMode==='heart'?'text':'heart');});
  heartCanvas.addEventListener('pointercancel',endHeartTouch);heartCanvas.addEventListener('lostpointercapture',endHeartTouch);
  heartCanvas.addEventListener('contextmenu',e=>e.preventDefault());
  heartCanvas.addEventListener('click',e=>{if(e.detail===0)changeGreeting(greetingMode==='heart'?'text':'heart');});
  heartCanvas.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();changeGreeting(greetingMode==='heart'?'text':'heart');}});
  function setScene(name){endHeartTouch();scene=name;window.Birthday3D?.setActive(name==='finale');if(name==='heart')resetGreeting();if(name==='finale'){preloadPhotos();makeCake();}resize();}
  canvases.universe.addEventListener('pointerdown',e=>{if(scene!=='finale')return;down={x:e.clientX,y:e.clientY,at:performance.now()};lastPointerX=e.clientX;dragging=true;canvases.universe.setPointerCapture(e.pointerId);});
  canvases.universe.addEventListener('pointermove',e=>{if(!dragging||!down)return;dragRotation+=(e.clientX-lastPointerX)*.009;lastPointerX=e.clientX;tilt=clamp(.2+(e.clientY-down.y)*.0015,-.12,.6);wake();});
  canvases.universe.addEventListener('pointerup',e=>{if(!down)return;const distance=Math.hypot(e.clientX-down.x,e.clientY-down.y);dragging=false;
    if(distance<9){const rect=canvases.universe.getBoundingClientRect(),x=e.clientX-rect.left,y=e.clientY-rect.top;const hit=[...photoHits].sort((a,b)=>b.z-a.z).find(p=>Math.abs(x-p.x)<p.w*.65&&Math.abs(y-p.y)<p.h*.6);if(hit)window.dispatchEvent(new CustomEvent('birthday:photo',{detail:hit.index}));else{expanded=!expanded;$('expandUniverse').setAttribute('aria-pressed',String(expanded));$('expandUniverse').textContent=expanded?'Thu về ♡':'Bung ảnh ✧';if(expanded&&formation){formation=false;$('heartFormation').setAttribute('aria-pressed','false');$('heartFormation').textContent='Ghép tim ♡';}}}down=null;wake();});
  canvases.universe.addEventListener('pointercancel',()=>{dragging=false;down=null;});
  window.addEventListener('resize',resize,{passive:true});document.addEventListener('visibilitychange',()=>{if(document.hidden){endHeartTouch();cancelAnimationFrame(raf);raf=0;}else{last=performance.now()-40;wake();}});
  window.BirthdayFX={setScene,resize,setExpanded(value){expanded=Boolean(value);wake();},setFormation(value){formation=Boolean(value);wake();},preloadPhotos,fireworks,blow(){blownAt=clock;fireworks();wake();},relight(){blownAt=null;wake();},replayHearts:resetGreeting,setPaused(value){paused=value;window.Birthday3D?.setPaused(value);partyBits=[];scheduled=[];wake();},get paused(){return paused;}};
  resize();document.fonts.ready.then(()=>{makeHeart();wake();});
})();
