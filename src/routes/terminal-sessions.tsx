import { listTerminalSessions } from "@/api/terminal"
import { Button } from "@/components/ui/button"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { ModelTerminalSessionInfo } from "@/types"
import { RefreshCw } from "lucide-react"
import { useEffect } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import useSWR from "swr"

export default function TerminalSessionsPage() {
    const { t } = useTranslation()
    const { data, mutate, isLoading, error } = useSWR<ModelTerminalSessionInfo[]>(
        "/api/v1/terminal/sessions",
        listTerminalSessions,
    )

    useEffect(() => {
        if (!error) return
        toast(t("Error"), {
            description: t("Results.ErrorFetchingResource", {
                error: (error as Error)?.message ?? String(error),
            }),
        })
    }, [error, t])

    return (
        <div className="px-3">
            <div className="flex mt-6 mb-4 items-center justify-between">
                <div>
                    <h2 className="text-lg font-semibold">{t("TerminalSessions")}</h2>
                    <p className="text-sm text-muted-foreground">{t("TerminalSessionsDescription")}</p>
                </div>
                <Button variant="outline" onClick={() => mutate()}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    {t("Refresh")}
                </Button>
            </div>

            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>{t("Session")}</TableHead>
                        <TableHead>{t("Server")}</TableHead>
                        <TableHead>{t("Status")}</TableHead>
                        <TableHead>{t("CreatedAt")}</TableHead>
                        <TableHead>{t("ClosedAt")}</TableHead>
                        <TableHead>{t("Actions")}</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {isLoading ? (
                        <TableRow>
                            <TableCell colSpan={6} className="h-24 text-center">
                                {t("Loading")}...
                            </TableCell>
                        </TableRow>
                    ) : !data || data.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                {t("NoResults")}
                            </TableCell>
                        </TableRow>
                    ) : (
                        data.map((session) => (
                            <TableRow key={session.session_id}>
                                <TableCell className="font-mono text-xs">{session.session_id}</TableCell>
                                <TableCell>{session.server_name || session.server_id}</TableCell>
                                <TableCell>{session.active ? t("Active") : t("Closed")}</TableCell>
                                <TableCell>{formatUnixTime(session.created_at)}</TableCell>
                                <TableCell>{session.closed_at ? formatUnixTime(session.closed_at) : "-"}</TableCell>
                                <TableCell>
                                    {session.active ? (
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => window.open("/dashboard/terminal/" + session.server_id, "_blank")}
                                        >
                                            {t("Open")}
                                        </Button>
                                    ) : null}
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>
        </div>
    )
}

function formatUnixTime(value?: number) {
    if (!value) return "-"
    return new Date(value * 1000).toLocaleString()
}
