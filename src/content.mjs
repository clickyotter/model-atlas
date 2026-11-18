export const sources = [
  ['openai', 'OpenAI', 'https://openai.com/news/rss.xml', '模型'],
  ['huggingface', 'Hugging Face', 'https://huggingface.co/blog/feed.xml', '开发者'],
  ['google', 'Google AI', 'https://blog.google/innovation-and-ai/rss/', '产品'],
  ['deepmind', 'Google DeepMind', 'https://deepmind.google/blog/rss.xml', '论文'],
  ['copilot', 'GitHub Copilot', 'https://github.blog/changelog/label/copilot/feed/', '开发者'],
  ['cloudflare', 'Cloudflare', 'https://blog.cloudflare.com/rss/', '行业']
].map(([id,label,url,category]) => ({id,label,url,category}));

export const editorialAt = '2026-11-18T06:00:00.000Z';
export const cases = [
  {
    id: 'traceable-rag', title: '给 RAG 答案加上逐句证据', enTitle: 'Attach evidence to each RAG claim',
    category: '数据', model: 'OpenAI', theme: 'violet', track: 'retrieval',
    summary: '把答案拆成可核对的断言，把段落 ID 和引用原句写进结构化结果。',
    source: 'https://platform.openai.com/docs/guides/structured-outputs',
    prompt: '你会收到按 ID 编号的检索片段。只用片段回答问题。将回答拆为 claims 数组，每项包含 statement、passage_id 和逐字 quote。若片段不能支持某项断言，将问题写入 unanswered。不要推断缺失的日期、数值与版本。',
    enPrompt: 'Answer from the numbered passages only. Return claims with statement, passage_id and an exact quote. Put unsupported questions under unanswered. Do not infer missing dates, numbers or versions.',
    input: 'P1: 夜间批处理每周一运行。 P2: 批处理成功后生成日报。\n问题：任务什么时候运行？失败后会重试吗？',
    output: '{"claims":[{"statement":"每周一运行","passage_id":"P1","quote":"每周一运行"}],"unanswered":["失败后会重试吗？"]}'
  },
  {
    id: 'safe-change', title: '把代码改动拆成可验收的任务', enTitle: 'Turn a code change into a verifiable task',
    category: '编程', model: 'Codex', theme: 'mint', track: 'coding',
    summary: '在修改前确定入口、影响范围和复现方式，用一条失败测试收住目标。',
    source: 'https://developers.openai.com/codex/',
    prompt: '先读仓库说明和相关入口。列出当前行为、目标行为和现有测试。用最小输入重现问题，再提出能复用现有逻辑的改动。执行后给出实际运行的命令、退出状态和仍待核验的边界。',
    enPrompt: 'Read repository guidance and the relevant entry point. Identify current and desired behavior. Reproduce with the smallest input, reuse existing logic, and report commands, exit status and outstanding checks.',
    input: '任务：旧版备份未包含 locale，导入时报错。', output: '用一份缺少 locale 的旧备份复现；导入时使用现有默认语言；补验显式语言、非法语言与往返导出。'
  },
  {
    id: 'scene-board', title: '从一张场景图写出镜头表', enTitle: 'Turn a scene reference into a shot list',
    category: '影像', model: 'Gemini', theme: 'peach', track: 'multimodal',
    summary: '先记录画面可见事实，再把镜头建议转换为能够拍摄和剪辑的表格。',
    source: 'https://ai.google.dev/gemini-api/docs/image-understanding',
    prompt: '将输入图像拆成可见对象、光线和空间关系。创作 3 个镜头，每个给出景别、时长、机位运动与主体。明确哪些细节来自图片，哪些是拍摄建议。不要识别人物身份。',
    enPrompt: 'Describe visible objects, light and spatial relations. Propose three shots with framing, duration, movement and subject. Separate observed details from creative choices. Do not identify people.',
    input: '场景描述：夜晚天台、低空月亮、远处公路车灯。', output: '全景 4 秒 · 固定 · 天台与月亮\n中景 3 秒 · 缓慢横移 · 护栏与远处公路\n特写 2 秒 · 固定 · 车灯光轨'
  },
  {
    id: 'tool-contract', title: '把工具失败变成可恢复的状态', enTitle: 'Make tool failures recoverable',
    category: '编程', model: 'MCP', theme: 'blue', track: 'agents',
    summary: '定义参数、幂等键与错误类别，用受控重试保留每一步的状态。',
    source: 'https://modelcontextprotocol.io/docs/getting-started/intro',
    prompt: '为一个读取工具定义输入和返回结构。区分 invalid_input、not_found、rate_limited 和 unavailable。只有暂时故障可以重试，给出重试上限及结果去重方法。',
    enPrompt: 'Design the input and output contract for a read-only tool. Distinguish invalid_input, not_found, rate_limited and unavailable. Retry transient errors only and specify limits and deduplication.',
    input: '输入：get_document(id)，可能发现记录不存在或存储服务超时。', output: '不存在 → not_found；超时 → unavailable、最多重试两次；结果按 id 和版本去重。'
  },
  {
    id: 'subtitle-check', title: '核对跨语言字幕里的专有名词', enTitle: 'Review named entities across subtitles',
    category: '文本', model: 'Claude', theme: 'pink', track: 'multimodal',
    summary: '锁定时间轴，只输出有术语依据的译文改动和证据，方便批量 review。',
    source: 'https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/overview',
    prompt: '输入包含字幕片段、译文和术语表。保持片段 ID 和时间不变，只提出能被术语表或上下文支持的译名修订。逐项返回 segment_id、before、after、evidence 并把歧义记录到 needs_review。',
    enPrompt: 'Given segments, translations and a glossary, preserve IDs and timing. Propose only context-supported glossary changes. Return segment_id, before, after and evidence. Put ambiguities in needs_review.',
    input: '术语 Hugo → 雨果；译文：「雨哥修改了稿件。」', output: 'before: 雨哥 · after: 雨果 · evidence: 术语表 Hugo → 雨果'
  },
  {
    id: 'release-brief', title: '从版本日志写一页工程简报', enTitle: 'Summarize release notes for engineers',
    category: '文本', model: 'GitHub Copilot', theme: 'ocean', track: 'coding',
    summary: '围绕受影响的调用方、迁移步骤和源码出处整理发布公告。',
    source: 'https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases',
    prompt: '从输入版本日志提取新增、变更和修复。每条写出受影响调用方、是否需要修改、验证步骤和章节链接。源材料未确认破坏性变化时标记待核实。',
    enPrompt: 'Extract additions, changes and fixes from release notes. Include affected callers, required actions, verification and source anchors. Mark unconfirmed breaking changes as unknown.',
    input: '发布说明：导出记录新增 schemaVersion，旧字段读法不变。', output: '对象：使用导出文件的程序。验证：导入旧文件，并核对新版文件的 schemaVersion。'
  }
].map(item => ({
  ...item, author: '模型图鉴编辑部', authorId: 'atlas', publishedAt: editorialAt,
  verifiedAt: editorialAt, rightsStatus: '原创练习', heat: null, stability: null
}));

