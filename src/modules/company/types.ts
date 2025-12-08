import { EmployeeRole } from "./models/employee";

export type SpendingLimitResetFrequency =
  | "never"
  | "daily"
  | "weekly"
  | "monthly"
  | "yearly";

export interface CreateCompanyInput {
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
  vat_validated_at?: Date;
  spending_limit_reset_frequency?: SpendingLimitResetFrequency;
}

export interface UpdateCompanyInput {
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
  vat_validated_at?: Date;
  spending_limit_reset_frequency?: SpendingLimitResetFrequency;
}

export interface CreateEmployeeInput {
  customer_id: string;
  company_id: string;
  role?: EmployeeRole;
  spending_limit?: number;
  is_active?: boolean;
}

export interface UpdateEmployeeInput {
  role?: EmployeeRole;
  spending_limit?: number;
  is_active?: boolean;
}

export interface CompanyService {
  createCompany(data: CreateCompanyInput): Promise<any>;
  updateCompany(id: string, data: UpdateCompanyInput): Promise<any>;
  retrieveCompany(id: string): Promise<any>;
  listCompanies(filters?: any): Promise<any[]>;
  deleteCompany(id: string): Promise<void>;
  addEmployeeToCompany(data: CreateEmployeeInput): Promise<any>;
  updateEmployee(id: string, data: UpdateEmployeeInput): Promise<any>;
  removeEmployeeFromCompany(employeeId: string): Promise<void>;
  listCompanyEmployees(companyId: string): Promise<any[]>;
  getEmployeeByCustomerId(customerId: string): Promise<any | null>;
}

