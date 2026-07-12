import { type LucideIcon, Loader2, Inbox, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"

interface LoadingStateProps {
    label?: string
    className?: string
}

export function LoadingState({ label, className = "" }: LoadingStateProps) {
    return (
        <div
            className={`flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground ${className}`}
        >
            <Loader2 className="size-6 animate-spin text-brand" />
            {label && <p className="text-sm">{label}</p>}
        </div>
    )
}

interface EmptyStateProps {
    icon?: LucideIcon
    title: string
    description?: string
    action?: React.ReactNode
    className?: string
}

export function EmptyState({
    icon: Icon = Inbox,
    title,
    description,
    action,
    className = "",
}: EmptyStateProps) {
    return (
        <div
            className={`flex flex-col items-center justify-center gap-3 py-16 text-center ${className}`}
        >
            <div className="flex size-12 items-center justify-center rounded-2xl bg-brand/10 text-brand">
                <Icon className="size-6" />
            </div>
            <div className="space-y-1">
                <p className="font-medium text-foreground">{title}</p>
                {description && (
                    <p className="max-w-xs text-sm text-muted-foreground">{description}</p>
                )}
            </div>
            {action}
        </div>
    )
}

interface ErrorStateProps {
    icon?: LucideIcon
    message?: string
    onRetry?: () => void
    className?: string
}

export function ErrorState({
    icon: Icon = AlertTriangle,
    message,
    onRetry,
    className = "",
}: ErrorStateProps) {
    return (
        <div
            className={`flex flex-col items-center justify-center gap-3 py-16 text-center text-destructive ${className}`}
        >
            <div className="flex size-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
                <Icon className="size-6" />
            </div>
            {/* 暗色下 text-destructive（近黑深红）叠在近黑卡片上几乎不可读，
                错误信息改用 text-foreground 保证 AA；红色语义由上方图标圆兜底。 */}
            <p className="text-sm text-foreground">{message || "加载失败，请稍后重试"}</p>
            {onRetry && (
                <Button size="sm" variant="outline" onClick={onRetry}>
                    重试
                </Button>
            )}
        </div>
    )
}
