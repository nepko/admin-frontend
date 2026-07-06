import { BatchCommandResult, CommandHistory, QuickCommand } from "@/types"

import { FetcherMethod, fetcher } from "./api"

export const listQuickCommands = async (): Promise<QuickCommand[]> => {
    return fetcher<QuickCommand[]>(FetcherMethod.GET, "/api/v1/quick-command", null)
}

// executeBatchCommand 批量执行命令（命中策略可能进入审批）。
// 返回 BatchCommandResult[]，或 { status: "pending", approval_id, reason }。
export const executeBatchCommand = async (
    command: string,
    servers: number[],
): Promise<BatchCommandResult[] | { status: string; approval_id: number; reason: string }> => {
    return fetcher<any>(FetcherMethod.POST, "/api/v1/quick-command/execute", {
        command,
        servers,
    })
}

export const listCommandHistory = async (serverId?: number): Promise<CommandHistory[]> => {
    const qs = serverId ? `?server_id=${serverId}` : ""
    return fetcher<CommandHistory[]>(FetcherMethod.GET, `/api/v1/command-history${qs}`, null)
}
