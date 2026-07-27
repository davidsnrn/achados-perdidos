export interface Material {
    id: string;
    code: string;
    name: string;
    createdAt: string;
    campus_id?: string;
    setor_id?: string;
}

export interface MaterialLoan {
    id: string;
    materialId: string;
    materialName: string;
    materialCode: string; // Track by code
    personName: string;
    personMatricula: string;
    personEmail?: string;
    loanDate: string;
    returnDate?: string;
    observation?: string;
    status: 'ACTIVE' | 'RETURNED' | 'DELETED' | 'PENDING_RETURN';
    loanedBy: string; // User who registered the loan
    returnedBy?: string; // User who registered the return
    campus_id?: string;
    setor_id?: string | null;
}

export interface ChargeHistory {
    id: number;
    loan_id: string;
    material_id: string;
    person_email: string;
    person_name: string;
    sent_at: string;
    triggered_by_name: string;
    triggered_by_email?: string;
    campus_id?: string;
    setor_id?: string;
}
