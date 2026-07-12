import { createFM, getFMEnhanced, chmodFile, chownFile, zipFile, unzipFile } from "@/api/fm"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
    Drawer,
    DrawerContent,
    DrawerHeader,
    DrawerTitle,
    DrawerTrigger,
} from "@/components/ui/drawer"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { useMediaQuery } from "@/hooks/useMediaQuery"
import { copyToClipboard, fm, formatPath, fmWorker as worker } from "@/lib/utils"
import {
    FMEntry,
    FMIdentifier,
    FMOpcode,
    FMWorkerData,
    FMWorkerOpcode,
    ModelCreateFMResponse,
} from "@/types"
import { ColumnDef } from "@tanstack/react-table"
import { Row, flexRender } from "@tanstack/react-table"
import { Archive, File, Folder } from "lucide-react"
import { HTMLAttributes, JSX, useCallback, useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import useSWR from "swr"

import { Button } from "./ui/button"
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "./ui/dialog"
import { TableCell, TableRow } from "./ui/table"
import { Textarea } from "./ui/textarea"
import { Filepath } from "./xui/filepath"
import { IconButton } from "./xui/icon-button"
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "./xui/overlayless-sheet"
import { DataTable } from "./xui/virtulized-data-table"

interface FMProps {
    wsUrl: string
    serverId?: string
}

type VirtualizedTableRowProps = HTMLAttributes<HTMLTableRowElement> & {
    "data-index"?: number | string
}

const arraysEqual = (a: Uint8Array, b: Uint8Array) => {
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return false
    }
    return true
}

