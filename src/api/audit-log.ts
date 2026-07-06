import { AuditLog, AuditLogQuery } from "@/types"
import { FetcherMethod, fetcher } from "./api"

export const getAuditLogs = async (query: AuditLogQuery = {}): Promise<AuditLog[]> => {
    const params = new URLSearchParams()
    if (query.page) params.append("page", query.page.toString())
    if (query.page_size) params.append("page_size", query.page_size.toString())
    if (query.action) params.append("action", query.action)
    if (query.resource) params.append("resource", query.resource)
    if (query.user_id) params.append("user_id", query.user_id.toString())
    if (query.start_time) params.append("start_time", query.start_time)
    if (query.end_time) params.append("end_time", query.end_time)

    const queryString = params.toString()
    const url = "/api/v1/audit-log" + (queryString ? "?" + queryString : "")
    return fetcher<AuditLog[]>(FetcherMethod.GET, url)
}

export const getAuditLogActions = async (): Promise<string[]> => {
    return fetcher<string[]>(FetcherMethod.GET, "/api/v1/audit-log/actions")
}

export const cleanAuditLogs = async (days: number): Promise<string> => {
    return fetcher<string>(FetcherMethod.POST, "/api/v1/audit-log/clean", { days })
}
