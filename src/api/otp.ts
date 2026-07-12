import { fetcher, FetcherMethod } from "./api"

export const setupOTP = async (): Promise<{secret: string, qr_url: string}> => {
    return fetcher<{secret: string, qr_url: string}>(FetcherMethod.POST, "/api/v1/otp/setup", null)
}

export const verifyOTP = async (code: string): Promise<string[]> => {
    return fetcher<string[]>(FetcherMethod.POST, "/api/v1/otp/verify", { code })
}

export const disableOTP = async (code: string): Promise<void> => {
    return fetcher<void>(FetcherMethod.POST, "/api/v1/otp/disable", { code })
}

export const getBackupCodes = async (): Promise<string[]> => {
    return fetcher<string[]>(FetcherMethod.GET, "/api/v1/otp/backup-codes")
}

export const regenerateBackupCodes = async (): Promise<string[]> => {
    return fetcher<string[]>(FetcherMethod.POST, "/api/v1/otp/backup-codes/regenerate", null)
}

export const getOTPStatus = async (): Promise<{enabled: boolean}> => {
    return fetcher<{enabled: boolean}>(FetcherMethod.GET, "/api/v1/otp/status")
}
