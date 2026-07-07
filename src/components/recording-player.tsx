import { FitAddon } from "@xterm/addon-fit"
import { Terminal } from "@xterm/xterm"
import "@xterm/xterm/css/xterm.css"
import { Pause, Play, RotateCcw } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { RecordingChunk } from "@/types"

import { useTranslation } from "react-i18next"

import { Button } from "./ui/button"

function base64ToBytes(b64: string): Uint8Array {
    const bin = atob(b64)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    return bytes
}

interface RecordingPlayerProps {
    chunks: RecordingChunk[]
}

export function RecordingPlayer({ chunks }: RecordingPlayerProps) {
    const { t } = useTranslation()
    const containerRef = useRef<HTMLDivElement>(null)
    const termRef = useRef<Terminal | null>(null)
    const fitRef = useRef(new FitAddon())
    const [index, setIndex] = useState(chunks.length)
    const [playing, setPlaying] = useState(false)
    const playTimer = useRef<number | null>(null)

    const renderUpTo = useCallback(
        (target: number) => {
            const term = termRef.current
            if (!term) return
            term.clear()
            const end = Math.max(0, Math.min(target, chunks.length))
            for (let i = 0; i < end; i++) {
                term.write(base64ToBytes(chunks[i].data))
            }
        },
        [chunks],
    )

    useEffect(() => {
        const container = containerRef.current
        if (!container) return
        const term = new Terminal({ fontSize: 14, cursorBlink: false, disableStdin: true })
        termRef.current = term
        term.loadAddon(fitRef.current)
        term.open(container)
        fitRef.current.fit()
        renderUpTo(chunks.length)

        const onResize = () => fitRef.current.fit()
        window.addEventListener("resize", onResize)
        return () => {
            window.removeEventListener("resize", onResize)
            term.dispose()
            termRef.current = null
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
        if (!playing) {
            if (playTimer.current) window.clearTimeout(playTimer.current)
            return
        }
        if (index >= chunks.length) {
            setPlaying(false)
            return
        }
        const nextTs = chunks[index]?.ts ?? 0
        const prevTs = index > 0 ? chunks[index - 1]?.ts ?? nextTs : nextTs
        const deltaMs = Math.max(20, Math.min(2000, (nextTs - prevTs) || 200))
        playTimer.current = window.setTimeout(() => {
            const ni = index + 1
            setIndex(ni)
            renderUpTo(ni)
        }, deltaMs)
        return () => {
            if (playTimer.current) window.clearTimeout(playTimer.current)
        }
    }, [playing, index, chunks, renderUpTo])

    const handleScrub = (value: number[]) => {
        setPlaying(false)
        const v = value[0] ?? 0
        setIndex(v)
        renderUpTo(v)
    }

    const handlePlay = () => {
        if (index >= chunks.length) {
            setIndex(0)
            renderUpTo(0)
        }
        setPlaying(true)
    }

    const handleRestart = () => {
        setPlaying(false)
        setIndex(0)
        renderUpTo(0)
    }

    if (chunks.length === 0) {
        return (
            <div className="flex h-[420px] items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
                {t("RecordingEmptyHint")}
            </div>
        )
    }

    return (
        <div className="space-y-3">
            <div className="rounded-lg border border-border bg-[#0B0E14] p-2">
                <div ref={containerRef} className="h-[420px] overflow-hidden" />
            </div>
            <div className="flex items-center gap-3">
                <Button size="sm" variant="outline" onClick={handlePlay} disabled={playing}>
                    <Play className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="outline" onClick={() => setPlaying(false)} disabled={!playing}>
                    <Pause className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="outline" onClick={handleRestart}>
                    <RotateCcw className="h-4 w-4" />
                </Button>
                <div className="flex-1">
                    <input
                        type="range"
                        min={0}
                        max={Math.max(1, chunks.length)}
                        step={1}
                        value={index}
                        onChange={(e) => handleScrub([Number(e.target.value)])}
                        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary"
                    />
                </div>
                <span className="w-20 text-right text-xs text-muted-foreground">
                    {index}/{chunks.length}
                </span>
            </div>
        </div>
    )
}
