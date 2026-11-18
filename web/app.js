import {root,params,en,t,path,parts,esc,date,known,external,link,button,pill,heading,section,empty,status,select,searchbox,form,pagination,
  announce,copy,bindCopy,get,post,api,chips,signin,loginBox,dataOf,storeGet,storeSet,refreshTop,url} from './ui.js';
import {atlasArt,graphViz,oceanViz} from './visuals.js';
import {renderClub,renderOffer,offerStatus} from './club.js';
import {renderAdmin,renderSubmit} from './admin.js';

const modules=[
  ['/cases','案例库','Cases','按场景找实操案例','Find an original example'],
  ['/radar','资讯雷达','Radar','追踪官方消息','Follow official news'],
  ['/map','热点图谱','Graph','查关联与热度','Explore related entities'],
  ['/learn','实践课程','Learn','把方法练成流程','Practice a workflow'],
  ['/token-ocean','算力海洋','Ocean','探索模型福利','Explore API offers'],
  ['/token-club','福利卡册','Offers','记录与备份','Record and back up']
];
document.querySelectorAll('#nav a').forEach((anchor,i)=>{
  anchor.href=url(modules[i][0]);
  anchor.textContent=t(modules[i][1],modules[i][2]);
  if(path.startsWith(modules[i][0]))anchor.setAttribute('aria-current','page');
});
const lang=new URL(location.href);
if(en) lang.searchParams.delete('lang'); else lang.searchParams.set('lang','en');
document.querySelector('#locale').href=lang.pathname+lang.search;
document.querySelector('#locale').textContent=en?'中文':'EN';
document.querySelector('.head-tools .search-icon').href=url('/search');
document.querySelectorAll('.footer a').forEach(a=>a.href=url(a.getAttribute('href')));

const title=item=>en?(item.enTitle||item.title):item.title;
const categoryOptions=[['',t('全部','All')],['编程',t('编程','Coding')],['数据',t('数据','Data')],['影像',t('影像','Visual')],['文本',t('文本','Text')]];
const mapType={'公司':'Company','模型':'Model','工具':'Tool','产品':'Product','开源':'Open source','概念':'Concept','人物':'Person'};
const chipBtn=(label,attrs='')=>'<button class="chip" '+attrs+'>'+esc(label)+'</button>';
const caseTabs=active=>chips([
  ['/cases',t('案例库','Catalog'),active==='cases'],['/rankings',t('排行榜','Rankings'),active==='rankings'],
  ['/retests',t('复测','Retests'),active==='retests'],['/skills',t('Skills','Skills'),active==='skills'],['/daily',t('报告','Reports'),active==='daily']
]);
const viewQuery=(defaults={})=>({...defaults,...Object.fromEntries([...params].filter(([key,v])=>key!=='lang' && v!==''))});
const art=item=>'<div class="art '+esc(item.theme||'violet')+'" aria-hidden="true"><span class="art-label">'+esc(item.category)+
  '</span><span class="diagram"><i></i><b>'+esc(item.model)+'</b></span></div>';
function caseCard(item) {
  return '<a class="case" href="'+esc(url('/cases/'+item.id))+'">'+art(item)+'<div class="body"><div class="meta">'+esc(item.model)+
    ' · '+esc(item.rightsStatus)+'</div><h3>'+esc(title(item))+'</h3><p class="muted">'+esc(item.summary)+'</p><div class="meta">'+
    date(item.publishedAt)+' <span aria-hidden="true">↗</span></div></div></a>';
}
function newsPreview(n) {
  const first=n.sources[0];
  return '<a class="brief" href="'+esc(url('/radar',{story:n.id,mode:'all'}))+'"><div class="meta">'+esc(first.source)+' · '+
    date(n.publishedAt)+'</div><h3>'+esc(n.title)+'</h3></a>';
}
const stat=(label,value)=>'<div class="stat"><span>'+esc(label)+'</span><b>'+known(value)+'</b></div>';

