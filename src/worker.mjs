import {cases, tracks, entities, relations, offers, sources, editorialAt} from './content.mjs';
import {all, one, run, updater, newsRows, cluster, computeGraph, httpsUrl, approvedHosts, titleKey, ensureSources} from './ingest.mjs';
import {rankCases} from './ranking.mjs';
import {shell, assets, lessons} from './generated.mjs';

const headers = {
  'x-content-type-options':'nosniff','referrer-policy':'strict-origin-when-cross-origin',
  'permissions-policy':'camera=(), microphone=(), geolocation=()',
  'content-security-policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; media-src 'self' https:; object-src 'none'; base-uri 'none'; form-action 'self'"
};
const hours = count=>count*3_600_000;
const error = (message,status=400)=>output({error:message},status,'no-store');
function output(data,status=200,cache='public, max-age=60') {
  return Response.json(data,{status,headers:{...headers,'cache-control':cache}});
}
function wrap(data,{asOf=null,dataStatus='fresh',sourceUrls=[],nextCursor=null,...extra}={}) {
  return {data,meta:{asOf,dataStatus,sourceUrls,nextCursor,...extra}};
}
const plain = (text,type='text/plain; charset=utf-8',cache='public, max-age=180') =>
  new Response(text,{headers:{...headers,'content-type':type,'cache-control':cache}});
const esc = text=>String(text??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[char]);
const categories = ['编程','数据','影像','文本'];
const reviewStates = ['待溯源','待版权核验','待复测','已发布','驳回','已处理'];
function identity(request, env) {
  const id=request.headers.get('oai-authenticated-user-id');
  const email=request.headers.get('oai-authenticated-user-email');
  if (!id) return {id:null,admin:false};
  return {id,admin:!!env.ATLAS_ADMIN_EMAIL && !!email && email.toLowerCase()===env.ATLAS_ADMIN_EMAIL.toLowerCase()};
}

async function caseData(db) {
  const published=db ? await all(db,'SELECT payload FROM published_cases ORDER BY published_at DESC') : [];
  return [...published.map(row=>JSON.parse(row.payload)),...cases];
}

function pageOptions(query) {
  const cursor=Number(query.get('cursor'));
  const limit=Math.min(60,Math.max(1,parseInt(query.get('limit'),10)||24));
  return {cursor:Number.isSafeInteger(cursor)&&cursor>=0?cursor:0,limit};
}

function page(items,query,extra={}) {
  const {cursor,limit}=pageOptions(query);
  return wrap(items.slice(cursor,cursor+limit),{...extra,total:items.length,nextCursor:cursor+limit<items.length?String(cursor+limit):null});
}

