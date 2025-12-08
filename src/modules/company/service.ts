import { MedusaService } from "@medusajs/framework/utils";
import { Company } from "./models/company";
import { Employee, EmployeeRole } from "./models/employee";
import {
  CreateCompanyInput,
  UpdateCompanyInput,
  CreateEmployeeInput,
  UpdateEmployeeInput,
} from "./types";

class CompanyModuleService extends MedusaService({
  Company,
  Employee,
}) {
  /**
   * Create a new company
   */
  async createCompany(data: CreateCompanyInput) {
    return await this.createCompanies(data);
  }

  /**
   * Update an existing company
   */
  async updateCompany(id: string, data: UpdateCompanyInput) {
    return await this.updateCompanies({ id, ...data });
  }

  /**
   * Retrieve a company by ID with employees
   */
  async retrieveCompanyWithEmployees(id: string) {
    return await super.retrieveCompany(id, {
      relations: ["employees"],
    });
  }

  /**
   * List all companies with optional filters
   */
  async listAllCompanies(filters?: any) {
    return await super.listCompanies(filters);
  }

  /**
   * Delete a company
   */
  async deleteCompany(id: string) {
    return await this.deleteCompanies(id);
  }

  /**
   * Add an employee to a company
   */
  async addEmployeeToCompany(data: CreateEmployeeInput) {
    return await this.createEmployees({
      customer_id: data.customer_id,
      company_id: data.company_id,
      role: data.role || EmployeeRole.MEMBER,
      spending_limit: data.spending_limit,
      is_active: data.is_active ?? true,
    });
  }

  /**
   * Update an employee
   */
  async updateEmployee(id: string, data: UpdateEmployeeInput) {
    return await this.updateEmployees({ id, ...data });
  }

  /**
   * Remove an employee from a company
   */
  async removeEmployeeFromCompany(employeeId: string) {
    return await this.deleteEmployees(employeeId);
  }

  /**
   * List all employees in a company
   */
  async listCompanyEmployees(companyId: string) {
    return await this.listEmployees({
      company_id: companyId,
    });
  }

  /**
   * Get employee record by customer ID
   */
  async getEmployeeByCustomerId(customerId: string) {
    const employees = await this.listEmployees({
      customer_id: customerId,
      is_active: true,
    });
    return employees.length > 0 ? employees[0] : null;
  }

  /**
   * Get company for a customer
   */
  async getCompanyForCustomer(customerId: string) {
    const employee = await this.getEmployeeByCustomerId(customerId);
    if (!employee) {
      return null;
    }
    return await super.retrieveCompany(employee.company_id);
  }

  /**
   * Check if customer is company admin
   */
  async isCompanyAdmin(customerId: string, companyId: string): Promise<boolean> {
    const employees = await this.listEmployees({
      customer_id: customerId,
      company_id: companyId,
      role: EmployeeRole.ADMIN,
      is_active: true,
    });
    return employees.length > 0;
  }

  /**
   * Find company by VAT number
   */
  async findCompanyByVatNumber(vatNumber: string) {
    const companies = await this.listCompanies({
      vat_number: vatNumber,
    });
    return companies.length > 0 ? companies[0] : null;
  }

  /**
   * Find or create a company by VAT number
   * Used during checkout when customer enters company info
   */
  async findOrCreateCompany(data: {
    name: string;
    email: string;
    vat_number?: string;
    vat_validated?: boolean;
    address?: string;
    city?: string;
    zip?: string;
    country?: string;
    currency_code?: string;
  }) {
    // If VAT number provided, try to find existing company
    if (data.vat_number) {
      const existingCompany = await this.findCompanyByVatNumber(data.vat_number);
      if (existingCompany) {
        return { company: existingCompany, created: false };
      }
    }

    // Create new company
    const company = await this.createCompany({
      name: data.name,
      email: data.email,
      vat_number: data.vat_number,
      vat_validated: data.vat_validated ?? false,
      address: data.address,
      city: data.city,
      zip: data.zip,
      country: data.country,
      currency_code: data.currency_code,
    });

    return { company, created: true };
  }
}

export default CompanyModuleService;

