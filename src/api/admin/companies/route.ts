import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { COMPANY_MODULE } from "../../../modules/company";
import type CompanyModuleService from "../../../modules/company/service";

// GET /admin/companies - List all companies
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const companyService = req.scope.resolve<CompanyModuleService>(COMPANY_MODULE);

    const companies = await companyService.listCompanies(
      {},
      {
        relations: ["employees"],
      }
    );

    res.json({ companies });
  } catch (error: any) {
    console.error("Error fetching companies:", error);
    res.status(500).json({ message: error.message || "Failed to fetch companies" });
  }
}

// POST /admin/companies - Create a new company
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
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
      vat_number,
      vat_validated,
      vat_country_code,
      vat_company_name,
      vat_company_address,
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
      vat_number?: string;
      vat_validated?: boolean;
      vat_country_code?: string;
      vat_company_name?: string;
      vat_company_address?: string;
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
      vat_number,
      vat_validated,
      vat_country_code,
      vat_company_name,
      vat_company_address,
      vat_validated_at: vat_validated ? new Date() : undefined,
      spending_limit_reset_frequency,
    });

    res.status(201).json({ company });
  } catch (error: any) {
    console.error("Error creating company:", error);
    res.status(500).json({ message: error.message || "Failed to create company" });
  }
}

