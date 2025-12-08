import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { COMPANY_MODULE } from "../../../../modules/company";
import type CompanyModuleService from "../../../../modules/company/service";

// GET /admin/companies/:id - Get a company by ID
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const companyService = req.scope.resolve<CompanyModuleService>(COMPANY_MODULE);
  const { id } = req.params;

  const company = await companyService.retrieveCompanyWithEmployees(id);

  res.json({ company });
}

// POST /admin/companies/:id - Update a company
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const companyService = req.scope.resolve<CompanyModuleService>(COMPANY_MODULE);
  const { id } = req.params;

  const {
    name,
    email,
    phone,
    address,
    city,
    state,
    zip,
    country,
    logo_url,
    currency_code,
    spending_limit_reset_frequency,
  } = req.body as {
    name?: string;
    email?: string;
    phone?: string;
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
    logo_url?: string;
    currency_code?: string;
    spending_limit_reset_frequency?: "never" | "daily" | "weekly" | "monthly" | "yearly";
  };

  const company = await companyService.updateCompany(id, {
    name,
    email,
    phone,
    address,
    city,
    state,
    zip,
    country,
    logo_url,
    currency_code,
    spending_limit_reset_frequency,
  });

  res.json({ company });
}

// DELETE /admin/companies/:id - Delete a company
export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const companyService = req.scope.resolve<CompanyModuleService>(COMPANY_MODULE);
  const { id } = req.params;

  await companyService.deleteCompany(id);

  res.status(200).json({ id, object: "company", deleted: true });
}

