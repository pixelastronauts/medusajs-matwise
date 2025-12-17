import { model } from "@medusajs/framework/utils";
import { Company } from "./company";

export enum EmployeeRole {
  MANAGER = "manager",
  EMPLOYEE = "employee",
  // Legacy roles for backward compatibility
  ADMIN = "admin",
  MEMBER = "member",
}

export const Employee = model.define("employee", {
  id: model
    .id({
      prefix: "emp",
    })
    .primaryKey(),
  customer_id: model.text(),
  company: model.belongsTo(() => Company, {
    mappedBy: "employees",
  }),
  role: model.enum(EmployeeRole).default(EmployeeRole.EMPLOYEE),
  spending_limit: model.number().nullable(),
  is_active: model.boolean().default(true),
});

