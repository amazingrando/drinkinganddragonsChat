"use client"
import * as z from "zod"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import axios from "axios"
import { useRouter } from "next/navigation"
import { useModal } from "@/hooks/use-modal-store"
import { ModalHeader } from "./_modal-header"
import { parseInviteCode } from "@/lib/invite"

import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"

const formSchema = z.object({
  invite: z.string().min(1, { message: "Invite code or URL is required" }),
})

const JoinServerModal = () => {
  const { isOpen, type, onClose } = useModal()
  const router = useRouter()
  const isModalOpen = isOpen && type === "joinServer"
  const { onOpen } = useModal()

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { invite: "" },
  })

  const isLoading = form.formState.isSubmitting

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    const parsed = parseInviteCode(values.invite)
    if (!parsed.ok) {
      form.setError("invite", { type: "manual", message: parsed.error })
      return
    }

    try {
      const res = await axios.post("/api/invite/validate", { code: parsed.code })
      if (res.data?.ok) {
        onClose()
        router.push(`/invite/${parsed.code}`)
      } else {
        form.setError("invite", { type: "manual", message: res.data?.error || "Invalid invite" })
      }
    } catch {
      form.setError("invite", { type: "manual", message: "Invalid or expired invite" })
    }
  }

  const handleClose = (open?: boolean) => {
    const wasOpen = isModalOpen
    form.reset()
    onClose()
    // Open initial modal when closing via overlay, escape key, or close button
    if (open === false && wasOpen) {
      onOpen("initialModal")
    }
  }

  const handleCancel = () => {
    onClose()
    onOpen("initialModal")
  }

  return (
    <Dialog open={isModalOpen} onOpenChange={handleClose}>
      <DialogContent>
        <ModalHeader title="Join a Server" description="Paste an invite URL or code." />
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="px-6">
              <FormField name="invite" control={form.control} render={({ field }) => (
                <FormItem>
                  <FormLabel className="uppercase text-xs font-bold">Invite URL or Code</FormLabel>
                  <FormControl>
                    <Input disabled={isLoading} placeholder="https://yourdomain.com/invite/abcd1234 or abcd1234" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <DialogFooter className="px-6 py-4">
              <Button disabled={isLoading} variant="primary" type="submit">Join Server</Button>
              <Button disabled={isLoading} variant="secondary" type="button" onClick={handleCancel}>Cancel</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

export default JoinServerModal


