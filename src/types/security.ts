export interface LoginBlockedInfo {
    type: "account_locked" | "ip_banned" | "cidr_denied"
    remaining: number
    message: string
}

export interface LoginProtectionConfig {
    enabled: boolean
    max_attempts: number
    lock_minutes: number
    ban_ip_threshold: number
    ban_minutes: number
    allowed_cidrs: string
}

export interface LoginLockEntry {
    kind: "account" | "ip"
    target: string
    remaining: number
    reason: string
}
