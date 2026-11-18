const reduce=matchMedia('(prefers-reduced-motion: reduce)');
const clamp=(n,min,max)=>Math.min(max,Math.max(min,n));
const colors={'公司':'#b9ec89','工具':'#f4ca7f','模型':'#d2bdf4','产品':'#7bd5bb','开源':'#a2c7ff','概念':'#f49d90','人物':'#f2b3d6'};
function size(canvas) {
  const box=canvas.getBoundingClientRect();
  const dpr=Math.min(devicePixelRatio||1,2);
  canvas.width=Math.round(box.width*dpr);
  canvas.height=Math.round(box.height*dpr);
  return {w:box.width,h:box.height,dpr};
}
function context(canvas) {
  const dims=size(canvas);
  const c=canvas.getContext('2d');
  if (c) c.setTransform(dims.dpr,0,0,dims.dpr,0,0);
  return {c,...dims};
}
export function atlasArt(canvas) {
  const draw=()=>{
    const {c,w,h}=context(canvas);
    if (!c||!w||!h) return;
    const cx=w*(w<700?.84:.735), cy=h*.52, rx=Math.min(w*.4,h*.95), ry=h*.55;
    const grad=c.createRadialGradient(cx,cy,0,cx,cy,rx);
    grad.addColorStop(0,'#536943');grad.addColorStop(.54,'#2d4b36');grad.addColorStop(1,'#162922');
    c.fillStyle=grad;c.fillRect(0,0,w,h);
    c.strokeStyle='#b4d38c22';c.lineWidth=.6;
    for (let x=18;x<w;x+=25){c.beginPath();c.moveTo(x,0);c.lineTo(x,h);c.stroke();}
    for(let y=12;y<h;y+=25){c.beginPath();c.moveTo(0,y);c.lineTo(w,y);c.stroke();}
    c.strokeStyle='#c0dc9b39';c.save();c.translate(cx,cy);c.rotate(-.20);
    for(let i=0;i<11;i++){
      c.beginPath();c.ellipse(0,0,68+i*25,20+i*16,.55,0,2*Math.PI);c.stroke();
    }
    c.restore();
    const nodes=[[-.72,.12],[-.47,-.44],[-.33,.35],[-.08,-.24],[.13,.20],[.34,-.4],[.59,.25],[.68,-.14],[.15,.53],[-.05,.03],[-.44,-.10],[.52,.55],[.95,.05],[-.66,-.69],[.28,-.65],[.45,.06]];
    const points=nodes.map(([x,y])=>[cx+x*rx,cy+y*ry]);
    points.forEach(([x,y],i)=>{
      points.slice(i+1).forEach(([bx,by],index)=>{
        if(Math.hypot(x-bx,y-by)<rx*.73 && (i+index)%3!==1){c.strokeStyle=i%3?'#aecd8358':'#b5de8db0';c.beginPath();c.moveTo(x,y);c.lineTo(bx,by);c.stroke();}
      });
      c.beginPath();c.arc(x,y,i%3===0?5:2.3,0,2*Math.PI);
      c.shadowBlur=i%3===0?15:5;c.shadowColor='#c7f9a6';c.fillStyle=i%4===0?'#ecf9a9':'#acd88d';c.fill();c.shadowBlur=0;
      if(i%3===0){c.strokeStyle='#d2e99b80';c.beginPath();c.arc(x,y,10,0,2*Math.PI);c.stroke();}
    });
    c.fillStyle='#c4dfab';
    c.font='11px monospace';
    [['MCP',3],['GPT',5],['Gemini',7],['RAG',10],['Codex',8],['Claude',11]].forEach(([label,i])=>{
      c.fillText(label,points[i][0]+9,points[i][1]-8);
    });
  };
  new ResizeObserver(draw).observe(canvas);
  draw();
}

