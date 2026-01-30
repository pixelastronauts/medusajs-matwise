import { ModuleProvider, Modules } from "@medusajs/framework/utils"
import MollieKlarnaService from "./services/mollie-klarna"

export default ModuleProvider(Modules.PAYMENT, {
  services: [MollieKlarnaService],
})
