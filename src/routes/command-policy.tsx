import { swrFetcher } from "@/api/api"
import {
    approveCommandApproval,
    createCommandPolicy,
    deleteCommandPolicy,
    rejectCommandApproval,
    updateCommandPolicy,
} from "@/api/command-policy"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/hooks/useAuth"
import { CommandApproval, CommandPolicy } from "@/types"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import useSWR from "swr"

const emptyPolicy: Partial<CommandPolicy> = {
    name: "",
    type: 2,
    commands_raw: "",
    enabled: true,
    require_approval: false,
}

export default function CommandPolicyPage() {
    const { t } = useTranslation()
    const { profile } = useAuth()
    const isAdmin = profile?.role === 0

    const { data: policies, mutate: mutatePolicies } = useSWR<CommandPolicy[]>(
        "/api/v1/command-policy",
        swrFetcher,
    )
    const { data: approvals, mutate: mutateApprovals } = useSWR<CommandApproval[]>(
        "/api/v1/command-approval",
        swrFetcher,
    )

    const [editing, setEditing] = useState<Partial<CommandPolicy> | null>(null)

    async function savePolicy() {
        if (!editing) return
        try {
            const payload = {
                ...editing,
                commands_raw: editing.commands_raw || "",
            }
            if (editing.id) {
                await updateCommandPolicy(editing.id, payload)
            } else {
                await createCommandPolicy(payload)
            }
            await mutatePolicies()
            setEditing(null)
            toast.success(t("Saved"))
        } catch (e: any) {
            toast.error(e?.message || t("NetworkError"))
        }
    }

    async function onDelete(id: number) {
        try {
            await deleteCommandPolicy(id)
            await mutatePolicies()
        } catch (e: any) {
            toast.error(e?.message || t("NetworkError"))
        }
    }

    async function onApprove(id: number) {
        try {
            await approveCommandApproval(id)
            await mutateApprovals()
            toast.success(t("Approved"))
        } catch (e: any) {
            toast.error(e?.message || t("NetworkError"))
        }
    }

    async function onReject(id: number) {
        try {
            await rejectCommandApproval(id)
            await mutateApprovals()
            toast.success(t("Rejected"))
        } catch (e: any) {
            toast.error(e?.message || t("NetworkError"))
        }
    }

    const statusLabel = (s: number) =>
        s === 1 ? t("Pending") : s === 2 ? t("Approved") : t("Rejected")
    const typeLabel = (ty: number) => (ty === 1 ? t("Whitelist") : t("Blacklist"))

    return (
        <div className="px-3 py-4 space-y-6">
            <Card>
                <CardHeader className="flex-row items-center justify-between">
                    <div>
                        <CardTitle>{t("CommandPolicies")}</CardTitle>
                        <CardDescription>{t("CommandPoliciesDesc")}</CardDescription>
                    </div>
                    <Button
                        size="sm"
                        onClick={() => setEditing({ ...emptyPolicy })}
                    >
                        {t("Create")}
                    </Button>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>{t("Name")}</TableHead>
                                <TableHead>{t("Type")}</TableHead>
                                <TableHead>{t("Enabled")}</TableHead>
                                <TableHead>{t("RequireApproval")}</TableHead>
                                <TableHead className="text-right">{t("Actions")}</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {(policies ?? []).length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-20 text-center">
                                        {t("NoResults")}
                                    </TableCell>
                                </TableRow>
                            ) : (
                                (policies ?? []).map((p) => (
                                    <TableRow key={p.id}>
                                        <TableCell>{p.name}</TableCell>
                                        <TableCell>{typeLabel(p.type)}</TableCell>
                                        <TableCell>{p.enabled ? t("Yes") : t("No")}</TableCell>
                                        <TableCell>{p.require_approval ? t("Yes") : t("No")}</TableCell>
                                        <TableCell className="text-right">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="mr-2"
                                                onClick={() => setEditing({ ...p })}
                                            >
                                                {t("Edit")}
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="destructive"
                                                onClick={() => onDelete(p.id)}
                                            >
                                                {t("Delete")}
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {isAdmin && (
                <Card>
                    <CardHeader>
                        <CardTitle>{t("CommandApprovals")}</CardTitle>
                        <CardDescription>{t("CommandApprovalsDesc")}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>{t("Command")}</TableHead>
                                    <TableHead>{t("Applicant")}</TableHead>
                                    <TableHead>{t("Status")}</TableHead>
                                    <TableHead>{t("Reason")}</TableHead>
                                    <TableHead className="text-right">{t("Actions")}</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {(approvals ?? []).length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-20 text-center">
                                            {t("NoResults")}
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    (approvals ?? []).map((a) => (
                                        <TableRow key={a.id}>
                                            <TableCell className="break-all max-w-xs">
                                                {a.command}
                                            </TableCell>
                                            <TableCell>{a.username}</TableCell>
                                            <TableCell>{statusLabel(a.status)}</TableCell>
                                            <TableCell className="break-all max-w-xs">
                                                {a.reason || "-"}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {a.status === 1 && (
                                                    <>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="mr-2"
                                                            onClick={() => onApprove(a.id)}
                                                        >
                                                            {t("Approve")}
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="destructive"
                                                            onClick={() => onReject(a.id)}
                                                        >
                                                            {t("Reject")}
                                                        </Button>
                                                    </>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}

            {editing && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-md rounded-xl border border-border bg-background p-5 space-y-3">
                        <h3 className="text-lg font-semibold">
                            {editing.id ? t("Edit") : t("Create")} {t("CommandPolicy")}
                        </h3>
                        <div className="space-y-1">
                            <Label>{t("Name")}</Label>
                            <Input
                                value={editing.name}
                                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                            />
                        </div>
                        <div className="space-y-1">
                            <Label>{t("Type")}</Label>
                            <select
                                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                                value={editing.type}
                                onChange={(e) =>
                                    setEditing({ ...editing, type: Number(e.target.value) })
                                }
                            >
                                <option value={2}>{t("Blacklist")}</option>
                                <option value={1}>{t("Whitelist")}</option>
                            </select>
                        </div>
                        <div className="space-y-1">
                            <Label>{t("Patterns")}</Label>
                            <Textarea
                                placeholder={"rm -rf.*\nreboot"}
                                value={editing.commands_raw}
                                onChange={(e) =>
                                    setEditing({ ...editing, commands_raw: e.target.value })
                                }
                            />
                            <p className="text-xs text-muted-foreground">
                                {t("PatternsDesc")}
                            </p>
                        </div>
                        <label className="flex items-center gap-2 text-sm">
                            <input
                                type="checkbox"
                                checked={editing.enabled}
                                onChange={(e) =>
                                    setEditing({ ...editing, enabled: e.target.checked })
                                }
                            />
                            {t("Enabled")}
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                            <input
                                type="checkbox"
                                checked={editing.require_approval}
                                onChange={(e) =>
                                    setEditing({ ...editing, require_approval: e.target.checked })
                                }
                            />
                            {t("RequireApproval")}
                        </label>
                        <div className="flex justify-end gap-2 pt-2">
                            <Button variant="outline" onClick={() => setEditing(null)}>
                                {t("Cancel")}
                            </Button>
                            <Button onClick={savePolicy}>{t("Save")}</Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