async function readAPI(path,query,db) {
  if (path==='/api/v1/retests') {
    const {cursor,limit}=pageOptions(query);
    const tests=db?await all(db,'SELECT * FROM retests ORDER BY tested_at DESC,id DESC LIMIT ? OFFSET ?',limit+1,cursor):[];
    return wrap(tests.slice(0,limit),{asOf:tests[0]?.tested_at??null,dataStatus:tests.length?'fresh':'partial',
      nextCursor:tests.length>limit?String(cursor+limit):null});
  }
  if (path==='/api/v1/cases' || path==='/api/v1/rankings' || path==='/api/v1/skills' || path==='/api/v1/daily' ||
    path.startsWith('/api/v1/cases/')) {
    const catalog=await caseData(db);
    const detail=path.match(/^\/api\/v1\/cases\/([^/]+)(?:\/(retests))?$/);
    if (path.startsWith('/api/v1/cases/') && !catalog.some(item=>item.id===detail?.[1])) return false;
    if (detail?.[2]) {
      const tests=db?await all(db,'SELECT * FROM retests WHERE case_slug=? ORDER BY tested_at DESC,id DESC LIMIT 250',detail[1]):[];
      return wrap(tests,{asOf:tests[0]?.tested_at??null,sourceUrls:[...new Set(tests.map(test=>test.evidence))]});
    }
    if (path==='/api/v1/skills') {
      return wrap(catalog.filter(item=>item.prompt).map(item=>({id:item.id,title:item.title,version:'1.0',skillsUrl:'/skills/'+item.id,source:item.source})),
        {asOf:catalog.map(item=>item.publishedAt).sort().at(-1)??editorialAt});
    }
    const [reviews,snapshots]=db?await Promise.all([
      all(db,`SELECT case_slug,AVG(score) AS average,COUNT(score) AS samples,MAX(tested_at) AS latest FROM retests
        WHERE score IS NOT NULL AND outcome IN ('人工成功','人工失败') GROUP BY case_slug`),
      all(db,`SELECT case_slug,captured_at,source,platform,likes,comments,shares,bookmarks FROM
        (SELECT *,ROW_NUMBER() OVER(PARTITION BY case_slug ORDER BY captured_at DESC) AS rn FROM case_metrics)
        WHERE rn<=2 ORDER BY captured_at DESC`)
    ]):[[],[]];
    const scores=new Map(reviews.map(review=>[review.case_slug,review]));
    const items=rankCases(catalog,snapshots).map(item=>{
      const review=scores.get(item.id);
      return {...item,stability:review?Math.round(review.average):null,stabilitySamples:review?.samples??0};
    });
    const asOf=items.map(item=>item.publishedAt).sort().at(-1)??editorialAt;
    if (path==='/api/v1/daily') {
      const period=query.get('period')??'day';
      const days=period==='month'?30:period==='week'?7:1;
      const cutoff=new Date(Date.now()-hours(24*days)).toISOString();
      const [tests,news]=db?await Promise.all([
        all(db,'SELECT * FROM retests WHERE tested_at>=? ORDER BY tested_at DESC,id DESC LIMIT 250',cutoff),newsRows(db,cutoff)
      ]):[[],[]];
      return wrap({period,cases:items.filter(i=>i.publishedAt>=cutoff),retests:tests,news:cluster(news).slice(0,20)},
        {asOf:new Date().toISOString(),dataStatus:db?'fresh':'partial'});
    }
    if (detail) {
      const item=items.find(i=>i.id===detail[1]);
      return wrap(item,{asOf,sourceUrls:item.source?[item.source]:[]});
    }
    const q=(query.get('q')??'').trim().toLowerCase().slice(0,150);
    const category=query.get('category');
    const model=query.get('model');
    const source=query.get('source');
    const sourceHost=query.get('sourceHost');
    const creator=query.get('creator');
    const ids=query.has('ids')?new Set(query.get('ids').split(',').slice(0,60)):null;
    const tag=query.get('tag');
    const period=query.get('period');
    const since=period==='7d'||period==='30d' ? new Date(Date.now()-hours(period==='7d'?168:720)).toISOString() : '';
    const ranking=path.endsWith('rankings');
    const requestedType=query.get('type');
    const type=['heat','stability'].includes(requestedType)?requestedType:'heat';
    const sort=ranking?type:query.get('sort');
    const host=item=>httpsUrl(item.source)?.hostname;
    const rows=items.filter(i=>(!q||[i.title,i.enTitle,i.summary,i.author,i.prompt,i.enPrompt,i.model].join(' ').toLowerCase().includes(q)) &&
      (!category||i.category===category)&&(!model||i.model.toLowerCase()===model.toLowerCase())&&
      (!source||i.source?.includes(source))&&(!sourceHost||host(i)===sourceHost)&&(!creator||i.authorId===creator)&&
      (!ids||ids.has(i.id))&&(!tag||i.track===tag)&&i.publishedAt>=since);
    const sorted=rows.sort((a,b)=>{
      if (sort==='heat'||sort==='stability') return (b[sort]??-1)-(a[sort]??-1);
      return b.publishedAt.localeCompare(a.publishedAt);
    });
    const ranked=ranking?sorted.filter(i=>i[type]!=null):sorted;
    const update=ranking?ranked.map(item=>type==='heat'?item.heatEvidence?.asOf:scores.get(item.id)?.latest)
      .filter(Boolean).sort().at(-1)??null:asOf;
    const facets=query.get('facets')==='1'?{
      models:[...new Set(items.map(i=>i.model))].sort(),
      sources:[...new Set(items.map(host).filter(Boolean))].sort(),
      tags:[...new Set(items.map(i=>i.track).filter(Boolean))].sort()
    }:null;
    return page(ranked,query,{asOf:update,dataStatus:ranking&&!ranked.length?'partial':'fresh',...(facets?{facets}:{})});
  }
  if (path==='/api/v1/learn/tracks') return wrap(tracks.filter(track=>!query.get('q')||[track.title,track.summary,track.articleTitle,track.tag,lessons[track.id]]
    .join(' ').toLowerCase().includes(query.get('q').toLowerCase().slice(0,150))),{asOf:editorialAt,sourceUrls:tracks.map(t=>t.source)});
  if (path.startsWith('/api/v1/learn/articles/')) {
    const item=tracks.find(t=>t.articleId===path.split('/').at(-1));
    return item?wrap({...item,markdown:lessons[item.id]},{asOf:editorialAt,sourceUrls:[item.source]}):false;
  }
  if (path.startsWith('/api/v1/token-offers')) {
    const id=path.match(/^\/api\/v1\/token-offers\/([^/]+)\/history$/)?.[1];
    if (id) {
      if (!offers.some(x=>x.id===id)) return false;
      return wrap(db?await all(db,'SELECT * FROM offer_history WHERE id=? ORDER BY at DESC LIMIT 30',id):[],{dataStatus:db?'fresh':'partial'});
    }
    if (path!=='/api/v1/token-offers') return false;
    const checks=db?await all(db,'SELECT * FROM offer_checks'):[];
    const data=offers.filter(x=>query.get('apiUsable')!=='true'||x.apiUsable).map(offer=>{
      const c=checks.find(check=>check.id===offer.id);
      const {check,...rest}=offer;
      return {...rest,status:offer.validUntil && Date.parse(offer.validUntil)<Date.now()?'expired':c?.status??'editorial',
        lastVerifiedAt:c?.verified_at??offer.verifiedAt,checkedAt:c?.checked_at??null,checkDetail:c?.detail??'依据厂商公开文档编辑'};
    });
    return wrap(data,{asOf:checks.map(c=>c.checked_at).sort().at(-1)??editorialAt,sourceUrls:offers.map(o=>o.source),
      dataStatus:data.every(o=>o.status==='verified')?'fresh':'partial'});
  }
  if (path==='/api/v1/models/rankings') return wrap([],{dataStatus:'partial'});
  if (path==='/api/v1/sources/health') {
    const data=db?await all(db,'SELECT id,label,url,category,checked_at,success_at,attempts,failures,consecutive_failures,error,enabled FROM sources ORDER BY label'):[];
    return wrap(data.length?data:sources.map(s=>({...s,enabled:1})),{asOf:data.map(s=>s.checked_at).filter(Boolean).sort().at(-1)??null,
      sourceUrls:sources.map(s=>s.url),dataStatus:data.length&&data.every(s=>s.success_at&&!s.error)?'fresh':'partial'});
  }
  if (path==='/api/v1/map/graph'||path==='/api/v1/map/terrain') {
    const window=query.get('window')==='24h'?'24h':'7d';
    const snapshot=db?await one(db,'SELECT as_of,payload FROM graph_snapshots WHERE window=?',window):null;
    const graph=snapshot?JSON.parse(snapshot.payload):{nodes:entities.map(n=>({...n,heat:null,change:null,count:0,news:[]})),edges:relations.map(([from,to,type])=>({from,to,type,weight:1,evidence:[]}))};
    return wrap(graph,{asOf:snapshot?.as_of??null,dataStatus:snapshot&&graph.nodes.some(n=>n.heat!==null)?'fresh':'partial'});
  }
  if (path==='/api/v1/news' || path.startsWith('/api/v1/news/clusters/')) {
    const found=db?cluster(await newsRows(db,new Date(Date.now()-hours(24*45)).toISOString())):[];
    if (path!=='/api/v1/news') {
      const item=found.find(item=>item.id===decodeURIComponent(path.split('/').at(-1)));
      return item?wrap(item,{asOf:item.sources.map(s=>s.fetchedAt).sort().at(-1),sourceUrls:item.sources.map(s=>s.url)}):false;
    }
    const health=db?await all(db,'SELECT success_at,error FROM sources WHERE enabled=1'):[];
    const q=(query.get('q')??'').toLowerCase().slice(0,150);
    const category=query.get('category');
    const source=query.get('source');
    const story=query.get('story');
    const curated=query.get('mode')!=='all';
    const list=found.filter(n=>(!story||n.id===story) && (!q||[n.title,...n.sources.map(s=>s.title+' '+s.source)].join(' ').toLowerCase().includes(q)) &&
      (!category||n.category===category) && (!source||n.sources.some(s=>s.sourceId===source)) &&
      (!curated||story||q||n.score>=90||n.sources.length>1));
    const asOf=health.map(s=>s.success_at).filter(Boolean).sort().at(-1)??null;
    const dataStatus=!asOf?'partial':Date.now()-Date.parse(asOf)>hours(2)?'stale':health.some(s=>s.error||!s.success_at)?'partial':'fresh';
    return page(list,query,{asOf,dataStatus,sourceUrls:[...new Set(list.flatMap(x=>x.sources.map(s=>s.url)))].slice(0,24)});
  }
  return false;
}

