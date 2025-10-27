import { DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog"

export const ModalHeader = ({ title, description }: { title: string, description: string }) => {
  return (
    <DialogHeader className="pt-8 px-6">
      <DialogTitle className="text-2xl font-bold">{title}</DialogTitle>
      <DialogDescription className="text-base font-medium text-muted-foreground">
        <span dangerouslySetInnerHTML={{ __html: description }} />
      </DialogDescription>
    </DialogHeader>
  )
}