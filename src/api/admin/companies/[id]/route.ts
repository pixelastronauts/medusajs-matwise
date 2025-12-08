import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { Modules } from "@medusajs/framework/utils";
import { COMPANY_MODULE } from "../../../../modules/company";
import type CompanyModuleService from "../../../../modules/company/service";

// GET /admin/companies/:id - Get a company by ID
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const companyService = req.scope.resolve<CompanyModuleService>(COMPANY_MODULE);
    const customerService = req.scope.resolve<any>(Modules.CUSTOMER);
    const { id } = req.params;

    const company = await companyService.retrieveCompanyWithEmployees(id);

    // Fetch customer data for each employee
    if (company.employees && company.employees.length > 0) {
      const customerIds = company.employees.map((e: any) => e.customer_id);
      const customers = await customerService.listCustomers(
        { id: customerIds },
        { select: ["id", "email", "first_name", "last_name", "has_account"] }
      );

      // Create a map of customer data
      const customerMap = new Map(customers.map((c: any) => [c.id, c]));

      // Attach customer data to employees
      company.employees = company.employees.map((employee: any) => ({
        ...employee,
        customer: customerMap.get(employee.customer_id) || null,
      }));
    }

    res.json({ company });
  } catch (error: any) {
    console.error("Error fetching company:", error);
    res.status(500).json({ message: error.message || "Failed to fetch company" });
  }
}

// POST /admin/companies/:id - Update a company
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
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
      vat_number,
      vat_validated,
      vat_country_code,
      vat_company_name,
      vat_company_address,
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
      vat_number?: string;
      vat_validated?: boolean;
      vat_country_code?: string;
      vat_company_name?: string;
      vat_company_address?: string;
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
      vat_number,
      vat_validated,
      vat_country_code,
      vat_company_name,
      vat_company_address,
      vat_validated_at: vat_validated ? new Date() : undefined,
      spending_limit_reset_frequency,
    });

    res.json({ company });
  } catch (error: any) {
    console.error("Error updating company:", error);
    res.status(500).json({ message: error.message || "Failed to update company" });
  }
}

// DELETE /admin/companies/:id - Delete a company
export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const companyService = req.scope.resolve<CompanyModuleService>(COMPANY_MODULE);
  const { id } = req.params;

  await companyService.deleteCompany(id);

  res.status(200).json({ id, object: "company", deleted: true });
}

