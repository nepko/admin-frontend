import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import useTerminal from "@/hooks/useTerminal"
import { sleep } from "@/lib/utils"
import { AttachAddon } from "@xterm/addon-attach"
import { FitAddon } from "@xterm/addon-fit"
import { Terminal } from "@xterm/xterm"
import "@xterm/xterm/css/xterm.css"
import { Terminal as TerminalIcon } from "lucide-react"
import {
    JSX,
    forwardRef,
    useCallback,
    useEffect,
    useImperativeHandle,
    useRef,
    useState,
} from "react"
import { useTranslation } from "react-i18next"
import { useParams } from "react-router-dom"
import { toast } from "sonner"

import {
    registerTerminalInput,
    setLastTerminalSelection,
    unregisterTerminalInput,
} from "@/lib/terminalBus"

import { FMCard } from "./fm"
import { Button } from "./ui/button"
import { IconButton } from "./xui/icon-button"

interface XtermProps {
    wsUrl: string
    setClose: React.Dispatch<React.SetStateAction<boolean>>
    /** 会话 ID，用于把该终端注册到 terminalBus，供 AI 助手注入命令。 */
    sessionId?: string
    /** 连接断开时回调（用于多标签场景标记该标签已断线）。 */
    onDisconnect?: () => void
}

export const XtermComponent = forwardRef<HTMLDivElement, XtermProps & JSX.IntrinsicElements["div"]>(
    ({ wsUrl, setClose, sessionId, onDisconnect, ...props }, ref) => {
        const { t } = useTranslation()
        const terminalIdRef = useRef<HTMLDivElement>(null)
        const terminalRef = useRef<Terminal | null>(null)
        const wsRef = useRef<WebSocket | null>(null)
        const onDisconnectRef = useRef(onDisconnect)
        onDisconnectRef.current = onDisconnect

        useImperativeHandle(ref, () => {
            return {
                ...terminalIdRef.current!,
                async requestFullscreen() {
                    await terminalIdRef.current?.requestFullscreen()
                },
            }
        }, [])

        const fitAddon = useRef(new FitAddon()).current
        const sendResize = useRef(false)

        const doResize = useCallback(() => {
            if (!terminalIdRef.current) return

            fitAddon.fit()

            const dimensions = fitAddon.proposeDimensions()

            if (dimensions) {
                const prefix = new Int8Array([1])
                const resizeMessage = new TextEncoder().encode(
                    JSON.stringify({
                        Rows: dimensions.rows,
                        Cols: dimensions.cols,
                    }),
                )

                const msg = new Int8Array(prefix.length + resizeMessage.length)
                msg.set(prefix)
                msg.set(resizeMessage, prefix.length)

                wsRef.current?.send(msg)
            }
        }, [fitAddon])

        const onResize = useCallback(async () => {
            if (sendResize.current) return

            sendResize.current = true
            try {
                await sleep(1500)
                doResize()
            } catch (error) {
                console.error("resize error", error)
            } finally {
                sendResize.current = false
            }
        }, [doResize])

        useEffect(() => {
            const container = terminalIdRef.current
            if (!container) return

            const terminal = new Terminal({
                cursorBlink: true,
                fontSize: 16,
            })
            const url = new URL(wsUrl, window.location.origin)
            url.protocol = url.protocol.replace("http", "ws")
            const ws = new WebSocket(url)
            ws.binaryType = "arraybuffer"

            terminalRef.current = terminal
            wsRef.current = ws

            const attachAddon = new AttachAddon(ws)
            terminal.loadAddon(attachAddon)
            terminal.loadAddon(fitAddon)
            terminal.open(container)
            // 二开：把终端选区上报到 terminalBus，供 AI 助手「解释选中 / 诊断」模式复用。
            terminal.onSelectionChange(() => {
                if (sessionId) setLastTerminalSelection(sessionId, terminal.getSelection())
            })
            window.addEventListener("resize", onResize)

            ws.onopen = () => {
                onResize()
                if (sessionId) {
                    registerTerminalInput(sessionId, (text: string) => {
                        if (ws.readyState === WebSocket.OPEN) ws.send(text)
                    })
                }
            }
            ws.onclose = (e: CloseEvent) => {
                if (sessionId) unregisterTerminalInput(sessionId)
                terminal.dispose()
                setClose(true)
                onDisconnectRef.current?.()
                // 二开：识别后端空闲超时断开（close code 4000 / reason idle-timeout）并提示。
                if (e.code === 4000 || (e.reason && e.reason.includes("idle"))) {
                    toast.warning(t("TerminalIdleDisconnect"))
                }
            }
            ws.onerror = (e) => {
                console.error(e)
                toast.error(t("TerminalWsError"), { description: t("TerminalWsErrorDesc") })
            }

            return () => {
                window.removeEventListener("resize", onResize)
                ws.onopen = null
                ws.onclose = null
                ws.onerror = null
                ws.close()
                terminal.dispose()
                if (wsRef.current === ws) wsRef.current = null
                if (terminalRef.current === terminal) terminalRef.current = null
            }
        }, [fitAddon, onResize, setClose, wsUrl, sessionId])

        return <div ref={terminalIdRef} {...props} />
    },
)

export const TerminalPage = () => {
    const { t } = useTranslation()
    const { id } = useParams<{ id: string }>()
    const [open, setOpen] = useState(false)
    const terminal = useTerminal(id ? parseInt(id) : undefined)
    const terminalIdRef = useRef<HTMLDivElement>(null)
    return (
        <div className="px-8">
            <div className="flex mt-6 mb-4">
                <h1 className="flex-1 text-3xl font-bold tracking-tight">{`Terminal (${id})`}</h1>
                <div className="flex ml-auto self-end sm:self-auto gap-2 flex-wrap shrink-0">
                    <IconButton
                        icon="expand"
                        onClick={async () => {
                            await terminalIdRef.current?.requestFullscreen()
                        }}
                    />
                    <FMCard id={id} />
                </div>
            </div>
            {terminal?.session_id ? (
                <XtermComponent
                    ref={terminalIdRef}
                    className="max-h-[60%] mb-5 overflow-auto"
                    wsUrl={`/api/v1/ws/terminal/${terminal?.session_id}`}
                    sessionId={terminal?.session_id}
                    setClose={setOpen}
                />
            ) : (
                <p>{t("ServerOffline")}</p>
            )}
            <AlertDialog open={open} onOpenChange={setOpen}>
                <AlertDialogContent className="sm:max-w-lg">
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t("SessionCompleted")}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {t("SessionCompletedDesc")}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogAction asChild>
                            <Button onClick={window.close}>{t("Close")}</Button>
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}

export const TerminalButton = ({ id, menuItem = false }: { id: number; menuItem?: boolean }) => {
    const { t } = useTranslation()
    const handleOpenNewTab = () => {
        window.open(`/dashboard/terminal/${id}`, "_blank")
    }

    if (menuItem) {
        return (
            <button
                type="button"
                onClick={handleOpenNewTab}
                className="flex w-full items-center text-sm px-2 py-2 hover:bg-accent hover:text-accent-foreground"
            >
                <TerminalIcon className="h-4 w-4 mr-2" />
                <span>{t("Terminal")}</span>
            </button>
        )
    }

    return <IconButton variant="outline" icon="terminal" onClick={handleOpenNewTab} />
}
