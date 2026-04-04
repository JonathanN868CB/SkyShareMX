import { useRecordsVaultCtx } from "../RecordsVaultApp"
import { RecordsPipelineView } from "../components/RecordsPipelineView"

export default function RecordsVaultPipelinePage() {
  const { selectedAircraftId } = useRecordsVaultCtx()
  return (
    <div className="flex-1 overflow-y-auto p-6">
      <RecordsPipelineView aircraftId={selectedAircraftId} />
    </div>
  )
}
