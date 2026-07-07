import { Columns2, X } from "lucide-react"
import { useTranslation } from "react-i18next"
import { create } from "zustand"

import { XtermComponent } from "./terminal"
import { Button } from "./ui/button"

export interface TerminalTab {
    key: string
    serverId: number
    sessionId: string
    name: string
}

interface TerminalTabsState {
    tabs: TerminalTab[]
    activeKey: string | null
    split: boolean
    addTab: (t: TerminalTab) => void
    removeTab: (key: string) => void
    setActive: (key: string) => void
    toggleSplit: () => void
    clear: () => void
}

export const useTerminalTabs = create<TerminalTabsState>((set) => ({
    tabs: [],
    activeKey: null,
    split: false,
    addTab: (t) =>
        set((s) => ({
            tabs: [...s.tabs.filter((x) => x.key !== t.key), t],
            activeKey: t.key,
        })),
    removeTab: (key) =>
        set((s) => {
            const tabs = s.tabs.filter((x) => x.key !== key)
            const activeKey =
                s.activeKey === key ? (tabs[tabs.length - 1]?.key ?? null) : s.activeKey
            return { tabs, activeKey }
        }),
    setActive: (key) => set({ activeKey: key }),
    toggleSplit: () => set((s) => ({ split: !s.split })),
    clear: () => set({ tabs: [], activeKey: null }),
}))

export function TerminalTabs() {
    const { t } = useTranslation()
    const { tabs, activeKey, split, removeTab, setActive, toggleSplit } = useTerminalTabs()

    if (tabs.length === 0) {
        return (
            <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
                {t("TerminalEmptyHint")}
            </div>
        )
    }

    const visible = split ? tabs : tabs.filter((t) => t.key === activeKey)

    return (
        <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-1 rounded-lg border border-border bg-muted/40 p-1">
                {tabs.map((t) => (
                    <div
                        key={t.key}
                        onClick={() => setActive(t.key)}
                        className={`flex cursor-pointer items-center gap-1 rounded-md px-3 py-1 text-sm transition-colors ${
                            t.key === activeKey
                                ? "bg-primary text-primary-foreground"
                                : "hover:bg-accent"
                        }`}
                    >
                        <span className="max-w-32 truncate">{t.name}</span>
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation()
                                removeTab(t.key)
                            }}
                            className="rounded p-0.5 hover:bg-black/20"
                        >
                            <X className="h-3 w-3" />
                        </button>
                    </div>
                ))}
                <div className="ml-auto">
                    <Button
                        size="sm"
                        variant={split ? "default" : "outline"}
                        onClick={toggleSplit}
                        title="分屏"
                    >
                        <Columns2 className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            <div className={split ? "grid grid-cols-1 gap-2 lg:grid-cols-2" : "grid grid-cols-1"}>
                {visible.map((t) => (
                    <div
                        key={t.key}
                        className="overflow-hidden rounded-lg border border-border bg-[#0B0E14]"
                    >
                        <XtermComponent
                            className="h-[420px] overflow-auto"
                            wsUrl={`/api/v1/ws/terminal/${t.sessionId}`}
                            sessionId={t.sessionId}
                            setClose={() => {}}
                        />
                    </div>
                ))}
            </div>
        </div>
    )
}
