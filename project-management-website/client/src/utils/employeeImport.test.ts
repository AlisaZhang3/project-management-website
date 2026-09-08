import { describe, expect, it } from 'vitest';
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
