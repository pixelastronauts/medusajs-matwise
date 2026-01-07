import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { Modules } from "@medusajs/framework/utils";
import { COMPANY_MODULE } from "../../../modules/company";
import type CompanyModuleService from "../../../modules/company/service";
import { EmployeeRole } from "../../../modules/company/models/employee";

// POST /store/companies - Find or create a company and add customer as employee
// Used during checkout when customer enters company info
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const companyService = req.scope.resolve<CompanyModuleService>(COMPANY_MODULE);

    const {
      name,
      email,
      vat_number,
      vat_validated,
      address,
      city,
      zip,
      country,
      currency_code,
      customer_id,
    } = req.body as {
      name: string;
      email: string;
      vat_number?: string;
      vat_validated?: boolean;
      address?: string;
      city?: string;
      zip?: string;
      country?: string;
      currency_code?: string;
      customer_id?: string;
    };

    if (!name || !email) {
      return res.status(400).json({ message: "Company name and email are required" });
    }

    // Find or create company
    const { company, created } = await companyService.findOrCreateCompany({
      name,
      email,
      vat_number,
      vat_validated: vat_validated ?? false,
      address,
      city,
      zip,
      country,
      currency_code,
    });

    // If customer_id provided, add them as an employee
    if (customer_id) {
      // Check if customer is already an employee
      const existingEmployee = await companyService.getEmployeeByCustomerId(customer_id);
      
      if (!existingEmployee) {
        // Add customer as employee (member role by default, admin if they created the company)
        await companyService.addEmployeeToCompany({
          customer_id,
          company_id: company.id,
          role: created ? EmployeeRole.ADMIN : EmployeeRole.MEMBER,
          is_active: true,
        });
      }
    }

    res.status(created ? 201 : 200).json({ 
      company,
      created,
    });
  } catch (error: any) {
    console.error("Error creating/finding company:", error);
    res.status(500).json({ message: error.message || "Failed to process company" });
  }
}

// GET /store/companies/by-vat/:vatNumber - Find company by VAT number
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const companyService = req.scope.resolve<CompanyModuleService>(COMPANY_MODULE);
    const { vat_number } = req.query as { vat_number?: string };

    if (!vat_number) {
      return res.status(400).json({ message: "VAT number is required" });
    }

    const company = await companyService.findCompanyByVatNumber(vat_number);

    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    res.json({ company });
  } catch (error: any) {
    console.error("Error finding company:", error);
    res.status(500).json({ message: error.message || "Failed to find company" });
  }
}






