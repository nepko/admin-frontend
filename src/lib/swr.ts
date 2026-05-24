import useSWROriginal from "swr"
import { swrFetcher } from "@/api/api"

export { swrFetcher }

export function useSWR<T>(key: string | null, ...args: any[]) {
    return useSWROriginal<T>(key, swrFetcher as any, ...args)
}
