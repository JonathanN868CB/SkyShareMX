import { createContext, useState } from "react"
import { CreateRequestModal, type CreateRequestOptions } from "@/components/external-requests/CreateRequestModal"

type ContextValue = {
  openModal: (options?: CreateRequestOptions) => void
}

export const ExternalRequestModalContext = createContext<ContextValue>({
  openModal: () => {},
})

export function ExternalRequestModalProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [options, setOptions] = useState<CreateRequestOptions | undefined>(undefined)

  function openModal(opts?: CreateRequestOptions) {
    setOptions(opts)
    setOpen(true)
  }

  return (
    <ExternalRequestModalContext.Provider value={{ openModal }}>
      {children}
      <CreateRequestModal
        open={open}
        onClose={() => setOpen(false)}
        options={options}
      />
    </ExternalRequestModalContext.Provider>
  )
}
