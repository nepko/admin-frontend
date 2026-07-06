import { getCommandPolicies } from "@/api/command-policy"
import type { CommandPolicy } from "@/types"

export interface PolicyScanResult {
    // 命中黑名单或不在白名单 → 直接拦截，禁止下发。
    blocked: boolean
    // 命中需审批策略 → 必须经审批流程，禁止直接下发。
    needsApproval: boolean
    reasons: string[]
}

// commandName 取命令行的首个 token（命令名），用于粗粒度策略匹配。
function commandName(line: string): string {
    const t = line.trim()
    if (!t || t.startsWith("#")) return ""
    return t.split(/\s+/)[0]
}

// matchPattern 兼容「整行正则」与「命令名」两种匹配粒度。
function matchPolicy(policy: CommandPolicy, line: string): boolean {
    let patterns: string[] = []
    try {
        const parsed = JSON.parse(policy.commands)
        if (Array.isArray(parsed)) patterns = parsed.map(String)
        else if (typeof parsed === "string") patterns = [parsed]
    } catch {
        if (policy.commands) patterns = [policy.commands]
    }
    const name = commandName(line)
    for (const raw of patterns) {
        const pat = raw.trim()
        if (!pat) continue
        let re: RegExp
        try {
            re = new RegExp(pat)
        } catch {
            // 非合法正则时退化为子串匹配，避免策略因笔误而失效。
            if (line.includes(pat) || (name && name.includes(pat))) return true
            continue
        }
        if (re.test(line) || (name && re.test(name))) return true
    }
    return false
}

// scanCommandAgainstPolicy 在命令注入终端前做可靠扫描，闭合 plan 中
// “交互式终端按 PTY 字节流 best-effort 不可靠”的已知限制。
// 该扫描发生在结构化命令（AI 生成 / 快捷命令 / 批量下发）的注入点，
// 能精确按行判定黑名单命中、白名单外、以及需审批，远比解析原始 PTY 字节可靠。
export async function scanCommandAgainstPolicy(
    command: string,
): Promise<PolicyScanResult> {
    const result: PolicyScanResult = { blocked: false, needsApproval: false, reasons: [] }
    let policies: CommandPolicy[] = []
    try {
        policies = await getCommandPolicies()
    } catch {
        // 拉取策略失败时降级放行，避免阻断正常运维。
        return result
    }
    const active = policies.filter((p) => p.enabled)
    const blacklist = active.filter((p) => p.type === 2)
    const whitelist = active.filter((p) => p.type === 1)

    const lines = command
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length > 0 && !l.startsWith("#"))

    for (const line of lines) {
        // 黑名单命中 → 拦截
        for (const p of blacklist) {
            if (matchPolicy(p, line)) {
                result.blocked = true
                result.reasons.push(`黑名单「${p.name}」命中：${line}`)
                if (p.require_approval) {
                    result.needsApproval = true
                    result.reasons.push(`「${p.name}」要求审批：${line}`)
                }
            }
        }
        // 存在生效白名单时，未命中任何白名单 → 拦截
        if (whitelist.length > 0) {
            const allowed = whitelist.some((p) => matchPolicy(p, line))
            if (!allowed) {
                result.blocked = true
                result.reasons.push(`不在白名单，禁止执行：${line}`)
            }
        }
    }
    return result
}
