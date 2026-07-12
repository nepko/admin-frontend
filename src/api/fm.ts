import { ModelCreateFMResponse } from "@/types"

import { FetcherMethod, fetcher } from "./api"

export const createFM = async (id: string): Promise<ModelCreateFMResponse> => {
    return fetcher<ModelCreateFMResponse>(FetcherMethod.POST, `/api/v1/file?id=${id}`, null)
}

export const getFMEnhanced = async (): Promise<{ enabled: boolean }> => {
    return fetcher<{ enabled: boolean }>(FetcherMethod.GET, "/api/v1/file/enhanced", null)
}

// 二开：文件管理器增强操作。后端复用官方 TaskTypeExec 通道执行，无需 agent 新 opcode。
export const chmodFile = async (serverId: string | number, path: string, mode: number): Promise<void> => {
    return fetcher<void>(FetcherMethod.POST, `/api/v1/file/chmod`, { server_id: Number(serverId), path, mode })
}

export const chownFile = async (serverId: string | number, path: string, uid: number, gid: number): Promise<void> => {
    return fetcher<void>(FetcherMethod.POST, `/api/v1/file/chown`, { server_id: Number(serverId), path, uid, gid })
}

export const zipFile = async (serverId: string | number, src: string, dst: string): Promise<void> => {
    return fetcher<void>(FetcherMethod.POST, `/api/v1/file/zip`, { server_id: Number(serverId), src, dst })
}

export const unzipFile = async (serverId: string | number, src: string, dst: string): Promise<void> => {
    return fetcher<void>(FetcherMethod.POST, `/api/v1/file/unzip`, { server_id: Number(serverId), src, dst })
}
