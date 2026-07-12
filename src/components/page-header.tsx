import { cn } from "@/lib/utils"
import type { ReactNode } from "react"

interface PageHeaderProps {
    title: ReactNode
    description?: ReactNode
    actions?: ReactNode
    className?: string
}

/**
 * 统一页面标题区：品牌渐变标题 + 描述 + 右侧操作槽。
 * 各管理页统一复用，保证信息层级与视觉一致性。
 */
export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
    return (
        <div
            className={cn(
                "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
                className,
            )}
        >
            <div className="min-w-0">
                <h1 className="text-2xl font-bold tracking-tight text-gradient">{title}</h1>
                {description && (
                    <p className="mt-1 text-sm text-muted-foreground">{description}</p>
                )}
            </div>
            {actions && (
                <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
            )}
        </div>
    )
}
