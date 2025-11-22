import { createWorkflow, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { calculateVatTaxStep } from "./steps/calculate-vat-tax"

type WorkflowInput = {
  cart_id: string
}

export const calculateCartTaxesWorkflow = createWorkflow(
  "calculate-cart-taxes",
  (input: WorkflowInput) => {
    const taxDecision = calculateVatTaxStep({
      cart_id: input.cart_id
    })

    return new WorkflowResponse(taxDecision)
  }
)


