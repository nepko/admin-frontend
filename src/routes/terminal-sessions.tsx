import { executeBatchCommand, listCommandHistory, listQuickCommands } from "@/api/quick-command"
import { createTerminal } from "@/api/terminal"
import { sendTerminalInput, hasTerminalSession } from "@/lib/terminalBus"
import { AITerminalPanel } from "@/components/ai-terminal-panel"
import { TerminalTab, useTerminalTabs } from "@/components/terminal-tabs"
import {
    BatchCommandResult,
    CommandHistory,
    QuickCommand,
} from "@/types"
import { useServer } from "@/hooks/useServer"
import { Check, MonitorPlay, Play, Sparkles, TerminalSquare } from "lucide-react"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import useSWR from "swr"

import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { PageHeader } from "@/components/page-header"
import { TerminalTabs } from "@/components/terminal-tabs"
import { Link } from "react-router-dom"
import { toast } from "sonner"

// normalizeCommand 把粘贴进来的命令做安全清理，避免「粘错」：
// 统一换行符、去除每行行尾空白（保留行首缩进，避免破坏 heredoc）、
// 折叠多余空行、去掉整体首尾空行。
const normalizeCommand = (raw: string): string =>
    raw
        .replace(/\r\n?/g, "\n")
        .split("\n")
        .map((l) => l.replace(/[ \t]+$/g, ""))
        .join("\n")
        .replace(/\n{3,}/g, "\n\n")
        .replace(/^\n+|\n+$/g, "")

