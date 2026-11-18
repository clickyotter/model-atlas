## 目标与输入
设计一个只读 get_document 工具，输入资源 ID，输出内容版本和引用。给它准备一个成功 ID、一个不存在的 ID 和一次短时网络失败。

## 执行步骤
1. 定义输入字段类型、ID 长度和成功返回。返回内容版本，便于调用方识别重复结果。
2. 把错误分为 invalid_input、not_found、rate_limited、unavailable。只为暂时错误安排有限重试。
3. 使用调用 ID 记录每次尝试。测试超时后再次成功、达到重试上限、返回同一版本三种情况。

```json
{
  "status": "unavailable",
  "retryable": true,
  "retry_after_ms": 800,
  "request_id": "example-001"
}
```
