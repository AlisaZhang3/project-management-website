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

const normalizeDateValue = (value: string | number | undefined): string => {
  if (value === undefined || value === null) return '';
  const raw = String(value).trim();
  if (!raw) return '';

  const asNumber = Number(raw.replace(/,/g, ''));
  if (Number.isFinite(asNumber) && raw !== '' && /^[\d.]+$/.test(raw)) {
    const serial = Number(raw);
    if (serial > 30 && serial < 1000000) {
      const excelEpoch = new Date(Date.UTC(1899, 11, 30));
      const date = new Date(excelEpoch.getTime() + (serial - 1) * 86400000);
      if (!Number.isNaN(date.getTime())) {
        return date.toISOString().slice(0, 10);
      }
    }
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
    const [day, month, year] = raw.split('/');
    const pad = (value: string) => value.length === 1 ? `0${value}` : value;
    return `${year}-${pad(month)}-${pad(day)}`;
  }
  return raw;
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
    const joinDate = normalizeDateValue(row.joinDate);
    const leaveDate = normalizeDateValue(row.leaveDate);
    const monthlyWorkingHours = parseNumber(row.monthlyWorkingHours) || 168;
    const isShared = normalizeBoolean(row.isShared);
    const sharedProject = String(row.sharedProject ?? '').trim();
    const sharedRatio = parseNumber(row.sharedRatio);
    const isContractor = normalizeBoolean(row.isContractor);
    const maximumEndDate = normalizeDateValue(row.maximumEndDate);
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
