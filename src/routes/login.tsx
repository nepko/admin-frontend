import { Oauth2RequestType, getOauth2RedirectURL } from "@/api/oauth2"
import { Button } from "@/components/ui/button"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { useAuth } from "@/hooks/useAuth"
import useSetting from "@/hooks/useSetting"
import { zodResolver } from "@hookform/resolvers/zod"
import i18next from "i18next"
import { lazy, Suspense, useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { z } from "zod"
import { ShieldAlert } from "lucide-react"

// OAuth 图标依赖全量 simple-icons（约 525KB），仅在有 OAuth 提供商时才需要。
// 懒加载该组件，使无 OAuth 的部署在首屏不下载这一大块资源。
const OAuthProviderIcon = lazy(() =>
    import("@/components/ui/icon").then((m) => ({ default: m.OAuthProviderIcon })),
)

const formSchema = z.object({
    username: z.string().min(2, {
        message: i18next.t("Results.UsernameMin", { number: 2 }),
    }),
    password: z.string().min(1, {
        message: i18next.t("Results.PasswordRequired"),
    }),
    otp_token: z.string().optional(),
})

function Login() {
    const { login, loginOauth2, require2fa, loginBlocked } = useAuth()
    const { data: settingData } = useSetting()
    const [remaining, setRemaining] = useState(0)

    useEffect(() => {
        const oauth2 = new URLSearchParams(window.location.search).get("oauth2")
        if (oauth2) {
            loginOauth2()
        }
    }, [loginOauth2])

    useEffect(() => {
        if (!loginBlocked) {
            setRemaining(0)
            return
        }
        setRemaining(loginBlocked.remaining)
        const id = setInterval(() => setRemaining((r) => (r > 0 ? r - 1 : 0)), 1000)
        return () => clearInterval(id)
    }, [loginBlocked])

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            username: "",
            password: "",
            otp_token: "",
        },
    })

    function onSubmit(values: z.infer<typeof formSchema>) {
        login(values.username, values.password, values.otp_token || undefined)
    }

    async function loginWith(provider: string) {
        try {
            const redirectUrl = await getOauth2RedirectURL(provider, Oauth2RequestType.LOGIN)
            window.location.assign(redirectUrl.redirect!)
        } catch (error: any) {
            toast.error(error.message)
        }
    }

    const { t } = useTranslation()

    return (
        <div className="relative flex min-h-[calc(100vh-10rem)] items-center justify-center px-4">
            {/* 品牌背景光晕 */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="absolute -top-32 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-brand/20 blur-3xl" />
                <div className="absolute bottom-0 right-1/4 h-72 w-72 rounded-full bg-brand-2/15 blur-3xl" />
            </div>

            <div className="relative w-full max-w-sm animate-in fade-in-0 slide-in-from-bottom-4 duration-700">
                {/* 品牌头部 */}
                <div className="mb-6 flex flex-col items-center text-center">
                    <div className="flex size-14 items-center justify-center rounded-2xl bg-brand-gradient shadow-lg shadow-brand/30">
                        <img className="size-9" src="/dashboard/logo.svg" alt="logo" />
                    </div>
                    <h1 className="mt-3 text-2xl font-bold text-gradient">{t("nezha")}</h1>
                    <p className="mt-1 text-sm text-muted-foreground">服务器监控 · 运维控制台</p>
                </div>

                {loginBlocked && (
                    <div className="mb-4 flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                        <ShieldAlert className="mt-0.5 size-4 shrink-0" />
                        <div>
                            <p className="font-semibold">{t("LoginBlockedTitle")}</p>
                            <p className="mt-1 opacity-90">
                                {t("LoginBlockedDesc", { seconds: remaining })}
                            </p>
                        </div>
                    </div>
                )}

                <div className="glass rounded-2xl p-6 shadow-xl shadow-black/5">
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                            <FormField
                                control={form.control}
                                name="username"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t("Username")}</FormLabel>
                                        <FormControl>
                                            <Input placeholder="admin" autoComplete="username" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="password"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t("Password")}</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="password"
                                                placeholder="admin"
                                                autoComplete="current-password"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            {require2fa && (
                                <FormField
                                    control={form.control}
                                    name="otp_token"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>OTP Code</FormLabel>
                                            <FormControl>
                                                <Input placeholder="123456" {...field} />
                                            </FormControl>
                                            <p className="text-xs text-muted-foreground">
                                                Enter the 6-digit code, or a one-time backup code if you lost your device.
                                            </p>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            )}
                            <Button type="submit" variant="gradient" className="w-full rounded-lg">
                                {t("Login")}
                            </Button>
                        </form>
                        {settingData?.config?.oauth2_providers &&
                            settingData?.config?.oauth2_providers.length > 0 && (
                                <section className="flex items-center my-3 w-full">
                                    <Separator className="flex-1" />
                                    <div className="flex justify-center text-xs text-muted-foreground w-full max-w-[100px]">
                                        OAuth2
                                    </div>
                                    <Separator className="flex-1" />
                                </section>
                            )}
                    </Form>
                    <div className="mt-3 flex flex-col gap-3">
                        {settingData?.config?.oauth2_providers?.map((p: string) => (
                            <Button
                                key={p}
                                variant="outline"
                                className="w-full rounded-lg"
                                onClick={() => loginWith(p)}
                            >
                                <Suspense fallback={null}>
                                    <OAuthProviderIcon provider={p} className="size-4" />
                                </Suspense>
                                {p}
                            </Button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}

export default Login