function layout(nodes,edges) {
  const map=new Map(nodes.map((node,i)=>{
    const a=i*2.399963, r=.23+.43*Math.sqrt((i+1)/Math.max(1,nodes.length));
    return [node.id,{...node,x:Math.cos(a)*r,y:Math.sin(a)*r}];
  }));
  const list=[...map.values()];
  for(let step=0;step<100;step++){
    const alpha=(1-step/110)*.012;
    for(let i=0;i<list.length;i++){
      const a=list[i];
      a.x*=.996;a.y*=.996;
      for(let j=i+1;j<list.length;j++){
        const b=list[j],dx=a.x-b.x,dy=a.y-b.y,d=Math.max(.017,dx*dx+dy*dy);
        const impulse=Math.min(.8,.061/d)*alpha;
        a.x+=dx*impulse;a.y+=dy*impulse;b.x-=dx*impulse;b.y-=dy*impulse;
      }
    }
    for(const e of edges){
      const a=map.get(e.from),b=map.get(e.to);if(!a||!b)continue;
      const dx=a.x-b.x,dy=a.y-b.y,d=Math.max(.05,Math.hypot(dx,dy));
      const k=(d-.43)*alpha*2/d;
      a.x-=dx*k;a.y-=dy*k;b.x+=dx*k;b.y+=dy*k;
    }
  }
  return map;
}
function grid(c,w,h,sx,sy,zoom) {
  c.fillStyle='#162923';c.fillRect(0,0,w,h);c.strokeStyle='#d0eac31e';c.lineWidth=.6;
  const spacing=32*zoom;
  for(let x=((sx%spacing)+spacing)%spacing;x<w;x+=spacing){c.beginPath();c.moveTo(x,0);c.lineTo(x,h);c.stroke();}
  for(let y=((sy%spacing)+spacing)%spacing;y<h;y+=spacing){c.beginPath();c.moveTo(0,y);c.lineTo(w,y);c.stroke();}
}
function shape(c,x,y,r,type) {
  c.beginPath();
  if (type==='公司'||type==='开源') c.roundRect(x-r,y-r,r*2,r*2,Math.min(4,r/2));
  else if(type==='概念'){c.moveTo(x,y-r);c.lineTo(x+r,y);c.lineTo(x,y+r);c.lineTo(x-r,y);c.closePath();}
  else c.arc(x,y,r,0,Math.PI*2);
}
function terrainCanvas(canvas) {
  const gl=canvas.getContext('webgl',{alpha:false,antialias:true});
  if(!gl) return null;
  const program=gl.createProgram();
  for(const [type,source] of [[gl.VERTEX_SHADER,'attribute vec2 p;attribute vec3 rgb;varying vec3 color;void main(){gl_Position=vec4(p,0.,1.);color=rgb;}'],
    [gl.FRAGMENT_SHADER,'precision mediump float;varying vec3 color;void main(){gl_FragColor=vec4(color,1.);}']]){
    const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);
    if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))return null;
    gl.attachShader(program,shader);gl.deleteShader(shader);
  }
  gl.linkProgram(program);
  if(!gl.getProgramParameter(program,gl.LINK_STATUS))return null;
  gl.useProgram(program);
  const buffer=gl.createBuffer();
  const p=gl.getAttribLocation(program,'p');
  const rgb=gl.getAttribLocation(program,'rgb');
  gl.enableVertexAttribArray(p);gl.enableVertexAttribArray(rgb);
  gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
  gl.vertexAttribPointer(p,2,gl.FLOAT,false,20,0);gl.vertexAttribPointer(rgb,3,gl.FLOAT,false,20,8);
  return (w,h,vertices,lines)=>{
    gl.viewport(0,0,canvas.width,canvas.height);gl.clearColor(.086,.16,.137,1);gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertices),gl.DYNAMIC_DRAW);gl.drawArrays(gl.TRIANGLES,0,vertices.length/5);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(lines),gl.DYNAMIC_DRAW);gl.drawArrays(gl.LINES,0,lines.length/5);
  };
}

