import { ModelCreateTerminalResponse, ModelTerminalSessionInfo } from "@/types"

import { FetcherMethod, fetcher } from "./api"

export const createTerminal = async (id: number): Promise<ModelCreateTerminalResponse> => {
    return fetcher<ModelCreateTerminalResponse>(FetcherMethod.POST, "/api/v1/terminal", {
        server_id: id,
    })
}

export const listTerminalSessions = async (): Promise<ModelTerminalSessionInfo[]> => {
    return fetcher<ModelTerminalSessionInfo[]>(FetcherMethod.GET, "/api/v1/terminal/sessions", null)
}