export const tracks = [
  ['coding', 'AI 编程交付', '让 Coding Agent 通过可复现输入完成修改、测试与交付。', 'safe-change', '在 Codex 中验证一次小改动', 'Codex', 'https://developers.openai.com/codex/'],
  ['retrieval', 'RAG 与证据链', '建立答案、来源段落与拒答之间可机器校验的关系。', 'traceable-rag', '写一个带引用检查的检索答案', 'RAG', 'https://platform.openai.com/docs/guides/structured-outputs'],
  ['agents', 'Agent 与 MCP', '明确工具职责、参数约束、失败分类和重试口径。', 'tool-contract', '设计一个可恢复的 MCP 工具', 'MCP', 'https://modelcontextprotocol.io/docs/getting-started/intro'],
  ['multimodal', '多模态内容实践', '把图像、字幕与文本结构化成可以验收的产物。', 'scene-board', '为参考画面组织一个镜头表', '多模态', 'https://ai.google.dev/gemini-api/docs/image-understanding'],
  ['verification', '模型评测与发布', '记录真实模型、输入参数、费用和失败证据。', 'release-brief', '记录一次可重放的复测', '评测', 'https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases']
].map(([id,title,summary,caseId,articleTitle,tag,source]) => ({
  id,title,summary,caseId,articleTitle,tag,source,version:'1.0',verifiedAt:editorialAt,
  articleId: id+'-practice'
}));

