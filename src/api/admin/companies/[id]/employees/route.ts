import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { COMPANY_MODULE, EmployeeRole } from "../../../../../modules/company";
import type CompanyModuleService from "../../../../../modules/company/service";

// GET /admin/companies/:id/employees - List all employees in a company
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const companyService = req.scope.resolve<CompanyModuleService>(COMPANY_MODULE);
  const { id } = req.params;

  const employees = await companyService.listCompanyEmployees(id);

  res.json({ employees });
}

// POST /admin/companies/:id/employees - Add an employee to a company
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const companyService = req.scope.resolve<CompanyModuleService>(COMPANY_MODULE);
  const { id: company_id } = req.params;

  const {
    customer_id,
    role,
    spending_limit,
    is_active,
  } = req.body as {
    customer_id: string;
    role?: "admin" | "member";
    spending_limit?: number;
    is_active?: boolean;
  };

  const employee = await companyService.addEmployeeToCompany({
    customer_id,
    company_id,
    role: role === "admin" ? EmployeeRole.ADMIN : EmployeeRole.MEMBER,
    spending_limit,
    is_active,
  });

  res.status(201).json({ employee });
}






