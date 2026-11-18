import {test} from 'node:test';
import assert from 'node:assert/strict';
import worker from '../dist/server/index.js';
import {sqlite} from './sqlite.mjs';
import {parseFeed,cluster,computeGraph} from '../src/ingest.mjs';
import {periodKey,activeRecord} from '../web/ledger.js';

const url='https://atlas.local';
const DB=sqlite();
const who={'oai-authenticated-user-id':'reader','oai-authenticated-user-email':'reader@example.org'};
const admin={'oai-authenticated-user-id':'operator','oai-authenticated-user-email':'owner@example.org'};
const access={ATLAS_ADMIN_EMAIL:'owner@example.org',DB};
const pending=[];
const request=(path,options={})=>worker.fetch(new Request(url+path,options),access,{waitUntil:p=>pending.push(p)});
const send=(path,body,user,origin=url)=>request(path,{method:'POST',body:JSON.stringify(body),
  headers:{...user,'content-type':'application/json',origin}});
async function output(response){assert.equal(response.status,200);return response.json();}

test('serves six deep links, frontend, original case search and article',async()=>{
  for(const path of ['/','/cases','/cases/traceable-rag','/radar','/map','/map/3d','/learn','/learn/articles/coding-practice','/token-ocean','/token-club']){
    const response=await request(path);
    assert.equal(response.status,200);
    assert.match(await response.text(),/模型图鉴/);
  }
  assert.match(await (await request('/visuals.js')).text(),/webgl/);
  const catalog=await output(await request('/api/v1/cases?q=RAG'));
  assert.equal(catalog.data[0].id,'traceable-rag');
  assert.equal(catalog.data[0].heat,null);
  assert.match(await (await request('/skills/traceable-rag/SKILL.md')).text(),/claims/);
  assert.equal((await request('/api/v1/cases/unknown')).status,404);
});

test('parses RSS and Atom, preserves sources and computes observed heat',()=>{
  const now=new Date().toISOString(),when=new Date(Date.now()-200000).toISOString();
  const source={id:'a',label:'A',category:'开发者'};
  const rss=`<rss><channel><item><title><![CDATA[Codex and Gemini model update]]></title><link>https://example.org/1?utm_source=test&amp;ok=1</link><pubDate>${when}</pubDate></item></channel></rss>`;
  const atom=`<feed><entry><title>Codex and Gemini model update</title><link rel="alternate" href="https://example.org/2"/><updated>${when}</updated></entry></feed>`;
  const articles=[...parseFeed(rss,source,now),...parseFeed(atom,{...source,id:'b'},now)];
  assert.equal(articles.length,2);
  assert.equal(articles[0].url,'https://example.org/1?ok=1');
  const records=articles.map(a=>({title:a.title,title_key:a.titleKey,url:a.url,source_id:a.sourceId,label:a.sourceId,published_at:a.publishedAt,fetched_at:a.fetchedAt,category:a.category,ai_score:a.aiScore}));
  assert.equal(cluster(records)[0].sources.length,2);
  assert.ok(computeGraph(records,now).nodes.find(x=>x.id==='gemini').heat>0);
  assert.equal(computeGraph(records,now).nodes.find(x=>x.id==='deepseek').heat,null);
});

test('requires identity and same-origin writes, moderates cases and persists retests',async()=>{
  assert.equal((await request('/api/admin/overview')).status,401);
  assert.equal((await request('/api/admin/overview',{headers:who})).status,403);
  assert.equal((await send('/api/v1/submissions',{},who,'https://other.example')).status,403);
  assert.equal((await send('/api/admin/retests',{},who)).status,403);
  const sample={title:'集成检查案例',detail:'可公开的练习说明',category:'数据',url:'https://example.net'};
  const response=await send('/api/v1/submissions',sample,who);
  assert.equal(response.status,201);
  const {id}=await response.json();
  assert.equal((await send('/api/admin/review',{id,status:'已发布',rights:true},admin)).status,400);
  for(const status of ['待版权核验','待复测','已发布'])
    assert.equal((await send('/api/admin/review',{id,status,rights:true},admin)).status,200);
  assert.equal((await output(await request('/api/v1/cases?q=集成检查案例'))).data[0].id,id);
  const retest={caseId:id,model:'Model',version:'2026.1',parameters:'temperature=0',outcome:'人工失败',score:23,evidence:'https://example.net/test',note:'测试证据'};
  assert.equal((await send('/api/admin/retests',retest,admin)).status,201);
  assert.equal((await output(await request('/api/v1/cases/'+id))).data.stability,23);
  assert.equal((await output(await request('/api/v1/cases/'+id+'/retests'))).data[0].outcome,'人工失败');
  assert.equal((await output(await request('/api/admin/overview',{headers:admin}))).audits.length,4);
});

test('provider time zones and rolling records honor their boundaries',()=>{
  const at=Date.parse('2026-11-18T04:00:00Z');
  const google={id:'google',period:'daily',zone:'America/Los_Angeles'};
  assert.equal(periodKey(google,at),'2026-11-17');
  assert.equal(periodKey({period:'daily',zone:'UTC'},at),'2026-11-18');
  const row={offerId:'google',recordedAt:new Date(at).toISOString(),period:'2026-11-17'};
  assert.ok(activeRecord([row],google,at));
  assert.equal(activeRecord([row],google,Date.parse('2026-11-18T08:00:00Z')),undefined);
});

test('case popularity compares verified recent snapshots and leaves unknown scores empty',async()=>{
  const ids=['safe-change','tool-contract'];
  const now=Date.now();
  for(const [index,caseId] of ids.entries()){
    for(const [offset,likes] of [[4,12],[1,20+19*index]]){
      const result=await send('/api/admin/metrics',{caseId,platform:'GitHub',evidence:'https://example.net/evidence',
        capturedAt:new Date(now-offset*3600000).toISOString(),likes,comments:2,shares:1,bookmarks:0},admin);
      assert.equal(result.status,201);
    }
  }
  const ranking=await output(await request('/api/v1/rankings?type=heat&category='+encodeURIComponent('编程')));
  assert.equal(ranking.data.length,2);
  assert.equal(ranking.data[0].id,'tool-contract');
  assert.equal(ranking.data[0].heatEvidence.peerCount,2);
});

test('searches full Git-backed Markdown articles',async()=>{
  const matches=await output(await request('/api/v1/learn/tracks?q=validateCitation'));
  assert.equal(matches.data[0].id,'retrieval');
  const article=await output(await request('/api/v1/learn/articles/retrieval-practice'));
  assert.match(article.data.markdown,/function validateCitation/);
});
