import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { COMPANY_MODULE } from "../../../modules/company";
import type CompanyModuleService from "../../../modules/company/service";

// GET /admin/companies - List all companies
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const companyService = req.scope.resolve<CompanyModuleService>(COMPANY_MODULE);

  const companies = await companyService.listCompanies({}, {
    relations: ["employees"],
  });

  res.json({ companies });
}

// POST /admin/companies - Create a new company
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const companyService = req.scope.resolve<CompanyModuleService>(COMPANY_MODULE);

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
    name: string;
    email: string;
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

  const company = await companyService.createCompany({
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

  res.status(201).json({ company });
}

