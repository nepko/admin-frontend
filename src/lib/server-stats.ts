import type { ModelServer } from "@/types"

export interface ServerStats {
    /** 服务器总数 */
    total: number
    /** 服务器分组数 */
    groups: number
    /** 已启用 DDNS 的节点数 */
    ddns: number
    /** 监控服务数 */
    services: number
    /** 全部在线节点平均 CPU（整数 %） */
    avgCpu: number
    /** 全部在线节点平均内存占用（整数 %） */
    avgMem: number
}

/**
 * 由后端 /api/v1/server 返回的数据，推算概览统计。
 *
 * 抽成纯函数是为了让「数据契约 → UI 聚合」这一联调关键路径可被单测守卫：
 * 一旦后端字段（state.cpu / host.mem_total / enable_ddns 等）改名或语义变化，
 * 测试会立刻失败，而不是在界面上静默算出错误的均值。
 *
 * 约定：
 * - 仅统计「既有 state 又有 host.mem_total」的节点（在线且上报完整），
 *   离线 / 未上报内存的节点不参与均值，避免把 0 拉低平均线。
 * - mem_total 为 0 时按 1 处理，防除零。
 * - 均值四舍五入为整数百分比。
 */
export function computeServerStats(
    servers: ModelServer[],
    groupCount: number,
    serviceCount: number,
): ServerStats {
    const withState = servers.filter((s) => s.state && s.host?.mem_total)
    const n = withState.length
    const avgCpu = n
        ? Math.round(withState.reduce((a, s) => a + (s.state?.cpu ?? 0), 0) / n)
        : 0
    const avgMem = n
        ? Math.round(
              withState.reduce(
                  (a, s) => a + ((s.state?.mem_used ?? 0) / (s.host.mem_total || 1)) * 100,
                  0,
              ) / n,
          )
        : 0
    return {
        total: servers.length,
        groups: groupCount,
        ddns: servers.filter((s) => s.enable_ddns).length,
        services: serviceCount,
        avgCpu,
        avgMem,
    }
}
