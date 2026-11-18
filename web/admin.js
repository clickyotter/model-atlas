import {root,params,esc,date,external,button,pill,heading,section,empty,announce,get,post,api,loginBox,refreshTop} from './ui.js';

const select=(name,values,selected)=>'<select name="'+name+'">'+values.map(v=>'<option '+(v===selected?'selected':'')+'>'+esc(v)+'</option>').join('')+'</select>';
const fromForm=form=>Object.fromEntries(new FormData(form));
const input=(name,label,placeholder='',type='text',required=true)=>'<label>'+label+'<input type="'+type+'" name="'+name+'" placeholder="'+esc(placeholder)+'" '+(required?'required':'')+' maxlength="1000"></label>';

function wire(selector,task) {
  root.querySelectorAll(selector).forEach(form=>form.addEventListener('submit',async event=>{
    event.preventDefault();
    const button=form.querySelector('button[type=submit],button:not([type])');
    if(button)button.disabled=true;
    try {await task(form);}
    catch(error){announce(error.message);}
    finally {if(button)button.disabled=false;}
  }));
}
export async function renderSubmit(){
  const session=await get('session');
  const correction=params.get('kind')==='correction';
  root.innerHTML=heading('SUBMIT',correction?'提交勘误':'提交案例',correction?'指出过时、错误或缺失的来源信息。':'提供公开来源、作者与许可说明、提示词与复现步骤。')+
    '<div class="subnav">'+button('/submit','提交案例',correction?'':'dark')+button('/submit?kind=correction','提交勘误',correction?'dark':'')+'</div>'+
    (!session.signedIn?loginBox('登录后提交。'):'<form class="panel form" id="submit-form">'+input('title','标题')+
      input('url','HTTPS 来源链接','https://','url')+'<label>分类'+select('category',['编程','数据','影像','文本'])+
      '</label><label>'+ (correction?'说明与证据':'提示词、权属说明与复现步骤')+'<textarea required name="detail" maxlength="3500"></textarea></label>'+
      '<button class="button dark">提交审核</button><p id="submit-result" role="status"></p></form>');
  wire('#submit-form',async form=>{
    const result=await post('/api/v1/submissions',{...fromForm(form),kind:correction?'correction':'case'});
    form.reset();
    document.querySelector('#submit-result').textContent='已提交 · '+result.status+' · '+result.id;
  });
}
export async function renderAdmin(){
  const session=await get('session');
  const page=heading('OPERATIONS','管理后台','采集、投稿审核、复测证据与操作审计。');
  if(!session.signedIn){root.innerHTML=page+loginBox('管理后台需要使用站点所有者的 ChatGPT 账号登录。');return;}
  if(!session.admin){root.innerHTML=page+empty('当前账号没有管理权限');return;}
  const [data,cases]=await Promise.all([api('/api/admin/overview'),get('cases',{limit:60})]);
  const reviewLabels={'待溯源':'待版权核验','待版权核验':'待复测','待复测':'已发布'};
  const caseOptions=cases.data.map(item=>'<option value="'+esc(item.id)+'">'+esc(item.title)+'</option>').join('');
  const subscription=data.subscription;
  root.innerHTML=page+'<div class="actions"><form data-refresh><input name="kind" type="hidden" value="all"><button class="button dark">立即采集与核验</button></form>'+
    '<form data-refresh><input name="kind" type="hidden" value="offers"><button class="button">核验福利来源</button></form>'+
    button('/radar?view=health','公开信源状态')+'</div>'+
    '<div class="dashboard section"><section class="panel">'+section('采集健康')+'<div class="table-scroll"><table class="table"><thead><tr><th>来源</th><th>最后成功</th><th>失败 / 总数</th><th>状态</th><th>操作</th></tr></thead>'+
    '<tbody>'+data.health.map(s=>'<tr><td>'+external(s.url,s.label)+'</td><td>'+date(s.success_at,true)+'</td><td>'+(s.failures||0)+' / '+(s.attempts||0)+
    '</td><td>'+esc(s.enabled?s.error||'启用':'暂停')+'</td><td><form data-source-toggle><input type="hidden" name="id" value="'+esc(s.id)+'"><input type="hidden" name="enabled" value="'+!s.enabled+
    '"><button class="button">'+(s.enabled?'暂停':'启用')+'</button></form></td></tr>').join('')+'</tbody></table></div>'+
    '<details style="margin-top:16px"><summary>新增官方信源</summary><form class="form" id="source-form" style="margin-top:12px">'+
    input('label','名称')+input('url','HTTPS RSS / Atom URL','https://','url')+
    '<label>栏目'+select('category',['模型','产品','开发者','行业','论文','社区'])+'</label><p class="meta">允许域名 '+data.approvedHosts.map(esc).join('、')+
    '</p><button class="button dark">新增信源</button></form></details></section>'+
    '<section class="panel">'+section('新增人工复测')+'<form class="form form-wide" id="retest-form">'+
    '<label class="span">案例<select name="caseId">'+caseOptions+'</select></label>'+
    input('model','模型')+input('version','版本')+input('cost','费用','例如 0.002 USD','text',false)+
    '<label>人工结果'+select('outcome',['待人工判定','人工成功','人工失败'])+'</label>'+
    '<label>评分（可选）<input type="number" name="score" min="0" max="100" step="0.1"></label>'+input('evidence','证据链接','https://','url')+
    '<label class="span">运行参数<textarea name="parameters" maxlength="1500" required></textarea></label>'+
    '<label class="span">结果与失败说明<textarea name="note" maxlength="2000" required></textarea></label>'+
    '<button class="button dark span">保存复测证据</button></form></section></div>'+
    (subscription?'<section class="section panel">'+section('编辑参考订阅')+
      '<div class="actions">'+external(subscription.url,'打开原始 RSS ↗')+
      '<form data-refresh><input name="kind" type="hidden" value="news"><button class="button">立即检查资讯</button></form></div>'+
      '<p class="meta">最近检查 '+date(subscription.checkedAt,true)+' · 最近成功 '+date(subscription.successAt,true)+
      (subscription.error?' · '+esc(subscription.error):'')+'</p>'+
      (subscription.items.length?'<ul>'+subscription.items.map(item=>'<li>'+external(item.url,item.title)+
        ' <span class="meta">'+date(item.publishedAt,true)+'</span></li>').join('')+'</ul>':empty('暂无可预览的订阅条目'))+'</section>':'')+
    '<section class="section panel">'+section('登记案例互动快照',null,'仅录入已取得许可且可核对的数据。同平台、同类至少有两个案例各达到两次有效快照，才会生成传播榜。')+
    '<form class="form form-wide" id="metrics-form"><label class="span">案例<select name="caseId">'+caseOptions+'</select></label>'+
    input('platform','来源平台','例如 GitHub')+input('evidence','互动证据链接','https://','url')+
    input('capturedAt','采集时间（带时区）','2026-11-18T14:00:00+08:00')+
    ['likes','comments','shares','bookmarks'].map((name,i)=>'<label>'+['点赞','评论','转发','收藏'][i]+'<input name="'+name+
      '" type="number" min="0" max="1000000000" step="1" required></label>').join('')+
    '<button class="button dark span">保存互动快照</button></form></section>'+
    '<section class="section">'+section('投稿审核与勘误')+
    (data.submissions.length?'<div class="grid">'+data.submissions.map(r=>'<article class="panel"><div class="tagline">'+pill(r.kind==='case'?'案例':'勘误')+pill(r.status)+
    '<span class="meta">'+date(r.created_at,true)+'</span></div><h3>'+esc(r.title)+'</h3><p>'+esc(r.detail)+'</p><p>'+external(r.url,'打开来源 ↗')+'</p>'+
    (r.status==='已发布'||r.status==='驳回'||r.status==='已处理'?'':'<form class="form" data-review><input type="hidden" name="id" value="'+esc(r.id)+'">'+
      '<label>新状态'+select('status',r.kind==='case'?[reviewLabels[r.status],'驳回'].filter(Boolean):['已处理','驳回'])+'</label>'+
      (r.status==='待复测'&&r.kind==='case'?'<label style="display:flex"><input type="checkbox" name="rights" style="min-height:0;width:auto">来源与发布权属已确认</label>'+input('model','模型（可选）','','text',false):'')+
      '<button class="button dark">保存审核</button></form>')+'</article>').join('')+'</div>':empty('暂无待处理投稿'))+'</section>'+
    '<section class="section panel">'+section('审计记录')+(data.audits.length?
      '<div class="table-scroll"><table class="table"><thead><tr><th>时间</th><th>操作</th><th>目标</th></tr></thead><tbody>'+
      data.audits.map(a=>'<tr><td>'+date(a.created_at,true)+'</td><td>'+esc(a.action)+'</td><td>'+esc(a.target)+'</td></tr>').join('')+'</tbody></table></div>':
      empty('暂无管理操作'))+'</section>';
  wire('[data-refresh]',async form=>{
    const result=await post('/api/admin/refresh',fromForm(form));
    announce(result.running?'另一次采集正在运行':'采集完成');
    refreshTop(renderAdmin);
  });
  wire('#source-form',async form=>{
    await post('/api/admin/sources',fromForm(form));announce('已添加信源');refreshTop(renderAdmin);
  });
  wire('[data-source-toggle]',async form=>{
    const values=fromForm(form);
    await post('/api/admin/sources',{...values,enabled:values.enabled==='true'});announce('已更新信源');refreshTop(renderAdmin);
  });
  wire('[data-review]',async form=>{
    const values=fromForm(form);
    await post('/api/admin/review',{...values,rights:values.rights==='on'});announce('审核已保存');refreshTop(renderAdmin);
  });
  wire('#metrics-form',async form=>{
    const values=fromForm(form);
    for(const key of ['likes','comments','shares','bookmarks']) values[key]=Number(values[key]);
    await post('/api/admin/metrics',values);announce('互动快照已保存');refreshTop(renderAdmin);
  });
  wire('#retest-form',async form=>{
    const values=fromForm(form);
    await post('/api/admin/retests',{...values,score:values.score===''?null:Number(values.score)});announce('复测已保存');refreshTop(renderAdmin);
  });
}
