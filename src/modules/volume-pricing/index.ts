import VolumePricingModuleService from "./service";
import { Module } from "@medusajs/framework/utils";

export const VOLUME_PRICING_MODULE = "volumePricing";

export default Module(VOLUME_PRICING_MODULE, {
  service: VolumePricingModuleService,
});

export type VolumePricingService = InstanceType<typeof VolumePricingModuleService>;






