import { swrFetcher } from "@/api/api"
import { deleteServer, forceUpdateServer } from "@/api/server"
import { ActionButtonGroup } from "@/components/action-button-group"
import { BatchMoveServerIcon } from "@/components/batch-move-server-icon"
import { CopyButton } from "@/components/copy-button"
import { HeaderButtonGroup } from "@/components/header-button-group"
import { InstallCommandsMenu } from "@/components/install-commands"
import { NoteMenu } from "@/components/note-menu"
import { ServerCard } from "@/components/server"
import { ServerConfigCard } from "@/components/server-config"
import { ServerConfigCardBatch } from "@/components/server-config-batch"
import { TerminalButton } from "@/components/terminal"
import { Checkbox } from "@/components/ui/checkbox"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { IconButton } from "@/components/xui/icon-button"
import { Badge } from "@/components/ui/badge"
import { useServer } from "@/hooks/useServer"
import { joinIP } from "@/lib/utils"
import { computeServerStats } from "@/lib/server-stats"
import { ServerOff } from "lucide-react"
import { EmptyState, LoadingState } from "@/components/state"
import { ModelServerTaskResponse, ModelServer as Server } from "@/types"
import { ColumnDef, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table"
import { useEffect, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import useSWR from "swr"
import { StatCard } from "@/components/stat-card"
import { Activity, Cpu, Globe, MemoryStick, Server as ServerIcon, Users } from "lucide-react"

function UsageBar({ label, value }: { label: string; value: number }) {
    const v = Math.max(0, Math.min(100, Math.round(value)))
    const barColor =
        v > 85 ? "bg-red-500" : v > 60 ? "bg-amber-500" : "bg-brand"
    return (
        <div className="flex items-center gap-2">
            <span className="w-8 shrink-0 text-[10px] text-muted-foreground">{label}</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                    className={`h-full rounded-full ${barColor} transition-all duration-500`}
                    style={{ width: `${v}%` }}
                />
            </div>
            <span className="w-9 shrink-0 text-right text-[10px] tabular-nums text-muted-foreground">
                {v}%
            </span>
        </div>
    )
}

export default function ServerPage() {
    const { t } = useTranslation()
    // 列表只挂载时取一次，不后台轮询——避免持续打 API 造成资源占用
    // （初衷是「优化前端展示、轻量少占用」，实时刷新不属于此范畴）。
    const { data, mutate, error, isLoading } = useSWR<Server[]>("/api/v1/server", swrFetcher, {
        revalidateOnFocus: false,
        revalidateOnReconnect: false,
    })
    const { serverGroups } = useServer()
    const { data: servicesData } = useSWR<Array<unknown>>(
        "/api/v1/service",
        swrFetcher,
        { revalidateOnFocus: false, revalidateOnReconnect: false },
    )

    useEffect(() => {
        if (error)
            toast(t("Error"), {
                description: t("Results.ErrorFetchingResource", { error: error.message }),
            })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [error])

    const columns: ColumnDef<Server>[] = [
        {
            id: "select",
            header: ({ table }) => (
                <Checkbox
                    checked={
                        table.getIsAllPageRowsSelected() ||
                        (table.getIsSomePageRowsSelected() && "indeterminate")
                    }
                    onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
                    aria-label="Select all"
                />
            ),
            cell: ({ row }) => (
                <Checkbox
                    checked={row.getIsSelected()}
                    onCheckedChange={(value) => row.toggleSelected(!!value)}
                    aria-label="Select row"
                />
            ),
            enableSorting: false,
            enableHiding: false,
        },
        {
            header: "ID",
            accessorKey: "id",
            accessorFn: (row) => `${row.id}(${row.display_index})`,
        },
        {
            header: t("Name"),
            accessorKey: "name",
            accessorFn: (row) => row.name,
            cell: ({ row }) => {
                const s = row.original
                return <div className="max-w-24 whitespace-normal break-words">{s.name}</div>
            },
        },
        {
            header: t("Group"),
            accessorKey: "groups",
            accessorFn: (row) => {
                return (
                    serverGroups
                        ?.filter((sg) => sg.servers?.includes(row.id))
                        .map((sg) => sg.group.id) || []
                )
            },
        },
        {
            id: "owner",
            header: t("Owner"),
            // Backend Server.MarshalJSON always emits owner.id; username is
            // omitted for uid=0 (legacy global agent secret) and for users
            // that no longer exist. Render uid=0 as "Global Agent" and a
            // missing username as "Unknown user (#id)" so deleted-user rows
            // stay debuggable instead of silently appearing ownerless.
            accessorFn: (row) => {
                if (!row.owner) return ""
                if (row.owner.id === 0) return t("GlobalAgent")
                return row.owner.username || t("UnknownUser", { id: row.owner.id })
            },
            cell: ({ row }) => {
                const owner = row.original.owner
                if (!owner) {
                    return <span className="text-muted-foreground">-</span>
                }
                if (owner.id === 0) {
                    return <span>{t("GlobalAgent")}</span>
                }
                const label = owner.username || t("UnknownUser", { id: owner.id })
                return (
                    <div
                        className="max-w-32 whitespace-normal break-words"
                        title={`uid=${owner.id}`}
                    >
                        {label}
                    </div>
                )
            },
        },
        {
            id: "ip",
            header: "IP",
            cell: ({ row }) => {
                const s = row.original
                return (
                    <div className="max-w-24 whitespace-normal break-words">
                        {joinIP(s.geoip?.ip)}
                    </div>
                )
            },
        },
        {
            header: t("Version"),
            accessorKey: "host.version",
            accessorFn: (row) => row.host.version || t("Unknown"),
        },
        {
            id: "resource",
            header: "资源",
            enableSorting: false,
            cell: ({ row }) => {
                const s = row.original
                const cpu = Math.round(s.state?.cpu ?? 0)
                const memTotal = s.host?.mem_total ?? 0
                const memUsed = s.state?.mem_used ?? 0
                const mem = memTotal ? Math.round((memUsed / memTotal) * 100) : 0
                const diskTotal = s.host?.disk_total ?? 0
                const diskUsed = s.state?.disk_used ?? 0
                const disk = diskTotal ? Math.round((diskUsed / diskTotal) * 100) : 0
                return (
                    <div className="flex w-36 flex-col gap-1.5">
                        <UsageBar label={t("CPU")} value={cpu} />
                        <UsageBar label={t("Memory")} value={mem} />
                        <UsageBar label={t("Disk")} value={disk} />
                    </div>
                )
            },
        },
        {
            header: t("EnableDDNS"),
            accessorKey: "enableDDNS",
            accessorFn: (row) => row.enable_ddns ?? false,
            cell: ({ row }) => {
                const on = row.original.enable_ddns
                return (
                    <Badge
                        className={
                            on
                                ? "border-emerald-500/20 bg-emerald-500/15 text-emerald-500"
                                : "border-transparent bg-muted text-muted-foreground"
                        }
                    >
                        {on ? "已启用" : "未启用"}
                    </Badge>
                )
            },
        },
        {
            header: t("HideForGuest"),
            accessorKey: "hideForGuest",
            accessorFn: (row) => row.hide_for_guest ?? false,
        },
        {
            id: "note",
            header: t("Note"),
            cell: ({ row }) => {
                const s = row.original
                return <NoteMenu note={{ private: s.note, public: s.public_note }} />
            },
        },
        {
            id: "uuid",
            header: "UUID",
            cell: ({ row }) => {
                const s = row.original
                return <CopyButton text={s.uuid} />
            },
        },
        {
            id: "actions",
            header: t("Actions"),
            cell: ({ row }) => {
                const s = row.original
                return (
                    <ActionButtonGroup
                        className="flex gap-2"
                        delete={{ fn: deleteServer, id: s.id, mutate: mutate }}
                    >
                        <>
                            <ServerCard mutate={mutate} data={s} />
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <IconButton
                                        icon="more"
                                        variant="outline"
                                        aria-label="More actions"
                                    />
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem asChild>
                                        <TerminalButton id={s.id} menuItem />
                                    </DropdownMenuItem>
                                    <DropdownMenuItem asChild>
                                        <ServerConfigCard sid={s.id} variant="ghost" menuItem />
                                    </DropdownMenuItem>
                                    <DropdownMenuItem asChild>
                                        <InstallCommandsMenu uuid={s.uuid} menuItem />
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </>
                    </ActionButtonGroup>
                )
            },
        },
    ]

    const dataCache = useMemo(() => {
        return data ?? []
    }, [data])

    // 聚合逻辑抽到 computeServerStats（数据契约→UI 的可测守卫，见 lib/server-stats.ts）
    const stats = useMemo(
        () =>
            computeServerStats(
                dataCache,
                serverGroups?.length ?? 0,
                servicesData?.length ?? 0,
            ),
        [dataCache, serverGroups, servicesData],
    )

    const table = useReactTable({
        data: dataCache,
        columns,
        getCoreRowModel: getCoreRowModel(),
    })

    const selectedRows = table.getSelectedRowModel().rows

    return (
        <div className="px-3 max-w-7xl mx-auto">
            <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-3">
                <StatCard
                    label={t("Server")}
                    value={stats.total}
                    icon={ServerIcon}
                    iconClassName="bg-brand/10 text-brand"
                    hint="服务器总数"
                />
                <StatCard
                    label={t("Group")}
                    value={stats.groups}
                    icon={Users}
                    iconClassName="bg-sky-500/10 text-sky-500"
                    hint="服务器分组"
                />
                <StatCard
                    label={t("EnableDDNS")}
                    value={stats.ddns}
                    icon={Globe}
                    iconClassName="bg-emerald-500/10 text-emerald-500"
                    hint="已启用 DDNS"
                />
                <StatCard
                    label="平均 CPU"
                    value={`${stats.avgCpu}%`}
                    icon={Cpu}
                    iconClassName="bg-brand/10 text-brand"
                    hint="全部节点均值"
                />
                <StatCard
                    label="平均内存"
                    value={`${stats.avgMem}%`}
                    icon={MemoryStick}
                    iconClassName="bg-fuchsia-500/10 text-fuchsia-500"
                    hint="全部节点均值"
                />
                <StatCard
                    label={t("Service")}
                    value={stats.services}
                    icon={Activity}
                    iconClassName="bg-amber-500/10 text-amber-500"
                    hint="监控服务数"
                />
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between w-full gap-3 mt-6 mb-4">
                <h1 className="text-2xl font-bold tracking-tight text-gradient">{t("Server")}</h1>
                <HeaderButtonGroup
                    className="flex gap-2 flex-wrap shrink-0"
                    delete={{
                        fn: deleteServer,
                        id: selectedRows.map((r) => r.original.id),
                        mutate: mutate,
                    }}
                >
                    <IconButton
                        icon="update"
                        onClick={async () => {
                            const id = selectedRows.map((r) => r.original.id)
                            if (id.length < 1) {
                                toast(t("Error"), {
                                    description: t("Results.SelectAtLeastOneServer"),
                                })
                                return
                            }

                            let resp: ModelServerTaskResponse = {}
                            try {
                                resp = await forceUpdateServer(id)
                            } catch (e) {
                                console.error(e)
                                toast(t("Error"), {
                                    description: t("Results.UnExpectedError"),
                                })
                                return
                            }
                            toast(t("Done"), {
                                description:
                                    t("Results.ForceUpdate") +
                                    (resp.success?.length
                                        ? t(`Success`) + ` [${resp.success.join(",")}]`
                                        : "") +
                                    (resp.failure?.length
                                        ? t(`Failure`) + ` [${resp.failure.join(",")}]`
                                        : "") +
                                    (resp.offline?.length
                                        ? t(`Offline`) + ` [${resp.offline.join(",")}]`
                                        : ""),
                            })
                        }}
                    />
                    <BatchMoveServerIcon serverIds={selectedRows.map((r) => r.original.id)} />
                    <ServerConfigCardBatch
                        sid={selectedRows.map((r) => r.original.id)}
                        className="shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] bg-yellow-600 text-white hover:bg-yellow-500 dark:hover:bg-yellow-700 rounded-lg"
                    />
                    <InstallCommandsMenu className="shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] bg-blue-700 text-white hover:bg-blue-600 dark:hover:bg-blue-800 rounded-lg" />
                </HeaderButtonGroup>
            </div>
            <div className="glass rounded-xl overflow-x-auto">
                <Table className="min-w-[960px]">
                    <TableHeader className="sticky top-0 bg-background z-10">
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map((header) => {
                                    return (
                                        <TableHead key={header.id} className="text-sm">
                                            {header.isPlaceholder
                                                ? null
                                                : flexRender(
                                                    header.column.columnDef.header,
                                                    header.getContext(),
                                                )}
                                        </TableHead>
                                    )
                                })}
                            </TableRow>
                        ))}
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={columns.length} className="h-40">
                                    <LoadingState label={t("Loading") + "..."} />
                                </TableCell>
                            </TableRow>
                        ) : table.getRowModel().rows?.length ? (
                            table.getRowModel().rows.map((row) => (
                                <TableRow
                                    key={row.id}
                                    data-state={row.getIsSelected() && "selected"}
                                >
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell key={cell.id} className="text-xsm">
                                            {flexRender(
                                                cell.column.columnDef.cell,
                                                cell.getContext(),
                                            )}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                    ) : (
                        <TableRow>
                            <TableCell colSpan={columns.length} className="h-40">
                                <EmptyState icon={ServerOff} title={t("NoResults")} />
                            </TableCell>
                        </TableRow>
                    )}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}
