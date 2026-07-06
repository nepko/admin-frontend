import {
    ModelCreateTerminalResponse,
    ModelTerminalSessionInfo,
    RecordingChunk,
    RecordingSessionMeta,
} from "@/types"

import { FetcherMethod, fetcher } from "./api"

export const createTerminal = async (id: number): Promise<ModelCreateTerminalResponse> => {
    return fetcher<ModelCreateTerminalResponse>(FetcherMethod.POST, "/api/v1/terminal", {
        server_id: id,
    })
}

export const listTerminalSessions = async (): Promise<ModelTerminalSessionInfo[]> => {
    return fetcher<ModelTerminalSessionInfo[]>(FetcherMethod.GET, "/api/v1/terminal/sessions", null)
}

// 二开：终端会话录制回放
export const listRecordings = async (): Promise<RecordingSessionMeta[]> => {
    return fetcher<RecordingSessionMeta[]>(FetcherMethod.GET, "/api/v1/terminal/recordings", null)
}

export const getRecording = async (sessionId: string): Promise<RecordingChunk[]> => {
    return fetcher<RecordingChunk[]>(FetcherMethod.GET, `/api/v1/terminal/recordings/${sessionId}`, null)
}

