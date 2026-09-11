import { describe, expect, it } from 'vitest';
import { calculateQuotationRow, newQuotationRow } from './quotation';

describe('quotation calculations', () => {
    const row = { ...newQuotationRow(), position: 'Developer', hourlyRate: 50, monthlyBill: 8400, headcount: 3, costPerPerson: 4000 };

    it('applies the Profit formula and headcount to English NR', () => {
        const result = calculateQuotationRow(row, 'english');
        expect(result.monthlyNR).toBeCloseTo(8400 * 0.93 * 0.99529 * 3);
        expect(result.monthlyBill).toBe(25200);
        expect(result.monthlyCost).toBe(12000);
        expect(result.gp2).toBeCloseTo((result.monthlyNR - 12000) / result.monthlyNR * 100);
    });

    it('deducts only five percent for India and does not convert input amounts', () => {
        expect(calculateQuotationRow(row, 'india').monthlyNR).toBe(23940);
        expect(row.monthlyBill).toBe(8400);
    });

    it('supports custom hours and manual per-person bills', () => {
        expect(calculateQuotationRow({ ...row, monthlyWorkingHours: 180, monthlyBill: 9000 }, 'india').monthlyNR).toBe(25650);
    });

    it('returns finite zero totals for zero headcount or bill', () => {
        expect(calculateQuotationRow({ ...row, headcount: 0 }, 'english')).toEqual({ monthlyBill: 0, monthlyNR: 0, monthlyCost: 0, gp2: 0 });
        expect(calculateQuotationRow({ ...row, monthlyBill: 0 }, 'india').gp2).toBe(0);
    });
});