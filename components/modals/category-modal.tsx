"use client"
import * as z from "zod"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import axios from "axios"
import { useParams, useRouter } from "next/navigation"
import { ModalHeader } from "./_modal-header"
import {
  Dialog,
  DialogContent,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { useModal } from "@/hooks/use-modal-store"
import qs from "query-string"
import { useEffect } from "react"

const formSchema = z.object({
  name: z.string().min(1, {
    message: "Category name is required",
  }).max(100, {
    message: "Category name too long",
  }),
})

const CategoryModal = () => {
  const { isOpen, type, onClose, data } = useModal()
  const router = useRouter()
  const params = useParams()

  const isCreateModal = isOpen && type === "createCategory"
  const isEditModal = isOpen && type === "editCategory"
  const isModalOpen = isCreateModal || isEditModal
  const { category } = data || {}

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
    },
  })

  useEffect(() => {
    if (isEditModal && category) {
      form.setValue("name", category.name || "")
    } else {
      form.reset()
    }
  }, [isEditModal, category, form])

  const isLoading = form.formState.isSubmitting

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      if (isCreateModal) {
        const url = `/api/servers/${params?.serverId}/categories`
        await axios.post(url, values)
      } else if (isEditModal && category?.id) {
        const url = `/api/servers/${params?.serverId}/categories/${category.id}`
        await axios.patch(url, values)
      }

      form.reset()
      router.refresh()
      onClose()
    } catch (error) {
      console.error(error)
    }
  }

  const handleClose = () => {
    form.reset()
    onClose()
  }

  return (
    <Dialog open={isModalOpen} onOpenChange={handleClose}>
      <DialogContent>
        <ModalHeader
          title={isCreateModal ? "Create Category" : "Edit Category"}
          description={isCreateModal ? "Create a category to organize channels." : "Edit the category name."}
        />

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <div className="space-y-8 px-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="uppercase text-xs font-bold">Category name</FormLabel>
                    <FormControl>
                      <Input
                        disabled={isLoading}
                        placeholder="Enter category name"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter className="px-6 py-4">
              <Button disabled={isLoading} variant="primary">
                {isCreateModal ? "Create" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

export default CategoryModal

