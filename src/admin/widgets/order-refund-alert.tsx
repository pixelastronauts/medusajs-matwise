import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { Alert, Button, toast } from "@medusajs/ui"
import { AdminOrder, DetailWidgetProps } from "@medusajs/framework/types"
import { useState, useEffect } from "react"
import { Link, useNavigate } from "react-router-dom"

const OrderRefundAlertWidget = ({ data: order }: DetailWidgetProps<AdminOrder>) => {
  const [refundAmount, setRefundAmount] = useState<number>(0)
  const [isCalculating, setIsCalculating] = useState(true)
  const navigate = useNavigate()
  
  // Try to get payment ID directly from order data
  const orderData = order as any
  const payments = orderData.payment_collections?.[0]?.payments || orderData.payment_collection?.payments || []
  const capturedPayment = payments.find((p: any) => p.captured_at !== null)
  const paymentId = capturedPayment?.id || null

  console.log("🔵 Order data:", { 
    orderId: order.id,
    hasPaymentCollections: !!orderData.payment_collections,
    hasPaymentCollection: !!orderData.payment_collection,
    totalPayments: payments.length,
    capturedPaymentId: paymentId,
    payments: payments.map((p: any) => ({ id: p.id, captured_at: p.captured_at }))
  })

  useEffect(() => {
    calculateRefund()
  }, [order.id])

  const handleProcessRefund = () => {
    // Navigate to Medusa's native refund drawer
    // The amount will auto-fill correctly now that we use Order Edit workflow
    if (paymentId) {
      navigate(`/orders/${order.id}/refund?paymentId=${paymentId}`)
    }
  }

  const calculateRefund = async () => {
    try {
      setIsCalculating(true)
      
      const orderData = order as any
      const summary = orderData.summary || {}
      
      // Use pending_difference from summary - this is what Order Edit workflow calculates
      // Negative pending_difference means refund is needed
      const pendingDiff = summary.pending_difference || 0
      const refund = Math.abs(pendingDiff) // Make it positive for display
      
      console.log("=== Refund Alert Debug ===", {
        pending_difference: pendingDiff,
        refund_amount: refund,
        paid_total: summary.paid_total,
        current_order_total: summary.current_order_total,
        payment_status: orderData.payment_status,
        status: order.status
      })
      
      // Show alert if pending_difference is negative (refund needed) and payment was captured
      if (pendingDiff < -0.01 && (orderData.payment_status === "captured" || orderData.payment_status === "partially_refunded")) {
        console.log("✅ Showing refund alert:", refund)
        setRefundAmount(refund)
      } else {
        console.log("❌ Not showing refund alert:", { pendingDiff, payment_status: orderData.payment_status })
        setRefundAmount(0)
      }
    } catch (error) {
      console.error("Error calculating refund:", error)
      setRefundAmount(0)
    } finally {
      setIsCalculating(false)
    }
  }

  // Don't show anything if no refund is needed or still calculating
  if (isCalculating || refundAmount <= 0 || order.status === "canceled") {
    return null
  }

  const formattedAmount = refundAmount.toFixed(2)
  const currency = order.currency_code?.toUpperCase() || "EUR"

  console.log("🔵 Rendering refund alert:", { refundAmount, formattedAmount, paymentId, orderId: order.id })

  return (
    <Alert variant="warning" className="bg-ui-bg-base">
      <div className="flex items-center justify-between w-full gap-4">
        <div className="flex-1">
          <div className="font-semibold">Outstanding Refund Required</div>
          <div className="text-sm">
            There is an outstanding refund of <strong>{formattedAmount} {currency}</strong> that needs to be processed.
          </div>
        </div>
        <Button
          variant="primary"
          size="small"
          onClick={handleProcessRefund}
          disabled={!paymentId}
          className="flex-shrink-0"
        >
          {paymentId ? "Process Refund" : "Loading..."}
        </Button>
      </div>
    </Alert>
  )
}

export const config = defineWidgetConfig({
  zone: "order.details.before",
})

export default OrderRefundAlertWidget
