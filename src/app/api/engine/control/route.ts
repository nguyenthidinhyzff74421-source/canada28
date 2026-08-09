import { NextRequest, NextResponse } from "next/server";
import {
  startEngine,
  stopEngine,
  resetSessions,
  manualPoll,
  setCurrentMode,
  setAlgorithm,
  setMessageDelay,
  runBacktest,
  clearHistory,
  loadHistoricalData,
} from "@/lib/engine";
import {
  setTelegramConfig,
  getTelegramConfig,
  setSessionString,
  getSessionString,
  connectClient,
  submitCode,
  disconnectClient,
  isClientConnected,
} from "@/lib/telegram-client";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case "start":
        startEngine();
        return NextResponse.json({ ok: true, message: "引擎已启动" });

      case "stop":
        stopEngine();
        return NextResponse.json({ ok: true, message: "引擎已停止" });

      case "reset":
        resetSessions();
        return NextResponse.json({ ok: true, message: "会话已重置" });

      case "poll":
        await manualPoll();
        return NextResponse.json({ ok: true, message: "轮询完成" });

      case "set_mode": {
        const { mode } = body;
        if (mode !== "shuangzu" && mode !== "sanmen") {
          return NextResponse.json({ ok: false, message: "无效模式" }, { status: 400 });
        }
        setCurrentMode(mode);
        return NextResponse.json({ ok: true, message: `已切换${mode === "shuangzu" ? "双组" : "三门"}` });
      }

      case "set_algorithm": {
        const { algorithmId } = body;
        setAlgorithm(algorithmId);
        return NextResponse.json({ ok: true, message: `算法已切换` });
      }

      case "set_delay": {
        const { delay } = body;
        setMessageDelay(parseInt(delay, 10) || 0);
        return NextResponse.json({ ok: true, message: `延迟${delay}秒` });
      }

      case "backtest": {
        const results = runBacktest();
        return NextResponse.json({ ok: true, results });
      }

      case "load_history": {
        const count = await loadHistoricalData();
        return NextResponse.json({ ok: true, message: `加载${count}期`, count });
      }

      case "clear_history":
        clearHistory();
        return NextResponse.json({ ok: true, message: "已清空" });

      case "set_telegram_config": {
        const { apiId, apiHash, phoneNumber } = body;
        setTelegramConfig(parseInt(apiId, 10), apiHash, phoneNumber);
        // Also persist to DB so Render restarts don't lose it
        const { saveAllToDb } = await import("@/lib/telegram-client");
        await saveAllToDb();
        return NextResponse.json({ ok: true, message: "配置已保存(含数据库)" });
      }

      case "get_telegram_config":
        return NextResponse.json({ ok: true, config: getTelegramConfig() });

      case "set_session": {
        const { session } = body;
        setSessionString(session);
        return NextResponse.json({ ok: true, message: "Session已保存" });
      }

      case "get_session":
        return NextResponse.json({ ok: true, session: getSessionString() ? "已保存" : "" });

      case "connect_telegram": {
        const result = await connectClient();
        return NextResponse.json({
          ok: result.ok,
          needCode: result.needCode,
          error: result.error,
          message: result.ok ? "已连接" : result.needCode ? "请输入验证码" : result.error,
        });
      }

      case "submit_code": {
        const { code } = body;
        const result = await submitCode(code);
        return NextResponse.json({
          ok: result.ok,
          error: result.error,
          message: result.ok ? "登录成功" : result.error,
        });
      }

      case "disconnect_telegram":
        await disconnectClient();
        return NextResponse.json({ ok: true, message: "已断开" });

      case "check_telegram":
        return NextResponse.json({ ok: true, connected: isClientConnected() });

      default:
        return NextResponse.json({ ok: false, message: "未知操作" }, { status: 400 });
    }
  } catch (err) {
    return NextResponse.json(
      { ok: false, message: err instanceof Error ? err.message : "Error" },
      { status: 500 }
    );
  }
}
