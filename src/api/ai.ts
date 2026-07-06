// 终端 AI 助手：调用后端 /api/v1/ai/chat（OpenAI 兼容 SSE 流式）。
// 后端负责持有 API Key 并转发，前端只消费增量文本流。

export interface AIChatMessage {
    role: "system" | "user" | "assistant"
    content: string
}

export interface StreamCallbacks {
    onDelta?: (delta: string) => void
    onDone?: () => void
    onError?: (message: string) => void
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
        })
    } catch (e: any) {
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
