export interface FMEntry {
    type: number
    name: string
}

export enum FMOpcode {
    List,
    Download,
    Upload,
    // 二开：文件管理器增强 op（真实实现需 nezhahq/agent 支持，见后端 fm.go 协议契约）
    Edit, // 在线编辑：写入文件内容
    Chmod, // 修改权限
    Chown, // 修改属主
    Zip, // 压缩打包
    Unzip, // 解压
}

export const FMIdentifier = {
    file: new Uint8Array([0x4e, 0x5a, 0x54, 0x44]), // NZTD
    fileName: new Uint8Array([0x4e, 0x5a, 0x46, 0x4e]), // NZFN
    error: new Uint8Array([0x4e, 0x45, 0x52, 0x52]), // NERR
    complete: new Uint8Array([0x4e, 0x5a, 0x55, 0x50]), // NZUP
}

export interface FMWorkerPost {
    operation: number
    arrayBuffer: ArrayBuffer
    fileName: string
}

export enum FMWorkerOpcode {
    Error,
    Progress,
    Result,
}

export interface FMWorkerData {
    type: FMWorkerOpcode
    error: string
    blob?: Blob
    progress?: string
    fileName?: string
}