async function home() {
  root.innerHTML='<div class="topline"><span class="eyebrow"><strong>✳</strong> '+t('AI 实践与资讯索引','AI PRACTICE AND NEWS INDEX')+'</span><span class="year meta">'+
    date(new Date())+' · '+t('北京时间','UTC+08')+'</span></div>'+
    '<section class="hero"><canvas id="atlas-art" aria-hidden="true"></canvas><div class="hero-copy">'+
      '<h1>'+t('看懂 AI 世界，<br><em>动手用起来。</em>','Navigate AI.<br><em>Put it to work.</em>')+'</h1>'+
      '<p>'+t('跟进模型和工具动态，找到可练习的工作流，再从官方来源核对可用福利。','Track models and tools, practice reusable workflows, and find offers with official sources.')+'</p>'+
      '<div class="actions">'+button('/cases',t('浏览实践案例 ↗','Explore examples ↗'),'primary')+button('/radar',t('查看最新资讯','Read the radar'),'quiet')+'</div></div>'+
      '</section>'+
      '<div class="stats" id="home-stats" aria-label="'+t('站内内容','Site content')+'">'+
      stat(t('原创与审核案例','Cases'),null)+stat(t('资讯来源','News sources'),null)+stat(t('实践路径','Tracks'),null)+stat(t('厂商福利','Offers'),null)+'</div>'+
      '<div class="section board"><section>'+section(t('精选实践','Featured workflows'),['/cases',t('全部案例 →','All cases →')])+'<div id="home-cases">'+
      empty(t('正在载入案例','Loading cases'))+'</div></section><section>'+section(t('最新资讯','Latest releases'),['/radar',t('打开雷达 →','Open radar →')])+
      '<div id="home-news" class="panel briefs">'+empty(t('正在读取源站数据','Loading source data'))+'</div></section></div>'+
      '<section class="section">'+section(t('专题入口','Explore the index'))+'<div class="index-links">'+modules.map(([to,zh,label,hint,enHint])=>
      '<a href="'+url(to)+'"><b>'+t(zh,label)+' ↗</b><small>'+t(hint,enHint)+'</small></a>').join('')+'</div></section>';
  atlasArt(document.getElementById('atlas-art'));
  const [cases,news,health,tracks,offers]=await Promise.all([
    dataOf(get('cases',{limit:60}),[]),dataOf(get('news',{mode:'all',limit:6}),[]),dataOf(get('sources/health'),null),
    dataOf(get('learn/tracks'),null),dataOf(get('token-offers'),null)]);
  document.getElementById('home-stats').innerHTML=stat(t('案例','Cases'),cases.length||null)+stat(t('资讯来源','News sources'),health?.filter(x=>x.enabled).length)+
    stat(t('实践路径','Tracks'),tracks?.length)+stat(t('厂商福利','Offers'),offers?.length);
  document.getElementById('home-cases').innerHTML=cases.length?'<div class="grid">'+cases.slice(0,3).map(caseCard).join('')+'</div>':empty(t('暂无已发布案例','No published cases'));
  document.getElementById('home-news').innerHTML=news.length?news.slice(0,4).map(newsPreview).join(''):empty(t('等待首轮信源采集','Waiting for the first source sync'),t('有数据后会显示原文与发布时间。','Source links appear after the first successful sync.'));
}

