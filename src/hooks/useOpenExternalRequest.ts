// useOpenExternalRequest — global hook for launching the CreateRequestModal from any tab.
// In V1, the modal is only opened from the External Requests tab itself.
// In V2 (14-day Check, Aircraft Beauty, etc.), call openModal(options) from those tabs
// with parentType, parentId, parentLabel, and prefill data already set.

import { useContext } from "react"
import { ExternalRequestModalContext } from "@/features/external-requests/ExternalRequestModalContext"

export function useOpenExternalRequest() {
  return useContext(ExternalRequestModalContext)
}
