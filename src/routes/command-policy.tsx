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
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { PageHeader } from "@/components/page-header"
import { useAuth } from "@/hooks/useAuth"
import { CommandApproval, CommandPolicy } from "@/types"
import { zodResolver } from "@hookform/resolvers/zod"
import { useState } from "react"
import { FileCode2, ShieldAlert } from "lucide-react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { z } from "zod"
import { toast } from "sonner"
import useSWR from "swr"

const emptyPolicy: Partial<CommandPolicy> = {
    name: "",
    type: 2,
    commands_raw: "",
    enabled: true,
    require_approval: false,
}

function PolicyFormDialog({
    policy,
    onClose,
    onSaved,
}: {
    policy: Partial<CommandPolicy>
    onClose: () => void
    onSaved: () => void | Promise<void>
}) {
    const { t } = useTranslation()
    const [submitting, setSubmitting] = useState(false)

    const schema = z.object({
        name: z.string().min(1, t("NameRequired")),
        type: z.number(),
        commands_raw: z.string().min(1, t("PatternsRequired")),
        enabled: z.boolean(),
        require_approval: z.boolean(),
    })

    const form = useForm<z.infer<typeof schema>>({
        resolver: zodResolver(schema),
        defaultValues: {
            name: policy.name ?? "",
            type: policy.type ?? 2,
            commands_raw: policy.commands_raw ?? "",
            enabled: policy.enabled ?? true,
            require_approval: policy.require_approval ?? false,
        },
    })

    async function onSubmit(values: z.infer<typeof schema>) {
        setSubmitting(true)
        try {
            // 多余字段（如 id）对后端无意义，提交时仅发送表单字段
            const payload = { ...values }
            if (policy.id) {
                await updateCommandPolicy(policy.id, payload)
            } else {
                await createCommandPolicy(payload)
            }
            toast.success(t("Saved"))
            onSaved()
        } catch (e: any) {
            toast.error(e?.message || t("NetworkError"))
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="glass w-full max-w-md rounded-xl p-5 space-y-3">
                <h3 className="text-lg font-semibold">
                    {policy.id ? t("Edit") : t("Create")} {t("CommandPolicy")}
                </h3>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t("Name")}</FormLabel>
                                    <FormControl>
                                        <Input {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="type"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t("Type")}</FormLabel>
                                    <Select
                                        value={String(field.value)}
                                        onValueChange={(v) => field.onChange(Number(v))}
                                    >
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="2">{t("Blacklist")}</SelectItem>
                                            <SelectItem value="1">{t("Whitelist")}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="commands_raw"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t("Patterns")}</FormLabel>
                                    <FormControl>
                                        <Textarea placeholder={t("PatternsPlaceholder")} {...field} />
                                    </FormControl>
                                    <FormDescription>{t("PatternsDesc")}</FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="enabled"
                            render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-lg border border-border p-3">
                                    <FormLabel className="mb-0">{t("Enabled")}</FormLabel>
                                    <FormControl>
                                        <Switch
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                        />
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="require_approval"
                            render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-lg border border-border p-3">
                                    <FormLabel className="mb-0">{t("RequireApproval")}</FormLabel>
                                    <FormControl>
                                        <Switch
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                        />
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                        <div className="flex justify-end gap-2 pt-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={onClose}
                                disabled={submitting}
                            >
                                {t("Cancel")}
                            </Button>
                            <Button type="submit" disabled={submitting}>
                                {t("Save")}
                            </Button>
                        </div>
                    </form>
                </Form>
            </div>
        </div>
    )
}

export default function CommandPolicyPage() {
    const { t } = useTranslation()
    const { profile } = useAuth()
    const isAdmin = profile?.role === 0

    const { data: policies, mutate: mutatePolicies } = useSWR<CommandPolicy[]>(
        "/api/v1/command-policy",
        swrFetcher,
        { keepPreviousData: true },
    )
    const { data: approvals, mutate: mutateApprovals } = useSWR<CommandApproval[]>(
        "/api/v1/command-approval",
        swrFetcher,
        { keepPreviousData: true },
    )

    const [editing, setEditing] = useState<Partial<CommandPolicy> | null>(null)

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
            <PageHeader
                title={t("CommandPolicies")}
                description={t("CommandPoliciesDesc")}
                actions={
                    <Button size="sm" variant="gradient" onClick={() => setEditing({ ...emptyPolicy })}>
                        {t("Create")}
                    </Button>
                }
            />
            <Card>
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
                                    <TableCell colSpan={5} className="h-32 text-center">
                                        <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                                            <FileCode2 className="size-6 opacity-60" />
                                            <span>{t("NoResults")}</span>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                (policies ?? []).map((p) => (
                                    <TableRow key={p.id}>
                                        <TableCell>{p.name}</TableCell>
                                        <TableCell>
                                            <Badge
                                                className={
                                                    p.type === 1
                                                        ? "border-emerald-500/20 bg-emerald-500/15 text-emerald-500"
                                                        : "border-rose-500/20 bg-rose-500/15 text-rose-500"
                                                }
                                            >
                                                {typeLabel(p.type)}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <Badge
                                                className={
                                                    p.enabled
                                                        ? "border-emerald-500/20 bg-emerald-500/15 text-emerald-500"
                                                        : "border-transparent bg-muted text-muted-foreground"
                                                }
                                            >
                                                {p.enabled ? t("Yes") : t("No")}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <Badge
                                                className={
                                                    p.require_approval
                                                        ? "border-amber-500/20 bg-amber-500/15 text-amber-500"
                                                        : "border-transparent bg-muted text-muted-foreground"
                                                }
                                            >
                                                {p.require_approval ? t("Yes") : t("No")}
                                            </Badge>
                                        </TableCell>
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
                                        <TableCell colSpan={5} className="h-32 text-center">
                                            <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                                                <ShieldAlert className="size-6 opacity-60" />
                                                <span>{t("NoResults")}</span>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    (approvals ?? []).map((a) => (
                                        <TableRow key={a.id}>
                                            <TableCell className="break-all max-w-xs">
                                                {a.command}
                                            </TableCell>
                                            <TableCell>{a.username}</TableCell>
                                            <TableCell>
                                                <Badge
                                                    className={
                                                        a.status === 1
                                                            ? "border-amber-500/20 bg-amber-500/15 text-amber-500"
                                                            : a.status === 2
                                                              ? "border-emerald-500/20 bg-emerald-500/15 text-emerald-500"
                                                              : "border-rose-500/20 bg-rose-500/15 text-rose-500"
                                                    }
                                                >
                                                    {statusLabel(a.status)}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="break-all max-w-xs">
                                                {a.reason || "-"}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {a.status === 1 && (
                                                    <>
                                                        <Button
                                                            size="sm"
                                                            variant="gradient"
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
                <PolicyFormDialog
                    policy={editing}
                    onClose={() => setEditing(null)}
                    onSaved={async () => {
                        await mutatePolicies()
                        setEditing(null)
                    }}
                />
            )}
        </div>
    )
}
