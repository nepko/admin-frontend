import { Copy, Eraser, Send, Sparkles, Square, Wand2, X } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import useSWR from "swr"

import useSetting from "@/hooks/useSetting"
import {
    streamAIChat,
    getAIHistory,
    saveAIHistory,
    clearAIHistory,
    type AIChatMessage,
    type AIToolCallEvent,
    type AIToolResultEvent,
} from "@/api/ai"
import { getServers } from "@/api/server"
import type { ModelServer } from "@/types"
import { useTerminalTabs } from "./terminal-tabs"
import {
    getLastTerminalSelection,
    hasTerminalSession,
    sendTerminalInput,
} from "@/lib/terminalBus"
import { Markdown } from "./markdown"
import { scanCommandAgainstPolicy } from "@/lib/commandPolicyScan"

import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Textarea } from "./ui/textarea"

type AIMode = "chat" | "gen" | "explain" | "diagnose"

// 对话模式的系统提示：让模型具备运维/终端上下文，而非通用闲聊。
const CHAT_SYSTEM =
    "你是集成在哪吒面板终端里的运维 AI 助手。请用简洁中文回答，聚焦 Linux/Unix 运维、网络、容器与排障；" +
    "涉及命令时给出可直接执行的命令，必要时说明关键参数。不要编造不确定的事实。"

const SYSTEM_PROMPTS: Record<Exclude<AIMode, "chat">, string> = {
    gen: "你是一个资深 Linux/Unix 运维助手。用户用自然语言描述想做的事，请只返回可直接在终端执行的 shell 命令（如有多条用换行分隔），不要任何解释、不要 markdown 代码块围栏、不要多余前缀。若信息不足，返回一条最合适的命令并在末尾用 # 注释说明默认假设。",
    explain:
        "你是一个资深 Linux 运维助手。用户会给你一段来自终端的命令或输出，请用简洁中文解释它的含义与作用；涉及命令时说明关键参数的意义。",
    diagnose:
        "你是一个资深 Linux 运维助手。用户会给你一段报错日志，请用简洁中文分析可能的根本原因，并给出可操作的修复步骤（命令或配置修改）。",
}

const MODES: { key: AIMode; labelKey: string }[] = [
    { key: "chat", labelKey: "AIModeChat" },
    { key: "gen", labelKey: "AIModeGenCommand" },
    { key: "explain", labelKey: "AIModeExplain" },
    { key: "diagnose", labelKey: "AIModeDiagnose" },
]

