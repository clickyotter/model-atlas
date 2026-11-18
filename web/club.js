import {root,params,t,esc,date,external,link,button,pill,heading,section,empty,status,select,searchbox,form,announce,get,url,storeGet,storeSet,refreshTop} from './ui.js';
import {activeRecord,records,claim,undo,backup,restore} from './ledger.js';

const offerLabels={verified:['已核验','Verified','ok'],editorial:['按官方文档整理','Based on official docs','ok'],stale:['源暂不可用','Source unreachable','attention'],
  review:['待复核','Review required','attention'],expired:['已过期','Expired','bad']};
export function offerStatus(offer){
  const [zh,en,theme]=offerLabels[offer.status]??offerLabels.review;
  return pill(t(zh,en),theme);
}
const names={daily:['每日','Daily'],rolling:['本地间隔 24 小时','Local 24h interval'],monthly:['每月','Monthly'],weekly:['每周','Weekly'],one:['一次','One time']};
const cycle=offer=>t(...(names[offer.period]??['未知','Unknown']));
const level=count=>count>=2?t('金色','Gold'):count===1?t('棱镜','Prism'):t('银色','Silver');
const selectedRows=(all,offer)=>all.filter(record=>record.offerId===offer.id);
const score=(entry)=>String(entry).toLowerCase();
function offerCard(offer,all) {
  const rows=selectedRows(all,offer),current=activeRecord(rows,offer);
  return '<article class="offer '+esc(offer.theme)+'" data-level="'+Math.min(rows.length,2)+'"><div class="mark">'+esc(offer.mark)+'</div>'+
    '<div><div class="tagline">'+offerStatus(offer)+' '+pill(level(rows.length))+'</div><h3>'+esc(offer.provider)+' · '+esc(offer.name)+'</h3>'+
    '<p class="amount">'+esc(offer.amount)+'</p><p class="meta">'+esc(cycle(offer))+' · '+(offer.apiUsable?'API':t('产品内','In product'))+' · '+
    t('本地记录','Local records')+' '+rows.length+'</p></div><div class="actions">'+
    button('/token-club/'+offer.id,current?t('查看记录','View record'):t('详情与记录','Details and record'),'dark')+'</div></article>';
}

