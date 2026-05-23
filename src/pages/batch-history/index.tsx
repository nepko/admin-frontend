import { useState } from "react"
import { useSWR, swrFetcher } from "@/lib/swr"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RotateCcw, Power, Play, Calendar, Search, ArrowUpDown } from "lucide-react"

interface BatchHistory {
    id: number
    operation: string
    command?: string
    total: number
    success: number
    failed: number
    created_at: string
}

interface BatchHistoryResponse {
    total: number
    page: number
    page_size: number
    histories: BatchHistory[]
}

export default function BatchHistoryPage() {
    const [page, setPage] = useState(1)
    const [pageSize, setPageSize] = useState(10)
    const [searchTerm, setSearchTerm] = useState("")
    const [operationFilter, setOperationFilter] = useState("")

    const { data: historyData, error: historyError, mutate } = useSWR<BatchHistoryResponse>(
        `/api/v1/batch/history?page=${page}&size=${pageSize}`,
        swrFetcher
    )

    const histories = historyData?.histories || []
    const total = historyData?.total || 0
    const totalPages = Math.ceil(total / pageSize)

    const getOperationIcon = (operation: string) => {
        switch (operation) {
            case "restart": return <RotateCcw className="w-4 h-4" />
            case "shutdown": return <Power className="w-4 h-4" />
            case "execute": return <Play className="w-4 h-4" />
            default: return null
        }
    }

    const getOperationLabel = (operation: string) => {
        switch (operation) {
            case "restart": return "重启服务器"
            case "shutdown": return "关闭服务器"
            case "execute": return "执行命令"
            default: return operation
        }
    }

    const getOperationBadgeColor = (operation: string) => {
        switch (operation) {
            case "restart": return "bg-blue-100 text-blue-800 border-blue-200"
            case "shutdown": return "bg-red-100 text-red-800 border-red-200"
            case "execute": return "bg-green-100 text-green-800 border-green-200"
            default: return "bg-gray-100 text-gray-800 border-gray-200"
        }
    }

    const getSuccessRate = (success: number, total: number) => {
        if (total === 0) return 0
        return Math.round((success / total) * 100)
    }

    const filteredHistories = histories.filter(history => {
        const matchesSearch = !searchTerm ||
            getOperationLabel(history.operation).toLowerCase().includes(searchTerm.toLowerCase()) ||
            (history.command && history.command.toLowerCase().includes(searchTerm.toLowerCase()))
        const matchesOperation = !operationFilter || history.operation === operationFilter
        return matchesSearch && matchesOperation
    })

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold">批量操作历史</h1>
                <Button variant="outline" onClick={() => mutate()}>
                    <ArrowUpDown className="w-4 h-4 mr-2" />
                    刷新
                </Button>
            </div>

            <Card>
                <CardContent className="pt-6">
                    <div className="flex flex-col sm:flex-row gap-4">
                        <div className="flex-1">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                                <Input
                                    placeholder="搜索操作或命令..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-10"
                                />
                            </div>
                        </div>
                        <div className="sm:w-48">
                            <Select value={operationFilter} onValueChange={setOperationFilter}>
                                <SelectTrigger>
                                    <SelectValue placeholder="操作类型" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="">全部操作</SelectItem>
                                    <SelectItem value="restart">重启服务器</SelectItem>
                                    <SelectItem value="shutdown">关闭服务器</SelectItem>
                                    <SelectItem value="execute">执行命令</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                        <span>操作记录</span>
                        <Badge variant="secondary">共 {total} 条记录</Badge>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {historyError && (
                        <div className="text-red-500 text-center py-8">加载历史记录失败</div>
                    )}

                    {filteredHistories.length === 0 && !historyError && (
                        <div className="text-gray-500 text-center py-8">
                            {searchTerm || operationFilter ? "没有找到匹配的记录" : "暂无操作历史"}
                        </div>
                    )}

                    <div className="space-y-4">
                        {filteredHistories.map((history) => (
                            <div key={history.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center space-x-3 mb-2">
                                            <Badge variant="outline" className={getOperationBadgeColor(history.operation)}>
                                                <span className="flex items-center space-x-1">
                                                    {getOperationIcon(history.operation)}
                                                    <span>{getOperationLabel(history.operation)}</span>
                                                </span>
                                            </Badge>
                                            <span className="text-sm text-gray-500 flex items-center">
                                                <Calendar className="w-3 h-3 mr-1" />
                                                {new Date(history.created_at).toLocaleString()}
                                            </span>
                                        </div>

                                        {history.command && (
                                            <div className="mb-2">
                                                <span className="text-sm font-medium text-gray-700">执行命令: </span>
                                                <code className="text-sm bg-gray-100 px-2 py-1 rounded">{history.command}</code>
                                            </div>
                                        )}

                                        <div className="flex items-center space-x-4 text-sm">
                                            <div className="flex items-center space-x-1">
                                                <span className="text-gray-600">总计:</span>
                                                <span className="font-medium">{history.total}</span>
                                            </div>
                                            <div className="flex items-center space-x-1">
                                                <span className="text-green-600">成功:</span>
                                                <span className="font-medium text-green-600">{history.success}</span>
                                            </div>
                                            <div className="flex items-center space-x-1">
                                                <span className="text-red-600">失败:</span>
                                                <span className="font-medium text-red-600">{history.failed}</span>
                                            </div>
                                            <div className="flex items-center space-x-1">
                                                <span className="text-blue-600">成功率:</span>
                                                <span className="font-medium text-blue-600">{getSuccessRate(history.success, history.total)}%</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="text-right">
                                        <div className={`text-2xl font-bold ${
                                            getSuccessRate(history.success, history.total) >= 80 ? "text-green-600" :
                                            getSuccessRate(history.success, history.total) >= 50 ? "text-yellow-600" : "text-red-600"
                                        }`}>
                                            {getSuccessRate(history.success, history.total)}%
                                        </div>
                                        <div className="text-xs text-gray-500">成功率</div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {totalPages > 1 && (
                        <div className="flex items-center justify-between mt-6">
                            <div className="flex items-center space-x-2">
                                <span className="text-sm text-gray-600">每页显示:</span>
                                <Select value={pageSize.toString()} onValueChange={(value) => { setPageSize(Number(value)); setPage(1) }}>
                                    <SelectTrigger className="w-20">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="5">5</SelectItem>
                                        <SelectItem value="10">10</SelectItem>
                                        <SelectItem value="20">20</SelectItem>
                                        <SelectItem value="50">50</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="flex items-center space-x-2">
                                <Button variant="outline" size="sm" onClick={() => setPage(1)} disabled={page === 1}>首页</Button>
                                <Button variant="outline" size="sm" onClick={() => setPage(page - 1)} disabled={page === 1}>上一页</Button>
                                <span className="text-sm text-gray-600">第 {page} 页，共 {totalPages} 页</span>
                                <Button variant="outline" size="sm" onClick={() => setPage(page + 1)} disabled={page === totalPages}>下一页</Button>
                                <Button variant="outline" size="sm" onClick={() => setPage(totalPages)} disabled={page === totalPages}>末页</Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
