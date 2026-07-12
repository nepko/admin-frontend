import { cn } from "@/lib/utils"
import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"

import { Card } from "@/components/ui/card"

interface StatCardProps {
    label: string
    value: ReactNode
    icon: LucideIcon
    iconClassName?: string
    hint?: string
}

/**
 * 概览指标卡：玻璃拟态 + 悬浮微动效 + 品牌色图标。
 * 用于各页面顶部的总览带，统一信息层级与视觉语言。
 */
export function StatCard({ label, value, icon: Icon, iconClassName, hint }: StatCardProps) {
    return (
        <Card className="card-hover glass flex items-center gap-4 p-4">
            <div
                className={cn(
                    "flex size-11 shrink-0 items-center justify-center rounded-xl",
                    iconClassName ?? "bg-brand/10 text-brand",
                )}
            >
                <Icon className="size-5" />
            </div>
            <div className="min-w-0">
                <p className="text-xsm font-medium text-muted-foreground">{label}</p>
                <p className="text-2xl font-bold leading-tight">{value}</p>
                {hint && <p className="truncate text-xsm text-muted-foreground">{hint}</p>}
            </div>
        </Card>
    )
}
