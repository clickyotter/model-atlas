## 目标与输入
准备一组带稳定段落 ID 的检索结果。选择一个原文能明确回答的问题和一个证据缺失的问题。

## 执行步骤
1. 把段落 ID 和链接随正文传入模型。用 claims 数组记录断言、段落 ID 与原句，用 unanswered 接收缺少依据的问题。
2. 检查引文确实存在于对应段落，单独核对日期、数值与版本。失败时要求重新检索或保守留空。
3. 检查同一问题的多个证据片段是否冲突。冲突无法核实时保留来源和待核实状态。

```js
function validateCitation(claim, passages) {
  const text = passages.get(claim.passage_id);
  return typeof text === "string" &&
    typeof claim.quote === "string" &&
    claim.quote.trim().length > 0 &&
    text.includes(claim.quote);
}
```
