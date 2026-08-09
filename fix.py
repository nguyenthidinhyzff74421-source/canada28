import re

with open('src/lib/engine.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. 替换 formatMessage 函数
new_format = '''function formatMessage(session: SessionState): string {
  const recentPredictions = session.predictions.slice(-15);
  const lines: string[] = [];
  for (const p of recentPredictions) {
    const short = getPeriodShort(p.period);
    let line = `${short}.${p.prediction}`;
    if (p.isCorrect === true) line += " ✅";
    else if (p.isCorrect === false) line += " ❌";
    lines.push(line);
  }
  return lines.join("\\n");
}'''

pattern1 = r'function formatMessage\(session: SessionState\): string \{[\s\S]*?\n\}'
content = re.sub(pattern1, new_format, content, count=1)

# 2. 替换 Continue session 部分
old_continue = '''    // Continue session
    addPrediction(session, nextPeriod);
    if (session.messageId) {
      await editMessage(group.groupId, session.messageId, formatMessage(session));
    }'''

new_continue = '''    // Continue session - 发新消息
    addPrediction(session, nextPeriod);
    {
      const msg = formatMessage(session);
      const result = await sendMessage(group.groupId, msg);
      if (result.ok && result.messageId) {
        session.messageId = result.messageId;
        session.messageLink = getMessageLink(group.groupId, result.messageId);
        addLog("MSG", `已发送 ID:${result.messageId}`, group.groupId);
      }
    }'''

content = content.replace(old_continue, new_continue)

# 3. 替换 Complete 部分的 editMessage
old_complete = '''      session.status = "completed";
      if (session.messageId) {
        await editMessage(group.groupId, session.messageId, formatMessage(session));
      }'''

new_complete = '''      session.status = "completed";
      {
        const msg = formatMessage(session);
        const result = await sendMessage(group.groupId, msg);
        if (result.ok && result.messageId) {
          session.messageId = result.messageId;
          session.messageLink = getMessageLink(group.groupId, result.messageId);
        }
      }'''

content = content.replace(old_complete, new_complete)

with open('src/lib/engine.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ 修改完成！")