async function catalog(ranking=false) {
  const [result,all]=await Promise.all([get(ranking?'rankings':'cases',viewQuery()),get('cases',{limit:60})]);
  const rows=result.data;
  const models=[...new Set(all.data.map(i=>i.model))];
  const modelOptions=[['',t('全部','All')],...models.map(model=>[model,model])];
  const content=ranking
    ? '<div class="list">'+rows.map((item,i)=>'<div class="row"><span class="number">'+String(i+1+(Number(params.get('cursor'))||0)).padStart(2,'0')+
      '</span><div class="item-main">'+link('/cases/'+item.id,title(item))+'<p class="meta">'+esc(item.model)+' · '+esc(item.category)+'</p></div><b>'+
      known(item[params.get('type')||'heat'])+'</b></div>').join('')+'</div>'
    : '<div class="grid">'+rows.map(caseCard).join('')+'</div>';
  const reason=ranking?t('排名需要已核验的互动或复测证据。','Rankings require verified engagement or retest evidence.'):'';
  root.innerHTML=heading('CASE INDEX',ranking?t('案例排行榜','Case rankings'):t('案例库','Case catalog'),
    ranking?t('传播热度与稳定度分别计算。稳定度展示有记录的分数及样本量。','Popularity and stability use separate evidence and scores.'):t('每条案例保留参考来源、可复制的提示词和练习产物。','Each case includes source references, a reusable prompt and an exercise.'))+
    caseTabs(ranking?'rankings':'cases')+form(
      (ranking?select('type',t('榜单','Chart'),[['heat',t('传播榜','Popularity')],['stability',t('稳定榜','Stability')]],params.get('type')||'heat'):
       searchbox(t('搜索','Search'),t('标题、作者、模型或 Prompt','Title, author, model or prompt')))+
      select('category',t('分类','Category'),categoryOptions)+select('model',t('模型','Model'),modelOptions)+
      (ranking?select('period',t('时段','Period'),[['',t('全部时间','All time')],['7d',t('近 7 天','7 days')],['30d',t('近 30 天','30 days')]]):
       select('sort',t('排序','Sort'),[['latest',t('最新','Latest')],['heat',t('传播热度','Popularity')],['stability',t('稳定度','Stability')]],params.get('sort')||'latest')+
       select('tag',t('主题','Topic'),[['',t('全部','All')],['coding','AI Coding'],['retrieval','RAG'],['agents','MCP'],['multimodal',t('多模态','Multimodal')]])))+
    (ranking?'<p class="meta" style="margin-bottom:14px">'+status(result.meta)+(params.get('type')==='stability'?
    t(' · 口径为已记录的评审平均分与样本量。',' · Mean of recorded review scores and sample size.'):
    t(' · 同平台同类比较。互动分位 85% + 增速分位 15%，按 7 天半衰期衰减。',' · Compare by platform and category. Engagement percentile 85%, speed percentile 15%, with a 7-day half-life.'))+'</p>':'')+
    (rows.length?content:empty(t('暂无匹配记录','No matching records'),reason))+pagination(result.meta);
}
function testTile(test,showCase=true) {
  return '<div class="tile"><div class="tagline">'+pill(test.outcome,test.outcome==='人工失败'?'bad':'attention')+
    '<span class="meta">'+date(test.tested_at,true)+'</span></div><h3>'+esc(test.model)+' · '+esc(test.version)+'</h3>'+
    '<p>'+esc(test.note)+'</p><p class="meta">'+t('评审分','Review score')+' '+known(test.score)+' · '+t('成本','Cost')+' '+known(test.cost)+'</p>'+
    '<details><summary>'+t('运行参数','Parameters')+'</summary><pre>'+esc(test.parameters)+'</pre></details>'+
    '<div class="actions">'+external(test.evidence,t('查看复测证据 ↗','View evidence ↗'))+
    (showCase?link('/cases/'+test.case_slug,t('关联案例 →','Related case →'),'text-link'):'')+'</div></div>';
}
async function caseDetail() {
  const [{data:item},related,tests]=await Promise.all([get('cases/'+encodeURIComponent(parts[1])),
    dataOf(get('cases',{limit:60}),[]),dataOf(get('cases/'+encodeURIComponent(parts[1])+'/retests'),[])]);
  const saved=storeGet('saved-cases',[]);
  const showAlt=!!item.enPrompt;
  const defaultPrompt=en&&showAlt?item.enPrompt:item.prompt;
  const relevant=related.filter(x=>x.id!==item.id&&x.category===item.category).slice(0,3);
  root.innerHTML=heading('',title(item),item.summary,['/cases',t('← 案例库','← Case catalog')])+
    '<div class="layout-side"><article class="content">'+art(item)+
    '<section id="prompt"><h2>Prompt</h2><div class="actions">'+
      (showAlt?chipBtn('中文','id="prompt-zh" aria-pressed="'+!en+'"')+chipBtn('English','id="prompt-en" aria-pressed="'+en+'"'):'')+
      '<button class="button" data-copy="prompt-code">'+t('复制','Copy')+'</button></div><pre id="prompt-code">'+esc(defaultPrompt)+'</pre></section>'+
    '<section id="sample"><h2>'+t('练习输入与参考结果','Practice input and expected output')+'</h2>'+
      (item.input||item.output?'<div class="grid two"><div class="panel"><span class="meta">'+t('输入','Input')+'</span><pre>'+esc(item.input)+'</pre></div><div class="panel">'+
      '<span class="meta">'+t('编辑参考结果','Editorial reference result')+'</span><pre>'+esc(item.output)+'</pre></div></div>':empty(t('此案例未附练习产物','No exercise output included')))+
    '</section><section id="retests"><h2>'+t('复测记录','Retest evidence')+'</h2>'+
      (tests.length?'<div class="grid two">'+tests.map(row=>testTile(row,false)).join('')+'</div>':empty(t('暂无独立复测','No independent retests'),t('编辑参考结果未计入复测分。','Editorial examples are excluded from retest scores.')))+
    '</section>'+(relevant.length?'<section class="section">'+section(t('相关案例','Related examples'))+'<div class="grid">'+relevant.map(caseCard).join('')+'</div></section>':'')+
    '</article><aside class="panel side"><div class="tagline">'+pill(item.category)+pill(item.rightsStatus,'ok')+'</div><h3>'+t('案例资料','Case record')+
    '</h3><div class="source-list"><div>'+t('作者','Author')+' '+link('/creators/'+item.authorId,item.author,'text-link')+'</div><div>'+
    t('参考模型','Model')+' '+link('/models/'+encodeURIComponent(item.model),item.model,'text-link')+'</div>'+
    '<div>'+t('核验','Verified')+' '+date(item.verifiedAt)+'</div><div>'+t('热度','Popularity')+' '+known(item.heat)+(item.heatEvidence?' · '+external(item.heatEvidence.source,t('互动快照 ↗','Source snapshot ↗')):'')+'</div><div>'+
    t('稳定度','Stability')+' '+known(item.stability)+(item.stabilitySamples?' · '+item.stabilitySamples+' '+t('次评审','reviews'):'')+'</div>'+
    '<div>'+external(item.source,t('查看参考来源 ↗','Open reference ↗'))+'</div></div>'+
    '<div class="actions">'+button('/skills/'+item.id,t('查看 Skill','Open Skill'))+
    '<button id="save-case" class="button" aria-pressed="'+saved.includes(item.id)+'">'+(saved.includes(item.id)?t('已收藏','Saved'):t('收藏','Save'))+
    '</button><button id="share-case" class="button">'+t('复制链接','Share link')+'</button></div></aside></div>';
  bindCopy();
  for(const [key,value] of [['zh',item.prompt],['en',item.enPrompt]]) if(value){
    document.getElementById('prompt-'+key)?.addEventListener('click',()=>{
      document.getElementById('prompt-code').textContent=value;
      for(const language of ['en','zh']) document.getElementById('prompt-'+language).setAttribute('aria-pressed',String(key===language));
    });
  }
  document.getElementById('save-case').addEventListener('click',event=>{
    const existing=storeGet('saved-cases',[]);
    const active=!existing.includes(item.id);
    if(!storeSet('saved-cases',active?[...existing,item.id]:existing.filter(id=>id!==item.id)))return announce(t('无法写入本地收藏','Local storage unavailable'));
    event.target.textContent=active?t('已收藏','Saved'):t('收藏','Save');
    event.target.setAttribute('aria-pressed',String(active));
  });
  document.getElementById('share-case').addEventListener('click',()=>copy(location.href));
}
async function caseGroup(kind) {
  const {data:items}=await get('cases',{limit:60});
  const id=parts[1];
  const rows=items.filter(x=>kind==='models'?x.model.toLowerCase()===id.toLowerCase():x.authorId===id);
  root.innerHTML=heading(kind,kind==='models'?id:rows[0]?.author||t('创作者','Creators'),t('已公开的相关案例','Published examples'),['/cases',t('← 案例库','← Cases')])+
    (rows.length?'<div class="grid">'+rows.map(caseCard).join('')+'</div>':empty(t('没有相关案例','No related cases')));
}
async function retests() {
  const result=await get('retests',viewQuery());
  root.innerHTML=heading('RETESTS',t('复测实验室','Retest lab'),t('按模型版本、运行参数和人工判定比对实际结果。','Compare model versions, parameters and observed outcomes.'))+
  caseTabs('retests')+(result.data.length?'<div class="grid">'+result.data.map(row=>testTile(row)).join('')+'</div>':
    empty(t('暂无可以展示的复测证据','No retest evidence is published'),t('有记录的成功、失败与成本会在此公开。','Recorded successes, failures and costs appear here.')))+pagination(result.meta);
}
async function skills() {
  if (!parts[1]) {
    const {data}=await get('skills');
    root.innerHTML=heading('SKILLS',t('实用 Skills','Reusable skills'),t('从案例提取操作指令，下载或复制到支持的 Agent。','Download or copy a case workflow for a compatible agent.'))+caseTabs('skills')+
      '<div class="grid">'+data.map(item=>'<div class="tile">'+pill('v'+item.version)+'<h3>'+link(item.skillsUrl,item.title)+'</h3>'+
      button(item.skillsUrl,t('查看 Skill →','Open Skill →'))+'</div>').join('')+'</div>';return;
  }
  const {data:item}=await get('cases/'+encodeURIComponent(parts[1]));
  const response=await fetch('/skills/'+encodeURIComponent(item.id)+'/SKILL.md');
  if(!response.ok)throw new Error('无法载入 SKILL.md');
  const markdown=await response.text();
  root.innerHTML=heading('SKILL',title(item),t('将 SKILL.md 保存到 Agent 配置的 Skills 目录，重新加载后选用。','Save SKILL.md in your agent’s configured skills folder, then reload it.'),['/skills','← Skills'])+
    '<div class="actions"><button class="button dark" data-copy="skill-doc">'+t('复制 SKILL.md','Copy SKILL.md')+'</button>'+
    '<a class="button" download="SKILL.md" href="/skills/'+esc(item.id)+'/SKILL.md">'+t('下载 SKILL.md','Download SKILL.md')+'</a>'+
    button('/cases/'+item.id,t('查看案例','Open case'))+'</div><pre id="skill-doc">'+esc(markdown)+'</pre>';
  bindCopy();
}
async function daily() {
  const defaultPeriod=params.get('period')||'day';
  const {data,meta}=await get('daily',{period:defaultPeriod});
  root.innerHTML=heading('REPORTS',t('更新报告','Update reports'),t('从实际发布内容生成周期统计。','Periodic summaries use published records.'))+caseTabs('daily')+
    chips([['day',t('日','Day')],['week',t('周','Week')],['month',t('月','Month')]].map(([key,name])=>[url('/daily',{period:key}),name,key===defaultPeriod]))+
    '<p>'+status(meta)+'</p><div class="stats">'+stat(t('新增案例','Cases'),data.cases.length)+stat(t('复测','Retests'),data.retests.length)+stat(t('近期新闻（上限 20）','News (up to 20)'),data.news.length)+'</div>'+
    '<div class="section grid two"><section>'+section(t('案例','Cases'))+(data.cases.length?'<div class="grid two">'+data.cases.map(caseCard).join('')+'</div>':empty(t('本时段无已发布案例','No cases in this period')))+
    '</section><section>'+section(t('资讯','News'))+'<div class="panel briefs">'+(data.news.length?data.news.map(newsPreview).join(''):empty(t('暂无资讯','No news')))+
    '</div></section></div>'+(data.retests.length?'<div class="section grid">'+data.retests.map(x=>testTile(x)).join('')+'</div>':'');
}

