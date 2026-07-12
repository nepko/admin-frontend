import { render, screen } from "@testing-library/react"
import { describe, expect, test } from "vitest"

import { PageHeader } from "../components/page-header"

describe("PageHeader", () => {
    test("renders title", () => {
        render(<PageHeader title="服务器" />)
        expect(screen.getByText("服务器")).toBeTruthy()
    })

    test("renders description and actions slot", () => {
        render(
            <PageHeader title="服务器" description="管理你的节点" actions={<button>刷新</button>} />,
        )
        expect(screen.getByText("管理你的节点")).toBeTruthy()
        expect(screen.getByText("刷新")).toBeTruthy()
    })

    test("omits description when not provided", () => {
        render(<PageHeader title="T" />)
        expect(screen.queryByText("管理你的节点")).toBeNull()
    })
})
