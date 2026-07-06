import { Copy, Send, Sparkles, X } from "lucide-react"
import { useCallback, useState } from "react"
import { useTranslation } from "react-i18next"

import useSetting from "@/hooks/useSetting"
import { streamAIChat, type AIChatMessage } from "@/api/ai"
import { useTerminalTabs } from "./terminal-tabs"
import { sendTerminalInput } from "@/lib/terminalBus"

import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Textarea } from "./ui/textarea"

type AIMode = "chat" | "gen" | "explain" | "diagnose"

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

export function AITerminalPanel({ onClose }: { onClose: () => void }) {
    const { t } = useTranslation()
    const { data: config } = useSetting()
    const aiEnabled = !!config?.config?.ai_enabled

    const [mode, setMode] = useState<AIMode>("chat")
    const [input, setInput] = useState("")
    const [result, setResult] = useState("")
    const [streaming, setStreaming] = useState(false)
    const [chat, setChat] = useState<AIChatMessage[]>([])

    const activeKey = useTerminalTabs((s) => s.activeKey)
    const tabs = useTerminalTabs((s) => s.tabs)
    const activeSessionId = tabs.find((x) => x.key === activeKey)?.sessionId

    const runStream = useCallback(
        (messages: AIChatMessage[], onDelta: (d: string) => void) => {
            setStreaming(true)
            streamAIChat(messages, undefined, {
                onDelta,
                onError: (msg) => {
                    setStreaming(false)
                    onDelta(`\n[错误] ${msg}`)
                },
                onDone: () => setStreaming(false),
            })
        },
        [],
    )

    const handleGenerate = () => {
        if (!input.trim() || streaming) return
        const content = input.trim()
        setResult("")
        if (mode === "chat") {
            const next: AIChatMessage[] = [...chat, { role: "user", content }]
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

    const copyResult = async () => {
        if (result) await navigator.clipboard.writeText(result)
    }

    const sendToTerminal = () => {
        if (!result.trim()) return
        const ok = sendTerminalInput(activeSessionId, result.trim() + "\r")
        if (!ok) {
            // 没有可用终端会话时退化为复制
            navigator.clipboard?.writeText(result.trim())
        }
    }

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

            <div className="flex flex-wrap gap-1 px-3 pt-2">
                {MODES.map((m) => (
                    <Button
                        key={m.key}
                        size="sm"
                        variant={mode === m.key ? "default" : "outline"}
                        className="h-7 text-xs"
                        onClick={() => {
                            setMode(m.key)
                            setResult("")
                        }}
                    >
                        {t(m.labelKey)}
                    </Button>
                ))}
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
                        {result && (
                            <pre className="whitespace-pre-wrap rounded-md border border-border bg-[#0B0E14] p-2 font-mono text-xs text-green-300">
                                {result}
                            </pre>
                        )}
                    </div>
                )}
            </div>

            <div className="space-y-2 border-t border-border p-3">
                {mode !== "chat" && (
                    <div className="flex gap-2">
                        <Button
                            size="sm"
                            onClick={handleGenerate}
                            disabled={streaming || !input.trim()}
                            className="flex-1"
                        >
                            <Sparkles className="h-4 w-4" />
                            {streaming ? t("AISending") : t("AIGenerate")}
                        </Button>
                        {mode === "gen" && result && (
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
                        <Button size="sm" onClick={handleGenerate} disabled={streaming}>
                            <Send className="h-4 w-4" />
                        </Button>
                    </div>
                )}
            </div>
        </div>
    )
}
