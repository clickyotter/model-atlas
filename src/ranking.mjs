const weighted=snapshot=>snapshot.likes+2*snapshot.comments+3*snapshot.shares+snapshot.bookmarks;
const percentile=(list,value)=>{
  if(list.length<2)return .5;
  const below=list.filter(n=>n<value).length;
  const tied=list.filter(n=>n===value).length;
  return (below+(tied-1)*.5)/(list.length-1);
};

export function rankCases(items,snapshots,now=Date.now()){
  const groups=new Map();
  for(const item of items){
    const rows=snapshots.filter(row=>row.case_slug===item.id).slice(0,2);
    if(rows.length<2 || rows[0].platform!==rows[1].platform)continue;
    const elapsed=(Date.parse(rows[0].captured_at)-Date.parse(rows[1].captured_at))/3_600_000;
    const age=(now-Date.parse(rows[0].captured_at))/3_600_000;
    if(elapsed<.25||age>24*60||age<0)continue;
    const score={item,volume:Math.log1p(weighted(rows[0])),speed:Math.max(0,weighted(rows[0])-weighted(rows[1]))/elapsed,
      age,source:rows[0].source,at:rows[0].captured_at,previousAt:rows[1].captured_at,platform:rows[0].platform};
    const group=item.category+'/'+score.platform;
    groups.set(group,[...(groups.get(group)??[]),score]);
  }
  const byID=new Map();
  for(const peers of groups.values()) {
    if(peers.length<2)continue;
    const volumes=peers.map(p=>p.volume),speeds=peers.map(p=>p.speed);
    for(const p of peers) {
      const score=.85*percentile(volumes,p.volume)+.15*percentile(speeds,p.speed);
      const heat=Math.round(100*score*2**(-p.age/(24*7)));
      byID.set(p.item.id,{heat,heatEvidence:{asOf:p.at,previousAt:p.previousAt,source:p.source,platform:p.platform,peerCount:peers.length}});
    }
  }
  return items.map(item=>({...item,...byID.get(item.id)}));
}
