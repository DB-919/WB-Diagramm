(function(){
'use strict';

const $=id=>document.getElementById(id);
const els={
  drop:$('dropZone'),file:$('fileInput'),pick:$('pickBtn'),workspace:$('workspace'),
  fileName:$('fileName'),fileMeta:$('fileMeta'),channelChecks:$('channelChecks'),
  startEnabled:$('startEnabled'),startTemp:$('startTemp'),timeUnit:$('timeUnit'),
  yMin:$('yMin'),yMax:$('yMax'),stats:$('stats'),chart:$('chart'),chartWrap:$('chartWrap'),
  legend:$('legend'),tooltip:$('tooltip'),rangeInfo:$('rangeInfo'),notice:$('notice'),
  bands:$('bands'),addBand:$('addBandBtn'),holdEnabled:$('holdEnabled'),
  holdStart:$('holdStart'),holdEnd:$('holdEnd'),pickHoldStart:$('pickHoldStart'),
  pickHoldEnd:$('pickHoldEnd'),clearHold:$('clearHold'),pickHint:$('pickHint')
};

const colors=['#2563eb','#16a34a','#dc2626','#9333ea','#ea580c','#0891b2','#4f46e5','#65a30d'];
const bandColors=[
  {fill:'#dbeafe',stroke:'#60a5fa'},
  {fill:'#dcfce7',stroke:'#4ade80'},
  {fill:'#fef3c7',stroke:'#fbbf24'},
  {fill:'#f3e8ff',stroke:'#c084fc'},
  {fill:'#ffe4e6',stroke:'#fb7185'}
];

let data=null,currentFile=null,renderRows=[],visibleChannels=[],pickMode=null,bandSeq=0;
let aliases={};

function showNotice(msg,kind='warn'){
  if(!msg){els.notice.classList.add('hidden');return;}
  els.notice.textContent=msg; els.notice.classList.remove('hidden');
  els.notice.style.borderColor=kind==='error'?'#e2a1a7':'#e6c36a';
  els.notice.style.background=kind==='error'?'#fff0f1':'#fff7df';
  els.notice.style.color=kind==='error'?'#8c2430':'#745300';
}
function fmt(n,d=1){return Number.isFinite(n)?n.toLocaleString('de-DE',{minimumFractionDigits:d,maximumFractionDigits:d}):'–'}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function numValue(input){
  if(input.value.trim()==='') return null;
  const n=Number(String(input.value).replace(',','.'));
  return Number.isFinite(n)?n:null;
}
function channelLabel(ch){return (aliases[ch]||ch).trim()||ch;}

async function loadFile(file){
  showNotice('');
  try{
    const buffer=await file.arrayBuffer();
    const text=WBParser.decodeArrayBuffer(buffer);
    const parsed=WBParser.parseText(text,file.name);
    data=parsed; currentFile=file; aliases={};
    parsed.channels.forEach(ch=>aliases[ch]=ch);
    els.fileName.textContent=file.name;
    const dur=parsed.rows.length?parsed.rows[parsed.rows.length-1].elapsedMin:0;
    els.fileMeta.textContent=`${parsed.meta.format || 'Text'} · ${parsed.rows.length.toLocaleString('de-DE')} Punkte · ${fmt(dur/60,2)} h${parsed.meta.interval?' · '+parsed.meta.interval:''}${parsed.meta.unit?' · '+parsed.meta.unit:''}`;
    buildChannels();
    els.drop.classList.add('hidden'); els.workspace.classList.remove('hidden');
    render();
    if(parsed.meta.skippedRows) showNotice(`${parsed.meta.skippedRows} nicht passende Zeile(n) wurden beim Import übersprungen.`);
  }catch(err){showNotice(err && err.message?err.message:String(err),'error');}
}

function buildChannels(){
  els.channelChecks.innerHTML='';
  data.channels.forEach(ch=>{
    const row=document.createElement('div'); row.className='channel-row';
    const check=document.createElement('input'); check.type='checkbox'; check.checked=true; check.value=ch; check.setAttribute('aria-label',`${ch} anzeigen`);
    const raw=document.createElement('span'); raw.className='raw'; raw.textContent=ch;
    const name=document.createElement('input'); name.type='text'; name.value=aliases[ch]; name.placeholder=`Name für ${ch}`; name.setAttribute('aria-label',`${ch} benennen`);
    check.addEventListener('change',render);
    name.addEventListener('input',()=>{aliases[ch]=name.value||ch;render();});
    row.append(check,raw,name); els.channelChecks.appendChild(row);
  });
}

function selectedChannels(){
  return [...els.channelChecks.querySelectorAll('.channel-row input[type=checkbox]:checked')].map(x=>x.value);
}

function addBand(config={}){
  if(els.bands.children.length>=5){showNotice('Maximal 5 Solltemperaturbereiche sind vorgesehen.');return;}
  bandSeq++;
  const row=document.createElement('div'); row.className='band-row'; row.dataset.bandId=String(bandSeq);
  row.innerHTML=`
    <input class="band-visible" type="checkbox" checked aria-label="Sollbereich anzeigen">
    <label>Name<input class="band-name" type="text" value="${escapeHtml(config.name||`Sollbereich ${bandSeq}`)}"></label>
    <label>Soll [°C]<input class="band-target" type="number" step="0.1" value="${Number.isFinite(config.target)?config.target:''}" placeholder="z. B. 520"></label>
    <label>± [°C]<input class="band-tol" type="number" min="0" step="0.1" value="${Number.isFinite(config.tol)?config.tol:''}" placeholder="z. B. 5"></label>
    <button class="remove-band ghost" type="button" aria-label="Sollbereich entfernen">×</button>`;
  row.querySelectorAll('input').forEach(inp=>inp.addEventListener(inp.type==='checkbox'?'change':'input',render));
  row.querySelector('.remove-band').addEventListener('click',()=>{row.remove();render();});
  els.bands.appendChild(row);
}

function getBands(){
  return [...els.bands.querySelectorAll('.band-row')].map((row,i)=>{
    const target=numValue(row.querySelector('.band-target'));
    const tol=numValue(row.querySelector('.band-tol'));
    return {
      visible:row.querySelector('.band-visible').checked,
      name:row.querySelector('.band-name').value.trim()||`Sollbereich ${i+1}`,
      target,tol:tol===null?null:Math.abs(tol), color:bandColors[i%bandColors.length]
    };
  }).filter(b=>b.visible && Number.isFinite(b.target) && Number.isFinite(b.tol));
}

function holdConfig(){
  const start=numValue(els.holdStart), end=numValue(els.holdEnd);
  return {
    enabled:els.holdEnabled.checked && Number.isFinite(start) && Number.isFinite(end) && end>start,
    start,end
  };
}

function viewRows(){
  if(!data)return [];
  visibleChannels=selectedChannels();
  let rows=data.rows, startIndex=0;
  if(els.startEnabled.checked && visibleChannels.length){
    const t=Number(els.startTemp.value);
    if(Number.isFinite(t)){
      const idx=rows.findIndex(r=>visibleChannels.some(ch=>Number.isFinite(r[ch])&&r[ch]>=t));
      if(idx>=0)startIndex=idx;
      else showNotice(`Die Starttemperatur ${fmt(t,1)} °C wird von den gewählten Kanälen nicht erreicht.`);
    }
  }
  const base=rows[startIndex]?.elapsedMin||0;
  return rows.slice(startIndex).map(r=>Object.assign({},r,{elapsedMin:r.elapsedMin-base}));
}

function render(){
  if(!data)return;
  showNotice('');
  const rows=viewRows(); renderRows=rows;
  renderStats(rows); renderChart(rows);
}

function renderStats(rows){
  const duration=rows.length?rows[rows.length-1].elapsedMin:0;
  const cards=[
    ['Messpunkte',rows.length.toLocaleString('de-DE')],
    ['Dauer',els.timeUnit.value==='h'?`${fmt(duration/60,2)} h`:`${fmt(duration,1)} min`]
  ];
  const hold=holdConfig();
  if(hold.enabled) cards.push(['Haltezeit',`${fmt(hold.end-hold.start,1)} min`]);
  for(const ch of visibleChannels.slice(0,3)){
    const vals=rows.map(r=>r[ch]).filter(Number.isFinite); if(!vals.length)continue;
    cards.push([channelLabel(ch),`${fmt(Math.min(...vals),1)} – ${fmt(Math.max(...vals),1)} °C`]);
  }
  els.stats.innerHTML=cards.slice(0,6).map(c=>`<div class="stat"><div class="k">${escapeHtml(c[0])}</div><div class="v">${escapeHtml(c[1])}</div></div>`).join('');
}

function niceStep(range,target=6){
  if(!(range>0))return 1;
  const rough=range/target, pow=Math.pow(10,Math.floor(Math.log10(rough))), n=rough/pow;
  return (n<1.5?1:n<3?2:n<7?5:10)*pow;
}

function renderChart(rows){
  const w=Math.max(320,els.chartWrap.clientWidth), h=Math.max(280,els.chartWrap.clientHeight), m={l:68,r:24,t:30,b:52};
  els.chart.setAttribute('viewBox',`0 0 ${w} ${h}`);

  if(!rows.length || !visibleChannels.length){
    els.chart.innerHTML='<text x="50%" y="50%" text-anchor="middle" fill="#6b7785">Bitte mindestens einen Kanal auswählen.</text>';
    els.legend.innerHTML=''; return;
  }

  const ds=WBParser.minMaxDownsample(rows,visibleChannels,2200);
  const unit=els.timeUnit.value, factor=unit==='h'?1/60:1;
  const xMax=Math.max(1e-9,rows[rows.length-1].elapsedMin*factor);

  const vals=[];
  for(const r of rows) for(const ch of visibleChannels) if(Number.isFinite(r[ch])) vals.push(r[ch]);
  const bands=getBands();
  for(const b of bands){vals.push(b.target-b.tol,b.target+b.tol);}

  let y0=numValue(els.yMin), y1=numValue(els.yMax);
  if(!Number.isFinite(y0))y0=Math.min(...vals);
  if(!Number.isFinite(y1))y1=Math.max(...vals);
  if(y1<=y0)y1=y0+1;
  if(numValue(els.yMin)===null || numValue(els.yMax)===null){
    const pad=Math.max(1,(y1-y0)*.06);
    if(numValue(els.yMin)===null)y0-=pad;
    if(numValue(els.yMax)===null)y1+=pad;
  }

  const px=x=>m.l+(x/xMax)*(w-m.l-m.r);
  const py=y=>m.t+(1-(y-y0)/(y1-y0))*(h-m.t-m.b);
  const xStep=niceStep(xMax,7), yStep=niceStep(y1-y0,6);
  const parts=[`<rect x="0" y="0" width="${w}" height="${h}" fill="#fff"/>`];

  // Sollbereiche hinter Messkurven
  for(const b of bands){
    const low=b.target-b.tol, high=b.target+b.tol;
    const yy1=py(Math.min(y1,high)), yy2=py(Math.max(y0,low));
    const top=Math.min(yy1,yy2), height=Math.abs(yy2-yy1);
    if(height>0 && high>=y0 && low<=y1){
      parts.push(`<rect x="${m.l}" y="${top}" width="${w-m.l-m.r}" height="${height}" fill="${b.color.fill}" opacity="0.58"/>`);
      const sy=py(b.target);
      if(sy>=m.t && sy<=h-m.b) parts.push(`<line x1="${m.l}" y1="${sy}" x2="${w-m.r}" y2="${sy}" stroke="${b.color.stroke}" stroke-width="1" stroke-dasharray="5 4"/>`);
    }
  }

  // Haltezeitbereich
  const hold=holdConfig();
  if(hold.enabled){
    const sx=Math.max(m.l,Math.min(w-m.r,px(hold.start*factor)));
    const ex=Math.max(m.l,Math.min(w-m.r,px(hold.end*factor)));
    if(ex>m.l && sx<w-m.r){
      parts.push(`<rect x="${Math.min(sx,ex)}" y="${m.t}" width="${Math.abs(ex-sx)}" height="${h-m.t-m.b}" fill="#64748b" opacity="0.07"/>`);
      parts.push(`<line x1="${sx}" y1="${m.t}" x2="${sx}" y2="${h-m.b}" stroke="#475569" stroke-width="1.3" stroke-dasharray="5 4"/>`);
      parts.push(`<line x1="${ex}" y1="${m.t}" x2="${ex}" y2="${h-m.b}" stroke="#475569" stroke-width="1.3" stroke-dasharray="5 4"/>`);
      parts.push(`<text x="${Math.min(w-m.r-4,sx+4)}" y="${m.t+14}" font-size="10" fill="#475569">Haltezeit Start</text>`);
      parts.push(`<text x="${Math.max(m.l+4,ex-4)}" y="${m.t+14}" text-anchor="end" font-size="10" fill="#475569">Ende · ${fmt(hold.end-hold.start,1)} min</text>`);
    }
  }

  for(let y=Math.ceil(y0/yStep)*yStep;y<=y1+1e-9;y+=yStep){
    const yy=py(y);
    parts.push(`<line x1="${m.l}" y1="${yy}" x2="${w-m.r}" y2="${yy}" stroke="#e6ebef"/>`);
    parts.push(`<text x="${m.l-10}" y="${yy+4}" text-anchor="end" font-size="11" fill="#66727e">${fmt(y,Math.abs(yStep)<1?1:0)}</text>`);
  }
  for(let x=0;x<=xMax+1e-9;x+=xStep){
    const xx=px(x);
    parts.push(`<line x1="${xx}" y1="${m.t}" x2="${xx}" y2="${h-m.b}" stroke="#eef1f4"/>`);
    parts.push(`<text x="${xx}" y="${h-m.b+20}" text-anchor="middle" font-size="11" fill="#66727e">${fmt(x,xStep<1?1:0)}</text>`);
  }

  parts.push(`<line x1="${m.l}" y1="${h-m.b}" x2="${w-m.r}" y2="${h-m.b}" stroke="#77838f"/>`);
  parts.push(`<line x1="${m.l}" y1="${m.t}" x2="${m.l}" y2="${h-m.b}" stroke="#77838f"/>`);
  parts.push(`<text x="${(m.l+w-m.r)/2}" y="${h-12}" text-anchor="middle" font-size="12" fill="#44505c">Zeit [${unit==='h'?'h':'min'}]</text>`);
  parts.push(`<text transform="translate(17 ${(m.t+h-m.b)/2}) rotate(-90)" text-anchor="middle" font-size="12" fill="#44505c">Temperatur [°C]</text>`);

  visibleChannels.forEach((ch,ci)=>{
    let d='',started=false;
    for(const r of ds){
      const v=r[ch]; if(!Number.isFinite(v))continue;
      const x=px(r.elapsedMin*factor), y=py(v);
      d+=(started?' L ':'M ')+x.toFixed(2)+' '+y.toFixed(2); started=true;
    }
    parts.push(`<path d="${d}" fill="none" stroke="${colors[ci%colors.length]}" stroke-width="1.7" vector-effect="non-scaling-stroke"/>`);
  });

  parts.push(`<line id="crosshair" x1="0" x2="0" y1="${m.t}" y2="${h-m.b}" stroke="#66727e" stroke-width="1" stroke-dasharray="4 4" visibility="hidden"/>`);
  els.chart.innerHTML=parts.join('');
  els.chart.dataset.plot=JSON.stringify({w,h,m,xMax,y0,y1,factor});

  els.rangeInfo.textContent=`${fmt(rows[rows.length-1].elapsedMin,1)} min · ${visibleChannels.map(channelLabel).join(', ')}`;

  const channelLegend=visibleChannels.map((ch,i)=>`<span class="legend-item"><span class="swatch" style="background:${colors[i%colors.length]}"></span>${escapeHtml(channelLabel(ch))}</span>`);
  const bandLegend=bands.map((b,i)=>`<span class="legend-item"><span class="band-swatch" style="background:${b.color.fill};border-color:${b.color.stroke}"></span>${escapeHtml(b.name)} ${fmt(b.target,1)} ± ${fmt(b.tol,1)} °C</span>`);
  els.legend.innerHTML=[...channelLegend,...bandLegend].join('');
}

function nearestRow(xValue){
  if(!renderRows.length)return null;
  let lo=0,hi=renderRows.length-1;
  while(lo<hi){const mid=(lo+hi)>>1;if(renderRows[mid].elapsedMin<xValue)lo=mid+1;else hi=mid;}
  const a=renderRows[Math.max(0,lo-1)],b=renderRows[lo];
  return !a?b:!b?a:(Math.abs(a.elapsedMin-xValue)<=Math.abs(b.elapsedMin-xValue)?a:b);
}

function pointerData(ev){
  if(!renderRows.length)return null;
  const p=JSON.parse(els.chart.dataset.plot||'null'); if(!p)return null;
  const rect=els.chart.getBoundingClientRect();
  const x=(ev.clientX-rect.left)/rect.width*p.w;
  if(x<p.m.l||x>p.w-p.m.r)return null;
  const xv=(x-p.m.l)/(p.w-p.m.l-p.m.r)*p.xMax;
  const min=xv/p.factor;
  const row=nearestRow(min); if(!row)return null;
  const sx=p.m.l+(row.elapsedMin*p.factor/p.xMax)*(p.w-p.m.l-p.m.r);
  return {p,rect,row,sx};
}

function chartPointer(ev){
  const d=pointerData(ev);
  if(!d){els.tooltip.classList.add('hidden');return;}
  const {p,rect,row,sx}=d;
  const cross=els.chart.querySelector('#crosshair');
  if(cross){cross.setAttribute('x1',sx);cross.setAttribute('x2',sx);cross.setAttribute('visibility','visible');}
  const t=els.timeUnit.value==='h'?`${fmt(row.elapsedMin/60,3)} h`:`${fmt(row.elapsedMin,2)} min`;
  els.tooltip.innerHTML=`<strong>${t}</strong>${row.timestamp?`<br>${escapeHtml(row.timestamp)}`:''}`+
    visibleChannels.map(ch=>`<br>${escapeHtml(channelLabel(ch))}: <strong>${fmt(row[ch],1)} °C</strong>`).join('');
  els.tooltip.classList.remove('hidden');
  const left=Math.min(rect.width-els.tooltip.offsetWidth-8,Math.max(8,(sx/p.w)*rect.width+10));
  els.tooltip.style.left=left+'px'; els.tooltip.style.top='10px';
}

function setPickMode(mode){
  pickMode=pickMode===mode?null:mode;
  els.pickHoldStart.classList.toggle('active-pick',pickMode==='start');
  els.pickHoldEnd.classList.toggle('active-pick',pickMode==='end');
  els.chartWrap.classList.toggle('pick-mode',!!pickMode);
  if(pickMode){
    els.pickHint.textContent=pickMode==='start'?'Jetzt im Diagramm auf den gewünschten Start der Haltezeit klicken.':'Jetzt im Diagramm auf das gewünschte Ende der Haltezeit klicken.';
    els.pickHint.classList.remove('hidden');
  }else els.pickHint.classList.add('hidden');
}

function chartClick(ev){
  if(!pickMode)return;
  const d=pointerData(ev); if(!d)return;
  const v=d.row.elapsedMin;
  if(pickMode==='start')els.holdStart.value=v.toFixed(2);
  else els.holdEnd.value=v.toFixed(2);
  els.holdEnabled.checked=true;
  setPickMode(null);
  render();
}

function download(blob,name){
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name;
  document.body.appendChild(a); a.click();
  setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},100);
}
function baseName(){return (currentFile?.name||'WB_Diagramm').replace(/\.[^.]+$/,'')}
function svgBlob(){
  const clone=els.chart.cloneNode(true);
  const c=clone.querySelector('#crosshair'); if(c)c.setAttribute('visibility','hidden');
  const xml=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${clone.getAttribute('viewBox')}" width="1600" height="900">${clone.innerHTML}</svg>`;
  return new Blob([xml],{type:'image/svg+xml;charset=utf-8'});
}
function exportCSV(){
  const cols=['Zeitstempel','Zeit_min',...visibleChannels.map(ch=>channelLabel(ch))], lines=[cols.join(';')];
  for(const r of renderRows){
    lines.push([r.timestamp||'',r.elapsedMin.toFixed(5).replace('.',','),...visibleChannels.map(ch=>Number.isFinite(r[ch])?String(r[ch]).replace('.',','):'')].join(';'));
  }
  download(new Blob(['\uFEFF'+lines.join('\r\n')],{type:'text/csv;charset=utf-8'}),baseName()+'_Diagrammdaten.csv');
}

