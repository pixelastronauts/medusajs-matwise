import { model } from "@medusajs/framework/utils";
import { Company } from "./company";

export enum EmployeeRole {
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
  role: model.enum(EmployeeRole).default(EmployeeRole.MEMBER),
  spending_limit: model.bigNumber().nullable(),
  is_active: model.boolean().default(true),
});

