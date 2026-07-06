import { LoginLockEntry, LoginProtectionConfig } from "@/types"

import { FetcherMethod, fetcher } from "./api"

export const getLoginProtection = (): Promise<LoginProtectionConfig> =>
    fetcher<LoginProtectionConfig>(FetcherMethod.GET, "/api/v1/security/login-protection")

export const updateLoginProtection = (data: LoginProtectionConfig): Promise<void> =>
    fetcher<void>(FetcherMethod.POST, "/api/v1/security/login-protection", data)

export const listLoginLocks = (): Promise<LoginLockEntry[]> =>
    fetcher<LoginLockEntry[]>(FetcherMethod.GET, "/api/v1/security/locks")

export const unlockAccount = (username: string): Promise<void> =>
    fetcher<void>(FetcherMethod.POST, "/api/v1/security/locks/unlock", { username })

export const unbanIP = (ip: string): Promise<void> =>
    fetcher<void>(FetcherMethod.POST, "/api/v1/security/locks/unban", { ip })
