export type EmployeeImportRow = {
  employeeNumber?: string | number;
  name?: string | number;
  region?: string | number;
  salary?: string | number;
  projectCode?: string | number;
  joinDate?: string | number;
  leaveDate?: string | number;
  monthlyWorkingHours?: string | number;
  isShared?: string | boolean;
  sharedProject?: string | number;
  sharedRatio?: string | number;
  isContractor?: string | boolean;
  maximumEndDate?: string | number;
  hasC2C?: string | boolean;
};

export type ParsedEmployeeImportResult = {
  records: Array<{
    employeeNumber: string;
    name: string;
    region: string;
    salary: number;
    projectId: number;
    joinDate: string;
    leaveDate: string;
    monthlyWorkingHours: number;
    isShared: boolean;
    sharedProject: string;
    sharedRatio: number;
    isContractor: boolean;
    maximumEndDate: string;
    hasC2C: boolean;
  }>;
  errors: string[];
};

const normalizeBoolean = (value: string | boolean | undefined): boolean => {
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return false;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return false;
  return ['true', '1', 'yes', 'y', 'on'].indexOf(normalized) >= 0 || normalized === 'true';
};

const parseNumber = (value: string | number | undefined): number => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (value === undefined || value === null || String(value).trim() === '') return 0;
  const parsed = Number(String(value).replace(/,/g, '').trim());
  return Number.isFinite(parsed) ? parsed : 0;
};

export const parseEmployeeImportRows = (
  rows: EmployeeImportRow[],
  projectCodeMap: Record<string, number>,
): ParsedEmployeeImportResult => {
  const records: ParsedEmployeeImportResult['records'] = [];
  const errors: string[] = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const employeeNumber = String(row.employeeNumber ?? '').trim();
    const name = String(row.name ?? '').trim();
    const region = String(row.region ?? '').trim();
    const salary = parseNumber(row.salary);
    const projectCode = String(row.projectCode ?? '').trim();
    const projectId = projectCodeMap[projectCode];
    const joinDate = String(row.joinDate ?? '').trim();
    const leaveDate = String(row.leaveDate ?? '').trim();
    const monthlyWorkingHours = parseNumber(row.monthlyWorkingHours) || 168;
    const isShared = normalizeBoolean(row.isShared);
    const sharedProject = String(row.sharedProject ?? '').trim();
    const sharedRatio = parseNumber(row.sharedRatio);
    const isContractor = normalizeBoolean(row.isContractor);
    const maximumEndDate = String(row.maximumEndDate ?? '').trim();
    const hasC2C = normalizeBoolean(row.hasC2C);

    if (!employeeNumber || !name || !region || !projectCode || !joinDate) {
      errors.push(`Row ${rowNumber}: employeeNumber, name, region, projectCode, and joinDate are required.`);
      return;
    }

    if (!projectId) {
      errors.push(`Row ${rowNumber}: project code "${projectCode}" does not exist in the project list.`);
      return;
    }

    if (salary <= 0) {
      errors.push(`Row ${rowNumber}: salary must be greater than 0.`);
      return;
    }

    if (isShared && (!sharedProject || sharedRatio <= 0 || sharedRatio > 100)) {
      errors.push(`Row ${rowNumber}: shared employees must include a sharedProject and a sharedRatio between 1 and 100.`);
      return;
    }

    if (isContractor && !maximumEndDate) {
      errors.push(`Row ${rowNumber}: contractor employees require maximumEndDate.`);
      return;
    }

    records.push({
      employeeNumber,
      name,
      region,
      salary,
      projectId,
      joinDate,
      leaveDate,
      monthlyWorkingHours,
      isShared,
      sharedProject: isShared ? sharedProject : '',
      sharedRatio: isShared ? sharedRatio : 0,
      isContractor,
      maximumEndDate: isContractor ? maximumEndDate : '',
      hasC2C,
    });
  });

  return { records, errors };
};
