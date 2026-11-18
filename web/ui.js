export const root=document.querySelector('main');
export const params=new URLSearchParams(location.search);
export const en=params.get('lang')==='en';
export const locale=en?'en':'zh-CN';
export const t=(zh,english)=>en?english:zh;
export const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[char]);
export const known=(value,suffix='')=>value===null||value===undefined?'—':esc(value)+suffix;
export const date=(value,withTime=false)=>value&&Number.isFinite(Date.parse(value)) ?
  new Intl.DateTimeFormat(locale,{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',
    ...(withTime?{hour:'2-digit',minute:'2-digit',hourCycle:'h23'}:{})}).format(new Date(value)):'—';
export const path=location.pathname.replace(/\/$/,'')||'/';
export const parts=path.split('/').slice(1).map(seg=>{
  try {return decodeURIComponent(seg);} catch {return seg;}
});
export const url=(pathname,data={})=>{
  const [target,tail]=pathname.split('?');
  const query=new URLSearchParams(tail);
  if (en) query.set('lang','en');
  for (const [name,value] of Object.entries(data)) {
    if (value!==null&&value!==undefined&&value!=='') query.set(name,value);
    else query.delete(name);
  }
  return target+(query.size?'?'+query:'');
};
export const external=(href,label)=>href?'<a class="text-link" target="_blank" rel="noopener noreferrer" href="'+esc(href)+'">'+esc(label)+'</a>':'—';
export const link=(to,title,kind='')=>'<a class="'+esc(kind)+'" href="'+esc(url(to))+'">'+esc(title)+'</a>';
export const button=(to,title,kind='')=>link(to,title,'button '+kind);
export const pill=(label,kind='')=>'<span class="pill '+kind+'">'+esc(label)+'</span>';
export const heading=(tag,title,summary='',back)=>'<div class="page-head">'+
  (back?link(back[0],back[1],'back'):'<span class="eyebrow muted">'+esc(tag)+'</span>')+
  '<h1>'+esc(title)+'</h1>'+(summary?'<p>'+esc(summary)+'</p>':'')+'</div>';
export const section=(title,action,summary='')=>'<div class="section-head"><div><h2>'+esc(title)+'</h2>'+
  (summary?'<p class="muted">'+esc(summary)+'</p>':'')+'</div>'+(action?link(action[0],action[1]):'')+'</div>';
export const empty=(message,description='')=>'<div class="empty"><strong>'+esc(message)+'</strong>'+
  (description?'<p>'+esc(description)+'</p>':'')+'</div>';
export const status=(meta,statuses={})=>{
  const names={fresh:t('已更新','Updated'),partial:t('数据待补充','Partial data'),stale:t('保留历史快照','Last good snapshot'),...statuses};
  return pill(names[meta?.dataStatus||'partial'],meta?.dataStatus==='fresh'?'ok':'attention')+
    ' <span class="meta">'+t('更新','Updated')+' '+date(meta?.asOf,true)+'</span>';
};
export function select(name,label,values,selected=params.get(name)) {
  return '<label>'+esc(label)+'<select name="'+esc(name)+'">'+values.map(([value,display])=>
    '<option value="'+esc(value)+'"'+(String(selected??'')===String(value)?' selected':'')+'>'+esc(display)+'</option>').join('')+'</select></label>';
}
export const searchbox=(label,placeholder,value=params.get('q')??'')=>'<label class="grow">'+esc(label)+'<input name="q" type="search" maxlength="150" value="'+esc(value)+'" placeholder="'+esc(placeholder)+'"></label>';
export function form(body,action=path,label=t('筛选','Apply')) {
  return '<form class="toolbar" method="get" action="'+esc(action)+'">'+(en?'<input type="hidden" name="lang" value="en">':'')+
    body+'<button class="button dark">'+esc(label)+'</button></form>';
}
export function pagination(meta,limit=Math.min(60,Math.max(1,parseInt(params.get('limit'),10)||24)),
  cursor=Math.max(0,parseInt(params.get('cursor'),10)||0)) {
  if (!cursor&&!meta.nextCursor) return '';
  const page=(offset,label)=>button(url(path,{...Object.fromEntries(params),cursor:offset}),label);
  return '<div class="pagination">'+(cursor?page(String(Math.max(0,cursor-limit)),t('上一页','Previous')):'')+
    (meta.nextCursor?page(meta.nextCursor,t('下一页','Next')):'')+'</div>';
}
export function announce(message) {
  const notice=document.getElementById('notice');
  notice.textContent=message;
  clearTimeout(announce.timer);
  announce.timer=setTimeout(()=>{notice.textContent='';},2800);
}
export async function copy(value) {
  try { await navigator.clipboard.writeText(value); announce(t('已复制','Copied')); }
  catch { announce(t('复制失败，可手动选中文本','Copy failed. Select the text to copy it.')); }
}
export function bindCopy(scope=root) {
  scope.querySelectorAll('[data-copy]').forEach(btn=>btn.addEventListener('click',()=>{
    const target=document.getElementById(btn.dataset.copy);
    if (target) copy(target.textContent);
  }));
}
export async function api(endpoint,options) {
  const response=await fetch(endpoint,options);
  const result=await response.json();
  if (!response.ok) throw new Error(result.error||'HTTP '+response.status);
  return result;
}
export const get=(endpoint,defaults={})=>api('/api/v1/'+endpoint+(Object.keys(defaults).length?'?'+new URLSearchParams(defaults):''));
export const post=(endpoint,body)=>api(endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
export const navLink=(to,label,active)=>link(to,label,'chip'+(active?' active':''));
export const chips=(items)=>'<div class="tabs">'+items.map(([to,label,active])=>navLink(to,label,active)).join('')+'</div>';
export const signin=(next=location.pathname+location.search)=>'/signin-with-chatgpt?returnTo='+encodeURIComponent(next);
export const loginBox=(reason)=>empty(reason)+
  '<p class="section"><a class="button dark" target="_top" href="'+esc(signin())+'">使用 ChatGPT 登录</a></p>';
export const dataOf=async(promise,fallback)=>promise.then(result=>result.data).catch(()=>fallback);
export function storeGet(key,value) {
  try { const stored=localStorage.getItem('atlas:'+key); return stored?JSON.parse(stored):value; } catch { return value; }
}
export function storeSet(key,value) {
  try { localStorage.setItem('atlas:'+key,JSON.stringify(value)); return true; } catch { return false; }
}
export function refreshTop(render) {
  render().catch(showError);
}
export function showError(error) {
  root.innerHTML=heading('MODEL ATLAS',t('暂时无法载入','Unable to load'),error.message)+button('/',t('返回首页','Back to home'));
}