export async function renderClub() {
  const [{data,meta},history]=await Promise.all([get('token-offers'),records().catch(()=>null)]);
  const query=score(params.get('q')??'');
  const list=params.get('view')==='list';
  const rule=params.get('period');
  const category=params.get('category');
  const type=params.get('availability');
  const mode=params.get('mode')??'all';
  const rows=history??[];
  const found=data.filter(offer=>(!query||score([offer.name,offer.provider,offer.conditions,offer.amount].join(' ')).includes(query))&&
    (!rule||offer.period===rule)&&(!category||offer.category===category)&&(!type||offer.apiUsable===(type==='api'))&&
    (mode!=='saved'||rows.some(r=>r.offerId===offer.id)));
  if(params.get('sort')==='name')found.sort((a,b)=>a.provider.localeCompare(b.provider)); 
  if(params.get('sort')==='saved')found.sort((a,b)=>selectedRows(rows,b).length-selectedRows(rows,a).length);
  const paramsObject=Object.fromEntries(params);
  root.innerHTML=heading('OFFER COLLECTION',t('福利卡册','Model offer collection'),t('按使用规则筛选福利，核对厂商文档，再手动标记。记录保存在当前浏览器。','Filter offers, check provider rules, and record use manually in this browser.'))+
    '<div class="actions" style="margin-bottom:16px">'+button(url('/token-club',{...paramsObject,mode:'all'}),t('全部福利','All offers'),mode==='all'?'dark':'')+
    button(url('/token-club',{...paramsObject,mode:'saved'}),t('已记录','Recorded'),mode==='saved'?'dark':'')+
    button(url('/token-club',{...paramsObject,view:list?'cards':'list'}),list?t('卡片视图','Cards'):t('清单视图','List'))+
    '<button class="button" id="backup">'+t('导出备份','Export backup')+'</button><label class="button" for="restore">'+t('导入备份','Import backup')+
    '</label><input id="restore" type="file" accept="application/json,.json" hidden></div>'+
    form(searchbox(t('搜索福利','Search offers'),t('厂商、额度或条件','Provider, amount or terms'))+
      select('category',t('能力','Capability'),[['',t('全部','All')],...[...new Set(data.map(x=>x.category))].map(x=>[x,x])])+
      select('period',t('周期','Period'),[['',t('全部','All')],...Object.entries(names).map(([key,value])=>[key,t(...value)])])+
      select('availability',t('使用场景','Access'),[['',t('全部','All')],['api',t('仅 API 可用','API only')],['product',t('仅产品内','In product only')]])+
      select('sort',t('排序','Sort'),[['',t('推荐','Featured')],['name',t('厂商','Provider')],['saved',t('记录次数','Record count')]])+
      '<input type="hidden" name="view" value="'+(list?'list':'cards')+'"><input type="hidden" name="mode" value="'+(mode==='saved'?'saved':'all')+'">')+
    '<div class="section-head"><div class="tagline">'+status(meta)+'</div><a href="#achievements">'+t('查看成就 ↓','View achievements ↓')+'</a></div>'+
    (history===null?empty(t('浏览器本地记录当前不可用','Browser storage is currently unavailable')):'')+
    (found.length?'<div class="grid offer-grid '+(list?'dense':'')+'">'+found.map(offer=>offerCard(offer,rows)).join('')+'</div>':empty(t('没有匹配福利','No matching offers')))+
    '<section class="section" id="achievements">'+section(t('记录成就','Collection milestones'),null,t('依据本地手动标记统计。','Calculated from local manual records.'))+
    '<div class="grid"><div class="panel"><p class="meta">'+t('记录次数','Records')+'</p><h3>'+rows.length+'</h3></div>'+
    '<div class="panel"><p class="meta">'+t('已收录福利','Collected offers')+'</p><h3>'+new Set(rows.map(r=>r.offerId)).size+'</h3></div>'+
    '<div class="panel"><p class="meta">'+t('金色卡','Gold cards')+'</p><h3>'+[...new Set(rows.map(r=>r.offerId))].filter(id=>rows.filter(r=>r.offerId===id).length>=2).length+'</h3></div></div></section>';
  root.querySelectorAll('.offer').forEach(card=>{
    card.addEventListener('pointermove',e=>{
      if(e.pointerType!=='mouse')return;
      const r=card.getBoundingClientRect(),x=(e.clientX-r.left)/r.width,y=(e.clientY-r.top)/r.height;
      card.style.setProperty('--rx',(5-y*10)+'deg');card.style.setProperty('--ry',(x*10-5)+'deg');
      card.style.setProperty('--px',x*100+'%');card.style.setProperty('--py',y*100+'%');
    });
    card.addEventListener('pointerleave',()=>{card.style.removeProperty('--rx');card.style.removeProperty('--ry');});
  });
  document.querySelector('#backup').addEventListener('click',async()=>{
    try {
      const href=URL.createObjectURL(new Blob([await backup()],{type:'application/json'}));
      const a=document.createElement('a');a.href=href;a.download='model-atlas-offers.json';a.click();
      setTimeout(()=>URL.revokeObjectURL(href),1000);
      announce(t('已导出备份','Backup exported'));
    } catch(error) {announce(error.message);}
  });
  document.querySelector('#restore').addEventListener('change',async(event)=>{
    try {
      const [file]=event.target.files;
      if(!file)return;
      if(file.size>1_000_000)throw new Error('备份超过 1 MB');
      const total=await restore(await file.text(),data);
      announce(t('新增 '+total+' 条本地记录','Imported '+total+' new records'));
      refreshTop(renderClub);
    } catch(error) {announce(error.message);}
    finally {event.target.value='';}
  });
}

