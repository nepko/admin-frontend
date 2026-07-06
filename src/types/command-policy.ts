export interface CommandPolicy {
    id: number
    name: string
    type: number // 1=whitelist 2=blacklist
    commands: string // JSON 文本
    commands_raw?: string
    enabled: boolean
    require_approval: boolean
}

export interface CommandApproval {
    id: number
    command: string
    user_id: number
    username: string
    server_ids: string // JSON 文本
    status: number // 1=pending 2=approved 3=rejected
    approver?: number
    reason?: string
    created_at?: string
}
