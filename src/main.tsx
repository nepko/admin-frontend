// NOTE: Do not modify the import order unless absolutely necessary.
import { lazy } from "react"
import { createRoot } from "react-dom/client"
import { RouterProvider, createBrowserRouter } from "react-router-dom"

import "./index.css"
import "./lib/i18n"

import { AuthProvider } from "./hooks/useAuth"
import { NotificationProvider } from "./hooks/useNotfication"
import { ServerProvider } from "./hooks/useServer"

import Root from "./routes/root"
import ErrorPage from "./error-page"
import ProtectedRoute from "./routes/protect"

// 路由级懒加载：把各页面拆分为独立 chunk，首屏仅加载布局与当前路由，
// 显著降低初始 JS 体积与内存占用（其余页面访问时按需加载）。
const LoginPage = lazy(() => import("./routes/login"))
const ServerPage = lazy(() => import("./routes/server"))
const ServicePage = lazy(() => import("./routes/service"))
const CronPage = lazy(() => import("./routes/cron"))
const AlertRulePage = lazy(() => import("./routes/alert-rule"))
const DDNSPage = lazy(() => import("./routes/ddns"))
const NATPage = lazy(() => import("./routes/nat"))
const ServerGroupPage = lazy(() => import("./routes/server-group"))
const NotificationGroupPage = lazy(() => import("./routes/notification-group"))
const TerminalPage = lazy(() =>
    import("./components/terminal").then((m) => ({ default: m.TerminalPage })),
)
const TerminalSessionsPage = lazy(() => import("./routes/terminal-sessions"))
const NotificationPage = lazy(() => import("./routes/notification"))
const ProfilePage = lazy(() => import("./routes/profile"))
const SettingsPage = lazy(() => import("./routes/settings"))
const UserPage = lazy(() => import("./routes/user"))
const WAFPage = lazy(() => import("./routes/waf"))
const OnlineUserPage = lazy(() => import("./routes/online-user"))
const ApiTokensPage = lazy(() => import("./routes/api-tokens"))
const TransferPage = lazy(() => import("./routes/transfer"))
const SecurityPage = lazy(() => import("./routes/security"))
const CommandPolicyPage = lazy(() => import("./routes/command-policy"))
const RecordingsPage = lazy(() => import("./routes/recordings"))

// 懒加载兜底由 Root 内的 <Outlet/> 外 <Suspense> 统一处理。
const router = createBrowserRouter([
    {
        path: "/dashboard",
        element: (
            <AuthProvider>
                <ProtectedRoute>
                    <Root />
                </ProtectedRoute>
            </AuthProvider>
        ),
        errorElement: <ErrorPage />,
        children: [
            {
                path: "/dashboard/login",
                element: <LoginPage />,
            },
            {
                path: "/dashboard",
                element: (
                    <ServerProvider withServerGroup>
                        <ServerPage />
                    </ServerProvider>
                ),
            },
            {
                path: "/dashboard/service",
                element: (
                    <ServerProvider withServer>
                        <NotificationProvider withNotifierGroup>
                            <ServicePage />
                        </NotificationProvider>
                    </ServerProvider>
                ),
            },
            {
                path: "/dashboard/cron",
                element: (
                    <ServerProvider withServer>
                        <NotificationProvider withNotifierGroup>
                            <CronPage />
                        </NotificationProvider>
                    </ServerProvider>
                ),
            },
            {
                path: "/dashboard/alert-rule",
                element: (
                    <NotificationProvider withNotifierGroup>
                        <AlertRulePage />
                    </NotificationProvider>
                ),
            },
            {
                path: "/dashboard/ddns",
                element: <DDNSPage />,
            },
            {
                path: "/dashboard/nat",
                element: <NATPage />,
            },
            {
                path: "/dashboard/server-group",
                element: (
                    <ServerProvider withServer>
                        <ServerGroupPage />
                    </ServerProvider>
                ),
            },
            {
                path: "/dashboard/notification-group",
                element: (
                    <NotificationProvider withNotifier>
                        <NotificationGroupPage />
                    </NotificationProvider>
                ),
            },
            {
                path: "/dashboard/terminal/:id",
                element: <TerminalPage />,
            },
            {
                path: "/dashboard/terminal",
                element: (
                    <ServerProvider withServer>
                        <TerminalSessionsPage />
                    </ServerProvider>
                ),
            },
            {
                path: "/dashboard/notification",
                element: (
                    <NotificationProvider withNotifierGroup>
                        <NotificationPage />
                    </NotificationProvider>
                ),
            },
            {
                path: "/dashboard/profile",
                element: (
                    <ServerProvider withServer withServerGroup>
                        <ProfilePage />
                    </ServerProvider>
                ),
            },
            {
                path: "/dashboard/settings",
                element: (
                    <NotificationProvider withNotifierGroup>
                        <SettingsPage />
                    </NotificationProvider>
                ),
            },
            {
                path: "/dashboard/settings/user",
                element: <UserPage />,
            },
            {
                path: "/dashboard/settings/waf",
                element: <WAFPage />,
            },
            {
                path: "/dashboard/settings/online-user",
                element: <OnlineUserPage />,
            },
            {
                path: "/dashboard/settings/api-tokens",
                element: <ApiTokensPage />,
            },
            {
                path: "/dashboard/transfer",
                element: <TransferPage />,
            },
            {
                path: "/dashboard/security",
                element: <SecurityPage />,
            },
            {
                path: "/dashboard/command-policy",
                element: <CommandPolicyPage />,
            },
            {
                path: "/dashboard/recordings",
                element: <RecordingsPage />,
            },
        ],
    },
])

createRoot(document.getElementById("root")!).render(<RouterProvider router={router} />)
