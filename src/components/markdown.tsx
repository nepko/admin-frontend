import { Fragment, type ReactNode } from "react"

// 轻量 Markdown 渲染：仅覆盖运维场景最常见的语法（代码块、标题、列表、
// 引用、行内 code/bold/italic/链接）。全部产出受控 React 元素，不使用
// dangerouslySetInnerHTML，从根本上避免 AI 内容引发的 XSS。

function renderInline(text: string): ReactNode[] {
    const nodes: ReactNode[] = []
    const regex = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g
    let last = 0
    let key = 0
    let m: RegExpExecArray | null
    while ((m = regex.exec(text)) !== null) {
        if (m.index > last) nodes.push(text.slice(last, m.index))
        const tok = m[0]
        if (tok.startsWith("`")) {
            nodes.push(
                <code
                    key={key++}
                    className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]"
                >
                    {tok.slice(1, -1)}
                </code>,
            )
        } else if (tok.startsWith("**")) {
            nodes.push(<strong key={key++}>{tok.slice(2, -2)}</strong>)
        } else if (tok.startsWith("*")) {
            nodes.push(<em key={key++}>{tok.slice(1, -1)}</em>)
        } else {
            const mm = /\[([^\]]+)\]\(([^)]+)\)/.exec(tok)
            if (mm) {
                nodes.push(
                    <a
                        key={key++}
                        href={mm[2]}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary underline"
                    >
                        {mm[1]}
                    </a>,
                )
            } else {
                nodes.push(tok)
            }
        }
        last = m.index + tok.length
    }
    if (last < text.length) nodes.push(text.slice(last))
    return nodes
}

const HEADING_CLASS = [
    "text-base font-bold",
    "text-sm font-bold",
    "text-sm font-semibold",
]

function parseBlocks(src: string): ReactNode[] {
    const blocks: ReactNode[] = []
    const lines = src.split("\n")
    let i = 0
    let key = 0

    const isSpecial = (l: string) =>
        /^```/.test(l) ||
        /^(#{1,6})\s/.test(l) ||
        /^>\s?/.test(l) ||
        /^[-*]\s+/.test(l) ||
        /^\d+\.\s+/.test(l)

    while (i < lines.length) {
        const line = lines[i]

        // 代码块
        if (/^```(\w*)\s*$/.test(line)) {
            const code: string[] = []
            i++
            while (i < lines.length && !/^```\s*$/.test(lines[i])) {
                code.push(lines[i])
                i++
            }
            i++ // 跳过结束 fence
            blocks.push(
                <pre
                    key={key++}
                    className="my-2 overflow-auto rounded-md border border-border bg-[#0B0E14] p-2 text-xs"
                >
                    <code className="font-mono text-green-300">{code.join("\n")}</code>
                </pre>,
            )
            continue
        }

        // 标题
        const h = /^(#{1,6})\s+(.*)$/.exec(line)
        if (h) {
            const level = Math.min(h[1].length, 3)
            blocks.push(
                <div key={key++} className={`${HEADING_CLASS[level - 1]} mb-1 mt-2`}>
                    {renderInline(h[2])}
                </div>,
            )
            i++
            continue
        }

        // 引用
        if (/^>\s?/.test(line)) {
            const quote: string[] = []
            while (i < lines.length && /^>\s?/.test(lines[i])) {
                quote.push(lines[i].replace(/^>\s?/, ""))
                i++
            }
            blocks.push(
                <blockquote
                    key={key++}
                    className="my-1 border-l-2 border-primary/50 pl-2 text-muted-foreground"
                >
                    {quote.map((q, idx) => (
                        <Fragment key={idx}>
                            {renderInline(q)}
                            <br />
                        </Fragment>
                    ))}
                </blockquote>,
            )
            continue
        }

        // 无序列表
        if (/^[-*]\s+/.test(line)) {
            const items: string[] = []
            while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
                items.push(lines[i].replace(/^[-*]\s+/, ""))
                i++
            }
            blocks.push(
                <ul key={key++} className="my-1 list-disc space-y-0.5 pl-5">
                    {items.map((it, idx) => (
                        <li key={idx}>{renderInline(it)}</li>
                    ))}
                </ul>,
            )
            continue
        }

        // 有序列表
        if (/^\d+\.\s+/.test(line)) {
            const items: string[] = []
            while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
                items.push(lines[i].replace(/^\d+\.\s+/, ""))
                i++
            }
            blocks.push(
                <ol key={key++} className="my-1 list-decimal space-y-0.5 pl-5">
                    {items.map((it, idx) => (
                        <li key={idx}>{renderInline(it)}</li>
                    ))}
                </ol>,
            )
            continue
        }

        // 空行
        if (line.trim() === "") {
            i++
            continue
        }

        // 段落：聚合连续普通行
        const para: string[] = []
        while (i < lines.length && lines[i].trim() !== "" && !isSpecial(lines[i])) {
            para.push(lines[i])
            i++
        }
        blocks.push(
            <p key={key++} className="my-1 leading-relaxed">
                {para.map((p, idx) => (
                    <Fragment key={idx}>
                        {renderInline(p)}
                        {idx < para.length - 1 && <br />}
                    </Fragment>
                ))}
            </p>,
        )
    }
    return blocks
}

export function Markdown({ content, className }: { content: string; className?: string }) {
    return <div className={className}>{parseBlocks(content)}</div>
}
