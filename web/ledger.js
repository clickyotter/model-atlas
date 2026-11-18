const VERSION=1;
const DAY=86_400_000;

function open() {
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open('model-atlas',1);
    request.onupgradeneeded=()=>request.result.createObjectStore('claims',{keyPath:'id'});
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(new Error('无法打开本地记录'));
  });
}

async function transaction(mode,operation) {
  const db=await open();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('claims',mode);
    const store=tx.objectStore('claims');
    let result;
    let issue;
    const request=store.getAll();
    request.onsuccess=()=>{
      try { result=operation(store,request.result); } catch (error) { issue=error;tx.abort(); }
    };
    tx.oncomplete=()=>{db.close();resolve(result);};
    tx.onabort=()=>{db.close();reject(issue||new Error('无法写入本地记录'));};
    tx.onerror=()=>{issue??=new Error('本地记录操作失败');};
  });
}

export function periodKey(offer, at) {
  if (offer.period==='one') return 'once';
  if (offer.period==='rolling') return new Date(at).toISOString();
  const day=new Intl.DateTimeFormat('en-CA',{timeZone:offer.zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(at));
  if (offer.period==='monthly') return day.slice(0,7);
  if (offer.period==='weekly') {
    const utc=new Date(day+'T00:00:00Z');
    utc.setUTCDate(utc.getUTCDate()-(utc.getUTCDay()+6)%7);
    return utc.toISOString().slice(0,10);
  }
  return day;
}
export function activeRecord(records,offer,now=Date.now()) {
  return records.filter(r=>r.offerId===offer.id).sort((a,b)=>b.recordedAt.localeCompare(a.recordedAt)).find(r=>
    offer.period==='rolling'?now-Date.parse(r.recordedAt)<DAY:periodKey(offer,now)===r.period);
}
export function records() { return transaction('readonly',(_,all)=>all); }

export function claim(offer,note) {
  return transaction('readwrite',(store,all)=>{
    const now=Date.now();
    if (offer.status==='expired'||(offer.validUntil&&Date.parse(offer.validUntil)<=now)) throw new Error('福利规则已过期');
    if (activeRecord(all,offer,now)) throw new Error('本记录周期已标记');
    const period=periodKey(offer,now);
    const data={id:offer.id+'/'+period,offerId:offer.id,recordedAt:new Date(now).toISOString(),period,
      note:note.trim().slice(0,280),snapshot:{amount:offer.amount,estimatedValue:offer.estimate??null,source:offer.source}};
    store.add(data);
    return data;
  });
}
export function undo(offer) {
  return transaction('readwrite',(store,all)=>{
    const current=activeRecord(all,offer);
    if(!current)throw new Error('当前记录周期没有可撤销的记录');
    store.delete(current.id);
  });
}
export async function backup() {
  return JSON.stringify({schemaVersion:VERSION,exportedAt:new Date().toISOString(),records:await records()},null,2);
}
export function restore(text,offers) {
  let parsed;
  try { parsed=JSON.parse(text); } catch { throw new Error('无效 JSON'); }
  if (!parsed||parsed.schemaVersion!==VERSION||!Array.isArray(parsed.records)||parsed.records.length>3000) throw new Error('备份格式或版本无效');
  const offerMap=new Map(offers.map(offer=>[offer.id,offer]));
  const validated=parsed.records.map(r=>{
    if(!r||typeof r.offerId!=='string'||!/^[-a-z0-9]{1,80}$/.test(r.offerId)||
        typeof r.recordedAt!=='string'||!Number.isFinite(Date.parse(r.recordedAt))||Date.parse(r.recordedAt)>Date.now()||
        typeof r.period!=='string'||r.period.length>30||r.id!==r.offerId+'/'+r.period) throw new Error('存在无效记录');
    const offer=offerMap.get(r.offerId);
    if (offer&&periodKey(offer,Date.parse(r.recordedAt))!==r.period) throw new Error('记录的使用周期与厂商规则不符');
    const snapshot={};
    if(r.snapshot&&typeof r.snapshot.amount==='string')snapshot.amount=r.snapshot.amount.slice(0,160);
    if(r.snapshot&&typeof r.snapshot.source==='string'&&r.snapshot.source.startsWith('https://'))snapshot.source=r.snapshot.source.slice(0,400);
    return {id:r.id,offerId:r.offerId,period:r.period,recordedAt:new Date(r.recordedAt).toISOString(),
      note:typeof r.note==='string'?r.note.slice(0,280):'',snapshot};
  });
  return transaction('readwrite',(store,current)=>{
    const existing=new Map(current.map(record=>[record.id,record]));
    let total=0;
    for(const record of validated.sort((a,b)=>a.recordedAt.localeCompare(b.recordedAt))){
      if(existing.has(record.id))continue;
      if(offerMap.get(record.offerId)?.period==='rolling'&&[...existing.values()].some(r=>
        r.offerId===record.offerId&&Math.abs(Date.parse(r.recordedAt)-Date.parse(record.recordedAt))<DAY)) continue;
      store.add(record);
      existing.set(record.id,record);
      total++;
    }
    return total;
  });
}