export default function TerminalSessionsPage() {
    const { t } = useTranslation()
    const { servers } = useServer()
    const serverList = useMemo(() => servers ?? [], [servers])

    const [selected, setSelected] = useState<number[]>([])
    const [command, setCommand] = useState("")
    const [results, setResults] = useState<BatchCommandResult[] | null>(null)
    const [executing, setExecuting] = useState(false)
    const [aiOpen, setAiOpen] = useState(false)

    const addTab = useTerminalTabs((s) => s.addTab)
    const activeKey = useTerminalTabs((s) => s.activeKey)

    const { data: quickCommands } = useSWR<QuickCommand[]>(
        "/api/v1/quick-command",
        listQuickCommands,
    )
    const { data: history } = useSWR<CommandHistory[]>(
        "/api/v1/command-history",
        listCommandHistory,
    )

    const toggleServer = (id: number) => {
        setSelected((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
        )
    }

    const openTerminals = async () => {
        if (selected.length === 0) {
            toast.warning(t("NoServersSelected"))
            return
        }
        for (const id of selected) {
            try {
                const s = await createTerminal(id)
                const tab: TerminalTab = {
                    key: s.session_id,
                    serverId: id,
                    sessionId: s.session_id,
                    name: s.server_name || String(id),
                }
                addTab(tab)
            } catch (e: any) {
                toast.error(e?.message || t("Error"))
            }
        }
    }

    const runCommand = async () => {
        if (selected.length === 0) {
            toast.warning(t("NoServersSelected"))
            return
        }
        const cmd = normalizeCommand(command)
        if (!cmd.trim()) {
            toast.warning(t("CommandRequired"))
            return
        }
        setExecuting(true)
        try {
            const res = await executeBatchCommand(cmd, selected)
            if (res && typeof res === "object" && "status" in res && res.status === "pending") {
                toast.info(t("PendingApproval"))
                setResults(null)
            } else {
                setResults(res as BatchCommandResult[])
            }
        } catch (e: any) {
            toast.error(e?.message || t("Error"))
        } finally {
            setExecuting(false)
        }
    }

    // sendToTerminal 把编辑区命令逐行发送到当前激活的终端，等价于手动键入，
    // 避免直接往 xterm 粘贴带来的换行/选中/格式问题（"省得粘错"）。
    const sendToTerminal = () => {
        const cmd = normalizeCommand(command)
        if (!cmd.trim()) {
            toast.warning(t("CommandRequired"))
            return
        }
        if (!activeKey || !hasTerminalSession(activeKey)) {
            toast.warning(t("NoActiveTerminal"))
            return
        }
        for (const line of cmd.split("\n")) {
            sendTerminalInput(activeKey, line + "\n")
        }
        toast.success(t("SentToTerminal"))
    }

    const lineCount = command === "" ? 0 : command.split("\n").length

    return (
        <div className="px-3 py-4 space-y-4">
            <PageHeader
                title={t("Terminals")}
                actions={
                    <>
                        <Link
                            to="/dashboard/recordings"
                            className="inline-flex items-center gap-1 text-sm text-brand hover:underline"
                        >
                            <MonitorPlay className="h-4 w-4" />
                            {t("TerminalRecordings")}
                        </Link>
                        <Button
                            size="sm"
                            variant={aiOpen ? "gradient" : "outline"}
                            onClick={() => setAiOpen((o) => !o)}
                        >
                            <Sparkles className="h-4 w-4" />
                            {t("AIAssistant")}
                        </Button>
                    </>
                }
            />

            <div
                className={`grid grid-cols-1 gap-4 ${
                    aiOpen ? "lg:grid-cols-[280px_1fr_360px]" : "lg:grid-cols-[280px_1fr]"
                }`}
            >
                {/* 服务器多选 */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base">{t("ServerSelect")}</CardTitle>
                        <CardDescription>
                            {t("SelectedServers")}: {selected.length}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <div className="max-h-72 space-y-1 overflow-auto rounded-md border border-border p-2">
                            {serverList.length === 0 ? (
                                <p className="text-sm text-muted-foreground">
                                    {t("NoResults")}
                                </p>
                            ) : (
                                serverList.map((s) => (
                                    <label
                                        key={s.id}
                                        className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-accent"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selected.includes(s.id)}
                                            onChange={() => toggleServer(s.id)}
                                            className="accent-brand"
                                        />
                                        <span className="truncate">{s.name}</span>
                                    </label>
                                ))
                            )}
                        </div>
                        <div className="flex gap-2">
                            <Button size="sm" variant="gradient" onClick={openTerminals} className="flex-1">
                                <TerminalSquare className="h-4 w-4" />
                                {t("OpenTerminal")}
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setSelected([])}
                            >
                                {t("Clear")}
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* 终端区 */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base">{t("Terminal")}</CardTitle>
                        <CardDescription>{t("TerminalMultiDesc")}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <TerminalTabs />
                    </CardContent>
                </Card>

                {/* 终端 AI 助手面板（右侧抽屉式列） */}
                {aiOpen && <AITerminalPanel onClose={() => setAiOpen(false)} />}
            </div>

            {/* 快捷命令 / 批量执行 */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-base">{t("BatchExecute")}</CardTitle>
                    <CardDescription>{t("BatchExecuteDesc")}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="space-y-2">
                        <Textarea
                            className="min-h-[96px] resize-y font-mono text-sm"
                            placeholder={t("CommandPlaceholder")}
                            value={command}
                            onChange={(e) => setCommand(e.target.value)}
                            onKeyDown={(e) => {
                                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                                    e.preventDefault()
                                    runCommand()
                                }
                            }}
                        />
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="mr-auto text-xs text-muted-foreground">
                                {t("LinesChars", { lines: lineCount, chars: command.length })}
                            </span>
                            <Select
                                onValueChange={(v) => {
                                    const q = quickCommands?.find((x) => String(x.id) === v)
                                    if (q) setCommand(q.command)
                                }}
                            >
                                <SelectTrigger className="w-44">
                                    <SelectValue placeholder={t("QuickCommands")} />
                                </SelectTrigger>
                                <SelectContent>
                                    {(quickCommands ?? []).map((q) => (
                                        <SelectItem key={q.id} value={String(q.id)}>
                                            {q.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Select
                                onValueChange={(v) => {
                                    const h = history?.find((x) => String(x.id) === v)
                                    if (h) setCommand(h.command)
                                }}
                            >
                                <SelectTrigger className="w-44">
                                    <SelectValue placeholder={t("CommandHistory")} />
                                </SelectTrigger>
                                <SelectContent>
                                    {(history ?? []).map((h) => (
                                        <SelectItem key={h.id} value={String(h.id)}>
                                            <span className="block max-w-40 truncate">
                                                {h.command}
                                            </span>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Button
                                variant="outline"
                                onClick={sendToTerminal}
                                disabled={!activeKey || !hasTerminalSession(activeKey)}
                                title={t("SendToTerminalHint")}
                            >
                                <TerminalSquare className="h-4 w-4" />
                                {t("SendToTerminal")}
                            </Button>
                            <Button onClick={runCommand} disabled={executing} variant="gradient">
                                <Play className="h-4 w-4" />
                                {t("ExecuteCommand")}
                            </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">{t("CommandEditHint")}</p>
                    </div>

                    {results && (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>{t("Server")}</TableHead>
                                    <TableHead>{t("Status")}</TableHead>
                                    <TableHead>{t("Result")}</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {results.map((r) => (
                                    <TableRow key={r.server_id}>
                                        <TableCell>{r.server_name}</TableCell>
                                        <TableCell>
                                            {r.success ? (
                                                <Badge variant="secondary" className="bg-green-500/15 text-green-500">
                                                    <Check className="h-3 w-3" />
                                                </Badge>
                                            ) : (
                                                <Badge variant="destructive">
                                                    {t("Failed")}
                                                </Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="max-w-md truncate font-mono text-xs">
                                            {r.error || r.output}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
