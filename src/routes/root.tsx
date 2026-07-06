import Header from "@/components/header"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import useSetting from "@/hooks/useSetting"
import i18n from "@/lib/i18n"
import { InjectContext } from "@/lib/inject"
import { Suspense } from "react"
import { useEffect } from "react"
import { useTranslation } from "react-i18next"
import { Outlet } from "react-router-dom"

export default function Root() {
    const { t } = useTranslation()
    const { data: settingData, error } = useSetting()

    useEffect(() => {
        document.title = settingData?.config?.site_name || "哪吒监控 Nezha Monitoring"
    }, [settingData?.config?.site_name])

    useEffect(() => {
        if (settingData?.config?.custom_code_dashboard) {
            InjectContext(settingData?.config?.custom_code_dashboard)
        }
    }, [settingData?.config?.custom_code_dashboard])

    useEffect(() => {
        if (settingData?.config?.language && !localStorage.getItem("language")) {
            i18n.changeLanguage(settingData?.config?.language)
        }
    }, [settingData?.config?.language])

    if (error) {
        throw error
    }

    if (!settingData) {
        return null
    }

    return (
        <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
            <section className="text-sm mx-auto h-full flex flex-col justify-between">
                <div>
                    <Header />
                    <div className="max-w-5xl mx-auto">
                        <Suspense
                            fallback={
                                <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
                                    {t("Loading")}
                                </div>
                            }
                        >
                            <Outlet />
                        </Suspense>
                    </div>
                </div>
                <footer className="mx-5 py-5 text-foreground/50 font-light text-xs text-center">
                    &copy; 2019-{new Date().getFullYear()} {t("nezha")} {settingData?.version}
                </footer>
            </section>
            <Toaster />
        </ThemeProvider>
    )
}
