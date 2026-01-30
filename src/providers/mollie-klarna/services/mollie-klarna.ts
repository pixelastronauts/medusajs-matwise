import { PaymentMethod, CaptureMethod } from "@mollie/api-client"
import MollieBase, { PaymentOptions } from "../core/mollie-base"

class MollieKlarnaService extends MollieBase {
  static identifier = "mollie-klarna"

  get paymentCreateOptions(): PaymentOptions {
    return {
      method: PaymentMethod.klarna,
      webhookUrl:
        this.options_.medusaUrl +
        "/hooks/payment/" +
        MollieKlarnaService.identifier +
        "_mollie",
      captureMethod: CaptureMethod.automatic,
      useOrdersApi: true, // Klarna requires the Orders API
    }
  }
}

export default MollieKlarnaService