export const FMComponent: React.FC<FMProps & JSX.IntrinsicElements["div"]> = ({
    wsUrl,
    serverId,
    ...props
}) => {
    const { t } = useTranslation()
    const fmRef = useRef<HTMLDivElement>(null)
    const wsRef = useRef<WebSocket | null>(null)
    const tRef = useRef(t)
    tRef.current = t

    const [dOpen, setdOpen] = useState(false)
    const [uOpen, setuOpen] = useState(false)

    const { data: enhRes } = useSWR("/api/v1/file/enhanced", getFMEnhanced)
    const enhanced = !!enhRes?.enabled

    const columns: ColumnDef<FMEntry>[] = [
        {
            id: "type",
            header: () => <span>{t("Type")}</span>,
            accessorFn: (row) => row.type,
            cell: ({ row }) => (row.original.type == 0 ? <File size={24} /> : <Folder size={24} />),
        },
        {
            header: () => <span>{t("Name")}</span>,
            id: "name",
            accessorFn: (row) => row.name,
            cell: ({ row }) => (
                <div className="max-w-48 text-sm whitespace-normal break-words">
                    {row.original.name}
                </div>
            ),
            size: 5000,
        },
        {
            header: () => <span>{t("Actions")}</span>,
            id: "download",
            cell: ({ row }) => {
                if (row.original.type != 0) return <span />
                return (
                    <div className="flex gap-1">
                        <IconButton
                            variant="ghost"
                            icon="download"
                            onClick={() => {
                                if (!dOpen) setdOpen(true)
                                downloadFile(row.original.name)
                            }}
                        />
                        {enhanced && (
                            <>
                                <IconButton
                                    variant="ghost"
                                    icon="pencil"
                                    onClick={() => editFile(row.original.name)}
                                />
                                <IconButton
                                    variant="ghost"
                                    icon="lock"
                                    onClick={() => openChmod(`${currentPath}/${row.original.name}`)}
                                />
                                <IconButton
                                    variant="ghost"
                                    icon="user-cog"
                                    onClick={() => openChown(`${currentPath}/${row.original.name}`)}
                                />
                                <IconButton
                                    variant="ghost"
                                    icon="file-archive"
                                    onClick={() =>
                                        archive(FMOpcode.Zip, `${currentPath}/${row.original.name}`, `${currentPath}/${row.original.name}.zip`)
                                    }
                                />
                            </>
                        )}
                    </div>
                )
            },
        },
    ]

    const tableRowComponent = (rows: Row<FMEntry>[]) =>
        function getTableRow(props: VirtualizedTableRowProps) {
            const index = Number(props["data-index"])
            const row = rows[index]

            if (!row) return null

            return (
                <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                    onClick={() => {
                        if (row.original.type === 1) {
                            setPath(`${currentPath}/${row.original.name}`)
                        }
                    }}
                    className={row.original.type === 1 ? "cursor-pointer" : "cursor-default"}
                    {...props}
                >
                    {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                    ))}
                </TableRow>
            )
        }

    const [fmEntires, setFMEntries] = useState<FMEntry[]>([])

    const firstChunk = useRef(true)
    const handleReady = useRef(false)
    const currentBasename = useRef("temp")
    const editModeRef = useRef(false)
    const opInProgress = useRef<string | null>(null)

    const waitForHandleReady = async () => {
        while (!handleReady.current) {
            await new Promise((resolve) => setTimeout(resolve, 10))
        }
    }

    useEffect(() => {
        worker.onmessage = async (event: MessageEvent<FMWorkerData>) => {
            switch (event.data.type) {
                case FMWorkerOpcode.Error: {
                    console.error("Error from worker", event.data.error)
                    break
                }
                case FMWorkerOpcode.Progress: {
                    handleReady.current = true
                    break
                }
                case FMWorkerOpcode.Result: {
                    handleReady.current = false

                    if (event.data.blob && event.data.fileName) {
                        if (editModeRef.current) {
                            editModeRef.current = false
                            try {
                                const text = await event.data.blob.text()
                                setEditContent(text)
                                setEditTarget(event.data.fileName)
                                setEditOpen(true)
                            } catch (e) {
                                toast(t("Error"), { description: String(e) })
                            }
                        } else {
                            const url = URL.createObjectURL(event.data.blob)
                            const anchor = document.createElement("a")
                            anchor.href = url
                            anchor.download = event.data.fileName
                            anchor.click()
                            URL.revokeObjectURL(url)
                        }
                    }

                    firstChunk.current = true
                    if (dOpen) setdOpen(false)
                    break
                }
            }
        }

        const handleBeforeUnload = () => {
            worker.postMessage({ operation: 3 })
        }

        window.addEventListener("beforeunload", handleBeforeUnload)
        return () => {
            window.removeEventListener("beforeunload", handleBeforeUnload)
        }
    }, [dOpen])

    const [currentPath, setPath] = useState("")
    const currentPathRef = useRef(currentPath)
    currentPathRef.current = currentPath

    const listFile = useCallback(() => {
        const prefix = new Int8Array([FMOpcode.List])
        const pathMsg = new TextEncoder().encode(currentPathRef.current)

        const msg = new Int8Array(prefix.length + pathMsg.length)
        msg.set(prefix)
        msg.set(pathMsg, prefix.length)

        wsRef.current?.send(msg)
    }, [])

    // The WebSocket initialization must not depend on listFile or currentPath,
    // otherwise navigating directories triggers a disconnect and reconnect.
    useEffect(() => {
        const url = new URL(wsUrl, window.location.origin)
        url.protocol = url.protocol.replace("http", "ws")
        const ws = new WebSocket(url)
        wsRef.current = ws
        ws.binaryType = "arraybuffer"
        ws.onopen = () => {
            listFile()
        }
        ws.onclose = (e) => {
            console.log("WebSocket connection closed:", e)
        }
        ws.onerror = (e) => {
            console.error(e)
            toast("Websocket" + " " + tRef.current("Error"), {
                description: tRef.current("Results.UnExpectedError"),
            })
        }
        ws.onmessage = async (e: MessageEvent<ArrayBufferLike>) => {
            try {
                const identifier = new Uint8Array(e.data, 0, 4)
                if (arraysEqual(identifier, FMIdentifier.error)) {
                    const errBytes = e.data.slice(4)
                    const errMsg = new TextDecoder("utf-8").decode(errBytes)
                    throw new Error(errMsg)
                }
                if (firstChunk.current) {
                    if (arraysEqual(identifier, FMIdentifier.file)) {
                        worker.postMessage({
                            operation: 1,
                            arrayBuffer: e.data,
                            fileName: currentBasename.current,
                        })
                        firstChunk.current = false
                    } else if (arraysEqual(identifier, FMIdentifier.fileName)) {
                        const { path, fmList } = await fm.parseFMList(e.data)
                        setPath(path)
                        setFMEntries(fmList)
                    } else if (arraysEqual(identifier, FMIdentifier.complete)) {
                        // 上传或其它写操作完成
                        listFile()
                        if (opInProgress.current) {
                            toast.success(`${opInProgress.current} ${t("Success")}`)
                            opInProgress.current = null
                        }
                        setuOpen(false)
                    } else {
                        throw new Error(tRef.current("Results.UnknownIdentifier"))
                    }
                } else {
                    await waitForHandleReady()
                    worker.postMessage({
                        operation: 2,
                        arrayBuffer: e.data,
                        fileName: currentBasename.current,
                    })
                }
            } catch (error) {
                console.error("Error processing received data:", error)
                toast("FM" + " " + tRef.current("Error"), {
                    description: tRef.current("Results.UnExpectedError"),
                })
                setdOpen(false)
                setuOpen(false)
            }
        }

        return () => {
            ws.close()
            if (wsRef.current === ws) {
                wsRef.current = null
            }
        }
    }, [listFile, wsUrl])

    useEffect(() => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            listFile()
        }
    }, [currentPath, listFile])

    const downloadFile = (basename: string, editMode = false) => {
        currentBasename.current = basename
        editModeRef.current = editMode
        const prefix = new Int8Array([FMOpcode.Download])
        const filePathMessage = new TextEncoder().encode(`${currentPath}/${basename}`)

        const msg = new Int8Array(prefix.length + filePathMessage.length)
        msg.set(prefix)
        msg.set(filePathMessage, prefix.length)

        wsRef.current?.send(msg)
    }

    const editFile = (basename: string) => {
        downloadFile(basename, true)
    }

    const uploadFile = async (file: File) => {
        const chunkSize = 1048576 // 1MB chunk
        let offset = 0

        // Send header
        const header = fm.buildUploadHeader({ path: currentPath, file: file })
        wsRef.current?.send(header)

        // Send data chunks
        while (offset < file.size) {
            const chunk = file.slice(offset, offset + chunkSize)
            const arrayBuffer = await fm.readFileAsArrayBuffer(chunk)
            if (arrayBuffer) wsRef.current?.send(arrayBuffer)
            offset += chunkSize
        }
    }

    // 编辑写回：复用官方 Upload opcode（opcode 2）走 FM WebSocket 流落盘，无需 agent 新 opcode。
    const saveEdit = () => {
        opInProgress.current = t("Save")
        const { header, content } = fm.writeContent(editTarget, editContent)
        wsRef.current?.send(header)
        wsRef.current?.send(content)
        setEditOpen(false)
    }

    // 压缩/解压：走后端 REST API（复用官方 TaskTypeExec 通道），无需 agent 新 opcode。
    const archive = async (opcode: FMOpcode, src: string, dst: string) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
            toast(t("Error"), { description: t("Results.UnExpectedError") })
            return
        }
        try {
            if (opcode === FMOpcode.Zip) {
                await zipFile(serverId, src, dst)
            } else {
                await unzipFile(serverId, src, dst)
            }
            toast.success(`${opcode === FMOpcode.Zip ? t("Zip") : t("Unzip")} ${t("Success")}`)
            listFile()
        } catch (e) {
            toast(t("Error"), { description: String(e) })
        }
    }

    // 在线编辑对话框
    const [editOpen, setEditOpen] = useState(false)
    const [editTarget, setEditTarget] = useState("")
    const [editContent, setEditContent] = useState("")

    // chmod 对话框
    const [chmodOpen, setChmodOpen] = useState(false)
    const [chmodPath, setChmodPath] = useState("")
    const [chmodMode, setChmodMode] = useState("644")
    const openChmod = (path: string) => {
        setChmodPath(path)
        setChmodOpen(true)
    }
    const saveChmod = async () => {
        const mode = parseInt(chmodMode, 8)
        if (isNaN(mode)) {
            toast(t("Error"), { description: t("Results.UnExpectedError") })
            return
        }
        try {
            await chmodFile(serverId, chmodPath, mode)
            toast.success(`${t("Chmod")} ${t("Success")}`)
            listFile()
            setChmodOpen(false)
        } catch (e) {
            toast(t("Error"), { description: String(e) })
        }
    }

    // chown 对话框
    const [chownOpen, setChownOpen] = useState(false)
    const [chownPath, setChownPath] = useState("")
    const [chownUid, setChownUid] = useState("0")
    const [chownGid, setChownGid] = useState("0")
    const openChown = (path: string) => {
        setChownPath(path)
        setChownOpen(true)
    }
    const saveChown = async () => {
        const uid = parseInt(chownUid, 10) || 0
        const gid = parseInt(chownGid, 10) || 0
        try {
            await chownFile(serverId, chownPath, uid, gid)
            toast.success(`${t("Chown")} ${t("Success")}`)
            listFile()
            setChownOpen(false)
        } catch (e) {
            toast(t("Error"), { description: String(e) })
        }
    }

    const fileInputRef = useRef<HTMLInputElement>(null)

    const [gotoPath, setGotoPath] = useState("")
    return (
        <div ref={fmRef} {...props}>
            <div className="flex justify-center items-center gap-4">
                <AlertDialog>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <IconButton variant="ghost" icon="menu" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                            <DropdownMenuItem onClick={listFile}>{t("Refresh")}</DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={async () => {
                                    try {
                                        await copyToClipboard(formatPath(currentPath))
                                    } catch (error) {
                                        const description =
                                            error instanceof Error
                                                ? error.message
                                                : t("Results.UnExpectedError")
                                        toast("FM" + " " + t("Error"), {
                                            description,
                                        })
                                        console.error("copy error: ", error)
                                    }
                                }}
                            >
                                {t("CopyPath")}
                            </DropdownMenuItem>
                            {enhanced && (
                                <DropdownMenuItem
                                    onClick={() =>
                                        archive(FMOpcode.Zip, currentPath, `${currentPath}/archive.zip`)
                                    }
                                >
                                    <Archive className="h-4 w-4 mr-2" />
                                    {t("ZipCurrentDir")}
                                </DropdownMenuItem>
                            )}
                            <AlertDialogTrigger asChild>
                                <DropdownMenuItem>{t("Goto")}</DropdownMenuItem>
                            </AlertDialogTrigger>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>{t("Goto")}</AlertDialogTitle>
                            <AlertDialogDescription />
                        </AlertDialogHeader>
                        <Input
                            className="mb-1"
                            placeholder={t("Path")}
                            value={gotoPath}
                            onChange={(e) => {
                                setGotoPath(e.target.value)
                            }}
                        />
                        <AlertDialogFooter>
                            <AlertDialogCancel>{t("Close")}</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={() => {
                                    setPath(gotoPath)
                                }}
                            >
                                {t("Confirm")}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
                <h1 className="text-base">{t("FileManager")}</h1>
                <div className="ml-auto">
                    <input
                        ref={fileInputRef}
                        type="file"
                        className="hidden"
                        onChange={async (e) => {
                            const files = e.target.files
                            if (files && files.length > 0) {
                                if (!uOpen) setuOpen(true)
                                await uploadFile(files[0])
                            }
                        }}
                    />
                    <IconButton
                        icon="upload"
                        variant="ghost"
                        onClick={() => {
                            if (fileInputRef.current) fileInputRef.current.click()
                        }}
                    />
                </div>
            </div>
            {enhanced && (
                <p className="text-xs text-muted-foreground mt-2">
                    {t("FMEnhancedHint")}
                </p>
            )}
            <Filepath path={currentPath} setPath={setPath} />
            <AlertDialog open={dOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t("Downloading")}...</AlertDialogTitle>
                        <AlertDialogDescription />
                    </AlertDialogHeader>
                </AlertDialogContent>
            </AlertDialog>
            <AlertDialog open={uOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t("Uploading")}...</AlertDialogTitle>
                        <AlertDialogDescription />
                    </AlertDialogHeader>
                </AlertDialogContent>
            </AlertDialog>

            {/* 在线编辑 */}
            <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{t("Edit")} · {editTarget}</DialogTitle>
                    </DialogHeader>
                    <Textarea
                        className="h-72 font-mono text-sm"
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                    />
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditOpen(false)}>
                            {t("Close")}
                        </Button>
                        <Button onClick={saveEdit}>{t("Save")}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* chmod */}
            <Dialog open={chmodOpen} onOpenChange={setChmodOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{t("Chmod")}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                        <div className="space-y-1">
                            <label className="text-sm">{t("Path")}</label>
                            <Input value={chmodPath} onChange={(e) => setChmodPath(e.target.value)} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm">{t("ModeOctal")}</label>
                            <Input value={chmodMode} onChange={(e) => setChmodMode(e.target.value)} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setChmodOpen(false)}>
                            {t("Close")}
                        </Button>
                        <Button onClick={saveChmod}>{t("Save")}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* chown */}
            <Dialog open={chownOpen} onOpenChange={setChownOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{t("Chown")}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                        <div className="space-y-1">
                            <label className="text-sm">{t("Path")}</label>
                            <Input value={chownPath} onChange={(e) => setChownPath(e.target.value)} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="text-sm">UID</label>
                                <Input value={chownUid} onChange={(e) => setChownUid(e.target.value)} />
                            </div>
                            <div className="space-y-1">
                                <label className="text-sm">GID</label>
                                <Input value={chownGid} onChange={(e) => setChownGid(e.target.value)} />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setChownOpen(false)}>
                            {t("Close")}
                        </Button>
                        <Button onClick={saveChown}>{t("Save")}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <DataTable columns={columns} data={fmEntires} rowComponent={tableRowComponent} />
        </div>
    )
}