// Datei
els.pick.addEventListener('click',()=>els.file.click());
$('changeBtn').addEventListener('click',()=>els.file.click());
els.file.addEventListener('change',()=>{if(els.file.files[0])loadFile(els.file.files[0])});
['dragenter','dragover'].forEach(n=>els.drop.addEventListener(n,e=>{e.preventDefault();els.drop.classList.add('drag')}));
['dragleave','drop'].forEach(n=>els.drop.addEventListener(n,e=>{e.preventDefault();els.drop.classList.remove('drag')}));
els.drop.addEventListener('drop',e=>{const f=e.dataTransfer.files[0];if(f)loadFile(f)});
els.drop.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();els.file.click()}});

// Darstellung
[els.startEnabled,els.startTemp,els.timeUnit,els.yMin,els.yMax,els.holdEnabled,els.holdStart,els.holdEnd].forEach(x=>{
  x.addEventListener(x.tagName==='SELECT'?'change':'input',render);
});
els.addBand.addEventListener('click',()=>{addBand();render();});
els.pickHoldStart.addEventListener('click',()=>setPickMode('start'));
els.pickHoldEnd.addEventListener('click',()=>setPickMode('end'));
els.clearHold.addEventListener('click',()=>{
  els.holdStart.value=''; els.holdEnd.value=''; els.holdEnabled.checked=false; setPickMode(null); render();
});

