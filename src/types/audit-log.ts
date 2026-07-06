export interface AuditLog {
    id: number
    created_at: string
    user_id: number
    username: string
    action: string
    resource: string
    resource_id: number
    detail: string
    ip: string
    ua: string
    success: boolean
}

export interface AuditLogQuery {
    page?: number
    page_size?: number
    action?: string
    resource?: string
    user_id?: number
    start_time?: string
    end_time?: string
}
