import {entities, offers, relations, sources} from './content.mjs';

export const all = async (db, sql, ...values) => (await db.prepare(sql).bind(...values).all()).results;
export const one = (db, sql, ...values) => db.prepare(sql).bind(...values).first();
export const run = (db, sql, ...values) => db.prepare(sql).bind(...values).run();
const hours = (count) => count * 3_600_000;
const stamp = () => new Date().toISOString();
const privateFeedKey = 'editorial_subscription';
const privateFeedHosts = new Set(['aihot.news']);

export function httpsUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' && !url.username && !url.password) return url;
  } catch {}
  return null;
}

function decode(value) {
  return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1')
    .replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (entity, code) => {
      if (code.startsWith('#')) {
        const number = code[1]?.toLowerCase() === 'x' ? parseInt(code.slice(2),16) : Number(code.slice(1));
        return number > 0 && number <= 0x10ffff ? String.fromCodePoint(number) : ' ';
      }
      return ({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '})[code.toLowerCase()] ?? entity;
    });
}
const clean = value => decode(value).replace(/<[^>]*>/g, ' ').replace(/\s+/g,' ').trim();
export const titleKey = title => title.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();

export function classify(title, fallback) {
  if (/\b(paper|research|benchmark|reasoning study)\b/i.test(title)) return '论文';
  if (/\b(model|gemini|claude|gpt[ -]?\d|llama|deepseek)\b/i.test(title)) return '模型';
  if (/\b(sdk|api|github|codex|mcp|agent|toolkit|copilot)\b/i.test(title)) return '开发者';
  if (/\b(app|launch|introducing|beta|release)\b/i.test(title)) return '产品';
  return fallback;
}

export function parseFeed(xml, source, fetchedAt) {
  if (!/<(?:rss|feed|rdf:RDF)\b/i.test(xml)) throw new Error('响应不是 RSS 或 Atom');
  const entries = [...xml.matchAll(/<(item|entry)\b[^>]*>([\s\S]*?)<\/\1>/gi)].slice(0,40);
  if (!entries.length) throw new Error('Feed 无可解析条目');
  return entries.flatMap(([,kind,entry]) => {
    const field = key => entry.match(new RegExp('<'+key+'\\b[^>]*>([\\s\\S]*?)<\\/'+key+'>','i'))?.[1] ?? '';
    const title = clean(field('title')).slice(0,320);
    const alternate = [...entry.matchAll(/<link\b([^>]*)>/gi)]
      .map(([,attrs])=>attrs).find(attrs=>/href\s*=/.test(attrs) && !/rel\s*=\s*["'](?:self|enclosure)/i.test(attrs));
    const url = httpsUrl(decode(((kind.toLowerCase()==='entry' ? alternate?.match(/href\s*=\s*["']([^"']+)/i)?.[1] : field('link')) ?? '').trim()));
    const date = new Date(clean(field('pubDate') || field('published') || field('updated') || field('dc:date')));
    if (!title || !url || !Number.isFinite(+date) || +date > Date.now()+hours(1)) return [];
    url.hash = '';
    for (const key of [...url.searchParams.keys()]) if (/^(utm_|fbclid$)/i.test(key)) url.searchParams.delete(key);
    const relevant = /\b(ai|llm|mcp|gpt|gemini|claude|copilot|codex|model|agents?|inference|machine learning|vllm|qwen|deepseek)\b/i.test(title);
    if (source.id === 'cloudflare' && !relevant) return [];
    return [{url:url.href,sourceId:source.id,title,titleKey:titleKey(title),publishedAt:date.toISOString(),fetchedAt,
      category:classify(title,source.category), aiScore: relevant ? 95 : 70}];
  });
}

async function cappedText(response, limit) {
  const stream = response.body?.getReader();
  if (!stream) return '';
  let size = 0;
  let result = '';
  const decoder = new TextDecoder();
  try {
    for (;;) {
      const {value,done} = await stream.read();
      if (done) return result + decoder.decode();
      size += value.byteLength;
      if (size > limit) throw new Error('响应超出大小限制');
      result += decoder.decode(value,{stream:true});
    }
  } finally { await stream.cancel().catch(()=>{}); }
}

export const approvedHosts = new Set([
  ...sources.map(s=>new URL(s.url).hostname), ...offers.map(o=>new URL(o.check).hostname),
  'www.openai.com','www.huggingface.co','www.github.blog','www.deepmind.google','blogs.microsoft.com','azure.microsoft.com'
]);

async function originFetch(url, headers = {}, hosts = approvedHosts) {
  const signal = AbortSignal.timeout(7000);
  let target=httpsUrl(url);
  for (let hop=0;hop<4;hop++) {
    if (!target || !hosts.has(target.hostname) || target.port) throw new Error('信源域名不在允许范围');
    const response=await fetch(target,{headers,redirect:'manual',signal});
    if (![301,302,303,307,308].includes(response.status)) return response;
    const next=response.headers.get('location');
    await response.body?.cancel();
    if (!next) throw new Error('信源没有提供重定向目标');
    target=httpsUrl(new URL(next,target).href);
  }
  throw new Error('信源重定向次数过多');
}

export async function ensureSources(db) {
  return db.batch(sources.map(s => db.prepare(
    'INSERT INTO sources(id,label,url,category) VALUES(?,?,?,?) ON CONFLICT(id) DO NOTHING'
  ).bind(s.id,s.label,s.url,s.category)));
}

async function ingestSource(db, source) {
  const at = stamp();
  try {
    const headers = {Accept:'application/rss+xml, application/atom+xml, application/xml, text/xml'};
    if (source.etag) headers['If-None-Match'] = source.etag;
    if (source.modified) headers['If-Modified-Since'] = source.modified;
    const response = await originFetch(source.url,headers);
    if (!response.ok && response.status!==304) throw new Error('HTTP '+response.status);
    const items = response.status===304 ? [] : parseFeed(await cappedText(response,4_000_000),source,at);
    if (!items.length && response.status!==304 && source.id!=='cloudflare') throw new Error('没有通过校验的条目');
    await db.batch([
      ...items.map(item => db.prepare(`INSERT INTO news VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(url) DO UPDATE SET
        title=excluded.title,title_key=excluded.title_key,category=excluded.category,ai_score=excluded.ai_score`).bind(
        item.url,item.sourceId,item.title,item.titleKey,item.publishedAt,item.fetchedAt,item.category,item.aiScore)),
      db.prepare(`UPDATE sources SET checked_at=?,success_at=?,attempts=attempts+1,consecutive_failures=0,
        error=NULL,etag=?,modified=? WHERE id=?`).bind(at,at,response.headers.get('etag')||source.etag,response.headers.get('last-modified')||source.modified,source.id),
      db.prepare('INSERT OR REPLACE INTO source_snapshots VALUES(?,?,?,?)').bind(source.id,at,items.length,response.status===304?'unchanged':'ok')
    ]);
  } catch (error) {
    const detail = error instanceof Error ? error.message.slice(0,150) : '读取失败';
    await db.batch([
      db.prepare('UPDATE sources SET checked_at=?,attempts=attempts+1,failures=failures+1,consecutive_failures=consecutive_failures+1,error=? WHERE id=?').bind(at,detail,source.id),
      db.prepare('INSERT OR REPLACE INTO source_snapshots VALUES(?,?,?,?)').bind(source.id,at,0,'failed')
    ]);
  }
}

function privateFeedUrl(value) {
  const url = httpsUrl(value);
  return url && privateFeedHosts.has(url.hostname) && !url.port ? url.href : null;
}

async function privateFeedState(db, url) {
  const row = await one(db,'SELECT value FROM settings WHERE key=?',privateFeedKey);
  const state = row && JSON.parse(row.value);
  return state?.url === url ? state : {url};
}

function privateFeedItems(xml, url, at) {
  if (!/<item\b/i.test(xml)) return [];
  const host = new URL(url).hostname;
  return parseFeed(xml,{id:'editorial',category:'行业'},at).filter(item=>new URL(item.url).hostname===host);
}

export async function privateSubscription(db, configuredUrl) {
  const url = privateFeedUrl(configuredUrl);
  if (!url) return null;
  const {xml,checkedAt,successAt,error} = await privateFeedState(db,url);
  const items = xml && Date.now()-Date.parse(successAt)<hours(24) ? privateFeedItems(xml,url,successAt) : [];
  return {url,checkedAt,successAt,error,items:items.slice(0,12).map(({title,url,publishedAt})=>({title,url,publishedAt}))};
}

async function refreshPrivateSubscription(db, configuredUrl, now, at) {
  const url = privateFeedUrl(configuredUrl);
  if (!url) return;
  const state = await privateFeedState(db,url);
  if (now < (state.retryAt ?? 0)) return;
  const next = {...state,checkedAt:at,retryAt:now+hours(.5)};
  try {
    const headers = {Accept:'application/rss+xml, application/xml, text/xml'};
    if (state.xml && state.etag) headers['If-None-Match'] = state.etag;
    if (state.xml && state.modified) headers['If-Modified-Since'] = state.modified;
    const response = await originFetch(url,headers,privateFeedHosts);
    if (response.status!==304 || !state.xml) {
      if (!response.ok) {
        const retryAfter = response.headers.get('retry-after');
        const retryAt = /^\d+$/.test(retryAfter ?? '') ? now+Number(retryAfter)*1000 : Date.parse(retryAfter);
        if (Number.isFinite(retryAt)) next.retryAt = Math.max(next.retryAt,retryAt);
        await response.body?.cancel();
        throw new Error('HTTP '+response.status);
      }
      const xml = await cappedText(response,500_000);
      if (!/<rss\b/i.test(xml) || !/<\/rss>\s*$/i.test(xml)) throw new Error('响应不是完整的 RSS');
      if (/<item\b/i.test(xml) && !privateFeedItems(xml,url,at).length) throw new Error('没有通过校验的条目');
      next.xml = xml;
      next.etag = response.headers.get('etag');
      next.modified = response.headers.get('last-modified');
    }
    next.successAt = at;
    next.error = null;
  } catch (error) {
    next.error = error instanceof Error ? error.message.slice(0,150) : '读取失败';
    next.retryAt = Math.max(next.retryAt,now+hours(1));
    if (now-Date.parse(next.successAt)>=hours(24)) delete next.xml;
  }
  const {xml,...metadata} = next;
  await run(db,'INSERT OR REPLACE INTO settings VALUES(?,?)',privateFeedKey,JSON.stringify({...metadata,xml}));
}

async function sha(text) {
  const bytes = await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));
  return Array.from(new Uint8Array(bytes),byte=>byte.toString(16).padStart(2,'0')).join('').slice(0,24);
}

const offerMarkers = {
  'cloudflare-workers-ai': /10,000\s+Neurons/i,
  'gemini-developer': /free(?:\s|[-_])tier/i
};

async function checkOffer(db, offer) {
  const at = stamp();
  const previous = await one(db,'SELECT * FROM offer_checks WHERE id=?',offer.id);
  let status, detail, fingerprint = null, verifiedAt = previous?.verified_at ?? null;
  try {
    const response = await originFetch(offer.check);
    if (!response.ok) throw new Error('HTTP '+response.status);
    const body = await cappedText(response,4_000_000);
    if (offer.id==='openrouter-free') {
      const ids = JSON.parse(body).data.filter(model=>model.id.endsWith(':free') && Number(model.pricing?.prompt)===0 && Number(model.pricing?.completion)===0)
        .map(model=>model.id).sort();
      if (!ids.length) throw new Error('目录中未识别到免费模型');
      fingerprint = await sha(ids.join('\n'));
      detail = '官方模型目录包含 '+ids.length+' 个免费文本模型。';
    } else {
      const normalized = clean(body.replace(/<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>/gi,' '));
      if (!offerMarkers[offer.id]?.test(normalized)) {
        status = 'review';
        detail = '厂商页面的公开规则有变化或无法识别，请核对原文。';
      } else {
        fingerprint = await sha(normalized.match(offerMarkers[offer.id])[0].toLowerCase());
        detail = '厂商页面保留了对应规则。';
      }
    }
    if (!status) { status='verified'; verifiedAt=at; }
  } catch {
    status='stale';
    detail='本次无法核验厂商来源，保留上次确认结果。';
  }
  await db.batch([
    db.prepare('INSERT OR REPLACE INTO offer_checks VALUES(?,?,?,?,?,?)').bind(offer.id,at,verifiedAt,status,detail,fingerprint ?? previous?.fingerprint ?? null),
    ...(status!==previous?.status || (fingerprint && fingerprint!==previous?.fingerprint) ?
      [db.prepare('INSERT OR REPLACE INTO offer_history VALUES(?,?,?,?,?)').bind(offer.id,at,status,detail,fingerprint)] : [])
  ]);
}

const stopwords = new Set(['with','from','the','and','for','new','this','your','that','into','now','our','its','using','how','can','what','are','you']);
const words = value => new Set(value.split(' ').filter(word=>word.length>2 && !stopwords.has(word)));
function likeness(left,right) {
  const a=words(left), b=words(right);
  let hits=0;
  for (const word of a) if (b.has(word)) hits++;
  return hits>=3 ? hits/(a.size+b.size-hits) : 0;
}

export function cluster(rows) {
  const groups = [];
  const byTitle = new Map();
  for (const row of rows) {
    const key=row.title_key;
    let group=byTitle.get(key);
    if (!group) group=groups.find(item=>Math.abs(Date.parse(item.publishedAt)-Date.parse(row.published_at))<hours(72) && likeness(key,item.key)>=0.72);
    const article={sourceId:row.source_id,source:row.label,title:row.title,url:row.url,
      publishedAt:row.published_at,fetchedAt:row.fetched_at};
    if (!group) {
      group={id:key.replaceAll(' ','-').slice(0,140),key,title:row.title,category:row.category,publishedAt:row.published_at,
        score:row.ai_score,sources:[]};
      groups.push(group);
    }
    if (!group.sources.some(a=>a.url===article.url)) group.sources.push(article);
    byTitle.set(key,group);
  }
  return groups.map(({key,...group})=>({...group,entities:matchingEntities(group.sources),
    matchNote:group.sources.length>1?'根据标题与发布时间合并':'单条来源'}));
}

export const newsRows = (db,since) => all(db,`SELECT n.*,s.label FROM news n JOIN sources s ON s.id=n.source_id
  WHERE n.published_at>=? AND s.enabled=1 ORDER BY n.published_at DESC LIMIT 300`,since);

const entityTerms=entities.map(({id,name,aliases})=>({id,name,terms:[name,...aliases].map(alias=>' '+titleKey(alias)+' ')}));

function matchingEntities(articles) {
  const titles=articles.map(article=>' '+titleKey(article.title)+' ');
  return entityTerms.filter(({terms})=>terms.some(term=>titles.some(title=>title.includes(term))))
    .map(({id,name})=>({id,name}));
}

export function computeGraph(rows, asOf) {
  const cutoff = Date.parse(asOf);
  const groups = cluster(rows);
  const nodes = entities.map(entity=>{
    const items=groups.filter(group=>group.entities.some(match=>match.id===entity.id));
    const score=(before=0)=>items.reduce((total,group)=>{
      const age=cutoff-before-Date.parse(group.publishedAt);
      return age>=0 ? total+group.score/100*Math.pow(2,-age/hours(24))*(1+.2*(new Set(group.sources.map(a=>a.sourceId)).size-1)) : total;
    },0);
    const heat=items.length ? Math.round(100*(1-Math.exp(-score()/2.5))) : null;
    const past=items.length ? Math.round(100*(1-Math.exp(-score(hours(24))/2.5))) : null;
    return {...entity,heat,change:past===null?null:heat-past,count:items.length,lastSeen:items[0]?.publishedAt??null,
      news:items.slice(0,8).map(({id,title,publishedAt,sources})=>({id,title,publishedAt,source:sources[0].url}))};
  });
  const edges = new Map(relations.map(([a,b,type])=>[[a,b].sort().join('/'),{from:a,to:b,type,weight:1,evidence:[]}]));
  for (const group of groups) {
    const matches=group.entities.map(entity=>entity.id);
    for (let i=0;i<matches.length;i++) for (let j=i+1;j<matches.length;j++) {
      const [a,b]=[matches[i],matches[j]].sort();
      const key=a+'/'+b;
      const edge=edges.get(key)??{from:a,to:b,type:'新闻共现',weight:0,evidence:[]};
      edge.weight++;
      if (edge.evidence.length<5) edge.evidence.push(group.id);
      edges.set(key,edge);
    }
  }
  return {nodes,edges:[...edges.values()]};
}

export async function updater(db,{force=false,kind='all',privateFeed}={}) {
  const now=Date.now(), asOf=stamp();
  const lease=await run(db,`INSERT INTO settings VALUES('refresh_lease',?)
    ON CONFLICT(key) DO UPDATE SET value=excluded.value WHERE CAST(settings.value AS INTEGER) < ?`,String(now+hours(.025)),now);
  if (!lease.meta.changes) return {running:true};
  try {
    if (kind !== 'offers') {
      await ensureSources(db);
      const config=await all(db,'SELECT * FROM sources WHERE enabled=1');
      const ready = config.filter(source=>{
        const backoff=Math.min(hours(12),hours(.5)*2**Math.min(source.consecutive_failures,6));
        return force || !source.checked_at || now-Date.parse(source.checked_at)>=backoff;
      });
      await Promise.all([...ready.map(source=>ingestSource(db,source)),refreshPrivateSubscription(db,privateFeed,now,asOf)]);
      for (const window of ['24h','7d']) {
        const snapshot=await one(db,'SELECT as_of FROM graph_snapshots WHERE window=?',window);
        if (force || !snapshot || now-Date.parse(snapshot.as_of)>=hours(12)) {
          const rows=await newsRows(db,new Date(now-hours(window==='24h'?24:168)).toISOString());
          await run(db,'INSERT OR REPLACE INTO graph_snapshots VALUES(?,?,?)',window,asOf,JSON.stringify(computeGraph(rows,asOf)));
        }
      }
      await run(db,'DELETE FROM news WHERE published_at<?',new Date(now-hours(24*120)).toISOString());
      await run(db,'DELETE FROM source_snapshots WHERE fetched_at<?',new Date(now-hours(24*30)).toISOString());
    }
    if (kind !== 'news') {
      const localDay = new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'})
        .format(new Date(now-hours(9)));
      const check=await one(db,"SELECT value FROM settings WHERE key='offer_day'");
      if (force || check?.value!==localDay) {
        await Promise.all(offers.map(offer=>checkOffer(db,offer)));
        await run(db,"INSERT OR REPLACE INTO settings VALUES('offer_day',?)",localDay);
      }
    }
    return {asOf};
  } finally {
    await run(db,"DELETE FROM settings WHERE key='refresh_lease' AND value=?",String(now+hours(.025)));
  }
}