// Export
$('resetBtn').addEventListener('click',()=>location.reload());
$('pngBtn').addEventListener('click',()=>{
  const blob=svgBlob(),url=URL.createObjectURL(blob),img=new Image();
  img.onload=()=>{
    const c=document.createElement('canvas');c.width=1800;c.height=1000;
    const ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);ctx.drawImage(img,0,0,c.width,c.height);
    URL.revokeObjectURL(url);c.toBlob(b=>download(b,baseName()+'_Diagramm.png'),'image/png');
  };
  img.src=url;
});
$('svgBtn').addEventListener('click',()=>download(svgBlob(),baseName()+'_Diagramm.svg'));
$('csvBtn').addEventListener('click',exportCSV);
$('printBtn').addEventListener('click',()=>window.print());

// Diagramm
els.chart.addEventListener('pointermove',chartPointer);
els.chart.addEventListener('pointerdown',ev=>{chartPointer(ev);chartClick(ev);});
els.chart.addEventListener('pointerleave',()=>{
  els.tooltip.classList.add('hidden');
  const c=els.chart.querySelector('#crosshair'); if(c)c.setAttribute('visibility','hidden');
});
new ResizeObserver(()=>{if(data)renderChart(renderRows)}).observe(els.chartWrap);

// Ein leerer Sollbereich als Startpunkt
addBand();

if('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register('./sw.js').catch(()=>{});
})();