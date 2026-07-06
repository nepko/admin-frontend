export interface RecordingChunk {
    session_id: string
    server_id: number
    seq: number
    ts: number
    direction: number // 1=用户输入 2=agent输出
    data: string // base64 编码的字节数据
}

export interface RecordingSessionMeta {
    session_id: string
    server_id: number
    server_name?: string
    chunks: number
    start_ts: number
    end_ts: number
}
