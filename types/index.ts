export interface FamilyMember {
    id: string;
    full_name: string;
    birth_date?: string;
    death_date?: string;
    portrait_url?: string;
    bio?: string;
    father_id?: string;
    mother_id?: string;
    created_at: string;
}

export interface Union {
    id: string;
    person1_id: string;
    person2_id: string;
    union_date?: string;
    divorce_date?: string;
    type: string;
    created_at: string;
}

export interface TreeData extends FamilyMember {
    children?: TreeData[];
    spouses?: FamilyMember[];
}
