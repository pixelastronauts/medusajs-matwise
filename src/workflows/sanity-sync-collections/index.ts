import { createWorkflow, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { syncCollectionStep } from "./steps/sync"

export type SanitySyncCollectionsWorkflowInput = {
  collection_ids?: string[]
}

export const sanitySyncCollectionsWorkflow = createWorkflow(
  { name: "sanity-sync-collections", retentionTime: 10000 },
  function (input: SanitySyncCollectionsWorkflowInput) {
    const result = syncCollectionStep(input)
    return new WorkflowResponse(result)
  }
)



