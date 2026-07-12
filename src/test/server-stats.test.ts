import { describe, expect, test } from "vitest"

import type { ModelServer } from "@/types"

import { computeServerStats } from "../lib/server-stats"

// 用最小字段构造 ModelServer，便于聚焦聚合逻辑本身（联调：数据契约 → 均值计算）。
function mk(over: Partial<ModelServer>): ModelServer {
    return {
        id: 1,
        name: "node",
        ...over,
    } as ModelServer
}

describe("computeServerStats", () => {
    test("空列表：所有计数归零，均值归零", () => {
        const s = computeServerStats([], 0, 0)
        expect(s).toEqual({ total: 0, groups: 0, ddns: 0, services: 0, avgCpu: 0, avgMem: 0 })
    })

    test("仅统计在线且有 mem_total 的节点", () => {
        const servers = [
            // 在线、内存完整：参与均值
            mk({ id: 1, enable_ddns: true, host: { mem_total: 1000 } as never, state: { cpu: 50, mem_used: 400 } as never }),
            // 离线（无 state）：不计入均值，但计入总数
            mk({ id: 2, host: { mem_total: 2000 } as never }),
            // 内存未上报（mem_total 缺失）：不计入均值，计入总数
            mk({ id: 3, state: { cpu: 80, mem_used: 100 } as never }),
        ]
        const s = computeServerStats(servers, 2, 5)
        expect(s.total).toBe(3)
        expect(s.groups).toBe(2)
        expect(s.services).toBe(5)
        expect(s.ddns).toBe(1)
        // 仅 id=1 参与：cpu 50 -> 50，mem 400/1000=40% -> 40
        expect(s.avgCpu).toBe(50)
        expect(s.avgMem).toBe(40)
    })

    test("均值四舍五入", () => {
        const servers = [
            mk({ id: 1, host: { mem_total: 3 } as never, state: { cpu: 10, mem_used: 1 } as never }),
            mk({ id: 2, host: { mem_total: 3 } as never, state: { cpu: 20, mem_used: 2 } as never }),
        ]
        const s = computeServerStats(servers, 0, 0)
        // avgCpu = 15；avgMem = (33.3 + 66.6)/2 ≈ 50
        expect(s.avgCpu).toBe(15)
        expect(s.avgMem).toBe(50)
    })

    test("mem_total 为 0 时防除零（按 1 处理）", () => {
        const servers = [
            mk({ id: 1, host: { mem_total: 0 } as never, state: { cpu: 0, mem_used: 0 } as never }),
        ]
        const s = computeServerStats(servers, 0, 0)
        expect(s.avgMem).toBe(0)
        expect(Number.isNaN(s.avgMem)).toBe(false)
    })

    test("DDNS 计数只统计 enable_ddns 为真的节点", () => {
        const servers = [
            mk({ id: 1, enable_ddns: true }),
            mk({ id: 2, enable_ddns: false }),
            mk({ id: 3 }),
        ]
        expect(computeServerStats(servers, 0, 0).ddns).toBe(1)
    })
})
