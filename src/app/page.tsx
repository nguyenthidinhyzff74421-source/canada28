"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface BacktestResult {
  algorithmId: string;
  algorithmName: string;
  algorithmType: string;
  totalTests: number;
  correctCount: number;
  wrongCount: number;
  accuracy: number;
  maxConsecutiveCorrect: number;
  maxConsecutiveWrong: number;
}

interface AlgorithmInfo {
  id: string;
  name: string;
  description: string;
  type: string;
}

interface PredictionEntry {
  period: string;
  prediction: string;
  actualResult?: string;
  isCorrect?: boolean;
}

interface SessionState {
  id: number;
  groupId: string;
  sessionType: string;
  status: string;
  predictions: PredictionEntry[];
  correctCount: number;
  wrongCount: number;
  consecutiveCorrect: number;
  consecutiveWrong: number;
  maxConsecutiveCorrect: number;
  maxConsecutiveWrong: number;
  rewardClaimed: boolean;
  rewardType?: string;
  messageLink?: string;
}

interface LogEntry {
  time: string;
  action: string;
  details: string;
  groupId?: string;
}

interface EngineStatus {
  running: boolean;
  connected: boolean;
  lastCheck: string;
  currentPeriod: string;
  countdown: string;
  currentMode: "shuangzu" | "sanmen";
  currentAlgorithm: string;
  messageDelay: number;
  historySize: number;
  historyLoaded: boolean;
  sessions: SessionState[];
  logs: LogEntry[];
  backtest: {
    shuangzu: BacktestResult[];
    sanmen: BacktestResult[];
    bestShuangzu: BacktestResult | null;
    bestSanmen: BacktestResult | null;
  } | null;
  algorithms: {
    shuangzu: AlgorithmInfo[];
    sanmen: AlgorithmInfo[];
  };
}

const GROUPS: Record<string, { name: string; auditor: string }> = {
  "-1004291735704": { name: "群组1", auditor: "@pznbnb" },
  "-1002102968320": { name: "群组3", auditor: "@oulu" },
  "-1004295253660": { name: "群组2", auditor: "@hn222" },
};

function parseCountdownToSeconds(cd: string): number {
  if (!cd || cd === "-" || cd === "00:00") return 0;
  const parts = cd.split(":");
  if (parts.length === 3) return (parseInt(parts[0]) || 0) * 3600 + (parseInt(parts[1]) || 0) * 60 + (parseInt(parts[2]) || 0);
  if (parts.length === 2) return (parseInt(parts[0]) || 0) * 60 + (parseInt(parts[1]) || 0);
  return 0;
}