export const entities = [
  ['openai','OpenAI','公司','https://openai.com/',[]],
  ['codex','Codex','工具','https://developers.openai.com/codex/',['OpenAI Codex']],
  ['gpt','GPT','模型','https://platform.openai.com/docs/models',['GPT-5','GPT-6','GPT-6.2']],
  ['google','Google','公司','https://blog.google/',['Google DeepMind','DeepMind']],
  ['gemini','Gemini','模型','https://ai.google.dev/',['Gemini API']],
  ['anthropic','Anthropic','公司','https://www.anthropic.com/',[]],
  ['claude','Claude','模型','https://www.anthropic.com/claude',['Claude Code']],
  ['hugging-face','Hugging Face','开源','https://huggingface.co/',['HuggingFace']],
  ['mcp','MCP','概念','https://modelcontextprotocol.io/',['Model Context Protocol']],
  ['github','GitHub','产品','https://github.blog/',[]],
  ['copilot','GitHub Copilot','工具','https://github.com/features/copilot',['Copilot']],
  ['cloudflare','Cloudflare','公司','https://www.cloudflare.com/',['Workers AI']],
  ['rag','RAG','概念','https://huggingface.co/docs/transformers/model_doc/rag',['retrieval-augmented']],
  ['openrouter','OpenRouter','产品','https://openrouter.ai/',[]],
  ['deepseek','DeepSeek','模型','https://api-docs.deepseek.com/',[]],
  ['research','arXiv','产品','https://arxiv.org/',['arXiv']]
].map(([id,name,type,source,aliases])=>({id,name,type,source,aliases}));

export const relations = [
  ['openai','codex','产品归属'], ['openai','gpt','模型归属'], ['google','gemini','模型归属'],
  ['anthropic','claude','模型归属'], ['anthropic','mcp','项目发起方'],
  ['github','copilot','产品归属'], ['hugging-face','rag','参考实现']
];

export const offers = [
  {id:'openrouter-free',provider:'OpenRouter',name:'免费模型路由',category:'语言 / 编程',period:'rolling',zone:null,amount:'部分模型请求费为 $0',conditions:'需要 API Key。免费路由与各模型受调用限制，具体规则以官方限流页面为准。',source:'https://openrouter.ai/collections/free-models/',claimUrl:'https://openrouter.ai/openrouter/free',check:'https://openrouter.ai/api/v1/models',mark:'OR',theme:'violet'},
  {id:'cloudflare-workers-ai',provider:'Cloudflare',name:'Workers AI 免费用量',category:'语言 / 编程',period:'daily',zone:'UTC',amount:'10,000 Neurons / 日',conditions:'按 UTC 00:00 重置。部分模型要求付费方案。仅作手动用量记录。',source:'https://developers.cloudflare.com/workers-ai/platform/pricing/',claimUrl:'https://dash.cloudflare.com/',check:'https://developers.cloudflare.com/workers-ai/platform/pricing/',mark:'CF',theme:'peach'},
  {id:'gemini-developer',provider:'Google',name:'Gemini API 免费层',category:'多模态',period:'daily',zone:'America/Los_Angeles',amount:'以模型与项目限制为准',conditions:'仅部分模型和地区可用，免费层按项目限制请求。厂商政策可能允许将免费层输入用于改进产品。',source:'https://ai.google.dev/gemini-api/docs/pricing',claimUrl:'https://aistudio.google.com/apikey',check:'https://ai.google.dev/gemini-api/docs/pricing',mark:'G',theme:'blue'}
].map(offer => ({...offer,apiUsable:true,estimate:null,verifiedAt:editorialAt,validUntil:null}));
