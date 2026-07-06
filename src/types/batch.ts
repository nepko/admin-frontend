export interface QuickCommand {
    id: number
    name: string
    command: string
    servers?: number[]
}

export interface CommandHistory {
    id: number
    server_id: number
    command: string
    output?: string
    exit_code: number
}

export interface BatchCommandResult {
    server_id: number
    server_name: string
    success: boolean
    output: string
    error?: string
}

export interface ServerOperationResult {
    server_id: number
    server_name: string
    success: boolean
    message: string
}

export interface BatchOperationRequest {
    operation: string
    server_ids: number[]
    command?: string
}

export interface BatchOperationResponse {
    total_count: number
    success_count: number
    failed_count: number
    results: ServerOperationResult[]
    operation: string
}