const newsCategories=['模型','产品','开发者','行业','论文','社区','自媒体'];
function newsItem(item) {
  const first=item.sources[0];
  const more=item.sources.length;
  return '<article class="row news-row"><div class="tagline">'+pill(item.category)+' <span class="meta">'+date(item.publishedAt,true)+
    '</span></div><h3>'+external(first.url,item.title)+'</h3><div class="actions"><span class="meta">'+esc(first.source)+'</span>'+
    link(url('/map',{q:item.title}),t('查看相关实体 →','Find entities →'),'text-link')+'</div><details><summary>'+
    t(more>1?'查看 '+more+' 条原始来源':'查看原始来源',more+' source'+(more===1?'':'s'))+'</summary><div class="source-list">'+
    item.sources.map(s=>'<div>'+external(s.url,s.source+' · '+s.title)+'<p class="meta">'+t('发布','Published')+' '+date(s.publishedAt,true)+
    ' · '+t('抓取','Collected')+' '+date(s.fetchedAt,true)+'</p></div>').join('')+'</div></details></article>';
}
async function radar() {
  const view=params.get('view')??'stream';
  const healthView=view==='health';
  const [result,health]=await Promise.all([get('news',viewQuery()),get('sources/health')]);
  const mode=params.get('mode')||'curated';
  const modeLink=next=>url('/radar',{...Object.fromEntries(params),mode:next,cursor:null});
  const healthRows=health.data.map(s=>'<article class="source-card"><div class="tagline">'+pill(s.enabled?(s.error?t('源站异常','Source error'):s.success_at?t('已连通','Healthy'):t('待采集','Pending')):t('已暂停','Paused'),s.error?'attention':'ok')+
    pill(s.category)+'</div><h3>'+esc(s.label)+'</h3><div class="source-list">'+external(s.url,'RSS / Atom ↗')+
    '<div class="meta">'+t('最后成功','Last success')+' '+date(s.success_at,true)+'</div><div class="meta">'+t('成功率','Success rate')+' '+
    (s.attempts?Math.round(100*(s.attempts-s.failures)/s.attempts)+'%':'—')+'</div>'+(s.error?'<div class="meta">'+esc(s.error)+'</div>':'')+'</div></article>').join('');
  let lastDay='';
  const grouped=result.data.map(item=>{
    const day=date(item.publishedAt);
    const divider=day===lastDay?'':'<div class="day">'+day+'</div>';
    lastDay=day;
    return divider+newsItem(item);
  }).join('');
  const top=[...result.data].sort((a,b)=>(b.score+b.sources.length*2)-(a.score+a.sources.length*2)||b.publishedAt.localeCompare(a.publishedAt)).slice(0,3);
  const story=params.get('story');
  const toolbar=chips([['/radar',t('信息流','Stream'),view==='stream'],['/radar?view=classic',t('经典视图','Classic'),view==='classic'],
    ['/radar?view=health',t('来源健康','Source health'),healthView]]);
  root.innerHTML=heading('RADAR',t('资讯雷达','News radar'),t('来自官方 RSS 与 Atom 的模型更新、开发工具和研究动态。','Model releases, developer tools and research from official feeds.'))+
    toolbar+(healthView?'<p>'+status(health.meta)+'</p><div class="section grid">'+healthRows+'</div>':
    form(searchbox(t('搜索资讯','Search news'),t('标题、关键词、来源','Title, keyword, source'))+
      select('category',t('栏目','Category'),[['',t('全部','All')],...newsCategories.map(x=>[x,x])])+
      select('source',t('信源','Source'),[['',t('全部','All')],...health.data.map(s=>[s.id,s.label])])+
      '<input type="hidden" name="mode" value="'+esc(mode)+'">'+(view==='classic'?'<input type="hidden" name="view" value="classic">':''))+
    '<div class="section-head"><div class="actions">'+chips([[modeLink('curated'),t('精选','Curated'),mode==='curated'],[modeLink('all'),t('全量','All items'),mode==='all']])+'</div>'+
    '<div>'+status(result.meta)+'</div></div>'+
    (story?'<p class="actions">'+button('/radar?mode=all',t('清除新闻定位','Clear story filter'))+'</p>':'')+
    (result.data.length?'<div class="'+(view==='classic'?'board':'')+'"><div class="list">'+grouped+'</div>'+
      (view==='classic'?'<aside class="panel"><h3>'+t('当前重点','Highlights')+'</h3><p class="muted">'+t('按标题相关度与来源数排序','Sorted by relevance and source count')+'</p>'+top.map(newsPreview).join('')+'</aside>':'')+'</div>':
      empty(t('暂无匹配新闻','No matching news'),result.meta.asOf?t('可切换全量或清空筛选。','Try all items or clear filters.'):t('首次采集尚未完成。刷新可重新查看。','Initial ingestion is pending. Refresh to check again.')))+pagination(result.meta));
}

