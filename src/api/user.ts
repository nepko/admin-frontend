import { LoginBlockedInfo, ModelProfile, ModelProfileForm, ModelUserForm } from "@/types"

import { FetcherMethod, fetcher } from "./api"

export const getProfile = async (): Promise<ModelProfile> => {
    return fetcher<ModelProfile>(FetcherMethod.GET, "/api/v1/profile", null)
}

// login 不走 fetcher：登录时尚未拿到 CSRF cookie，且需要把后端的登录封锁
// 详情（剩余秒数）透传给调用方，因此在此解析原始响应。
export const login = async (username: string, password: string, otpToken?: string): Promise<void> => {
    const resp = await fetch("/api/v1/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, otp_token: otpToken }),
    })
    const text = await resp.text()
    if (text === "") return
    const data = JSON.parse(text)
    if (!data.success) {
        const err: any = new Error(data.error || "error")
        if (data.error === "LOGIN_BLOCKED" && data.data) {
            err.blocked = data.data as LoginBlockedInfo
        }
        throw err
    }
    return
}

export const createUser = async (data: ModelUserForm): Promise<number> => {
    return fetcher<number>(FetcherMethod.POST, "/api/v1/user", data)
}

export const deleteUser = async (id: number[]): Promise<void> => {
    return fetcher<void>(FetcherMethod.POST, "/api/v1/batch-delete/user", id)
}

export const updateProfile = async (data: ModelProfileForm): Promise<void> => {
    return fetcher<void>(FetcherMethod.POST, "/api/v1/profile", data)
}
