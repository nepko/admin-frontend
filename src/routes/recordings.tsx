import { getRecording } from "@/api/terminal"
import { RecordingChunk, RecordingSessionMeta } from "@/types"
import { swrFetcher } from "@/api/api"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { RecordingPlayer } from "@/components/recording-player"
import { useAuth } from "@/hooks/useAuth"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import useSWR from "swr"

function fmtTime(ts: number) {
    if (!ts) return "-"
    return new Date(ts).toLocaleString()
}

export default function RecordingsPage() {
    const { t } = useTranslation()
    const { profile } = useAuth()
    const isAdmin = profile?.role === 0

    const { data, error, isLoading } = useSWR<RecordingSessionMeta[]>(
        "/api/v1/terminal/recordings",
        swrFetcher,
    )

    const [active, setActive] = useState<RecordingSessionMeta | null>(null)
    const [chunks, setChunks] = useState<RecordingChunk[]>([])
    const [loadingChunks, setLoadingChunks] = useState(false)

    useEffect(() => {
        if (!active) return
        let cancelled = false
        setLoadingChunks(true)
        getRecording(active.session_id)
            .then((c) => {
                if (!cancelled) setChunks(c)
            })
            .catch(() => {
                if (!cancelled) setChunks([])
            })
            .finally(() => {
                if (!cancelled) setLoadingChunks(false)
            })
        return () => {
            cancelled = true
        }
    }, [active])

    if (!isAdmin) {
        return <div className="px-3 py-4 text-muted-foreground">{t("PermissionDenied")}</div>
    }

    const rows = data ?? []

    return (
        <div className="px-3 py-4 space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>{t("TerminalRecordings")}</CardTitle>
                    <CardDescription>{t("TerminalRecordingsDesc")}</CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <p className="text-sm text-muted-foreground">{t("Loading")}</p>
                    ) : error ? (
                        <p className="text-sm text-destructive">{error.message}</p>
                    ) : rows.length === 0 ? (
                        <p className="h-24 text-center text-sm text-muted-foreground">
                            {t("NoResults")}
                        </p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>{t("Server")}</TableHead>
                                    <TableHead>{t("SessionID")}</TableHead>
                                    <TableHead>{t("Chunks")}</TableHead>
                                    <TableHead>{t("Start")}</TableHead>
                                    <TableHead>{t("End")}</TableHead>
                                    <TableHead className="text-right">{t("Actions")}</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {rows.map((row) => (
                                    <TableRow key={row.session_id}>
                                        <TableCell>{row.server_name || row.server_id}</TableCell>
                                        <TableCell className="max-w-[160px] truncate font-mono text-xs">
                                            {row.session_id}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="secondary">{row.chunks}</Badge>
                                        </TableCell>
                                        <TableCell className="text-xs text-muted-foreground">
                                            {fmtTime(row.start_ts)}
                                        </TableCell>
                                        <TableCell className="text-xs text-muted-foreground">
                                            {fmtTime(row.end_ts)}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => setActive(row)}
                                            >
                                                {t("Replay")}
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
                <DialogContent className="sm:max-w-4xl">
                    <DialogHeader>
                        <DialogTitle>
                            {t("Replay")} · {active?.server_name || active?.server_id}
                        </DialogTitle>
                    </DialogHeader>
                    {loadingChunks ? (
                        <p className="py-12 text-center text-sm text-muted-foreground">
                            {t("Loading")}
                        </p>
                    ) : (
                        <RecordingPlayer chunks={chunks} />
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}
