import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, test, vi } from "vitest"
import { Inbox } from "lucide-react"

import { EmptyState, ErrorState, LoadingState } from "../components/state"

describe("LoadingState", () => {
    test("renders spinner and optional label", () => {
        const { container } = render(<LoadingState label="加载中..." />)
        expect(screen.getByText("加载中...")).toBeTruthy()
        expect(container.querySelector(".animate-spin")).toBeTruthy()
    })
})

describe("EmptyState", () => {
    test("renders icon, title, description and action slot", () => {
        const { container } = render(
            <EmptyState
                icon={Inbox}
                title="空空如也"
                description="暂无数据"
                action={<button>新建</button>}
            />,
        )
        expect(screen.getByText("空空如也")).toBeTruthy()
        expect(screen.getByText("暂无数据")).toBeTruthy()
        expect(screen.getByText("新建")).toBeTruthy()
        expect(container.querySelector("svg")).toBeTruthy()
    })

    test("omits description when not provided", () => {
        render(<EmptyState title="空空如也" />)
        expect(screen.queryByText("暂无数据")).toBeNull()
    })
})

describe("ErrorState", () => {
    test("renders default message and triggers onRetry", () => {
        const onRetry = vi.fn()
        render(<ErrorState message="出错了" onRetry={onRetry} />)
        expect(screen.getByText("出错了")).toBeTruthy()
        fireEvent.click(screen.getByText("重试"))
        expect(onRetry).toHaveBeenCalledOnce()
    })

    test("renders fallback message when message omitted", () => {
        render(<ErrorState onRetry={vi.fn()} />)
        expect(screen.getByText("加载失败，请稍后重试")).toBeTruthy()
    })
})