export function graphViz(canvas,overlay,graph,{three=false,selected,onSelect,onFallback}) {
  const map=layout(graph.nodes,graph.edges);
  if (three) for(const pt of map.values()){pt.x*=.83;pt.y*=.83;}
  let points=[],sx=0,sy=0,zoom=1,angle=-.64,press=null,hover=null;
  const webgl=three?terrainCanvas(canvas):null;
  const controls=canvas.closest('.viz-wrapper').querySelector('.viz-zoom');
  let software=three&&!webgl;
  const markSoftware=()=>{
    canvas.closest('.viz-wrapper').querySelector('.viz-badge .pill').textContent='CANVAS / 3D';
    software=true;
  };
  if(software) markSoftware();
  if(webgl)canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();markSoftware();draw();});
  const peaks=[...map.values()].filter(n=>n.heat>0);
  const elevation=(x,y)=>clamp(peaks.reduce((z,n)=>z+n.heat*.008*Math.exp(-18*((x-n.x)**2+(y-n.y)**2)),0),0,1.05);
  const labels=(c,center,w)=>{
    const active=hover||selected;
    const neighbors=new Set(graph.edges.filter(e=>e.from===active||e.to===active).flatMap(e=>[e.from,e.to]));
    for(const dot of points){
      const x=dot.p[0],y=dot.p[1],a=dot.id===active;
      const r=dot.r;
      c.globalAlpha=(!active||a||neighbors.has(dot.id))?1:.5;
      if(a){c.strokeStyle='#eefacb';shape(c,x,y,r+5,dot.type);c.stroke();}
      c.fillStyle=colors[dot.type]||'#cde1c1';shape(c,x,y,r,dot.type);c.fill();
      c.fillStyle=a?'#f2ffcd':'#dfeade';c.font=(a?'700 ':'')+(w<500?10:12)+'px system-ui';
      c.fillText(dot.name,x+r+5,y+4);
    }
    c.globalAlpha=1;
  };
  const draw=()=>{
    if (!canvas.isConnected) return;
    if(three) {
      const {c,w,h}=context(overlay);size(canvas);
      if (!c||!w||!h) {onFallback();return;}
      if(software){c.fillStyle='#162923';c.fillRect(0,0,w,h);}
      const scale=Math.min(w,h*1.42)*.38*zoom;
      const p=(x,y,z=0)=>{
        const rx=x*Math.cos(angle)-y*Math.sin(angle),ry=x*Math.sin(angle)+y*Math.cos(angle);
        return [w/2+sx+rx*scale,h*.56+sy+ry*scale*.53-z*scale*.62,ry];
      };
      const out=(xy,color)=>[xy[0]/w*2-1,1-xy[1]/h*2,...color];
      const verts=[],lines=[],cells=[],steps=29,step=2.25/steps;
      const vertex=(x,y)=>{ const z=elevation(x,y);return {p:p(x,y,z),z}; };
      const vertices=Array.from({length:steps+1},(_,i)=>Array.from({length:steps+1},(_,j)=>vertex(-1.125+i*step,-1.125+j*step)));
      for(let i=0;i<steps;i++) for(let j=0;j<steps;j++){
        const a=vertices[i][j],b=vertices[i+1][j],d=vertices[i][j+1],q=vertices[i+1][j+1];
        cells.push({a,b,d,q,depth:(a.p[2]+q.p[2])*.5});
      }
      for(const {a,b,d,q} of cells.sort((x,y)=>x.depth-y.depth)){
        const z=(a.z+q.z)*.5,band=Math.floor(z*6)/6,light=z*.17;
        const col=[.13+band*.53+light,.25+band*.43+light,.21+band*.10+light];
        if(software) {
          c.beginPath();c.moveTo(a.p[0],a.p[1]);c.lineTo(b.p[0],b.p[1]);c.lineTo(q.p[0],q.p[1]);c.lineTo(d.p[0],d.p[1]);c.closePath();
          c.fillStyle='rgb('+col.map(channel=>Math.round(channel*255)).join(',')+')';c.fill();
          c.strokeStyle='#b7deb313';c.lineWidth=.6;c.stroke();
          continue;
        }
        verts.push(...out(a.p,col),...out(b.p,col),...out(d.p,col),...out(b.p,col),...out(q.p,col),...out(d.p,col));
        if(Math.floor(a.z*6)!==Math.floor(b.z*6)||Math.floor(a.z*6)!==Math.floor(d.z*6)) {
          const col=[.29+z*.4,.47+z*.25,.34+z*.1];
          lines.push(...out(a.p,col),...out(b.p,col),...out(a.p,col),...out(d.p,col));
        }
      }
      if(!software)webgl(w,h,verts,lines);
      points=[...map.values()].map(n=>({...n,p:p(n.x,n.y,elevation(n.x,n.y)+.045),r:n.id===selected?6:4}));
      labels(c,null,w);
    } else {
      const {c,w,h}=context(canvas);
      if (!c||!w||!h) return;
      grid(c,w,h,sx,sy,zoom);
      const scale=Math.min(w*.52,h*.61)*zoom,cx=w*.48+sx,cy=h*.51+sy;
      points=[...map.values()].map(n=>({...n,p:[cx+n.x*scale,cy+n.y*scale],r:clamp(5+(n.heat??0)/13,4,15)}));
      const displayed=new Map(points.map(n=>[n.id,n]));
      const active=hover||selected;
      for(const e of graph.edges){
        const a=displayed.get(e.from),b=displayed.get(e.to);if(!a||!b)continue;
        const chosen=active===a.id||active===b.id;
        c.strokeStyle=chosen?'#d0ee99aa':active?'#c3e6ad24':'#c3e6ad62';
        c.lineWidth=chosen?1.6:Math.min(2,.5+e.weight*.22);c.beginPath();c.moveTo(...a.p);c.lineTo(...b.p);c.stroke();
      }
      labels(c,null,w);
    }
  };
  const pointer=event=>{
    const box=canvas.getBoundingClientRect();return [event.clientX-box.left,event.clientY-box.top];
  };
  const hit=([x,y])=>points.toReversed().find(n=>Math.hypot(x-n.p[0],y-n.p[1])<=n.r+9);
  canvas.addEventListener('pointerdown',event=>{
    const pos=pointer(event);press={start:pos,last:pos,node:hit(pos),moved:false,button:event.button};
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove',event=>{
    const pos=pointer(event);
    if(!press){const found=hit(pos)?.id;if(found!==hover){hover=found;draw();}return;}
    const dx=pos[0]-press.last[0],dy=pos[1]-press.last[1];
    if(Math.hypot(pos[0]-press.start[0],pos[1]-press.start[1])>4) press.moved=true;
    if(press.moved){
      if(three&&press.button===0){angle+=dx*.012;sy+=dy*.25;}
      else if(press.node&&!three){
        const pt=map.get(press.node.id),scale=Math.min(canvas.clientWidth*.52,canvas.clientHeight*.61)*zoom;
        pt.x+=dx/scale;pt.y+=dy/scale;
      } else {sx+=dx;sy+=dy;}
      press.last=pos;draw();
    }
  });
  canvas.addEventListener('pointerup',event=>{
    if(press&&!press.moved){const item=hit(pointer(event));if(item)onSelect(item.id);}
    press=null;
  });
  canvas.addEventListener('pointercancel',()=>{press=null;});
  canvas.addEventListener('pointerleave',()=>{if(!press&&hover){hover=null;draw();}});
  canvas.addEventListener('contextmenu',event=>event.preventDefault());
  const changeZoom=k=>{zoom=clamp(zoom*k,.56,2.8);draw();};
  canvas.addEventListener('wheel',event=>{if(!event.ctrlKey&&event.target!==document.activeElement)return;event.preventDefault();changeZoom(event.deltaY>0?.90:1.11);},{passive:false});
  controls?.querySelector('[data-in]')?.addEventListener('click',()=>changeZoom(1.18));
  controls?.querySelector('[data-out]')?.addEventListener('click',()=>changeZoom(.85));
  controls?.querySelector('[data-reset]')?.addEventListener('click',()=>{zoom=1;sx=0;sy=0;angle=-.64;draw();});
  new ResizeObserver(draw).observe(canvas);
  draw();
  return {focus(id,center=false){selected=id;hover=null;if(center&&!three){const n=map.get(id);if(n){const s=Math.min(canvas.clientWidth*.52,canvas.clientHeight*.61)*zoom;sx=-n.x*s;sy=-n.y*s;}}draw();}};
}