export async function renderOffer(id) {
  const [{data},history,checks]=await Promise.all([
    get('token-offers'),records().catch(()=>null),get('token-offers/'+encodeURIComponent(id)+'/history').then( x=>x.data).catch(()=>[])]);
  const offer=data.find(x=>x.id===id);
  if(!offer)throw new Error(t('福利不存在','Offer not found'));
  const rows=selectedRows(history??[],offer).sort((a,b)=>b.recordedAt.localeCompare(a.recordedAt));
  const existing=activeRecord(rows,offer);
  root.innerHTML=heading('',offer.provider+' · '+offer.name,offer.conditions,['/token-club',t('← 福利卡册','← Offer collection')])+
    '<div class="layout-side"><article class="content"><div class="panel"><div class="tagline">'+offerStatus(offer)+pill(offer.apiUsable?'API':t('产品内','In product'))+'</div>'+
    '<h2>'+esc(offer.amount)+'</h2><p class="meta">'+t('记录周期','Record cycle')+' '+esc(cycle(offer))+(offer.zone?' · '+esc(offer.zone):'')+'</p>'+
    '<p class="meta">'+t('最近核验','Verified')+' '+date(offer.lastVerifiedAt,true)+' · '+t('最近尝试','Last check')+' '+date(offer.checkedAt,true)+'</p>'+
    '<p>'+esc(offer.checkDetail)+'</p><div class="actions">'+external(offer.source,t('厂商规则 ↗','Provider rules ↗'))+
    '<a class="button dark" href="'+esc(offer.claimUrl)+'" target="_blank" rel="noopener noreferrer">'+t('打开官网 ↗','Open provider ↗')+'</a></div></div>'+
    '<div class="panel"><h3>'+t('手动记录','Manual record')+'</h3><p class="muted">'+t('使用厂商官网后回到这里记录，本页无法确认额度到账。','Record use after visiting the provider. The provider confirms eligibility and credit delivery.')+'</p>'+
    (history===null?empty(t('本地记录不可用','Local storage unavailable')):
    '<form class="form" id="claim-form"><label>'+t('备注','Note')+'<input maxlength="280" name="note" value="" placeholder="'+t('可选','Optional')+'"></label>'+
    '<div class="actions"><button class="button dark" '+(existing||offer.status==='expired'?'disabled':'')+'>'
    +t('标记本周期已使用','Record this cycle')+'</button>'+
    (existing?'<button type="button" class="button" id="undo">'+t('撤销本周期','Undo this cycle')+'</button>':'')+'</div></form>')+
    '</div><div class="panel"><h3>'+t('记录历史','Local history')+'</h3>'+
    (rows.length?'<div class="source-list">'+rows.map(row=>'<div><p>'+date(row.recordedAt,true)+' · '+esc(row.snapshot?.amount||offer.amount)+'</p>'+
    '<p class="muted">'+esc(row.note)+'</p></div>').join('')+'</div>':empty(t('本地暂无记录','No local records')))+
    '</div><div class="panel"><h3>'+t('来源校验记录','Source checks')+'</h3>'+
    (checks.length?'<div class="source-list">'+checks.map(entry=>'<div><p class="meta">'+date(entry.at,true)+'</p><p>'+esc(entry.detail)+'</p></div>').join('')+
    '</div>':empty(t('等待首次自动核对','Waiting for the first automated check')))+
    '</div></article><aside class="side">'+offerCard(offer,history??[])+'</aside></div>';
  const bind=(selector,task,event='click')=>root.querySelector(selector)?.addEventListener(event,async e=>{
    e.preventDefault();
    try {await task(e);refreshTop(()=>renderOffer(id));}catch(error){announce(error.message);}
  });
  bind('#claim-form',async e=>{await claim(offer,new FormData(e.target).get('note')||'');announce(t('已记录','Recorded'));},'submit');
  bind('#undo',async()=>{await undo(offer);announce(t('已撤销','Undone'));});
}
