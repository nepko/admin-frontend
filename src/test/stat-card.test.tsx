import { render, screen } from "@testing-library/react"
import { describe, expect, test } from "vitest"
import { Server } from "lucide-react"

import { StatCard } from "../components/stat-card"

describe("StatCard", () => {
    test("renders label, value and hint", () => {
        render(<StatCard label="服务器" value={42} icon={Server} hint="总数" />)
        expect(screen.getByText("服务器")).toBeTruthy()
        expect(screen.getByText("42")).toBeTruthy()
        expect(screen.getByText("总数")).toBeTruthy()
    })

    test("renders ReactNode value (e.g. percentage string)", () => {
        render(<StatCard label="CPU" value={"12%"} icon={Server} />)
        expect(screen.getByText("12%")).toBeTruthy()
    })

    test("applies custom iconClassName", () => {
        const { container } = render(
            <StatCard label="X" value={1} icon={Server} iconClassName="bg-sky-500/10 text-sky-500" />,
        )
        const svg = container.querySelector("svg")
        const wrap = svg?.parentElement
        expect(wrap?.className).toContain("bg-sky-500/10")
        expect(wrap?.className).toContain("text-sky-500")
    })

    test("falls back to brand icon styling when iconClassName omitted", () => {
        const { container } = render(<StatCard label="X" value={1} icon={Server} />)
        const svg = container.querySelector("svg")
        const wrap = svg?.parentElement
        expect(wrap?.className).toContain("text-brand")
    })

    test("omits hint when not provided", () => {
        render(<StatCard label="X" value={1} icon={Server} />)
        expect(screen.queryByText("总数")).toBeNull()
    })
})