async function graph() {
  const three=parts[1]==='3d';
  const windowSize=params.get('window')==='24h'?'24h':'7d';
  const {data,meta}=await get(three?'map/terrain':'map/graph',{window:windowSize});
  const initial=params.get('entity');
  let q=params.get('q')??'';
  const hasHeat=data.nodes.some(item=>item.heat!==null);
  const simple=value=>value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
  const matches=(item,value)=>{
    const term=simple(value);
    return !term||[item.name,...item.aliases,item.type].some(name=>simple(name).includes(term)||(' '+term+' ').includes(' '+simple(name)+' '));
  };
  let selected=data.nodes.find(n=>n.id===initial)?.id??(q?data.nodes.find(n=>matches(n,q))?.id:null)??data.nodes.find(n=>n.heat>0)?.id??data.nodes[0]?.id;
  let viz;
  root.innerHTML=heading('ENTITY GRAPH',three?t('热点地形','Terrain view'):t('热点图谱','Entity graph'),
    t('查找 AI 实体、官方关系与近期新闻。新闻热度按 24 小时半衰期衰减。','Find AI entities, official relations and news with a 24-hour heat half-life.'))+
    '<div class="map-tools"><label class="grow">'+t('查找实体','Find an entity')+' <input id="map-q" class="search-full" aria-label="'+t('查找实体','Find an entity')+'" value="'+esc(q)+'" maxlength="150" placeholder="Codex, Gemini, MCP…"></label>'+
    '<div class="actions" id="map-switch"></div><div class="actions">'+button(url(path,{window:'24h',entity:selected}),t('24 小时','24h'),windowSize==='24h'?'dark':'')+
    button(url(path,{window:'7d',entity:selected}),t('近 7 天','7d'),windowSize==='7d'?'dark':'')+'</div></div>'+
    '<div class="layout-side"><section><div class="dark-panel viz-wrapper" id="graph-panel"><canvas id="graph-canvas" tabindex="0" role="img" aria-label="'+
      t('交互图谱，键盘用户可以使用下方实体列表','Interactive graph. Keyboard users can use the entity list below.')+'"></canvas>'+
    (three?'<canvas id="graph-overlay" aria-hidden="true" style="position:absolute;inset:0;pointer-events:none"></canvas>':'')+
    '<div class="viz-badge">'+pill(three?'WEBGL / 3D':'NETWORK / 2D','ok')+'</div><div class="viz-zoom"><button class="button quiet" data-in aria-label="Zoom in">+</button>'+
    '<button class="button quiet" data-out aria-label="Zoom out">−</button><button class="button quiet" data-reset>'+t('重置','Reset')+'</button></div></div>'+
    '<p class="meta tagline" style="margin-top:10px">'+status(meta)+(hasHeat?'':t('当前仅显示官方关系，等待新闻热度。','Official relations shown while news signals load.'))+'</p>'+
    '<div id="entity-buttons" class="map-entities" aria-label="'+t('实体列表','Entities')+'"></div></section><aside id="entity-detail" class="side panel detail"></aside></div>';
  function tabs(){
    document.getElementById('map-switch').innerHTML=button(url('/map',{entity:selected,window:windowSize}),t('2D 网络','2D network'),three?'':'dark')+
      button(url('/map/3d',{entity:selected,window:windowSize}),t('3D 地形','3D terrain'),three?'dark':'');
  }
  function pick(id,center=false) {
    selected=id;
    const node=data.nodes.find(item=>item.id===id);
    if(!node)return;
    const query=new URL(location.href);query.searchParams.set('entity',id);history.replaceState(null,'',query);
    const edges=data.edges.filter(e=>e.from===id||e.to===id);
    const connections=edges.map(edge=>{
      const next=data.nodes.find(n=>n.id===(edge.from===id?edge.to:edge.from));
      return next?chipBtn(next.name,'data-neighbor="'+esc(next.id)+'" title="'+esc(edge.type)+'"'):'';
    }).join('');
    document.getElementById('entity-detail').innerHTML='<div class="tagline">'+pill(en?mapType[node.type]??node.type:node.type)+'</div><h3>'+esc(node.name)+
      '</h3><div class="graph-score">'+known(node.heat,' / 100')+'</div><div class="graph-bar" aria-hidden="true"><i style="width:'+(node.heat??0)+'%"></i></div>'+
      '<p class="meta">'+t('24 小时变化','24h change')+' '+known(node.change)+' · '+t('最近出现','Last seen')+' '+date(node.lastSeen)+'</p>'+
      '<p class="meta">'+(node.aliases.length?t('别名','Aliases')+' '+node.aliases.map(esc).join(' / '):'')+'</p>'+
      '<div class="source-list">'+external(node.source,t('官方信息 ↗','Official reference ↗'))+'</div>'+
      '<h3>'+t('关联实体','Related entities')+'</h3><div class="tagline">'+(connections||'—')+'</div><h3>'+t('相关报道','Related news')+'</h3>'+
      (node.news.length?'<div class="source-list">'+node.news.map(n=>'<div>'+link(url('/radar',{story:n.id,mode:'all'}),n.title,'text-link')+'</div>').join('')+'</div>':
       '<p class="muted">'+t('本窗口暂无匹配资讯。','No matching news in this window.')+'</p>')+
      '<div class="actions">'+button(url('/radar',{q:node.name,mode:'all'}),t('去资讯雷达','Open radar'))+
      button(url('/cases',{q:node.name}),t('找案例','Find cases'))+'</div>';
    document.getElementById('entity-detail').querySelectorAll('[data-neighbor]').forEach(b=>b.addEventListener('click',()=>pick(b.dataset.neighbor,true)));
    tabs();viz?.focus(id,center);entityButtons();
  }
  function entityButtons() {
    const matchesQuery=data.nodes.filter(node=>matches(node,q));
    const box=document.getElementById('entity-buttons');
    box.innerHTML=matchesQuery.length?matchesQuery.map(n=>chipBtn(n.name,'data-entity="'+esc(n.id)+'" aria-pressed="'+(n.id===selected)+'"')).join(''):
      '<span class="meta">'+t('没有匹配实体','No matching entities')+'</span>';
    box.querySelectorAll('[data-entity]').forEach(b=>b.addEventListener('click',()=>pick(b.dataset.entity,true)));
  }
  viz=graphViz(document.getElementById('graph-canvas'),document.getElementById('graph-overlay'),data,{
    three,selected,onSelect:pick,onFallback:()=>{
      document.getElementById('graph-panel').innerHTML='<div style="padding:20px">'+empty(t('3D 渲染不可用','3D rendering is unavailable'))+'</div>';
    }
  });
  pick(selected,!!q);
  const input=document.getElementById('map-q');
  input.addEventListener('input',()=>{
    q=input.value;
    entityButtons();
  });
  input.addEventListener('keydown',event=>{
    if(event.key==='Enter'){const node=data.nodes.find(n=>matches(n,q));if(node)pick(node.id,true);}
  });
}