async function audit(db,id,action,target,stamp) {
  return db.prepare('INSERT INTO audit VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),id,action,target,stamp);
}

function allowedOrigin(request,url) {
  const origin=request.headers.get('origin');
  return origin===url.origin && request.headers.get('sec-fetch-site')!=='cross-site';
}

async function jsonInput(request) {
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new Error('仅接受 JSON');
  if (Number(request.headers.get('content-length'))>12000) throw new Error('内容过长');
  const reader=request.body?.getReader();
  if (!reader) throw new Error('内容为空');
  const decoded=new TextDecoder();
  let size=0,input='';
  try {
    for (;;) {
      const {value,done}=await reader.read();
      if (done) break;
      size+=value.length;
      if (size>12000) throw new Error('内容过长');
      input+=decoded.decode(value,{stream:true});
    }
  } finally { await reader.cancel().catch(()=>{}); }
  const value=JSON.parse(input+decoded.decode());
  if (!value || Array.isArray(value) || typeof value!=='object') throw new Error('无效内容');
  return value;
}
const getText=(body,key,max=500)=>typeof body[key]==='string'?body[key].trim().slice(0,max):'';

async function writeAPI(request,env,url,user) {
  if (!allowedOrigin(request,url)) return error('请求来源无效',403);
  if (!user.id) return error('请先使用 ChatGPT 登录',401);
  const db=env.DB;
  if (!db) return error('数据库暂不可用',503);
  const path=url.pathname,now=new Date().toISOString();
  if (path!=='/api/v1/submissions' && !user.admin) return error('仅限管理员',403);
  let body;
  try { body=await jsonInput(request); } catch { return error('无效 JSON 或内容过长'); }
  if (path==='/api/v1/submissions') {
    const kind=body.kind==='correction'?'correction':'case',title=getText(body,'title',120),detail=getText(body,'detail',3500);
    const link=httpsUrl(getText(body,'url',1000));
    const category=getText(body,'category',20);
    if (!title||!link||!detail||!categories.includes(category)) return error('请填写标题、HTTPS 来源、分类和说明');
    const count=await one(db,'SELECT COUNT(*) AS n FROM submissions WHERE user_id=? AND created_at>?',user.id,new Date(Date.now()-hours(1)).toISOString());
    if (count.n>=6) return error('提交次数已达每小时上限',429);
    const id=crypto.randomUUID();
    await run(db,'INSERT INTO submissions VALUES(?,?,?,?,?,?,?,?,?,?)',id,kind,user.id,title,link.href,detail,category,'待溯源',now,now);
    return output({id,status:'待溯源'},201,'no-store');
  }
  if (path==='/api/admin/refresh') {
    const result=await updater(db,{force:true,kind:['all','news','offers'].includes(body.kind)?body.kind:'all'});
    return output(result,200,'no-store');
  }
  if (path==='/api/admin/sources') {
    const existing=getText(body,'id',100);
    if (existing) {
      const found=await one(db,'SELECT id FROM sources WHERE id=?',existing);
      if (!found||typeof body.enabled!=='boolean') return error('无效信源');
      await db.batch([db.prepare('UPDATE sources SET enabled=? WHERE id=?').bind(Number(body.enabled),existing),
        await audit(db,user.id,body.enabled?'开启信源':'暂停信源',existing,now)]);
    } else {
      const label=getText(body,'label',80),source=httpsUrl(getText(body,'url',1000)),category=getText(body,'category',20);
      if (!label||!source||!approvedHosts.has(source.hostname)||source.port||!['模型','产品','开发者','行业','论文','社区'].includes(category)) return error('需要从允许的官方域名填写 HTTPS RSS 或 Atom 链接');
      const id=crypto.randomUUID();
      const result=await db.batch([db.prepare('INSERT INTO sources(id,label,url,category) VALUES(?,?,?,?) ON CONFLICT(url) DO NOTHING').bind(id,label,source.href,category),
        db.prepare(`INSERT INTO audit SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM sources WHERE id=?)`).bind(crypto.randomUUID(),user.id,'新增信源',id,now,id)]);
      if (!result[0].meta.changes) return error('该信源已存在',409);
    }
    return output({ok:true},200,'no-store');
  }
  if (path==='/api/admin/review') {
    const row=await one(db,'SELECT * FROM submissions WHERE id=?',getText(body,'id',50));
    const status=getText(body,'status',30);
    if (!row||!reviewStates.includes(status)||row.status==='已发布'||(row.kind==='correction'&&status==='已发布')) return error('无效审核操作');
    const actions=[];
    const expected={'待溯源':'待版权核验','待版权核验':'待复测','待复测':'已发布'};
    if (status!=='驳回' && row.kind==='case' && expected[row.status]!==status) return error('审核步骤已变化，请刷新');
    if (status==='已发布') {
      if (body.rights!==true) return error('发布前必须确认内容权属');
      const item={id:row.id,title:row.title,category:row.category,summary:row.detail.slice(0,200),prompt:row.detail,
        author:'审核通过的投稿',authorId:'community',model:getText(body,'model',50)||'未指定',source:row.url,
        publishedAt:now,verifiedAt:now,rightsStatus:'人工核验',theme:'violet',input:'',output:'',heat:null,stability:null};
      actions.push(db.prepare(`INSERT INTO published_cases SELECT ?,?,? WHERE EXISTS
        (SELECT 1 FROM submissions WHERE id=? AND status=?)`).bind(item.id,JSON.stringify(item),now,row.id,row.status));
    }
    await db.batch([...actions,db.prepare('UPDATE submissions SET status=?,updated_at=? WHERE id=? AND status=?').bind(status,now,row.id,row.status),
      db.prepare(`INSERT INTO audit SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM submissions WHERE id=? AND updated_at=?)`)
        .bind(crypto.randomUUID(),user.id,'审核 '+status,row.id,now,row.id,now)]);
    return output({ok:true},200,'no-store');
  }
  if (path==='/api/admin/metrics') {
    const slug=getText(body,'caseId',100),platform=getText(body,'platform',70).toLowerCase(),evidence=httpsUrl(getText(body,'evidence',1000));
    const captured=Date.parse(getText(body,'capturedAt',40));
    const counts=['likes','comments','shares','bookmarks'].map(key=>body[key]);
    if(!(await caseData(db)).some(item=>item.id===slug)||!platform||!evidence||!Number.isFinite(captured)||
      captured>Date.now()||Date.now()-captured>hours(24*60)||
      counts.some(value=>!Number.isSafeInteger(value)||value<0||value>1_000_000_000)) return error('请填写有效案例、平台、UTC 快照时间、来源与完整互动数');
    const stamp=new Date(captured).toISOString();
    const [result]=await db.batch([
      db.prepare('INSERT INTO case_metrics VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(case_slug,captured_at) DO NOTHING')
        .bind(slug,stamp,user.id,evidence.href,platform,...counts),
      db.prepare('INSERT INTO audit SELECT ?,?,?,?,? WHERE changes()>0')
        .bind(crypto.randomUUID(),user.id,'记录互动快照',slug,now)
    ]);
    return result.meta.changes?output({ok:true},201,'no-store'):error('该时间已有互动快照',409);
  }
  if (path==='/api/admin/retests') {
    const slug=getText(body,'caseId',100),model=getText(body,'model',70),version=getText(body,'version',70);
    const note=getText(body,'note',2000),parameters=getText(body,'parameters',1500),evidence=httpsUrl(getText(body,'evidence',1000));
    const outcome=getText(body,'outcome',30),cost=getText(body,'cost',60);
    const score=body.score;
    if (!(await caseData(db)).some(i=>i.id===slug)||!model||!version||!parameters||!evidence||!note||
      !['人工成功','人工失败','待人工判定'].includes(outcome)||(score!==null&&!(typeof score==='number'&&score>=0&&score<=100))) return error('字段不全或评分无效');
    const id=crypto.randomUUID();
    await db.batch([db.prepare('INSERT INTO retests VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind(id,slug,model,version,parameters,outcome,score,evidence.href,note,cost||null,now),
      await audit(db,user.id,'记录复测',id,now)]);
    return output({id},201,'no-store');
  }
  return error('接口不存在',404);
}

async function adminRead(db) {
  if (!db) return error('数据库暂不可用',503);
  await ensureSources(db);
  const [submissions,audits,health,tests]=await Promise.all([
    all(db,'SELECT id,kind,title,url,detail,category,status,created_at FROM submissions ORDER BY created_at DESC LIMIT 70'),
    all(db,'SELECT action,target,created_at FROM audit ORDER BY created_at DESC LIMIT 30'),
    all(db,'SELECT id,label,url,category,checked_at,success_at,attempts,failures,error,enabled FROM sources ORDER BY label'),
    all(db,'SELECT * FROM retests ORDER BY tested_at DESC LIMIT 30')
  ]);
  return output({submissions,audits,health,tests,approvedHosts:[...approvedHosts]},200,'no-store');
}

async function startUpdate(db,ctx) {
  const now=Date.now();
  const next=await run(db,`INSERT INTO settings VALUES('background_after',?)
      ON CONFLICT(key) DO UPDATE SET value=excluded.value WHERE CAST(settings.value AS INTEGER) < ?`,String(now+hours(.5)),now);
  if (next.meta.changes) await updater(db);
}

const publicPaths=/^\/(?:cases(?:\/[^/]+)?|rankings|retests|skills(?:\/[^/]+)?|creators\/[^/]+|models\/[^/]+|daily|radar|map(?:\/3d)?|learn(?:\/(?:tracks|articles)\/[^/]+)?|token-ocean|token-club(?:\/[^/]+)?|connect|admin|submit|search)?$/;
const titles={'/cases':'案例库','/rankings':'排行榜','/radar':'资讯雷达','/map':'热点图谱','/map/3d':'热点地形','/learn':'实践课程','/token-ocean':'算力海洋','/token-club':'福利卡册','/admin':'管理后台'};

export default {
  async fetch(request,env,ctx) {
    const url=new URL(request.url);
    const path=url.pathname.replace(/\/$/,'')||'/';
    try {
      if (path==='/favicon.ico'||path==='/favicon.png') {
        return plain(Uint8Array.from(atob(assets['/favicon.png'][1]),char=>char.charCodeAt(0)),'image/png');
      }
      if (Object.hasOwn(assets,path)) {
        const [type,body]=assets[path];
        return plain(body,type);
      }
      if (path==='/robots.txt') return plain('User-agent: *\nDisallow: /admin\nDisallow: /api/admin\n');
      if (path==='/llms.txt') return plain('# 模型图鉴 · Model Atlas\n\nAI 实践案例、新闻、图谱、教程与福利索引。\n\n'+
        ['cases','retests','news','map/graph','learn/tracks','token-offers','feed.xml'].map(item=>'- '+url.origin+'/api/v1/'+item).join('\n'));
      if (path.startsWith('/api/')) {
        const user=identity(request,env);
        if (request.method==='POST') return await writeAPI(request,env,url,user);
        if (request.method!=='GET'&&request.method!=='HEAD') return error('方法不支持',405);
        if (path==='/api/v1/session') return output({signedIn:!!user.id,admin:user.admin},200,'private, no-store');
        if (path.startsWith('/api/admin')) return user.admin?await adminRead(env.DB):error(user.id?'仅限管理员':'请先登录',user.id?403:401);
        if (env.DB && ['/api/v1/news','/api/v1/token-offers','/api/v1/map/graph','/api/v1/map/terrain'].includes(path)) {
          ctx.waitUntil(startUpdate(env.DB,ctx).catch(e=>console.error('Update failed',e.message)));
        }
        if (path==='/api/v1/feed.xml') {
          const data=env.DB?cluster(await newsRows(env.DB,new Date(Date.now()-hours(24*14)).toISOString())).slice(0,30):[];
          return plain('<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>模型图鉴资讯雷达</title><link>'+esc(url.origin)+'</link><description>公开 AI 新闻来源索引</description>'+
            data.map(x=>'<item><title>'+esc(x.title)+'</title><link>'+esc(x.sources[0].url)+'</link><guid>'+esc(x.sources[0].url)+'</guid><pubDate>'+new Date(x.publishedAt).toUTCString()+'</pubDate></item>').join('')+
            '</channel></rss>','application/rss+xml; charset=utf-8');
        }
        const response=await readAPI(path,url.searchParams,env.DB);
        return response?output(response):error('资源不存在',404);
      }
      if (path.startsWith('/skills/') && path.endsWith('/SKILL.md')) {
        const item=(await caseData(env.DB)).find(i=>i.id===path.split('/')[2]);
        if (!item) return error('技能不存在',404);
        return plain('---\nname: '+item.id+'\ndescription: '+JSON.stringify(item.summary)+'\n---\n\n# '+item.title+'\n\n'+item.prompt+'\n\n参考：'+item.source+'\n','text/markdown; charset=utf-8');
      }
      if (!publicPaths.test(path)) return new Response('页面不存在',{status:404,headers});
      const locale=url.searchParams.get('lang');
      const title=titles[path];
      return plain(shell.replace('<html lang="zh-CN">',locale==='en'?'<html lang="en">':'<html lang="zh-CN">')
        .replace('<title>模型图鉴 · Model Atlas</title>',title?'<title>'+title+' | 模型图鉴</title>':'<title>模型图鉴 · Model Atlas</title>'),
        'text/html; charset=utf-8',path==='/admin'?'private, no-store':'public, max-age=120');
    } catch (failure) {
      console.error('Request failed',path,failure.message);
      return error('服务暂时不可用，请稍后重试',503);
    }
  }
};
