import { getOTPStatus, setupOTP, verifyOTP, disableOTP } from "@/api/otp"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useEffect, useState } from "react"
import { toast } from "sonner"

export function OTPManager() {
    const [enabled, setEnabled] = useState<boolean | null>(null)
    const [secret, setSecret] = useState("")
    const [showSetup, setShowSetup] = useState(false)

    const loadStatus = async () => {
        try {
            const data = await getOTPStatus()
            setEnabled(data.enabled)
        } catch (e: any) {
            toast.error("Failed to load 2FA status: " + e.message)
        }
    }

    useEffect(() => { loadStatus() }, [])

    const handleSetup = async () => {
        try {
            const data = await setupOTP()
            setSecret(data.secret)
            setShowSetup(true)
            toast.success("Enter the secret in your authenticator app")
        } catch (e: any) {
            toast.error("Setup failed: " + e.message)
        }
    }

    const handleVerify = async () => {
        const code = prompt("Enter the 6-digit code from your authenticator app:")
        if (!code) return
        try {
            await verifyOTP(code.trim())
            toast.success("2FA enabled successfully!")
            setShowSetup(false)
            setSecret("")
            loadStatus()
        } catch (e: any) {
            toast.error("Verification failed: " + e.message)
        }
    }

    const handleDisable = async () => {
        const code = prompt("Enter a backup code or 6-digit OTP code to disable 2FA:")
        if (!code) return
        try {
            await disableOTP(code.trim())
            toast.success("2FA disabled successfully!")
            loadStatus()
        } catch (e: any) {
            toast.error("Disable failed: " + e.message)
        }
    }

    return (
        <Card className="w-full">
            <CardHeader>
                <CardTitle className="flex gap-2 text-xl items-center">
                    2FA / OTP
                </CardTitle>
            </CardHeader>
            <CardContent className="text-lg font-semibold">
                Status: {enabled === null ? "Loading..." : enabled ? "Enabled" : "Disabled"}
                <div className="flex gap-2 mt-4">
                    {!enabled && (
                        <Button onClick={handleSetup}>Setup 2FA</Button>
                    )}
                    {enabled && (
                        <Button variant="destructive" onClick={handleDisable}>Disable 2FA</Button>
                    )}
                </div>
                {showSetup && (
                    <div className="mt-4 p-4 border rounded-lg space-y-2">
                        <Label>Secret (enter in your authenticator app):</Label>
                        <Input value={secret} readOnly />
                        <p className="text-sm text-muted-foreground">
                            After adding the secret, click Verify and enter the 6-digit code.
                        </p>
                        <Button onClick={handleVerify}>Verify & Enable</Button>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
