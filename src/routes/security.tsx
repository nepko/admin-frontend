import { swrFetcher } from "@/api/api"
import {
    unbanIP,
    unlockAccount,
    updateLoginProtection,
} from "@/api/security"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { useAuth } from "@/hooks/useAuth"
import { LoginLockEntry, LoginProtectionConfig } from "@/types"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import useSWR from "swr"

export default function SecurityPage() {
    const { t } = useTranslation()
    const { profile } = useAuth()
    const isAdmin = profile?.role === 0

    const { data: config, mutate: mutateConfig } = useSWR<LoginProtectionConfig>(
        "/api/v1/security/login-protection",
        swrFetcher,
        { keepPreviousData: true },
    )
    const { data: locks, mutate: mutateLocks, error } = useSWR<LoginLockEntry[]>(
        "/api/v1/security/locks",
        swrFetcher,
        { keepPreviousData: true },
    )

    const [form, setForm] = useState<LoginProtectionConfig>({
        enabled: false,
        max_attempts: 5,
        lock_minutes: 15,
        ban_ip_threshold: 10,
        ban_minutes: 60,
        allowed_cidrs: "",
    })
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        if (config) setForm(config)
    }, [config])

    useEffect(() => {
        if (error) toast(t("Error"), { description: error.message })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [error])

    async function onSave() {
        setSaving(true)
        try {
            await updateLoginProtection(form)
            await mutateConfig()
            toast.success(t("Saved"))
        } catch (e: any) {
            toast.error(e?.message || t("NetworkError"))
        } finally {
            setSaving(false)
        }
    }

    async function onUnlock(target: string) {
        try {
            await unlockAccount(target)
            await mutateLocks()
            toast.success(t("Unlocked"))
        } catch (e: any) {
            toast.error(e?.message || t("NetworkError"))
        }
    }

    async function onUnban(target: string) {
        try {
            await unbanIP(target)
            await mutateLocks()
            toast.success(t("Unbanned"))
        } catch (e: any) {
            toast.error(e?.message || t("NetworkError"))
        }
    }

    const lockRows = locks ?? []

    return (
        <div className="px-3 py-4 space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>{t("LoginProtection")}</CardTitle>
                    <CardDescription>{t("LoginProtectionDesc")}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between rounded-lg border border-border p-3">
                        <div>
                            <Label className="text-sm font-medium">{t("Enable")}</Label>
                            <p className="text-xs text-muted-foreground">{t("LoginProtectionEnableDesc")}</p>
                        </div>
                        <Switch
                            checked={form.enabled}
                            onCheckedChange={(v) => setForm({ ...form, enabled: v })}
                        />
                    </div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="space-y-1">
                            <Label>{t("MaxAttempts")}</Label>
                            <Input
                                type="number"
                                value={form.max_attempts}
                                onChange={(e) =>
                                    setForm({ ...form, max_attempts: Number(e.target.value) })
                                }
                            />
                        </div>
                        <div className="space-y-1">
                            <Label>{t("LockMinutes")}</Label>
                            <Input
                                type="number"
                                value={form.lock_minutes}
                                onChange={(e) =>
                                    setForm({ ...form, lock_minutes: Number(e.target.value) })
                                }
                            />
                        </div>
                        <div className="space-y-1">
                            <Label>{t("BanIPThreshold")}</Label>
                            <Input
                                type="number"
                                value={form.ban_ip_threshold}
                                onChange={(e) =>
                                    setForm({ ...form, ban_ip_threshold: Number(e.target.value) })
                                }
                            />
                        </div>
                        <div className="space-y-1">
                            <Label>{t("BanMinutes")}</Label>
                            <Input
                                type="number"
                                value={form.ban_minutes}
                                onChange={(e) =>
                                    setForm({ ...form, ban_minutes: Number(e.target.value) })
                                }
                            />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <Label>{t("AllowedCIDRs")}</Label>
                        <Textarea
                            placeholder="192.168.1.0/24, 10.0.0.5"
                            value={form.allowed_cidrs}
                            onChange={(e) => setForm({ ...form, allowed_cidrs: e.target.value })}
                        />
                        <p className="text-xs text-muted-foreground">{t("AllowedCIDRsDesc")}</p>
                    </div>
                    <Button onClick={onSave} disabled={saving} className="rounded-lg">
                        {t("Save")}
                    </Button>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>{t("LoginLocks")}</CardTitle>
                    <CardDescription>{t("LoginLocksDesc")}</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>{t("Type")}</TableHead>
                                <TableHead>{t("Target")}</TableHead>
                                <TableHead>{t("Remaining")}</TableHead>
                                <TableHead>{t("Reason")}</TableHead>
                                {isAdmin && <TableHead className="text-right">{t("Actions")}</TableHead>}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {lockRows.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={isAdmin ? 5 : 4} className="h-24 text-center">
                                        {t("NoResults")}
                                    </TableCell>
                                </TableRow>
                            ) : (
                                lockRows.map((row, idx) => (
                                    <TableRow key={`${row.kind}-${row.target}-${idx}`}>
                                        <TableCell>{t(row.kind === "account" ? "Account" : "IP")}</TableCell>
                                        <TableCell className="break-all">{row.target}</TableCell>
                                        <TableCell>
                                            {row.remaining > 0
                                                ? `${row.remaining}s`
                                                : t("Expired")}
                                        </TableCell>
                                        <TableCell>{row.reason}</TableCell>
                                        {isAdmin && (
                                            <TableCell className="text-right">
                                                {row.kind === "account" ? (
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => onUnlock(row.target)}
                                                    >
                                                        {t("Unlock")}
                                                    </Button>
                                                ) : (
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => onUnban(row.target)}
                                                    >
                                                        {t("Unban")}
                                                    </Button>
                                                )}
                                            </TableCell>
                                        )}
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    )
}
