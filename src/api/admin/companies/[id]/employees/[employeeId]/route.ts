import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { COMPANY_MODULE, EmployeeRole } from "../../../../../../modules/company";
import type CompanyModuleService from "../../../../../../modules/company/service";

// POST /admin/companies/:id/employees/:employeeId - Update an employee
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const companyService = req.scope.resolve<CompanyModuleService>(COMPANY_MODULE);
  const { employeeId } = req.params;

  const {
    role,
    spending_limit,
    is_active,
  } = req.body as {
    role?: "manager" | "employee" | "admin" | "member";
    spending_limit?: number;
    is_active?: boolean;
  };

  const updateData: {
    role?: EmployeeRole;
    spending_limit?: number;
    is_active?: boolean;
  } = {};

  if (role !== undefined) {
    // Map roles to enum values (support both old and new values)
    const roleMap: Record<string, EmployeeRole> = {
      "manager": EmployeeRole.MANAGER,
      "employee": EmployeeRole.EMPLOYEE,
      "admin": EmployeeRole.ADMIN,
      "member": EmployeeRole.MEMBER,
    };
    updateData.role = roleMap[role];
  }
  if (spending_limit !== undefined) {
    updateData.spending_limit = spending_limit;
  }
  if (is_active !== undefined) {
    updateData.is_active = is_active;
  }

  const employee = await companyService.updateEmployee(employeeId, updateData);

  res.json({ employee });
}

// DELETE /admin/companies/:id/employees/:employeeId - Remove an employee from a company
export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const companyService = req.scope.resolve<CompanyModuleService>(COMPANY_MODULE);
  const { employeeId } = req.params;

  await companyService.removeEmployeeFromCompany(employeeId);

  res.status(200).json({ id: employeeId, object: "employee", deleted: true });
}



