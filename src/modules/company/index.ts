import CompanyModuleService from "./service";
import { Company } from "./models/company";
import { Employee } from "./models/employee";
import { Module } from "@medusajs/framework/utils";

export const COMPANY_MODULE = "companyModuleService";
export type { CompanyService } from "./types";
export { EmployeeRole } from "./models/employee";

export default Module(COMPANY_MODULE, {
  service: CompanyModuleService,
});







