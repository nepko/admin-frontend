import { ModelCreateFMResponse } from "@/types"

import { FetcherMethod, fetcher } from "./api"

export const createFM = async (id: string): Promise<ModelCreateFMResponse> => {
    return fetcher<ModelCreateFMResponse>(FetcherMethod.POST, `/api/v1/file?id=${id}`, null)
}

export const getFMEnhanced = async (): Promise<{ enabled: boolean }> => {
    return fetcher<{ enabled: boolean }>(FetcherMethod.GET, "/api/v1/file/enhanced", null)
}
