// terminalBus 维护 会话ID -> 发送函数 的注册表，使终端页之外的组件（如 AI 助手）
// 能把文本注入到指定终端里（模拟用户键入）。发送走各 xterm 实例已有的 WebSocket，
// 由后端的 io_stream 双向拷贝转发到 agent PTY，因此天然与用户真实输入串行化。

type InputSender = (text: string) => void

const registry = new Map<string, InputSender>()
// lastSelection 暂存最近一次终端选区（含来源会话），供 AI 助手的
// 「解释选中 / 错误诊断」模式一键填充。
let lastSelection: { sessionId: string; text: string } = { sessionId: "", text: "" }

export function registerTerminalInput(sessionId: string, send: InputSender): void {
    registry.set(sessionId, send)
}

export function unregisterTerminalInput(sessionId: string): void {
    registry.delete(sessionId)
}

// sendTerminalInput 把文本发送到指定会话的终端。返回是否发送成功（会话存在且已连接）。
export function sendTerminalInput(sessionId: string | undefined, text: string): boolean {
    if (!sessionId) return false
    const send = registry.get(sessionId)
    if (!send) return false
    send(text)
    return true
}

// setLastTerminalSelection 记录某会话的当前选区。
export function setLastTerminalSelection(sessionId: string, text: string): void {
    lastSelection = { sessionId, text }
}

// getLastTerminalSelection 返回最近一次选区及其来源会话。
export function getLastTerminalSelection(): { sessionId: string; text: string } {
    return lastSelection
}