export default function Dashboard() {
  const [status, setStatus] = useState<EngineStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<string>("control");
  const [toast, setToast] = useState({ msg: "", type: "" });
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  // 倒计时：用 deadline 时间戳作为唯一真相源
  const [displaySec, setDisplaySec] = useState(0);
  const deadlineRef = useRef<number>(0); // 到期的 Date.now() 毫秒时间戳

  // Settings
  const [apiId, setApiId] = useState("");
  const [apiHash, setApiHash] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [needCode, setNeedCode] = useState(false);
  const [delayVal, setDelayVal] = useState("0");

  const [selectedSzAlgo, setSelectedSzAlgo] = useState("");
  const [selectedSmAlgo, setSelectedSmAlgo] = useState("");

  // 拉取状态
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/engine/status", { cache: "no-store" });
      const data: EngineStatus = await res.json();
      setStatus(data);

      // 用 API 返回的 countdown 校准 deadline（只往前推，不往后拉）
      const apiSec = parseCountdownToSeconds(data.countdown);
      if (apiSec > 0) {
        const newDeadline = Date.now() + apiSec * 1000;
        // 只在差异超过3秒时校准，避免每次轮询的微小偏差导致跳动
        if (Math.abs(newDeadline - deadlineRef.current) > 3000) {
          deadlineRef.current = newDeadline;
        }
      }
    } catch {
      // ignore
    }
  }, []);

  // 5秒轮询
  useEffect(() => {
    fetchStatus();
    const id = setInterval(fetchStatus, 5000);
    return () => clearInterval(id);
  }, [fetchStatus]);

  // 每秒更新显示的倒计时
  useEffect(() => {
    const id = setInterval(() => {
      const remain = Math.max(0, Math.floor((deadlineRef.current - Date.now()) / 1000));
      setDisplaySec(remain);

      // 到期后把 deadline 推到下一期(210秒)，并立即拉一次数据
      if (remain === 0 && deadlineRef.current > 0) {
        deadlineRef.current = Date.now() + 210 * 1000;
        fetchStatus();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [fetchStatus]);

  const showToast = (msg: string, type = "info") => {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: "", type: "" }), 3000);
  };

  const action = async (act: string, extra?: Record<string, string>) => {
    setLoading(true);
    try {
      const res = await fetch("/api/engine/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: act, ...extra }),
      });
      const d = await res.json();
      if (act === "connect_telegram" && d.needCode) {
        setNeedCode(true);
        showToast("请输入验证码", "warning");
      } else {
        showToast(d.message || (d.ok ? "成功" : "失败"), d.ok ? "success" : "error");
        if (act === "submit_code" && d.ok) setNeedCode(false);
      }
      fetchStatus();
    } catch {
      showToast("请求失败", "error");
    }
    setLoading(false);
  };

  const fmtTime = (s: string) => s ? new Date(s).toLocaleTimeString("zh-CN") : "-";
  const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
  const pad = (n: number) => n.toString().padStart(2, "0");
  const toggle = (key: string) => setCollapsed(p => ({ ...p, [key]: !p[key] }));

  const cdMin = Math.floor(displaySec / 60);
  const cdSec = displaySec % 60;
  const cdUrgent = displaySec > 0 && displaySec <= 30;

  const allSessions = status?.sessions || [];
  const activeSessions = allSessions.filter(s => s.status === "active");
  const szAlgos = status?.algorithms.shuangzu || [];
  const smAlgos = status?.algorithms.sanmen || [];
  const szBt = status?.backtest?.shuangzu || [];
  const smBt = status?.backtest?.sanmen || [];
  const nextPeriod = status?.currentPeriod ? String(parseInt(status.currentPeriod) + 1) : "-";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center text-white text-xl shadow-lg">🎯</div>
            <div>
              <h1 className="text-lg font-black text-slate-800">PC28 智能报数系统</h1>
              <p className="text-[10px] text-slate-500">E-Rand种子算法 · v4.2</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <Badge color={status?.connected ? "green" : "yellow"}>TG {status?.connected ? "✓" : "✗"}</Badge>
            <Badge color={status?.running ? "green" : "red"}>{status?.running ? "运行" : "停止"}</Badge>
            <Badge color="indigo">{status?.currentMode === "shuangzu" ? "双组" : "三门"}</Badge>
            <Badge color="slate">{status?.historySize || 0}期</Badge>
          </div>
        </div>
      </header>

      {/* Toast */}
      {toast.msg && (
        <div className={`fixed top-14 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full shadow-lg text-sm font-bold ${
          toast.type === "success" ? "bg-emerald-500 text-white" :
          toast.type === "error" ? "bg-red-500 text-white" :
          toast.type === "warning" ? "bg-amber-500 text-white" :
          "bg-blue-500 text-white"
        }`}>{toast.msg}</div>
      )}

      {/* Live Banner */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-2 px-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span className="text-sm font-bold">实时</span>
            </div>
            <span className="text-sm">当前: <span className="font-mono font-bold">{status?.currentPeriod?.slice(-6) || "-"}</span></span>
            <span className="text-sm">下期: <span className="font-mono font-bold">{nextPeriod.slice(-6)}</span></span>
          </div>
          <div className={`bg-white/20 backdrop-blur rounded-lg px-4 py-1 transition ${cdUrgent ? "ring-2 ring-yellow-300 animate-pulse" : ""}`}>
            <span className="text-xs opacity-80">下期开奖</span>
            <div className="font-mono text-2xl font-black tracking-wider">
              {pad(cdMin)}:{pad(cdSec)}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <nav className="bg-white border-b border-slate-200 sticky top-[52px] z-40">
        <div className="max-w-7xl mx-auto px-2 flex gap-0.5 overflow-x-auto py-1">
          {[["control","🎮 控制台"],["algorithm","🧮 算法库"],["session","📋 会话"],["backtest","📊 回测"],["log","📝 日志"],["settings","⚙️ 设置"]].map(([k,v])=>(
            <button key={k} onClick={()=>setTab(k)} className={`px-3 py-2 text-xs font-bold rounded-lg whitespace-nowrap transition ${tab===k?"bg-blue-600 text-white shadow":"text-slate-600 hover:bg-slate-100"}`}>{v}</button>
          ))}
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-3 space-y-3">
        {/* ========== Control ========== */}
        {tab === "control" && (<>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
            <StatBox label="当前期数" value={status?.currentPeriod?.slice(-6)||"-"} />
            <StatBox label="倒计时" value={`${pad(cdMin)}:${pad(cdSec)}`} color="red" pulse={cdUrgent} />
            <StatBox label="延迟" value={`${status?.messageDelay||0}s`} />
            <StatBox label="活跃会话" value={String(activeSessions.length)} color="green" />
            <StatBox label="历史数据" value={`${status?.historySize||0}`} />
            <StatBox label="最后更新" value={fmtTime(status?.lastCheck||"")} />
          </div>

          <Panel title="🎮 引擎控制">
            <div className="grid grid-cols-4 md:grid-cols-7 gap-2">
              <Btn c="emerald" onClick={()=>action("start")} disabled={loading||status?.running}>▶ 启动</Btn>
              <Btn c="red" onClick={()=>action("stop")} disabled={loading||!status?.running}>⏹ 停止</Btn>
              <Btn c="amber" onClick={()=>action("reset")} disabled={loading}>↻ 重置</Btn>
              <Btn c="blue" onClick={()=>action("poll")} disabled={loading}>🔄 轮询</Btn>
              <Btn c="indigo" onClick={()=>action("load_history")} disabled={loading}>📥 历史</Btn>
              <Btn c="purple" onClick={()=>action("backtest")} disabled={loading||(status?.historySize||0)<15}>📊 回测</Btn>
              <Btn c="slate" onClick={()=>action("clear_history")} disabled={loading}>🗑 清空</Btn>
            </div>
          </Panel>

          <Panel title="🔀 模式切换">
            <div className="grid grid-cols-2 gap-3">
              {(["shuangzu","sanmen"] as const).map(m=>(
                <button key={m} onClick={()=>action("set_mode",{mode:m})} className={`p-4 rounded-xl border-2 text-left transition ${status?.currentMode===m?(m==="shuangzu"?"border-blue-500 bg-blue-50 shadow-lg shadow-blue-100":"border-purple-500 bg-purple-50 shadow-lg shadow-purple-100"):"border-slate-200 bg-white hover:border-slate-300"}`}>
                  <div className="text-2xl">{m==="shuangzu"?"📊":"🎯"}</div>
                  <div className="font-black text-slate-800">{m==="shuangzu"?"双组模式":"三门模式"}</div>
                  <div className="text-[10px] text-slate-500">{m==="shuangzu"?"预测2组 覆盖50%":"杀1组 覆盖75%"}</div>
                </button>
              ))}
            </div>
          </Panel>

          <Panel title="⏱ 消息延迟">
            <div className="flex items-center gap-2 flex-wrap">
              <input type="number" min="0" max="120" value={delayVal} onChange={e=>setDelayVal(e.target.value)} className="w-16 border border-slate-300 rounded-lg px-2 py-1.5 text-center text-sm" />
              <span className="text-slate-500 text-sm">秒</span>
              <Btn c="blue" onClick={()=>action("set_delay",{delay:delayVal})} small>设置</Btn>
              {[0,5,10,15,20,30,45,60].map(d=>(
                <button key={d} onClick={()=>{setDelayVal(String(d));action("set_delay",{delay:String(d)});}} className={`px-2 py-1 text-xs rounded-lg font-bold transition ${status?.messageDelay===d?"bg-blue-600 text-white":"bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{d}</button>
              ))}
            </div>
          </Panel>

          <Panel title="🚀 快速算法选择">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs font-bold text-blue-600 mb-2">📊 双组</div>
                <select value={selectedSzAlgo||status?.currentAlgorithm||""} onChange={e=>{setSelectedSzAlgo(e.target.value);if(status?.currentMode==="shuangzu")action("set_algorithm",{algorithmId:e.target.value});}} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
                  {szAlgos.map(a=>{const bt=szBt.find(b=>b.algorithmId===a.id);return <option key={a.id} value={a.id}>{a.name}{bt?` (${pct(bt.accuracy)})`:""}</option>;})}
                </select>
              </div>
              <div>
                <div className="text-xs font-bold text-purple-600 mb-2">🎯 三门</div>
                <select value={selectedSmAlgo||status?.currentAlgorithm||""} onChange={e=>{setSelectedSmAlgo(e.target.value);if(status?.currentMode==="sanmen")action("set_algorithm",{algorithmId:e.target.value});}} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
                  {smAlgos.map(a=>{const bt=smBt.find(b=>b.algorithmId===a.id);return <option key={a.id} value={a.id}>{a.name}{bt?` (${pct(bt.accuracy)})`:""}</option>;})}
                </select>
              </div>
            </div>
          </Panel>

          <Panel title={`📡 活跃会话 (${activeSessions.length})`}>
            {activeSessions.length===0?<div className="text-center py-8 text-slate-400">暂无活跃会话</div>:(
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {activeSessions.map(s=><SessionCard key={s.id} session={s}/>)}
              </div>
            )}
          </Panel>

          <Panel title="📝 最近日志" collapsible collapsed={collapsed["logs"]} onToggle={()=>toggle("logs")}>
            <div className="max-h-40 overflow-y-auto space-y-1">
              {(status?.logs||[]).slice(0,8).map((log,i)=><LogRow key={i} log={log}/>)}
            </div>
          </Panel>
        </>)}

        {/* ========== Algorithm ========== */}
        {tab === "algorithm" && (<>
          <Panel title="📊 双组算法库 (10种)">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
              {szAlgos.map(a=><AlgoCard key={a.id} algo={a} bt={szBt.find(b=>b.algorithmId===a.id)} isActive={status?.currentMode==="shuangzu"&&status?.currentAlgorithm===a.id} isBest={status?.backtest?.bestShuangzu?.algorithmId===a.id} onClick={()=>action("set_algorithm",{algorithmId:a.id})} disabled={status?.currentMode!=="shuangzu"}/>)}
            </div>
          </Panel>
          <Panel title="🎯 三门算法库 (12种)">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
              {smAlgos.map(a=><AlgoCard key={a.id} algo={a} bt={smBt.find(b=>b.algorithmId===a.id)} isActive={status?.currentMode==="sanmen"&&status?.currentAlgorithm===a.id} isBest={status?.backtest?.bestSanmen?.algorithmId===a.id} onClick={()=>action("set_algorithm",{algorithmId:a.id})} disabled={status?.currentMode!=="sanmen"} compact/>)}
            </div>
          </Panel>
          <Panel title="ℹ️ E-Rand种子算法说明">
            <div className="text-xs text-slate-600 space-y-2">
              <p><strong>E-Rand种子算法</strong>基于 Mulberry32 伪随机数生成器，通过种子值和期号生成随机数，结合和值进行数位分割求和，判断是否在相同序列来决定使用哪套预测规则。</p>
              <div className="grid grid-cols-3 gap-2 mt-2">
                {[["A","0,3,9,12,15,18,21,24,27"],["B","1,4,7,10,13,16,19,22,25"],["C","2,5,8,11,14,17,20,23,26"]].map(([k,v])=>(
                  <div key={k} className="bg-slate-50 p-2 rounded"><div className="font-bold text-slate-700">序列{k}</div><div className="text-[10px]">{v}</div></div>
                ))}
              </div>
            </div>
          </Panel>
        </>)}

        {/* ========== Session ========== */}
        {tab === "session" && (<>
          <Panel title="📡 活跃会话">
            {activeSessions.length===0?<div className="text-center py-8 text-slate-400">暂无</div>:(
              <div className="space-y-3">{activeSessions.map(s=><SessionDetail key={s.id} session={s}/>)}</div>
            )}
          </Panel>
          {allSessions.filter(s=>s.status!=="active").length>0&&(
            <Panel title="📁 历史会话" collapsible collapsed={collapsed["hist"]} onToggle={()=>toggle("hist")}>
              <div className="space-y-3">{allSessions.filter(s=>s.status!=="active").slice(0,5).map(s=><SessionDetail key={s.id} session={s}/>)}</div>
            </Panel>
          )}
        </>)}

        {/* ========== Backtest ========== */}
        {tab === "backtest" && (<>
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-lg font-black text-slate-800">📊 回测分析</h2>
            <Btn c="purple" onClick={()=>action("backtest")} disabled={loading||(status?.historySize||0)<15}>🔄 重新回测</Btn>
          </div>
          {!status?.backtest?(
            <Panel><div className="text-center py-12"><div className="text-4xl mb-4">📈</div><p className="text-slate-500 mb-4">请先加载历史数据并运行回测</p><div className="flex justify-center gap-2"><Btn c="indigo" onClick={()=>action("load_history")}>加载历史</Btn><Btn c="purple" onClick={()=>action("backtest")} disabled={(status?.historySize||0)<15}>运行回测</Btn></div></div></Panel>
          ):(<>
            <Panel title="📊 双组算法对比"><BacktestTable results={szBt} bestId={status.backtest?.bestShuangzu?.algorithmId} type="shuangzu"/></Panel>
            <Panel title="🎯 三门算法对比"><BacktestTable results={smBt} bestId={status.backtest?.bestSanmen?.algorithmId} type="sanmen"/></Panel>
            <div className="text-xs text-slate-400 text-center">数据量: {status.historySize} 期</div>
          </>)}
        </>)}

        {/* ========== Log ========== */}
        {tab === "log" && (
          <Panel title="📝 运行日志">
            <div className="max-h-[600px] overflow-y-auto space-y-1">
              {(status?.logs||[]).map((log,i)=><LogRow key={i} log={log} full/>)}
              {(!status?.logs||status.logs.length===0)&&<div className="text-center py-12 text-slate-400">暂无日志</div>}
            </div>
          </Panel>
        )}

        {/* ========== Settings ========== */}
        {tab === "settings" && (<>
          <Panel title="🔑 Telegram 登录">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Inp label="API ID" value={apiId} onChange={setApiId} placeholder="从 my.telegram.org 获取"/>
              <Inp label="API Hash" value={apiHash} onChange={setApiHash} type="password" placeholder="从 my.telegram.org 获取"/>
              <Inp label="手机号" value={phone} onChange={setPhone} placeholder="+86..."/>
            </div>
            <div className="flex gap-2 mt-3">
              <Btn c="blue" onClick={()=>action("set_telegram_config",{apiId,apiHash,phoneNumber:phone})}>💾 保存</Btn>
              <Btn c="emerald" onClick={()=>action("connect_telegram")}>🔗 连接</Btn>
              <Btn c="red" onClick={()=>action("disconnect_telegram")}>❌ 断开</Btn>
            </div>
            {needCode&&(
              <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <Inp label="验证码" value={code} onChange={setCode} placeholder="12345"/>
                <Btn c="amber" onClick={()=>action("submit_code",{code})} className="mt-2">提交</Btn>
              </div>
            )}
          </Panel>
          <Panel title="📋 群组配置">
            {Object.entries(GROUPS).map(([id,info])=>(
              <div key={id} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg mb-2">
                <div><div className="font-bold text-slate-700">{info.name}</div><div className="text-[10px] text-slate-500 font-mono">{id}</div></div>
                <div className="text-blue-600 font-bold">{info.auditor}</div>
              </div>
            ))}
          </Panel>
          <Panel title="📐 奖励规则">
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div><h4 className="font-black text-blue-600 mb-2">📊 双组</h4><ul className="space-y-1 text-slate-600"><li>✓ 连中≥6 / 连挂≥6</li><li>✓ 10-15期胜率≥80%/90%</li><li>• 第11期无奖→重开</li></ul></div>
              <div><h4 className="font-black text-purple-600 mb-2">🎯 三门</h4><ul className="space-y-1 text-slate-600"><li>✓ 连中≥10期</li><li>• 中途挂→立即重开</li></ul></div>
            </div>
          </Panel>
          <Panel title="🔧 数据源"><div className="grid grid-cols-2 gap-2 text-xs"><div className="bg-slate-50 p-2 rounded">主源: pc28.ai</div><div className="bg-slate-50 p-2 rounded">备源: pc28.help</div><div className="bg-slate-50 p-2 rounded">轮询: 5秒</div><div className="bg-slate-50 p-2 rounded">周期: 3.5分钟</div></div></Panel>
        </>)}
      </main>

      <footer className="border-t border-slate-200 py-3 mt-6 bg-white/50">
        <div className="text-center text-[10px] text-slate-400">PC28 智能报数系统 · 仅供学术研究</div>
      </footer>
    </div>
  );
}

// ========== Reusable Components ==========

function Badge({children,color}:{children:React.ReactNode;color:string}) {
  const c:Record<string,string>={green:"bg-emerald-100 text-emerald-700 border-emerald-200",red:"bg-red-100 text-red-700 border-red-200",yellow:"bg-amber-100 text-amber-700 border-amber-200",indigo:"bg-indigo-100 text-indigo-700 border-indigo-200",slate:"bg-slate-100 text-slate-700 border-slate-200"};
  return <span className={`px-2 py-0.5 text-[10px] font-bold rounded border ${c[color]}`}>{children}</span>;
}

function StatBox({label,value,color,pulse}:{label:string;value:string;color?:string;pulse?:boolean}) {
  const c=color==="red"?"text-red-600":color==="green"?"text-emerald-600":"text-slate-800";
  return <div className={`bg-white rounded-xl border border-slate-200 p-2 shadow-sm ${pulse?"ring-2 ring-red-300 animate-pulse":""}`}><div className="text-[10px] text-slate-500">{label}</div><div className={`text-lg font-black font-mono ${c}`}>{value}</div></div>;
}

function Panel({title,children,defaultOpen,collapsible,collapsed,onToggle}:{title?:string;children:React.ReactNode;defaultOpen?:boolean;collapsible?:boolean;collapsed?:boolean;onToggle?:()=>void}) {
  const hide=collapsible?collapsed:false;
  return <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">{title&&<div className={`px-4 py-2 bg-slate-50 border-b border-slate-100 flex justify-between items-center ${collapsible?"cursor-pointer":""}`} onClick={collapsible?onToggle:undefined}><h3 className="font-black text-slate-700 text-sm">{title}</h3>{collapsible&&<span className="text-slate-400">{hide?"▼":"▲"}</span>}</div>}{!hide&&<div className="p-4">{children}</div>}</div>;
}

function Btn({c,children,onClick,disabled,small,className}:{c:string;children:React.ReactNode;onClick?:()=>void;disabled?:boolean;small?:boolean;className?:string}) {
  const m:Record<string,string>={emerald:"bg-emerald-500 hover:bg-emerald-600 text-white",red:"bg-red-500 hover:bg-red-600 text-white",amber:"bg-amber-500 hover:bg-amber-600 text-white",blue:"bg-blue-500 hover:bg-blue-600 text-white",indigo:"bg-indigo-500 hover:bg-indigo-600 text-white",purple:"bg-purple-500 hover:bg-purple-600 text-white",slate:"bg-slate-500 hover:bg-slate-600 text-white"};
  return <button onClick={onClick} disabled={disabled} className={`${small?"px-2 py-1 text-xs":"px-3 py-2 text-sm"} rounded-lg font-bold transition disabled:opacity-50 disabled:cursor-not-allowed ${m[c]} ${className||""}`}>{children}</button>;
}

function Inp({label,value,onChange,type,placeholder}:{label:string;value:string;onChange:(v:string)=>void;type?:string;placeholder?:string}) {
  return <div><label className="block text-xs font-bold text-slate-600 mb-1">{label}</label><input type={type||"text"} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"/></div>;
}

function AlgoCard({algo,bt,isActive,isBest,onClick,disabled,compact}:{algo:AlgorithmInfo;bt?:BacktestResult;isActive?:boolean;isBest?:boolean;onClick?:()=>void;disabled?:boolean;compact?:boolean}) {
  return <button onClick={onClick} disabled={disabled} className={`p-3 rounded-xl border-2 text-left transition relative ${isActive?"border-blue-500 bg-blue-50 shadow-lg shadow-blue-100":isBest?"border-emerald-400 bg-emerald-50":"border-slate-200 bg-white hover:border-slate-300"} ${disabled?"opacity-50":""}`}>
    {isBest&&<span className="absolute top-1 right-1 px-1 py-0.5 bg-emerald-500 text-white text-[8px] rounded font-bold">最佳</span>}
    {isActive&&<span className="absolute top-1 right-1 px-1 py-0.5 bg-blue-500 text-white text-[8px] rounded font-bold">当前</span>}
    <div className={`font-black text-slate-800 ${compact?"text-xs":"text-sm"}`}>{algo.name}</div>
    {!compact&&<div className="text-[10px] text-slate-500 mt-0.5">{algo.description}</div>}
    {bt&&<div className={`mt-2 pt-2 border-t border-slate-100 ${compact?"text-[10px]":"text-xs"}`}><span className={`font-black ${bt.accuracy>=0.7?"text-emerald-600":bt.accuracy>=0.5?"text-amber-600":"text-red-600"}`}>{(bt.accuracy*100).toFixed(1)}%</span><span className="text-slate-400 ml-1">({bt.correctCount}/{bt.totalTests})</span></div>}
  </button>;
}

function SessionCard({session}:{session:SessionState}) {
  const g=GROUPS[session.groupId]||{name:session.groupId,auditor:""};
  const t=session.correctCount+session.wrongCount;
  const r=t>0?((session.correctCount/t)*100).toFixed(0):"-";
  return <div className="bg-slate-50 rounded-lg p-3 border border-slate-100"><div className="flex justify-between items-center mb-2"><span className="font-bold text-sm">{session.sessionType==="shuangzu"?"📊双组":"🎯三门"}</span><span className="text-xs text-slate-500">{g.name}</span></div><div className="grid grid-cols-4 gap-2 text-center text-xs"><div><span className="text-emerald-600 font-bold">{session.correctCount}</span><div className="text-slate-400">中</div></div><div><span className="text-red-600 font-bold">{session.wrongCount}</span><div className="text-slate-400">挂</div></div><div><span className="text-blue-600 font-bold">{r}%</span><div className="text-slate-400">率</div></div><div><span className="text-purple-600 font-bold">{session.consecutiveCorrect}</span><div className="text-slate-400">连</div></div></div></div>;
}

function SessionDetail({session}:{session:SessionState}) {
  const g=GROUPS[session.groupId]||{name:session.groupId,auditor:""};
  const t=session.correctCount+session.wrongCount;
  const r=t>0?((session.correctCount/t)*100).toFixed(0):"-";
  return <div className="border border-slate-200 rounded-xl overflow-hidden">
    <div className="bg-slate-50 px-4 py-2 flex justify-between items-center"><div className="flex items-center gap-2"><span className="text-lg">{session.sessionType==="shuangzu"?"📊":"🎯"}</span><span className="font-bold">{session.sessionType==="shuangzu"?"双组":"三门"}</span><span className="text-xs text-slate-500">{g.name}</span></div><span className={`text-[10px] px-2 py-0.5 rounded font-bold ${session.status==="active"?"bg-emerald-100 text-emerald-700":session.status==="completed"?"bg-blue-100 text-blue-700":"bg-slate-100 text-slate-700"}`}>{session.status==="active"?"进行中":session.status==="completed"?"完成":"停止"}</span></div>
    <div className="px-4 py-2 flex gap-4 text-xs border-b border-slate-100"><span>中<span className="text-emerald-600 font-bold ml-1">{session.correctCount}</span></span><span>挂<span className="text-red-600 font-bold ml-1">{session.wrongCount}</span></span><span>率<span className="text-blue-600 font-bold ml-1">{r}%</span></span><span>连中<span className="text-purple-600 font-bold ml-1">{session.consecutiveCorrect}</span></span><span>最大<span className="text-emerald-600 font-bold ml-1">{session.maxConsecutiveCorrect}</span></span></div>
    <div className="px-4 py-2 max-h-32 overflow-y-auto text-xs space-y-0.5">{session.predictions.map((p,i)=><div key={i} className="flex justify-between py-0.5 border-b border-slate-50"><span className="font-mono">{p.period.slice(-2)}.{p.prediction}</span><span>{p.isCorrect===true?"✅":p.isCorrect===false?"❌":"⏳"}</span></div>)}</div>
    {session.rewardClaimed&&<div className="px-4 py-2 bg-amber-50 text-amber-700 text-xs">🎁 {session.rewardType}</div>}
  </div>;
}

function BacktestTable({results,bestId,type}:{results:BacktestResult[];bestId?:string;type:string}) {
  return <div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr className="border-b border-slate-200 text-slate-500"><th className="text-left py-2 px-2">算法</th><th className="text-center py-2 px-2">胜率</th><th className="text-center py-2 px-2">中</th><th className="text-center py-2 px-2">挂</th><th className="text-center py-2 px-2">连中</th><th className="text-center py-2 px-2">连挂</th></tr></thead><tbody>
    {results.map(bt=><tr key={bt.algorithmId} className={`border-b border-slate-50 ${bestId===bt.algorithmId?"bg-emerald-50":""}`}><td className="py-2 px-2 font-bold">{bt.algorithmName}{bestId===bt.algorithmId&&<span className="ml-1 text-[8px] bg-emerald-500 text-white px-1 rounded">最佳</span>}</td><td className={`text-center py-2 px-2 font-black ${bt.accuracy>=(type==="sanmen"?0.8:0.6)?"text-emerald-600":"text-amber-600"}`}>{(bt.accuracy*100).toFixed(1)}%</td><td className="text-center py-2 px-2 text-emerald-600">{bt.correctCount}</td><td className="text-center py-2 px-2 text-red-600">{bt.wrongCount}</td><td className="text-center py-2 px-2 text-emerald-600 font-bold">{bt.maxConsecutiveCorrect}</td><td className="text-center py-2 px-2 text-red-600">{bt.maxConsecutiveWrong}</td></tr>)}
  </tbody></table></div>;
}

function LogRow({log,full}:{log:LogEntry;full?:boolean}) {
  const ft=(s:string)=>s?new Date(s).toLocaleTimeString("zh-CN"):"-";
  const g=log.groupId?GROUPS[log.groupId]?.name:"";
  return <div className={`flex items-start gap-2 text-xs py-1 ${full?"border-b border-slate-50":""}`}><span className="text-slate-400 font-mono shrink-0">{ft(log.time)}</span><span className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${log.action.includes("ERROR")?"bg-red-100 text-red-700":log.action.includes("VERIFY")?"bg-blue-100 text-blue-700":log.action.includes("REWARD")?"bg-amber-100 text-amber-700":log.action.includes("DRAW")?"bg-emerald-100 text-emerald-700":"bg-slate-100 text-slate-600"}`}>{log.action}</span><span className="text-slate-700 flex-1">{log.details}</span>{g&&<span className="text-slate-400 shrink-0">{g}</span>}</div>;
}