export function oceanViz(canvas,offers,onSelect) {
  let cw,ch,c,feed=null,pointer=null,last=0,raf;
  const fishes=Array.from({length:innerWidth<620?19:38},(_,i)=>({
    x:((i*63+31)%113)/113,y:.14+(((i*29+14)%111)/111)*.73,
    dir:i%2?1:-1,pace:.00016+(i%7)*.000045,offer:offers[i%Math.max(offers.length,1)],big:i<offers.length,near:false
  }));
  const oct=['  .---.  ',' ( o o ) ','  ) ~ (  ',' /|/ \\|\\  '];
  function paint(time=0) {
    if(!canvas.isConnected||!c)return;
    c.fillStyle='#102821';c.fillRect(0,0,cw,ch);c.font='12px monospace';c.textBaseline='middle';
    const wave=time*.002;
    c.fillStyle='#79c9ad28';
    for(let j=0;j<7;j++) {
      const y=j*ch/7+14;
      for(let x=0;x<cw;x+=18)if((x/18+j*3)%7<3)c.fillText((j%2?'·':'~'),x,y+Math.sin(x*.017+wave+j)*5);
    }
    c.fillStyle='#5ba98a6e';
    for(let i=0;i<14;i++){
      const x=cw*(i+.5)/14;
      for(let j=0;j<4+(i%3);j++)c.fillText(j%2?'╱':'╲',x+Math.sin(j+wave*.9)*5,ch-8-j*9);
    }
    c.fillStyle='#8bd7ba';
    const react=pointer&&Math.hypot(pointer.x-cw*.83,pointer.y-ch*.71)<125;
    c.font='16px monospace';oct.forEach((line,i)=>c.fillText(line,cw*.83,ch*.69+i*14+(react?Math.sin(wave*5)*4:0)));
    for(const fish of fishes){
      const x=fish.x*cw,y=fish.y*ch;
      fish.near=pointer&&Math.hypot(x-pointer.x,y-pointer.y)<86;
      if(!reduce.matches) {
        if(feed && time-feed.at<4600) {
          fish.dir=feed.x>x?1:-1;fish.y+=(feed.y-y)*.000041;
        } else if(fish.near) {
          fish.dir=pointer.x>x?-1:1;fish.y+=(y-pointer.y)*.000025;
        }
        fish.x+=fish.dir*fish.pace*(fish.near?2.9:1);fish.y+=Math.sin(wave+fish.x*8)*.00028;
        if(fish.x>1.06)fish.x=-.06;if(fish.x<-.06)fish.x=1.06;
        fish.y=clamp(fish.y,.11,.88);
      }
      c.fillStyle=fish.big?'#d7f99e':fish.near?'#bafac7':'#73bda4';
      c.font=fish.big?'700 15px monospace':'12px monospace';
      c.fillText(fish.dir>0?'><>':'<><',x,y);
      if(fish.big&&fish.offer)c.fillText(fish.offer.mark,x+28,y);
    }
    if(feed && time-feed.at<4600){
      c.strokeStyle='#e3f5a5';c.beginPath();c.arc(feed.x,feed.y,5+((time-feed.at)*.022)%22,0,Math.PI*2);c.stroke();
      c.fillStyle='#e3f5a5';c.fillText('·',feed.x-1,feed.y);
    }
  }
  const redraw=time=>{
    if(!canvas.isConnected||document.hidden||reduce.matches){raf=undefined;return;}
    if(time-last>=16){last=time;paint(time);}
    raf=requestAnimationFrame(redraw);
  };
  function restart(){if(raf!==undefined)cancelAnimationFrame(raf);raf=undefined;if(!document.hidden&&!reduce.matches)raf=requestAnimationFrame(redraw);}
  const resize=()=>{({c,w:cw,h:ch}=context(canvas));paint(performance.now());};
  const point=e=>{const b=canvas.getBoundingClientRect();return {x:e.clientX-b.left,y:e.clientY-b.top};};
  canvas.addEventListener('pointermove',e=>{pointer=point(e);});
  canvas.addEventListener('pointerleave',()=>{pointer=null;});
  canvas.addEventListener('pointerdown',event=>{
    pointer=point(event);
    const selected=fishes.find(f=>f.big&&f.offer&&Math.hypot(f.x*cw+14-pointer.x,f.y*ch-pointer.y)<19);
    if(selected)onSelect(selected.offer.id);
    else {feed={...pointer,at:performance.now()};paint(feed.at);}
  });
  document.addEventListener('visibilitychange',restart);reduce.addEventListener('change',restart);
  new ResizeObserver(resize).observe(canvas);resize();restart();
}
