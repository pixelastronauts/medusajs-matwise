import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { COMPANY_MODULE } from "../../../../modules/company";
import type CompanyModuleService from "../../../../modules/company/service";

// GET /store/customers/company - Get the company for the authenticated customer
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const companyService = req.scope.resolve<CompanyModuleService>(COMPANY_MODULE);
  
  // Get the authenticated customer from the request
  const customerId = (req as any).auth_context?.actor_id;

  if (!customerId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const employee = await companyService.getEmployeeByCustomerId(customerId);

  if (!employee) {
    return res.status(404).json({ message: "Customer is not part of a company" });
  }

  const company = await companyService.retrieveCompanyWithEmployees(employee.company_id);

  res.json({ 
    company,
    employee: {
      id: employee.id,
      role: employee.role,
      spending_limit: employee.spending_limit,
      is_active: employee.is_active,
    }
  });
}