// stripCodeFences 去掉模型可能返回的 ```lang ... ``` 围栏，保留内部内容。
function stripCodeFences(text: string): string {
    return text
        .replace(/^```[a-zA-Z0-9]*\s*\n([\s\S]*?)```/gm, "$1")
        .replace(/^```\s*$/gm, "")
        .trim()
}

// cleanForTerminal 去除围栏与纯注释行，得到可直接注入终端执行的命令文本。
function cleanForTerminal(text: string): string {
    return stripCodeFences(text)
        .split("\n")
        .filter((line) => line.trim() !== "" && !line.trim().startsWith("#"))
        .join("\n")
        .trim()
}

// trackQuotes 在已打开引号状态 quote 基础上，扫描该行更新引号开合
// （忽略反斜杠转义的引号），用于判断多行命令的引号是否已闭合。
function trackQuotes(line: string, open: "'" | '"' | null): "'" | '"' | null {
    let q: "'" | '"' | null = open
    for (let i = 0; i < line.length; i++) {
        const c = line[i]
        if (c === "\\") {
            i++
            continue
        }
        if (c === '"' || c === "'") {
            if (q === null) q = c
            else if (q === c) q = null
        }
    }
    return q
}

// buildLogicalCommands 把多行文本按 shell 语义合并为“逻辑命令”：
// 行尾以 \ 续行，或引号未闭合时与下一行合并，避免 for/while/heredoc
// 等多行结构被逐行提前执行（仅在完整逻辑命令后发送回车）。
function buildLogicalCommands(text: string): string[] {
    const out: string[] = []
    let buf = ""
    let quote: "'" | '"' | null = null
    const lines = text.split("\n")
    lines.forEach((line, idx) => {
        quote = trackQuotes(line, quote)
        const cont = line.trimEnd().endsWith("\\")
        const trimmed = cont ? line.slice(0, -1) : line
        buf = buf ? buf + "\n" + trimmed : trimmed
        const isLast = idx === lines.length - 1
        if ((!cont && quote === null) || isLast) {
            if (buf.trim()) out.push(buf.trim())
            buf = ""
        }
    })
    return out
}

export function AITerminalPanel({ onClose }: { onClose: () => void }) {
    const { t } = useTranslation()
    const { data: config } = useSetting()
    const aiEnabled = !!config?.config?.ai_enabled
    const aiToolsEnabled = !!config?.config?.ai_tools_enabled

    const [mode, setMode] = useState<AIMode>(() => {
        try {
            const m = localStorage.getItem("nezha_ai_mode") as AIMode | null
            if (m) return m
        } catch {
            /* ignore */
        }
        return "chat"
    })
    const [input, setInput] = useState("")
    const [result, setResult] = useState("")
    // 逐行注入延时（毫秒），可在面板内调节以适配不同目标主机的 shell 响应速度。
    const [lineDelay, setLineDelay] = useState(150)
    const [streaming, setStreaming] = useState(false)
    const [error, setError] = useState("")
    const [usage, setUsage] = useState<{
        prompt_tokens: number
        completion_tokens: number
        total_tokens: number
    } | null>(null)
    // AI 工具活动（Agent 调用/结果），仅用于前端展示，不落库。
    const [toolEvents, setToolEvents] = useState<
        { type: "call" | "result"; name: string; text: string }[]
    >([])
    const [chat, setChat] = useState<AIChatMessage[]>(() => {
        try {
            const raw = localStorage.getItem("nezha_ai_chat_history")
            if (raw) return JSON.parse(raw) as AIChatMessage[]
        } catch {
            /* ignore */
        }
        return []
    })

    const abortRef = useRef<AbortController | null>(null)

    const activeKey = useTerminalTabs((s) => s.activeKey)
    const tabs = useTerminalTabs((s) => s.tabs)
    const activeTab = tabs.find((x) => x.key === activeKey)
    const activeSessionId = activeTab?.sessionId
    const activeServerId = activeTab?.serverId

    // 拉取服务器列表以解析当前终端所属服务器的 OS/架构等信息。
    const { data: servers } = useSWR<ModelServer[]>("/api/v1/server", getServers)
    const activeServer = servers?.find((s) => s.id === activeServerId)

    // 目标服务器上下文：注入 AI 提示词，使其基于真实环境给出命令与建议。
    const envContext = useMemo(() => {
        if (!activeServer) return ""
        const h = activeServer.host
        const cpu = h.cpu && h.cpu.length > 0 ? h.cpu[0] : "未知"
        return (
            "\n\n【目标服务器上下文】名称：" +
            activeServer.name +
            "；系统：" +
            h.platform +
            (h.platform_version ? " " + h.platform_version : "") +
            "；架构：" +
            h.arch +
            "；CPU：" +
            cpu +
            "；Nezha Agent：" +
            h.version +
            "。请基于该环境给出命令与建议。"
        )
    }, [activeServer])

    // 对话与模式持久化：面板关闭后仍可恢复上下文（localStorage 作为离线兜底）。
    useEffect(() => {
        try {
            localStorage.setItem("nezha_ai_chat_history", JSON.stringify(chat))
        } catch {
            /* ignore */
        }
    }, [chat])
    useEffect(() => {
        try {
            localStorage.setItem("nezha_ai_mode", mode)
        } catch {
            /* ignore */
        }
    }, [mode])

    // 服务端对话记忆（C 增强项）：挂载时拉取已持久化的对话。
    useEffect(() => {
        let alive = true
        getAIHistory()
            .then((m) => {
                if (alive && m.length > 0) setChat(m)
            })
            .catch(() => {
                /* 服务端不可用时降级到 localStorage */
            })
        return () => {
            alive = false
        }
    }, [])

    // 对话变更后防抖保存到服务端（与 localStorage 兜底并行）。
    useEffect(() => {
        if (chat.length === 0) return
        const id = window.setTimeout(() => {
            saveAIHistory(chat).catch(() => {
                /* 保存失败静默降级 */
            })
        }, 800)
        return () => clearTimeout(id)
    }, [chat])

    const runStream = useCallback(
        (
            messages: AIChatMessage[],
            onDelta: (d: string) => void,
            onToolCall?: (call: AIToolCallEvent) => void,
            onToolResult?: (result: AIToolResultEvent) => void,
        ) => {
            // 新请求先取消旧请求，避免并发流互相污染。
            abortRef.current?.abort()
            const controller = new AbortController()
            abortRef.current = controller
            setStreaming(true)
            setError("")
            setUsage(null)
            setToolEvents([])
            streamAIChat(
                messages,
                undefined,
                {
                    onDelta,
                    onError: (msg) => {
                        setStreaming(false)
                        setError(msg)
                    },
                    onDone: () => {
                        setStreaming(false)
                        abortRef.current = null
                    },
                    onUsage: (u) => setUsage(u),
                    onToolCall: onToolCall
                        ? (c) => {
                              setToolEvents((e) => [
                                  ...e,
                                  { type: "call", name: c.name, text: c.arguments },
                              ])
                              onToolCall(c)
                          }
                        : undefined,
                    onToolResult: onToolResult
                        ? (r) => {
                              setToolEvents((e) => [
                                  ...e,
                                  { type: "result", name: r.name, text: r.content },
                              ])
                              onToolResult(r)
                          }
                        : undefined,
                },
                controller.signal,
            )
        },
        [],
    )

    const handleGenerate = () => {
        if (!input.trim() || streaming) return
        const content = input.trim()
        setError("")
        if (mode === "chat") {
            const next: AIChatMessage[] = [
                { role: "system", content: CHAT_SYSTEM + envContext },
                ...chat,
                { role: "user", content },
            ]
            setChat(next)
            const assistant: AIChatMessage = { role: "assistant", content: "" }
            setChat((c) => [...c, assistant])
            runStream(
                next,
                (d) => {
                    assistant.content += d
                    setChat((c) => {
                        const copy = [...c]
                        copy[copy.length - 1] = { ...assistant }
                        return copy
                    })
                },
                () => {
                    /* 工具调用/结果已通过 runStream 内的 setToolEvents 展示 */
                },
                () => {
                    /* 工具调用/结果已展示 */
                },
            )
            return
        }
        const sys = SYSTEM_PROMPTS[mode as Exclude<AIMode, "chat">] + envContext
        runStream(
            [
                { role: "system", content: sys },
                { role: "user", content },
            ],
            (d) => setResult((r) => r + d),
            () => {},
            () => {},
        )
    }

    const stopStream = () => {
        abortRef.current?.abort()
        abortRef.current = null
        setStreaming(false)
    }

    const copyResult = async () => {
        if (result) await navigator.clipboard.writeText(stripCodeFences(result))
    }

    const sendTimers = useRef<number[]>([])
    // 卸载时清理未发出的定时发送，避免向已关闭的会话写入。
    useEffect(
        () => () => {
            sendTimers.current.forEach((t) => clearTimeout(t))
            sendTimers.current = []
        },
        [],
    )

    // 逐行限速注入：避免一次性长串写入 PTY 缓冲导致字符丢失，
    // 每行之间留间隔让远端 shell 处理完毕。无可用终端时退化为复制。
    const sendToTerminal = async (lineDelay = 150) => {
        const cmd = cleanForTerminal(result)
        if (!cmd) return
        // 注入前用命令策略做可靠扫描，闭合 plan 中“PTY 字节流 best-effort 不可靠”
        // 的已知限制：在结构化命令的注入点逐行判定黑名单/白名单/需审批。
        try {
            const scan = await scanCommandAgainstPolicy(cmd)
            if (scan.blocked || scan.needsApproval) {
                setError(
                    (scan.blocked ? t("AIPolicyBlocked") : t("AIPolicyApproval")) +
                        "\n" +
                        scan.reasons.join("\n"),
                )
                return
            }
        } catch {
            // 策略拉取失败时降级放行，避免阻断正常运维。
        }
        if (!hasTerminalSession(activeSessionId)) {
            navigator.clipboard?.writeText(cmd)
            return
        }
        // 合并多行脚本为逻辑命令，再按行限速注入，避免块结构被提前执行。
        const logical = buildLogicalCommands(cmd)
        logical.forEach((line, i) => {
            const id = window.setTimeout(() => {
                sendTerminalInput(activeSessionId, line + "\r")
            }, i * lineDelay)
            sendTimers.current.push(id)
        })
    }

    // 把当前终端选区一键填入输入框（解释/诊断模式）。
    const insertSelection = () => {
        const sel = getLastTerminalSelection()
        if (!sel.text) return
        setInput((prev) => (prev.trim() ? prev + "\n" + sel.text : sel.text))
    }

    const clearChat = () => {
        abortRef.current?.abort()
        abortRef.current = null
        setStreaming(false)
        setChat([])
        setResult("")
        setError("")
        setUsage(null)
        setToolEvents([])
        clearAIHistory().catch(() => {
            /* 忽略 */
        })
        try {
            localStorage.removeItem("nezha_ai_chat_history")
        } catch {
            /* ignore */
        }
    }

    const showUsage =
        usage && !streaming && (usage.total_tokens > 0 || usage.prompt_tokens > 0)

    return (
        <div className="flex h-full min-h-[520px] flex-col rounded-lg border border-border bg-card">
            <div className="flex items-center gap-2 border-b border-border px-3 py-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold">{t("AIAssistant")}</span>
                <Button
                    size="icon"
                    variant="ghost"
                    className="ml-auto h-7 w-7"
                    onClick={onClose}
                >
                    <X className="h-4 w-4" />
                </Button>
            </div>

            {!aiEnabled && (
                <div className="m-3 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-600">
                    {t("AINotEnabled")}
                </div>
            )}

            {aiToolsEnabled && (
                <div className="mx-3 mt-2 rounded-md border border-sky-500/30 bg-sky-500/10 p-2 text-[10px] text-sky-600">
                    {t("AIToolsEnabledHint")}
                </div>
            )}

            <div className="flex flex-wrap items-center gap-1 px-3 pt-2">
                {MODES.map((m) => (
                    <Button
                        key={m.key}
                        size="sm"
                        variant={mode === m.key ? "default" : "outline"}
                        className="h-7 text-xs"
                        onClick={() => {
                            setMode(m.key)
                            setResult("")
                            setError("")
                        }}
                    >
                        {t(m.labelKey)}
                    </Button>
                ))}
                {chat.length > 0 && (
                    <Button
                        size="sm"
                        variant="ghost"
                        className="ml-auto h-7 text-xs text-muted-foreground"
                        onClick={clearChat}
                        title={t("AIClear")}
                    >
                        <Eraser className="h-3.5 w-3.5" />
                        {t("AIClear")}
                    </Button>
                )}
            </div>

            <div className="flex-1 space-y-3 overflow-auto p-3">
                {toolEvents.length > 0 && (
                    <div className="space-y-1 rounded-md border border-border bg-muted/40 p-2 text-[10px]">
                        <div className="font-medium text-muted-foreground">
                            {t("AIToolActivity")}
                        </div>
                        {toolEvents.map((e, i) => (
                            <div key={i} className="flex gap-2">
                                <span
                                    className={
                                        e.type === "call"
                                            ? "shrink-0 text-sky-400"
                                            : "shrink-0 text-emerald-400"
                                    }
                                >
                                    {e.type === "call" ? "▶ 调用" : "◀ 结果"} {e.name}
                                </span>
                                <span className="truncate text-muted-foreground">
                                    {e.text}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
                {mode === "chat" ? (
                    <div className="space-y-2">
                        {chat.length === 0 && (
                            <p className="text-xs text-muted-foreground">{t("AIDisabledHint")}</p>
                        )}
                        {chat.map((m, i) => (
                            <div
                                key={i}
                                className={`rounded-md p-2 text-xs ${
                                    m.role === "user"
                                        ? "bg-primary/10 ml-auto w-fit max-w-[90%]"
                                        : "bg-muted mr-auto w-fit max-w-[90%]"
                                }`}
                            >
                                <span className="mb-1 block text-[10px] uppercase text-muted-foreground">
                                    {m.role}
                                </span>
                                <Markdown content={m.content} className="font-sans" />
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="space-y-2">
                        <div className="relative">
                            <Textarea
                                className="min-h-28 text-xs"
                                placeholder={
                                    mode === "gen"
                                        ? t("AIGenCommandPlaceholder")
                                        : mode === "explain"
                                          ? t("AIExplainPlaceholder")
                                          : t("AIDiagnosePlaceholder")
                                }
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                            />
                            <Button
                                size="icon"
                                variant="ghost"
                                title={t("AIInsertSelection")}
                                className="absolute right-1 top-1 h-6 w-6"
                                onClick={insertSelection}
                            >
                                <Wand2 className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                        {error && (
                            <div className="rounded-md border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-500">
                                {error}
                            </div>
                        )}
                        {result && (
                            <div className="whitespace-pre-wrap rounded-md border border-border bg-[#0B0E14] p-2 text-xs text-green-300">
                                <Markdown content={result} />
                            </div>
                        )}
                        {activeServer && (
                            <p className="text-[10px] text-muted-foreground">
                                {t("AIServerContext")}
                                {activeServer.name}（{activeServer.host.platform} /{" "}
                                {activeServer.host.arch}）
                            </p>
                        )}
                    </div>
                )}
            </div>

            <div className="space-y-2 border-t border-border p-3">
                {mode !== "chat" && (
                    <div className="flex gap-2">
                        {streaming ? (
                            <Button
                                size="sm"
                                variant="destructive"
                                onClick={stopStream}
                                className="flex-1"
                            >
                                <Square className="h-4 w-4" />
                                {t("AIStop")}
                            </Button>
                        ) : (
                            <Button
                                size="sm"
                                onClick={handleGenerate}
                                disabled={!input.trim()}
                                className="flex-1"
                            >
                                <Sparkles className="h-4 w-4" />
                                {t("AIGenerate")}
                            </Button>
                        )}
                        {mode === "gen" && result && !streaming && (
                            <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <span className="whitespace-nowrap text-[10px] text-muted-foreground">
                                        {t("AISendDelay")}
                                    </span>
                                    <input
                                        type="range"
                                        min={30}
                                        max={600}
                                        step={30}
                                        value={lineDelay}
                                        onChange={(e) => setLineDelay(Number(e.target.value))}
                                        className="h-1 flex-1 cursor-pointer"
                                        title={t("AISendDelayHint")}
                                    />
                                    <span className="w-12 text-right text-[10px] tabular-nums text-muted-foreground">
                                        {lineDelay}ms
                                    </span>
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => sendToTerminal(lineDelay)}
                                        title={activeSessionId ? "" : t("AICopy")}
                                    >
                                        <Send className="h-4 w-4" />
                                        {t("AISendToTerminal")}
                                    </Button>
                                    <Button size="sm" variant="outline" onClick={copyResult}>
                                        <Copy className="h-4 w-4" />
                                        {t("AICopy")}
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
                {mode === "chat" && (
                    <div className="flex gap-2">
                        {streaming ? (
                            <Button
                                size="sm"
                                variant="destructive"
                                onClick={stopStream}
                                className="px-3"
                            >
                                <Square className="h-4 w-4" />
                                {t("AIStop")}
                            </Button>
                        ) : (
                            <Button
                                size="sm"
                                onClick={handleGenerate}
                                disabled={!input.trim()}
                                className="px-3"
                            >
                                <Send className="h-4 w-4" />
                            </Button>
                        )}
                        <Input
                            className="flex-1 text-sm"
                            placeholder={t("AIGenCommandPlaceholder")}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                    e.preventDefault()
                                    handleGenerate()
                                }
                            }}
                        />
                    </div>
                )}
                {showUsage && (
                    <div className="text-right text-[10px] text-muted-foreground">
                        tokens: {usage!.total_tokens}（prompt {usage!.prompt_tokens} / completion{" "}
                        {usage!.completion_tokens}）
                    </div>
                )}
            </div>
        </div>
    )
}
