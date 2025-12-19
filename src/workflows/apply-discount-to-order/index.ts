import {
  createWorkflow,
  WorkflowResponse,
  type ReturnWorkflow,
} from "@medusajs/framework/workflows-sdk"
import { applyDiscountToOrderStep } from "./steps/apply-discount"
import { calculateRefundStep } from "./steps/calculate-refund"

type ApplyDiscountToOrderInput = {
  order_id: string
  discount_amount?: number
  discount_percentage?: number
  promotion_codes?: string[]
  reason?: string
  created_by?: string
}

export const applyDiscountToOrderWorkflow: ReturnWorkflow<
  ApplyDiscountToOrderInput,
  any,
  any
> = createWorkflow(
  "apply-discount-to-order",
  (input: ApplyDiscountToOrderInput) => {
    // Apply the discount to the order
    const discountResult = applyDiscountToOrderStep(input)

    // Calculate if refund is needed
    const refundInfo = calculateRefundStep({
      order_id: input.order_id,
    })

    return new WorkflowResponse({
      order_edit: discountResult,
      refund_info: refundInfo,
    })
  }
)

