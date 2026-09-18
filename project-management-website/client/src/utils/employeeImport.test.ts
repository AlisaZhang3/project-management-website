import { describe, expect, it } from 'vitest';
import { matchesEmployeeSearch } from '../pages/EmployeesPage';
import { parseEmployeeImportRows } from './employeeImport';

describe('parseEmployeeImportRows', () => {
  it('accepts valid employee rows and resolves project codes', () => {
    const result = parseEmployeeImportRows([
      {
        employeeNumber: 'E-001',
        name: 'Alice Chen',
        region: 'China',
        salary: '25000',
        projectCode: 'PRJ-001',
        joinDate: '2026-01-01',
        leaveDate: '',
        isShared: 'No',
        sharedProject: '',
        sharedRatio: '0',
        isContractor: 'False',
        maximumEndDate: '',
        hasC2C: 'No',
      },
    ], {
      'PRJ-001': 1,
    });

    expect(result.errors).toEqual([]);
    expect(result.records).toHaveLength(1);
    expect(result.records[0]).toMatchObject({
      employeeNumber: 'E-001',
      name: 'Alice Chen',
      projectId: 1,
      salary: 25000,
      isShared: false,
    });
  });

  it('converts Excel serialized dates into ISO dates', () => {
    const result = parseEmployeeImportRows([
      {
        employeeNumber: 'E-002',
        name: 'Bob Wang',
        region: 'China',
        salary: '30000',
        projectCode: 'PRJ-001',
        joinDate: 46080,
        leaveDate: '',
        isShared: 'No',
        sharedProject: '',
        sharedRatio: '0',
        isContractor: 'False',
        maximumEndDate: '',
        hasC2C: 'No',
      },
    ], {
      'PRJ-001': 1,
    });

    expect(result.errors).toEqual([]);
    expect(result.records[0].joinDate).toBe('2026-02-26');
  });

  it('rejects rows that are missing required data', () => {
    const result = parseEmployeeImportRows([
      {
        employeeNumber: '',
        name: 'Missing Fields',
        region: 'India',
        salary: '',
        projectCode: 'PRJ-001',
        joinDate: '',
      },
    ], {
      'PRJ-001': 1,
    });

    expect(result.records).toHaveLength(0);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

describe('matchesEmployeeSearch', () => {
  it('matches by employee number or name regardless of project filter', () => {
    const employee = { employeeNumber: 'E001323', name: '程钦睿' };

    expect(matchesEmployeeSearch(employee, 'E001')).toBe(true);
    expect(matchesEmployeeSearch(employee, '程钦')).toBe(true);
    expect(matchesEmployeeSearch(employee, 'Jane')).toBe(false);
  });
});
