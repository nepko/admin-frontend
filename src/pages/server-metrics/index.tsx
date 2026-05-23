import { useState } from "react"
import { useSWR, swrFetcher } from "@/lib/swr"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { RefreshCw, Activity, Cpu, HardDrive, MemoryStick, Network, Clock } from "lucide-react"
import { ModelServer } from "@/types"

interface ServerMetrics {
    server_id: number
    server_name: string
    metrics: {
        cpu_usage?: { current: number; unit: string }
        memory_usage?: { current: number; used: number; total: number; unit: string }
        disk_usage?: { current: number; used: number; total: number; unit: string }
        network_io?: { in_speed: number; out_speed: number; in_total: number; out_total: number; unit: string }
        load?: { load1: number; load5: number; load15: number }
    }
    period: string
    timestamp: number
}

export default function ServerMetricsPage() {
    const [selectedServer, setSelectedServer] = useState<number | null>(null)
    const [selectedMetrics, setSelectedMetrics] = useState<string>("cpu_usage,memory_usage,disk_usage")
    const [selectedPeriod, setSelectedPeriod] = useState<string>("24h")

    const { data: servers } = useSWR<ModelServer[]>("/api/v1/server", swrFetcher, {
        revalidateOnFocus: false,
    })

    const serverList = servers || []

    const { data: metricsData, error: metricsError, mutate } = useSWR<ServerMetrics>(
        selectedServer ? `/api/v1/batch/servers/${selectedServer}/metrics?metrics=${selectedMetrics}&period=${selectedPeriod}` : null,
        swrFetcher
    )

    const formatBytes = (bytes: number): string => {
        if (bytes === 0) return "0 B"
        const k = 1024
        const sizes = ["B", "KB", "MB", "GB", "TB"]
        const i = Math.floor(Math.log(bytes) / Math.log(k))
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
    }

    const formatSpeed = (bytes: number): string => formatBytes(bytes) + "/s"

    const getProgressColor = (percentage: number): string => {
        if (percentage >= 90) return "bg-red-500"
        if (percentage >= 70) return "bg-yellow-500"
        return "bg-green-500"
    }

    const getUsageColor = (percentage: number): string => {
        if (percentage >= 90) return "text-red-600"
        if (percentage >= 70) return "text-yellow-600"
        return "text-green-600"
    }

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold">服务器监控指标</h1>
                {selectedServer && (
                    <Button variant="outline" onClick={() => mutate()}>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        刷新数据
                    </Button>
                )}
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>配置监控</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">选择服务器</label>
                            <Select value={selectedServer?.toString() || ""} onValueChange={(value) => setSelectedServer(Number(value))}>
                                <SelectTrigger>
                                    <SelectValue placeholder="选择服务器" />
                                </SelectTrigger>
                                <SelectContent>
                                    {serverList.map((server) => (
                                        <SelectItem key={server.id} value={server.id.toString()}>
                                            <div className="flex items-center space-x-2">
                                                <span>{server.name}</span>
                                                <Badge variant={server.state ? "default" : "secondary"} className={server.state ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}>
                                                    {server.state ? "在线" : "离线"}
                                                </Badge>
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">监控指标</label>
                            <Select value={selectedMetrics} onValueChange={setSelectedMetrics}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="cpu_usage,memory_usage,disk_usage">CPU + 内存 + 磁盘</SelectItem>
                                    <SelectItem value="cpu_usage,memory_usage,disk_usage,network_io">全部基础指标</SelectItem>
                                    <SelectItem value="cpu_usage">CPU 使用率</SelectItem>
                                    <SelectItem value="memory_usage">内存使用率</SelectItem>
                                    <SelectItem value="disk_usage">磁盘使用率</SelectItem>
                                    <SelectItem value="network_io">网络 I/O</SelectItem>
                                    <SelectItem value="load">系统负载</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">时间周期</label>
                            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="1h">1小时</SelectItem>
                                    <SelectItem value="6h">6小时</SelectItem>
                                    <SelectItem value="24h">24小时</SelectItem>
                                    <SelectItem value="7d">7天</SelectItem>
                                    <SelectItem value="30d">30天</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {selectedServer && (
                <>
                    {metricsError && (
                        <Card>
                            <CardContent className="py-8 text-center text-red-500">加载监控数据失败</CardContent>
                        </Card>
                    )}

                    {metricsData && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {metricsData.metrics.cpu_usage && (
                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="flex items-center text-lg">
                                            <Cpu className="w-5 h-5 mr-2 text-blue-500" />
                                            CPU 使用率
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <span className={`text-2xl font-bold ${getUsageColor(metricsData.metrics.cpu_usage.current)}`}>
                                                    {metricsData.metrics.cpu_usage.current.toFixed(1)}%
                                                </span>
                                                <Badge variant="outline">{metricsData.metrics.cpu_usage.unit}</Badge>
                                            </div>
                                            <Progress value={metricsData.metrics.cpu_usage.current} className="h-2" indicatorClassName={getProgressColor(metricsData.metrics.cpu_usage.current)} />
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            {metricsData.metrics.memory_usage && (
                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="flex items-center text-lg">
                                            <MemoryStick className="w-5 h-5 mr-2 text-purple-500" />
                                            内存使用率
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <span className={`text-2xl font-bold ${getUsageColor(metricsData.metrics.memory_usage.current)}`}>
                                                    {metricsData.metrics.memory_usage.current.toFixed(1)}%
                                                </span>
                                                <Badge variant="outline">{metricsData.metrics.memory_usage.unit}</Badge>
                                            </div>
                                            <Progress value={metricsData.metrics.memory_usage.current} className="h-2" indicatorClassName={getProgressColor(metricsData.metrics.memory_usage.current)} />
                                            <div className="text-sm text-gray-600 space-y-1">
                                                <div className="flex justify-between">
                                                    <span>已用:</span>
                                                    <span className="font-medium">{formatBytes(metricsData.metrics.memory_usage.used)}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span>总计:</span>
                                                    <span className="font-medium">{formatBytes(metricsData.metrics.memory_usage.total)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            {metricsData.metrics.disk_usage && (
                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="flex items-center text-lg">
                                            <HardDrive className="w-5 h-5 mr-2 text-green-500" />
                                            磁盘使用率
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <span className={`text-2xl font-bold ${getUsageColor(metricsData.metrics.disk_usage.current)}`}>
                                                    {metricsData.metrics.disk_usage.current.toFixed(1)}%
                                                </span>
                                                <Badge variant="outline">{metricsData.metrics.disk_usage.unit}</Badge>
                                            </div>
                                            <Progress value={metricsData.metrics.disk_usage.current} className="h-2" indicatorClassName={getProgressColor(metricsData.metrics.disk_usage.current)} />
                                            <div className="text-sm text-gray-600 space-y-1">
                                                <div className="flex justify-between">
                                                    <span>已用:</span>
                                                    <span className="font-medium">{formatBytes(metricsData.metrics.disk_usage.used)}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span>总计:</span>
                                                    <span className="font-medium">{formatBytes(metricsData.metrics.disk_usage.total)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            {metricsData.metrics.network_io && (
                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="flex items-center text-lg">
                                            <Network className="w-5 h-5 mr-2 text-cyan-500" />
                                            网络 I/O
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-4">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="text-center">
                                                    <div className="text-sm text-gray-600">入站速度</div>
                                                    <div className="text-xl font-bold text-green-600">{formatSpeed(metricsData.metrics.network_io.in_speed)}</div>
                                                </div>
                                                <div className="text-center">
                                                    <div className="text-sm text-gray-600">出站速度</div>
                                                    <div className="text-xl font-bold text-blue-600">{formatSpeed(metricsData.metrics.network_io.out_speed)}</div>
                                                </div>
                                            </div>
                                            <div className="border-t pt-3">
                                                <div className="text-sm text-gray-600 space-y-1">
                                                    <div className="flex justify-between">
                                                        <span>总入站:</span>
                                                        <span className="font-medium">{formatBytes(metricsData.metrics.network_io.in_total)}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span>总出站:</span>
                                                        <span className="font-medium">{formatBytes(metricsData.metrics.network_io.out_total)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            {metricsData.metrics.load && (
                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="flex items-center text-lg">
                                            <Activity className="w-5 h-5 mr-2 text-orange-500" />
                                            系统负载
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="grid grid-cols-3 gap-4 text-center">
                                            <div>
                                                <div className="text-sm text-gray-600">1分钟</div>
                                                <div className="text-xl font-bold text-blue-600">{metricsData.metrics.load.load1.toFixed(2)}</div>
                                            </div>
                                            <div>
                                                <div className="text-sm text-gray-600">5分钟</div>
                                                <div className="text-xl font-bold text-yellow-600">{metricsData.metrics.load.load5.toFixed(2)}</div>
                                            </div>
                                            <div>
                                                <div className="text-sm text-gray-600">15分钟</div>
                                                <div className="text-xl font-bold text-green-600">{metricsData.metrics.load.load15.toFixed(2)}</div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            <Card className="md:col-span-2 lg:col-span-3">
                                <CardContent className="py-3">
                                    <div className="flex items-center justify-between text-sm text-gray-600">
                                        <div className="flex items-center">
                                            <Clock className="w-4 h-4 mr-2" />
                                            <span>最后更新: {new Date(metricsData.timestamp * 1000).toLocaleString()}</span>
                                        </div>
                                        <Badge variant="outline" className="bg-blue-50">周期: {selectedPeriod}</Badge>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    )}
                </>
            )}

            {!selectedServer && (
                <Card>
                    <CardContent className="py-12 text-center text-gray-500">
                        <Activity className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                        <h3 className="text-lg font-medium mb-2">选择服务器查看监控指标</h3>
                        <p>请在上方选择一台服务器来查看其详细的监控数据</p>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