function markdownBlocks(value) {
  const lines=(value??'').trim().split('\n');
  const sections=[];
  let inCode=false, buffer=[];
  for(const line of lines) {
    if(line.startsWith('```')) {
      if(inCode) {
        sections.push('<div class="actions"><button class="button" data-copy="lesson-code">'+t('复制代码','Copy code')+
          '</button></div><pre id="lesson-code">'+esc(buffer.join('\n'))+'</pre>');
        buffer=[];
      }
      inCode=!inCode;
      continue;
    }
    if(inCode) {buffer.push(line);continue;}
    if(line.startsWith('## ')) sections.push('<h3>'+esc(line.slice(3))+'</h3>');
    else if(line.trim()) sections.push('<p>'+esc(line)+'</p>');
  }
  return sections.join('');
}
const checklistFor=markdown=>[...(markdown??'').matchAll(/^\d+\. (.+)$/gm)].map(match=>match[1]);

async function learn() {
  const {data:tracks}=await get('learn/tracks',parts[1]?{}:{q:params.get('q')||''});
  if (!parts[1]) {
    const found=tracks;
    root.innerHTML=heading('FIELD NOTES',t('实践课程','Practical lessons'),t('从一个实际任务开始，把方法练成可复用的流程。','Build a reusable workflow around one concrete task.'))+
      form(searchbox(t('搜索教程','Search lessons'),t('Codex、MCP、RAG…','Codex, MCP, RAG…')))+
      (found.length?'<div class="grid course">'+found.map((track,i)=>'<a class="tile '+['mint','violet','blue','peach','ocean'][i%5]+'" href="'+url('/learn/tracks/'+track.id)+'">'+
        pill(track.tag)+'<h3>'+esc(track.title)+'</h3><p>'+esc(track.summary)+'</p><div class="meta" style="margin-top:10px">'+t('进入路径 ↗','Open track ↗')+'</div></a>').join('')+'</div>':empty(t('没有匹配课程','No matching lessons')));
    return;
  }
  const articles=parts[1]==='articles';
  const track=tracks.find(x=>articles?x.articleId===parts[2]:x.id===parts[2]);
  if(!track)throw new Error(t('找不到该教程','Lesson not found'));
  if(!articles){
    root.innerHTML=heading(track.tag,track.title,track.summary,['/learn',t('← 实践课程','← Practical lessons')])+
      '<section class="panel"><div class="tagline">'+pill('v'+track.version)+' <span class="meta">'+t('最近核验','Verified')+' '+date(track.verifiedAt)+'</span></div>'+
      '<h3>'+esc(track.articleTitle)+'</h3><div class="actions">'+button('/learn/articles/'+track.articleId,t('开始阅读','Read lesson'),'dark')+
      button('/cases/'+track.caseId,t('配套案例','Companion case'))+'</div></section>';
    return;
  }
  const [{data:item},{data:lesson}]=await Promise.all([get('cases/'+track.caseId),get('learn/articles/'+track.articleId)]);
  const saved=new Set(storeGet('lesson-'+track.id,[]));
  const steps=checklistFor(lesson.markdown);
  root.innerHTML=heading(track.tag,track.articleTitle,track.summary,['/learn/tracks/'+track.id,t('← 学习路径','← Learning track')])+
    '<div class="layout-side"><article class="panel content"><section id="goal"><h2>'+t('任务','Task')+'</h2><p>'+esc(track.summary)+'</p></section>'+
    '<section id="steps"><h2>'+t('练习步骤','Practice steps')+'</h2>'+markdownBlocks(lesson.markdown)+'</section>'+
    '<section id="example"><h2>'+t('复用示例','Reusable example')+'</h2><button class="button" data-copy="lesson-prompt">'+t('复制 Prompt','Copy prompt')+
    '</button><pre id="lesson-prompt">'+esc(en?item.enPrompt:item.prompt)+'</pre></section>'+
    '<section class="checklist" id="verify"><h2>'+t('验收清单','Checklist')+'</h2>'+steps.map((step,i)=>
      '<label><input type="checkbox" data-step="'+i+'" '+(saved.has(i)?'checked':'')+'> <span>'+esc(step)+'</span></label>').join('')+'</section>'+
    '<section id="refs"><h2>'+t('参考与版本','References and version')+'</h2><p>'+external(track.source,t('官方文档 ↗','Official documentation ↗'))+
    ' · '+date(track.verifiedAt)+' · v'+esc(track.version)+'</p><div class="actions">'+button('/cases/'+item.id,t('查看练习案例','Open exercise'))+
    button('/skills/'+item.id,t('关联 Skill','Companion Skill'))+button('/submit?kind=correction',t('提交勘误','Suggest correction'))+'</div></section></article>'+
    '<aside class="panel side"><h3>'+t('本节目录','On this page')+'</h3><nav class="source-list"><a href="#goal">'+t('任务','Task')+'</a><a href="#steps">'+t('步骤','Steps')+
    '</a><a href="#example">'+t('示例','Example')+'</a><a href="#verify">'+t('验收','Checklist')+'</a><a href="#refs">'+t('参考','References')+
    '</a></nav><p id="lesson-progress" class="meta"></p><div class="progress"><div id="lesson-progress-bar"></div></div></aside></div>';
  const progress=()=>{
    document.getElementById('lesson-progress').textContent=t('练习进度','Exercise progress')+' '+saved.size+' / '+steps.length;
    document.getElementById('lesson-progress-bar').style.width=100*saved.size/steps.length+'%';
  };
  root.querySelectorAll('[data-step]').forEach(input=>input.addEventListener('change',()=>{
    const i=Number(input.dataset.step);
    if(input.checked)saved.add(i);else saved.delete(i);
    if(!storeSet('lesson-'+track.id,[...saved]))announce(t('进度无法保存','Unable to save progress'));
    progress();
  }));
  progress(); bindCopy();
}

