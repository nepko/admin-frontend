import { useState } from "react"
import { useSWR, swrFetcher } from "@/lib/swr"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { Loader2, Play, RotateCcw, Power, History } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { ModelServer } from "@/types"

interface BatchOperationResult {
    server_id: number
    server_name: string
    success: boolean
    message: string
}

interface BatchOperationResponse {
    total_count: number
    success_count: number
    failed_count: number
    operation: string
    results: BatchOperationResult[]
}

export default function BatchOperationsPage() {
    const [selectedServers, setSelectedServers] = useState<number[]>([])
    const [operation, setOperation] = useState<string>("")
    const [customCommand, setCustomCommand] = useState<string>("")
    const [isExecuting, setIsExecuting] = useState(false)
    const [showResults, setShowResults] = useState(false)
    const [lastResults, setLastResults] = useState<BatchOperationResult[]>([])

    const { data: servers, error: serversError } = useSWR<ModelServer[]>("/api/v1/server", swrFetcher, {
        revalidateOnFocus: false,
    })

    const serverList = servers || []

    const handleServerToggle = (serverId: number) => {
        setSelectedServers(prev =>
            prev.includes(serverId)
                ? prev.filter(id => id !== serverId)
                : [...prev, serverId]
        )
    }

    const handleSelectAll = () => {
        if (selectedServers.length === serverList.length) {
            setSelectedServers([])
        } else {
            setSelectedServers(serverList.map(s => s.id))
        }
    }

    const handleExecute = async () => {
        if (selectedServers.length === 0) {
            toast.error("请至少选择一个服务器")
            return
        }

        if (!operation) {
            toast.error("请选择操作类型")
            return
        }

        if (operation === "execute" && !customCommand.trim()) {
            toast.error("请输入要执行的命令")
            return
        }

        setIsExecuting(true)
        setShowResults(false)

        try {
            const response = await fetch("/api/v1/batch/servers", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    server_ids: selectedServers,
                    operation,
                    command: operation === "execute" ? customCommand : undefined,
                }),
            })

            const result = await response.json()

            if (result.success && result.data) {
                setLastResults(result.data.results)
                setShowResults(true)
                toast.success(`批量操作执行完成: ${result.data.success_count}/${result.data.total_count} 成功`)
            } else {
                toast.error(result.error || "操作执行失败")
            }
        } catch (error) {
            toast.error("网络请求失败")
            console.error("Batch operation error:", error)
        } finally {
            setIsExecuting(false)
        }
    }

    const getOperationIcon = (op: string) => {
        switch (op) {
            case "restart": return <RotateCcw className="w-4 h-4" />
            case "shutdown": return <Power className="w-4 h-4" />
            case "execute": return <Play className="w-4 h-4" />
            default: return null
        }
    }

    const getOperationLabel = (op: string) => {
        switch (op) {
            case "restart": return "重启服务器"
            case "shutdown": return "关闭服务器"
            case "execute": return "执行命令"
            default: return op
        }
    }

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold">批量操作</h1>
                <Button variant="outline" onClick={() => window.location.href = "/dashboard/batch-history"}>
                    <History className="w-4 h-4 mr-2" />
                    操作历史
                </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                            <span>选择服务器</span>
                            <div className="flex items-center space-x-2">
                                <Button variant="outline" size="sm" onClick={handleSelectAll}>
                                    {selectedServers.length === serverList.length ? "取消全选" : "全选"}
                                </Button>
                                <Badge variant="secondary">
                                    已选择 {selectedServers.length}/{serverList.length}
                                </Badge>
                            </div>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {serversError && (
                            <div className="text-red-500 mb-4">加载服务器列表失败</div>
                        )}

                        <div className="space-y-2 max-h-96 overflow-y-auto">
                            {serverList.map((server) => (
                                <div
                                    key={server.id}
                                    className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50"
                                >
                                    <Checkbox
                                        checked={selectedServers.includes(server.id)}
                                        onCheckedChange={() => handleServerToggle(server.id)}
                                        id={`server-${server.id}`}
                                    />
                                    <div className="flex-1">
                                        <div className="flex items-center space-x-2">
                                            <label
                                                htmlFor={`server-${server.id}`}
                                                className="font-medium cursor-pointer"
                                            >
                                                {server.name}
                                            </label>
                                            <Badge
                                                variant={server.state ? "success" : "secondary"}
                                                className={server.state ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}
                                            >
                                                {server.state ? "在线" : "离线"}
                                            </Badge>
                                        </div>
                                        {server.state && (
                                            <div className="text-sm text-gray-500 mt-1">
                                                CPU: {server.state.cpu.toFixed(1)}% |
                                                内存: {server.state.mem_used ? `${(server.state.mem_used / 1024 / 1024).toFixed(0)}MB` : "N/A"} |
                                                磁盘: {server.state.disk_used ? `${(server.state.disk_used / 1024 / 1024).toFixed(0)}MB` : "N/A"}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>操作配置</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="operation">操作类型</Label>
                            <Select value={operation} onValueChange={setOperation}>
                                <SelectTrigger>
                                    <SelectValue placeholder="选择操作类型" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="restart">
                                        <div className="flex items-center space-x-2">
                                            <RotateCcw className="w-4 h-4" />
                                            <span>重启服务器</span>
                                        </div>
                                    </SelectItem>
                                    <SelectItem value="shutdown">
                                        <div className="flex items-center space-x-2">
                                            <Power className="w-4 h-4" />
                                            <span>关闭服务器</span>
                                        </div>
                                    </SelectItem>
                                    <SelectItem value="execute">
                                        <div className="flex items-center space-x-2">
                                            <Play className="w-4 h-4" />
                                            <span>执行命令</span>
                                        </div>
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {operation === "execute" && (
                            <div className="space-y-2">
                                <Label htmlFor="command">执行命令</Label>
                                <Input
                                    id="command"
                                    value={customCommand}
                                    onChange={(e) => setCustomCommand(e.target.value)}
                                    placeholder="输入要执行的命令，如: uptime"
                                />
                                <p className="text-sm text-gray-500">
                                    命令将在所有选中的服务器上执行
                                </p>
                            </div>
                        )}

                        <Button
                            className="w-full"
                            onClick={handleExecute}
                            disabled={isExecuting || selectedServers.length === 0 || !operation}
                        >
                            {isExecuting ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    执行中...
                                </>
                            ) : (
                                <>
                                    {getOperationIcon(operation)}
                                    <span className="ml-2">
                                        {operation ? getOperationLabel(operation) : "选择操作"}
                                    </span>
                                </>
                            )}
                        </Button>

                        {selectedServers.length > 0 && (
                            <div className="text-sm text-gray-500">
                                将对 {selectedServers.length} 台服务器执行操作
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {showResults && lastResults.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>操作结果</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            {lastResults.map((result, index) => (
                                <div
                                    key={index}
                                    className={`flex items-center justify-between p-3 rounded-lg border ${
                                        result.success ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"
                                    }`}
                                >
                                    <div>
                                        <div className="font-medium">{result.server_name}</div>
                                        <div className="text-sm text-gray-600">{result.message}</div>
                                    </div>
                                    <Badge
                                        variant={result.success ? "default" : "destructive"}
                                        className={result.success ? "bg-green-500" : "bg-red-500"}
                                    >
                                        {result.success ? "成功" : "失败"}
                                    </Badge>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
