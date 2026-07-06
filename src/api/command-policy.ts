import { CommandApproval, CommandPolicy } from "@/types"

import { FetcherMethod, fetcher } from "./api"

export const getCommandPolicies = (): Promise<CommandPolicy[]> =>
    fetcher<CommandPolicy[]>(FetcherMethod.GET, "/api/v1/command-policy")

export const createCommandPolicy = (data: Partial<CommandPolicy>): Promise<CommandPolicy> =>
    fetcher<CommandPolicy>(FetcherMethod.POST, "/api/v1/command-policy", data)

export const updateCommandPolicy = (id: number, data: Partial<CommandPolicy>): Promise<CommandPolicy> =>
    fetcher<CommandPolicy>(FetcherMethod.PATCH, `/api/v1/command-policy/${id}`, data)

export const deleteCommandPolicy = (id: number): Promise<void> =>
    fetcher<void>(FetcherMethod.DELETE, `/api/v1/command-policy/${id}`)

export const getCommandApprovals = (): Promise<CommandApproval[]> =>
    fetcher<CommandApproval[]>(FetcherMethod.GET, "/api/v1/command-approval")

export const approveCommandApproval = (id: number): Promise<void> =>
    fetcher<void>(FetcherMethod.POST, `/api/v1/command-approval/${id}/approve`)

export const rejectCommandApproval = (id: number, reason?: string): Promise<void> =>
    fetcher<void>(FetcherMethod.POST, `/api/v1/command-approval/${id}/reject`, { reason })
