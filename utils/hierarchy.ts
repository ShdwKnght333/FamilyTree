import { FamilyMember, TreeData, Union } from '../types';

/**
 * Builds a focused hierarchy centered on a specific member with contextual indicators.
 * Shows 3 generations:
 * 1. Parents (with indicator if they have parents).
 * 2. Focus member, Siblings, and Spouses (with indicator if they have parents).
 * 3. Children (with indicator if they have a spouse or children).
 */
export function buildHierarchy(members: FamilyMember[], focalId: string, unions: Union[] = []): TreeData | null {
    if (!focalId || members.length === 0) return null;

    const memberMap = new Map<string, FamilyMember>();
    members.forEach(m => memberMap.set(String(m.id), m));

    const focalMember = memberMap.get(String(focalId));
    if (!focalMember) return null;

    // Helper to check if a member has parents in the database
    const hasParents = (m: FamilyMember) => !!(m.father_id || m.mother_id);

    // Helper to check if a member has children in the database
    const hasChildren = (m: FamilyMember) =>
        members.some(child => String(child.father_id) === String(m.id) || String(child.mother_id) === String(m.id));

    // Helper to check if a member has a spouse (union) in the database
    const hasSpouse = (m: FamilyMember) =>
        unions.some(u => String(u.person1_id) === String(m.id) || String(u.person2_id) === String(m.id));

    const buildMarker = (id: string, label: string): TreeData => ({
        id: `marker-${id}`,
        full_name: label,
        created_at: new Date().toISOString(),
    } as TreeData);

    // 1. Identify Parents of Focal Node
    const parents: FamilyMember[] = [];
    if (focalMember.father_id) {
        const father = memberMap.get(String(focalMember.father_id));
        if (father) parents.push(father);
    }
    if (focalMember.mother_id) {
        const mother = memberMap.get(String(focalMember.mother_id));
        if (mother) parents.push(mother);
    }

    // 2. Identify Siblings of Focal Node
    const siblings = members.filter(m =>
        String(m.id) !== String(focalId) &&
        ((focalMember.father_id && String(m.father_id) === String(focalMember.father_id)) ||
            (focalMember.mother_id && String(m.mother_id) === String(focalMember.mother_id)))
    );

    // 3. Identify Children of Focal Node
    const children = members.filter(m =>
        String(m.father_id) === String(focalId) ||
        String(m.mother_id) === String(focalId)
    ).sort((a, b) => {
        const dateA = a.birth_date ? new Date(a.birth_date).getTime() : Infinity;
        const dateB = b.birth_date ? new Date(b.birth_date).getTime() : Infinity;
        return dateA - dateB;
    });

    // 4. Identify Spouses of Focal Node
    const focalSpousesMap = new Map<string, FamilyMember & { union?: Union }>();
    unions.filter(u => String(u.person1_id) === String(focalId) || String(u.person2_id) === String(focalId)).forEach(u => {
        const spouseId = String(u.person1_id) === String(focalId) ? String(u.person2_id) : String(u.person1_id);
        const spouse = memberMap.get(spouseId);
        if (spouse) focalSpousesMap.set(spouseId, { ...spouse, union: u });
    });
    // Add co-parents as spouses even if no formal union exists
    children.forEach(c => {
        const otherParentId = String(c.father_id) === String(focalId) ? String(c.mother_id) : String(c.father_id);
        if (otherParentId && otherParentId !== 'null' && otherParentId !== String(focalId)) {
            const otherParent = memberMap.get(otherParentId);
            if (otherParent && !focalSpousesMap.has(otherParentId)) {
                focalSpousesMap.set(otherParentId, { ...otherParent });
            }
        }
    });

    // Build the Children nodes (with potential grandchild/spouse markers)
    const childTreeNodes = children.map(c => {
        const node: TreeData = { ...c };
        // Child extended = child has children OR child has spouse
        if (hasChildren(c) || hasSpouse(c)) {
            node.children = [buildMarker(String(c.id), 'Extended Family')];
        }
        return node;
    });

    // Focal Node with Spouses
    const focalSpouses: TreeData[] = [];
    Array.from(focalSpousesMap.values()).forEach(s => {
        focalSpouses.push({ ...s });
        // Spouse extended = spouse has parents
        if (hasParents(s)) {
            focalSpouses.push(buildMarker(String(s.id), 'Extended Family'));
        }
    });

    const focalNode: TreeData = {
        ...focalMember,
        spouses: focalSpouses,
        children: childTreeNodes.length > 0 ? childTreeNodes : undefined
    };

    // 5. Structure the Primary Tree
    if (parents.length > 0) {
        // We pick one parent as structural parent, other(s) as spouses
        const primaryParent = parents[0];
        const otherParents = parents.slice(1);

        const primaryParentSpouses: (FamilyMember & { union?: Union })[] = otherParents.map(op => {
            const union = unions.find(u =>
                (String(u.person1_id) === String(primaryParent.id) && String(u.person2_id) === String(op.id)) ||
                (String(u.person1_id) === String(op.id) && String(u.person2_id) === String(primaryParent.id))
            );
            return { ...op, union };
        });

        const parentNode: TreeData = {
            ...primaryParent,
            spouses: primaryParentSpouses,
            children: [
                focalNode,
                ...siblings.map(s => ({ ...s }))
            ]
        };

        // Parent extended = primary parent has parents
        if (hasParents(primaryParent)) {
            return {
                id: 'virtual-root',
                full_name: 'Extended Family',
                children: [parentNode]
            } as TreeData;
        }
        return parentNode;
    }

    // No parents, just show focal node and siblings side by side
    if (siblings.length > 0) {
        return {
            id: 'virtual-root',
            full_name: 'Extended Family',
            children: [
                focalNode,
                ...siblings.map(s => ({ ...s }))
            ]
        } as TreeData;
    }

    return focalNode;
}