export const FMCard = ({ id }: { id?: string }) => {
    const { t } = useTranslation()
    const [open, setOpen] = useState(false)
    const [fm, setFM] = useState<ModelCreateFMResponse | null>(null)
    const [init, setInit] = useState(false)

    const isDesktop = useMediaQuery("(min-width: 640px)")

    const fetchFM = async () => {
        if (id) {
            try {
                setInit(false)
                const createdFM = await createFM(id)
                setFM(createdFM)
            } catch (e) {
                toast(t("Error"), {
                    description: t("Results.UnExpectedError"),
                })
                console.error("fetch error", e)
                return
            }
            setInit(true)
        }
    }

    return isDesktop ? (
        <Sheet
            modal={false}
            open={open}
            onOpenChange={(isOpen) => {
                if (isOpen) setOpen(true)
            }}
        >
            <SheetTrigger asChild>
                <IconButton icon="folder-closed" onClick={fetchFM} />
            </SheetTrigger>
            <SheetContent setOpen={setOpen} className="min-w-[35%]">
                <div className="overflow-auto">
                    <SheetTitle />
                    <SheetHeader className="pb-2">
                        <SheetDescription />
                    </SheetHeader>
                    {fm?.session_id && init ? (
                        <FMComponent
                            className="p-1 space-y-5"
                            wsUrl={`/api/v1/ws/file/${fm.session_id}`}
                            serverId={id}
                        />
                    ) : (
                        <p>{t("Results.TheServerDoesNotOnline")}</p>
                    )}
                </div>
            </SheetContent>
        </Sheet>
    ) : (
        <Drawer>
            <DrawerTrigger asChild>
                <IconButton icon="folder-closed" onClick={fetchFM} />
            </DrawerTrigger>
            <DrawerContent className="min-h-[60%] p-4">
                <div className="overflow-auto">
                    <DrawerTitle />
                    <DrawerHeader className="pb-2">
                        <SheetDescription />
                    </DrawerHeader>
                    {fm?.session_id && init ? (
                        <FMComponent
                            className="p-1 space-y-5"
                            wsUrl={`/api/v1/ws/file/${fm.session_id}`}
                            serverId={id}
                        />
                    ) : (
                        <p>{t("Results.TheServerDoesNotOnline")}</p>
                    )}
                </div>
            </DrawerContent>
        </Drawer>
    )
}
