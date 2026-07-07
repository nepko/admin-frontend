// 终端 AI 助手：调用后端 /api/v1/ai/chat（OpenAI 兼容 SSE 流式）。
// 后端负责持有 API Key 并转发，前端只消费增量文本流。

export interface AIChatMessage {
    role: "system" | "user" | "assistant"
    content: string
}

export interface AIToolCallEvent {
    name: string
    arguments: string
}

export interface AIToolResultEvent {
    name: string
    content: string
}

export interface StreamCallbacks {
    onDelta?: (delta: string) => void
    onDone?: () => void
    onError?: (message: string) => void
    onUsage?: (usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number }) => void
    onToolCall?: (call: AIToolCallEvent) => void
    onToolResult?: (result: AIToolResultEvent) => void
}

// 同域 POST 需要带上 CSRF 双提交令牌（与 api.ts 中逻辑保持一致）。
function csrfHeaders(): Record<string, string> {
    const name = "nz-csrf"
    const prefix = name + "="
    for (const part of document.cookie.split(";")) {
        const c = part.trim()
        if (c.startsWith(prefix)) {
            return { "X-CSRF-Token": c.slice(prefix.length) }
        }
    }
    return {}
}

export async function streamAIChat(
    messages: AIChatMessage[],
    opts?: { temperature?: number; max_tokens?: number },
    cb?: StreamCallbacks,
    signal?: AbortSignal,
): Promise<void> {
    let response: Response
    try {
        response = await fetch("/api/v1/ai/chat", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...csrfHeaders(),
            },
            body: JSON.stringify({
                messages,
                temperature: opts?.temperature,
                max_tokens: opts?.max_tokens,
            }),
            signal,
        })
    } catch (e: any) {
        // 用户主动中断（AbortController）不记为错误，仅收尾。
        if (e?.name === "AbortError") {
            cb?.onDone?.()
            return
        }
        cb?.onError?.(e?.message || "network error")
        return
    }

    if (!response.ok || !response.body) {
        let msg = response.statusText
        try {
            const text = await response.text()
            if (text) {
                try {
                    const obj = JSON.parse(text)
                    if (obj.error) msg = obj.error
                } catch {
                    msg = text
                }
            }
        } catch {
            /* ignore */
        }
        cb?.onError?.(msg)
        return
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ""

    const flushEvents = (): void => {
        let idx: number
        while ((idx = buffer.indexOf("\n\n")) >= 0) {
            const block = buffer.slice(0, idx)
            buffer = buffer.slice(idx + 2)
            for (const line of block.split("\n")) {
                const trimmed = line.trim()
                if (!trimmed.startsWith("data:")) continue
                const data = trimmed.slice(5).trim()
                if (data === "[DONE]") continue
                try {
                    const obj = JSON.parse(data)
                    if (obj.error) {
                        cb?.onError?.(obj.error)
                        return
                    }
                    if (obj.delta) cb?.onDelta?.(obj.delta)
                    if (obj.usage) cb?.onUsage?.(obj.usage)
                    if (obj.tool_call) cb?.onToolCall?.(obj.tool_call)
                    if (obj.tool_result) cb?.onToolResult?.(obj.tool_result)
                    if (obj.done) cb?.onDone?.()
                } catch {
                    /* 跳过无法解析的分片 */
                }
            }
        }
    }

    try {
        for (;;) {
            const { done, value } = await reader.read()
            if (done) break
            buffer += decoder.decode(value, { stream: true })
            flushEvents()
        }
        buffer += decoder.decode()
        flushEvents()
        cb?.onDone?.()
    } catch (e: any) {
        cb?.onError?.(e?.message || "stream error")
    }
}

// 服务端对话记忆：读取/保存/清空当前用户的 AI 对话（C 增强项）。

export async function getAIHistory(): Promise<AIChatMessage[]> {
    try {
        const res = await fetch("/api/v1/ai/history", {
            headers: { ...csrfHeaders() },
        })
        if (!res.ok) return []
        const obj = await res.json()
        if (obj?.data?.messages && Array.isArray(obj.data.messages)) {
            return obj.data.messages as AIChatMessage[]
        }
    } catch {
        /* 读取失败降级为空历史 */
    }
    return []
}

export async function saveAIHistory(messages: AIChatMessage[]): Promise<void> {
    try {
        await fetch("/api/v1/ai/history", {
            method: "POST",
            headers: { "Content-Type": "application/json", ...csrfHeaders() },
            body: JSON.stringify({ messages }),
        })
    } catch {
        /* 保存失败静默降级（localStorage 兜底） */
    }
}

export async function clearAIHistory(): Promise<void> {
    try {
        await fetch("/api/v1/ai/history", {
            method: "DELETE",
            headers: { ...csrfHeaders() },
        })
    } catch {
        /* 忽略 */
    }
}
