export type QuotationMode = 'english' | 'india';

export interface QuotationRow {
    position: string;
    headcount: number;
    hourlyRate: number;
    monthlyWorkingHours: number;
    monthlyBill: number;
    costPerPerson: number;
    comment: string;
}

export const newQuotationRow = (): QuotationRow => ({
    position: '', headcount: 1, hourlyRate: 0, monthlyWorkingHours: 168,
    monthlyBill: 0, costPerPerson: 0, comment: '',
});

export const calculateQuotationRow = (row: QuotationRow, mode: QuotationMode) => {
    const monthlyBill = row.monthlyBill * row.headcount;
    const monthlyNR = monthlyBill * (mode === 'india' ? 0.95 : (1 - 0.02 - 0.05) * (1 - 0.00471));
    const monthlyCost = row.costPerPerson * row.headcount;
    return { monthlyBill, monthlyNR, monthlyCost, gp2: monthlyNR ? (monthlyNR - monthlyCost) / monthlyNR * 100 : 0 };
};