export interface Material {
    id: string;
    code: string; // Unique tracking code (e.g., "MAT-001")
    name: string;
    createdAt: string;
    campus_id?: string;
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
    status: 'ACTIVE' | 'RETURNED' | 'DELETED';
    loanedBy: string; // User who registered the loan
    returnedBy?: string; // User who registered the return
    campus_id?: string;
}