async function ocean() {
  const {data,meta}=await get('token-offers');
  root.innerHTML=heading('COMPUTE OCEAN',t('算力海洋','Compute ocean'),t('点击水面投喂，移动指针扰动鱼群。带有厂商简称的鱼可以打开福利详情。','Scatter food, disturb the shoal, or select a labeled fish to open its offer.'))+
    '<div class="dark-panel ocean-panel"><canvas id="ocean-art" role="img" aria-label="'+t('字符画海洋，福利也可以从下方列表进入','ASCII ocean. Offers are also available below.')+
    '"></canvas><div class="ocean-note meta">ASCII · '+t('福利探索','OFFER EXPLORER')+'</div></div><section class="section" id="ocean-offers">'+
    section(t('厂商福利','Provider offers'),['/token-club',t('打开卡册 →','Open collection →')])+
    '<p class="tagline">'+status(meta)+'</p><div class="grid">'+data.map(offer=>'<div class="tile"><div class="tagline">'+pill(offer.mark)+offerStatus(offer)+'</div><h3>'+
    link('/token-club/'+offer.id,offer.provider+' · '+offer.name)+'</h3><p>'+esc(offer.amount)+'</p>'+
    button('/token-club/'+offer.id,t('查看福利 ↗','View offer ↗'))+'</div>').join('')+'</div></section>';
  oceanViz(document.getElementById('ocean-art'),data,id=>{
    const offer=data.find(o=>o.id===id);
    const bubble=document.querySelector('.ocean-note');
    bubble.style.pointerEvents='auto';
    bubble.innerHTML=button('/token-club/'+id,offer.provider+' · '+t('查看福利 ↗','View offer ↗'),'quiet');
  });
}
async function connect() {
  const endpoints=[
    ['cases','案例目录','/api/v1/cases?limit=10'],['news','资讯与事件','/api/v1/news?mode=all'],['sources','信源健康','/api/v1/sources/health'],
    ['graph','关系图谱','/api/v1/map/graph?window=7d'],['learn','学习路径','/api/v1/learn/tracks'],['offers','福利规则','/api/v1/token-offers']
  ];
  root.innerHTML=heading('CONNECT',t('API、RSS 与 Agent','API, RSS and agents'),t('公开内容采用 JSON 接口，响应附更新时间、状态和来源。','Public JSON responses include timestamps, status and sources.'))+
    '<div class="actions">'+button('/api/v1/feed.xml','RSS','dark')+button('/llms.txt','llms.txt')+button('/skills',t('浏览 Skills','Browse Skills'))+
    '</div><div class="section grid">'+endpoints.map(([key,label,to])=>'<div class="tile"><h3>'+esc(label)+'</h3><code id="api-'+key+'">'+esc(to)+
    '</code><div class="actions" style="margin-top:10px">'+external(to,t('查看 ↗','Open ↗'))+'<button class="button" data-copy="api-'+key+'">'+t('复制','Copy')+'</button></div></div>').join('')+'</div>';
  bindCopy();
}
async function search() {
  const q=params.get('q')||'';
  const [cases,news,tracks]=q?await Promise.all([dataOf(get('cases',{q,limit:9}),[]),dataOf(get('news',{q,mode:'all',limit:9}),[]),dataOf(get('learn/tracks',{q}),[])]):[[],[],[]];
  const learnResults=tracks;
  root.innerHTML=heading('SEARCH',t('全站搜索','Search the atlas'))+
    form(searchbox(t('关键词','Keyword'),t('搜索案例、资讯和课程','Search cases, news and lessons')),path,t('搜索','Search'))+
    (q?'<section class="section">'+section(t('案例','Cases'))+(cases.length?'<div class="grid">'+cases.map(caseCard).join('')+'</div>':empty(t('暂无结果','No results')))+
    '</section><section class="section">'+section(t('资讯','News'))+(news.length?'<div class="list">'+news.map(newsItem).join('')+'</div>':empty(t('暂无结果','No results')))+
    '</section><section class="section">'+section(t('课程','Lessons'))+(learnResults.length?'<div class="list">'+learnResults.map(item=>'<div class="row">'+link('/learn/articles/'+item.articleId,item.articleTitle)+'</div>').join('')+'</div>':empty(t('暂无结果','No results')))+
    '<div class="section actions">'+button(url('/map',{q}),t('在图谱中查找','Find on graph'))+button(url('/token-club',{q}),t('在福利中查找','Find offers'))+'</div></section>':'');
}

const routes = {
  '':home,cases:()=>parts[1]?caseDetail():catalog(),rankings:()=>catalog(true),retests,skills,
  creators:()=>caseGroup('creators'),models:()=>caseGroup('models'),daily,radar,map:graph,learn,'token-ocean':ocean,
  'token-club':()=>parts[1]?renderOffer(parts[1]):renderClub(),connect,admin:renderAdmin,submit:renderSubmit,search
};
refreshTop(routes[parts[0]]||home);
