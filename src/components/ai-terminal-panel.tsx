import { Copy, Eraser, Send, Sparkles, Square, Wand2, X } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import useSetting from "@/hooks/useSetting"
import { streamAIChat, type AIChatMessage } from "@/api/ai"
import { useTerminalTabs } from "./terminal-tabs"
import { getLastTerminalSelection, sendTerminalInput } from "@/lib/terminalBus"

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

export function AITerminalPanel({ onClose }: { onClose: () => void }) {
    const { t } = useTranslation()
    const { data: config } = useSetting()
    const aiEnabled = !!config?.config?.ai_enabled

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
    const [streaming, setStreaming] = useState(false)
    const [error, setError] = useState("")
    const [usage, setUsage] = useState<{
        prompt_tokens: number
        completion_tokens: number
        total_tokens: number
    } | null>(null)
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
    const activeSessionId = tabs.find((x) => x.key === activeKey)?.sessionId

    // 对话与模式持久化：面板关闭后仍可恢复上下文。
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

    const runStream = useCallback(
        (messages: AIChatMessage[], onDelta: (d: string) => void) => {
            // 新请求先取消旧请求，避免并发流互相污染。
            abortRef.current?.abort()
            const controller = new AbortController()
            abortRef.current = controller
            setStreaming(true)
            setError("")
            setUsage(null)
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
                { role: "system", content: CHAT_SYSTEM },
                ...chat,
                { role: "user", content },
            ]
            setChat(next)
            const assistant: AIChatMessage = { role: "assistant", content: "" }
            setChat((c) => [...c, assistant])
            runStream(next, (d) => {
                assistant.content += d
                setChat((c) => {
                    const copy = [...c]
                    copy[copy.length - 1] = { ...assistant }
                    return copy
                })
            })
            return
        }
        const sys = SYSTEM_PROMPTS[mode as Exclude<AIMode, "chat">]
        runStream(
            [
                { role: "system", content: sys },
                { role: "user", content },
            ],
            (d) => setResult((r) => r + d),
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

    const sendToTerminal = () => {
        const cmd = cleanForTerminal(result)
        if (!cmd) return
        const ok = sendTerminalInput(activeSessionId, cmd + "\r")
        if (!ok) {
            // 没有可用终端会话时退化为复制
            navigator.clipboard?.writeText(cmd)
        }
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
                                <pre className="whitespace-pre-wrap font-sans">{m.content}</pre>
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
                            <pre className="whitespace-pre-wrap rounded-md border border-border bg-[#0B0E14] p-2 font-mono text-xs text-green-300">
                                {stripCodeFences(result)}
                            </pre>
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
                            <>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={sendToTerminal}
                                    title={activeSessionId ? "" : t("AICopy")}
                                >
                                    <Send className="h-4 w-4" />
                                    {t("AISendToTerminal")}
                                </Button>
                                <Button size="sm" variant="outline" onClick={copyResult}>
                                    <Copy className="h-4 w-4" />
                                    {t("AICopy")}
                                </Button>
                            </>
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
