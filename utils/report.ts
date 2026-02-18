import { FamilyMember, Union } from '../types';

export interface ReportNode extends FamilyMember {
    spouses: FamilyMember[];
    children: ReportNode[];
}

export function findAncestors(members: FamilyMember[], unions: Union[]): FamilyMember[] {
    const list = members.filter(m => !m.father_id && !m.mother_id);
    const result: FamilyMember[] = [];
    const seen = new Set<string>();

    for (const m of list) {
        const mid = String(m.id);
        if (seen.has(mid)) continue;

        result.push(m);
        seen.add(mid);

        // Find spouse who might also be an ancestor
        const spouseIds = unions
            .filter(u => String(u.person1_id) === mid || String(u.person2_id) === mid)
            .map(u => String(u.person1_id) === mid ? String(u.person2_id) : String(u.person1_id));

        spouseIds.forEach(sId => seen.add(String(sId)));
    }

    return result;
}

export function buildDeepHierarchy(
    rootMember: FamilyMember,
    members: FamilyMember[],
    unions: Union[]
): ReportNode {
    const memberMap = new Map<string, FamilyMember>();
    members.forEach(m => memberMap.set(String(m.id), m));

    const buildNode = (member: FamilyMember, visited: Set<string>): ReportNode => {
        const mid = String(member.id);
        visited.add(mid);

        // Find Spouses
        const spouseIds = unions
            .filter(u => String(u.person1_id) === mid || String(u.person2_id) === mid)
            .map(u => String(u.person1_id) === mid ? String(u.person2_id) : String(u.person1_id));

        const spouses = spouseIds
            .map(id => memberMap.get(String(id)))
            .filter((s): s is FamilyMember => !!s);

        // Find Children
        const children = members
            .filter(m => String(m.father_id) === mid || String(m.mother_id) === mid)
            .filter(m => !visited.has(String(m.id))) // Prevent cycles just in case
            .sort((a, b) => {
                const dateA = a.birth_date ? new Date(a.birth_date).getTime() : Infinity;
                const dateB = b.birth_date ? new Date(b.birth_date).getTime() : Infinity;
                return dateA - dateB;
            });

        return {
            ...member,
            spouses,
            children: children.map(child => buildNode(child, new Set(visited)))
        };
    };

    return buildNode(rootMember, new Set());
}

export function generateReportHTML(rootNodes: ReportNode[]): string {
    const renderNode = (node: ReportNode, isRoot: boolean = false): string => {
        const hasSpouse = node.spouses.length > 0;

        let nodesHtml = '';
        if (isRoot && hasSpouse) {
            // Special Case: Display Root as 2 separate boxes
            const spouse = node.spouses[0];
            nodesHtml = `
                <div class="couple-container">
                    <div class="node-box root-box">
                        <div class="name">${node.full_name}</div>
                        <div class="dates">${node.birth_date || 'Unknown'} - ${node.death_date || 'Present'}</div>
                    </div>
                    <div class="couple-connector"></div>
                    <div class="node-box root-box spouse-box">
                        <div class="name">${spouse.full_name}</div>
                        <div class="dates">${spouse.birth_date || 'Unknown'} - ${spouse.death_date || 'Present'}</div>
                    </div>
                </div>
            `;
        } else {
            // Standard Case: Spouse(s) listed inside the box
            const spouseHtml = node.spouses.map(s => `
                <div class="internal-spouse">
                    m. ${s.full_name} <br/> 
                    <span class="dates">${s.birth_date || 'Unknown'} - ${s.death_date || 'Present'}</span>
                </div>
            `).join('');

            nodesHtml = `
                <div class="node-box">
                    <div class="name">${node.full_name}</div>
                    ${spouseHtml}
                    <div class="dates main-dates">${node.birth_date || 'Unknown'} - ${node.death_date || 'Present'}</div>
                </div>
            `;
        }

        let html = `<li>
            <div class="li-content">${nodesHtml}</div>
        `;

        if (node.children && node.children.length > 0) {
            html += `<ul>${node.children.map(child => renderNode(child)).join('')}</ul>`;
        }

        html += `</li>`;
        return html;
    };

    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Family Tree Ancestor Report</title>
            <style>
                @page {
                    size: landscape;
                    margin: 20mm;
                }
                body { 
                    font-family: -apple-system, system-ui, sans-serif; 
                    padding: 0; 
                    margin: 0;
                    background: white; 
                    color: #333; 
                }
                h1 { text-align: center; font-size: 24px; margin-bottom: 40px; color: #000; border-bottom: 1px solid #eee; padding-bottom: 15px; }
                .ancestor-section { margin-bottom: 100px; page-break-after: always; display: flex; flex-direction: column; align-items: center; width: 100%; }
                h2 { margin-bottom: 30px; color: #666; font-weight: 400; font-size: 18px; }
                
                /* Tree layout architecture */
                .tree {
                    display: inline-block;
                    white-space: nowrap;
                    margin: 0 auto;
                }
                .tree ul {
                    padding-top: 30px; position: relative;
                    display: flex;
                    justify-content: center;
                    margin: 0; padding-left: 0;
                }
                .tree li {
                    list-style-type: none;
                    position: relative;
                    padding: 30px 5px 0 5px;
                    text-align: center;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                }

                /* Connectors */
                .tree li::before, .tree li::after {
                    content: '';
                    position: absolute; top: 0; right: 50%;
                    border-top: 2px solid #ccc;
                    width: 50%; height: 30px;
                }
                .tree li::after {
                    right: auto; left: 50%;
                    border-left: 2px solid #ccc;
                }
                .tree li:only-child::after, .tree li:only-child::before {
                    display: none;
                }
                .tree li:only-child { padding-top: 0; }
                .tree li:first-child::before, .tree li:last-child::after {
                    border: 0 none;
                }
                .tree li:last-child::before {
                    border-right: 2px solid #ccc;
                    border-radius: 0 10px 0 0;
                }
                .tree li:first-child::after {
                    border-radius: 10px 0 0 0;
                }
                .tree ul ul::before {
                    content: '';
                    position: absolute; top: 0; left: 50%;
                    border-left: 2px solid #ccc;
                    width: 0; height: 30px;
                }

                /* Compact Node Styling */
                .node-box {
                    border: 1px solid #ddd;
                    padding: 8px 12px;
                    background: #fff;
                    border-radius: 8px;
                    min-width: 120px;
                    display: inline-block;
                    position: relative;
                    z-index: 5;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.05);
                }
                .li-content {
                    position: relative;
                    z-index: 10;
                    display: inline-block;
                    white-space: normal; /* Allow text wrapping within node */
                }

                /* Special Root Couple Display */
                .couple-container {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0;
                }
                .couple-connector {
                    width: 20px;
                    height: 2px;
                    background: #ccc;
                    margin: 0 -2px;
                    z-index: 1;
                }
                .root-box {
                    border-color: #007AFF;
                    background: #fbfdff;
                    min-width: 120px;
                }
                .spouse-box {
                    border-color: #FF2D55;
                    background: #fffafa;
                }

                /* Content Styling */
                .name { font-weight: 700; font-size: 13px; margin-bottom: 4px; color: #1a1a1a; line-height: 1.2; }
                .dates { font-size: 10px; color: #888; letter-spacing: 0.2px; }
                .main-dates { border-top: 1px solid #f0f0f0; margin-top: 6px; padding-top: 6px; }
                .internal-spouse {
                    font-size: 11px;
                    color: #007AFF;
                    font-style: italic;
                    margin: 4px 0;
                    padding: 4px 6px;
                    background: #f0f7ff;
                    border-radius: 4px;
                }
                .internal-spouse .dates { color: #555; }
            </style>
        </head>
        <body>
            <h1>Family Generation Report</h1>
            ${rootNodes.map(root => `
                <div class="ancestor-section">
                    <h2>Lineage of ${root.full_name}</h2>
                    <div class="tree">
                        <ul>${renderNode(root, true)}</ul>
                    </div>
                </div>
            `).join('')}
        </body>
        </html>
    `;
}

export function generateTextReportHTML(rootNodes: ReportNode[]): string {
    const renderNodeText = (node: ReportNode, level: number = 0): string => {
        const spouses = node.spouses.map(s => `${s.full_name} (${s.birth_date || 'Unknown'} - ${s.death_date || 'Present'})`).join(', ');
        const spouseText = spouses ? ` [Spouse(s): ${spouses}]` : '';

        let html = `
            <div class="text-node" style="margin-left: ${level * 30}px;">
                <span class="bullet">•</span>
                <span class="name">${node.full_name}</span>
                <span class="dates">(${node.birth_date || 'Unknown'} - ${node.death_date || 'Present'})</span>
                <span class="spouses">${spouseText}</span>
            </div>
        `;

        if (node.children && node.children.length > 0) {
            html += node.children.map(child => renderNodeText(child, level + 1)).join('');
        }

        return html;
    };

    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Family Tree Text Report</title>
            <style>
                body { font-family: -apple-system, system-ui, sans-serif; padding: 40px; line-height: 1.6; color: #333; }
                h1 { text-align: center; font-size: 24px; margin-bottom: 40px; border-bottom: 2px solid #eee; padding-bottom: 15px; }
                .ancestor-section { margin-bottom: 60px; page-break-inside: avoid; }
                h2 { color: #007AFF; font-size: 18px; margin-bottom: 20px; border-left: 4px solid #007AFF; padding-left: 10px; }
                .text-node { margin-bottom: 8px; font-size: 14px; }
                .bullet { color: #ccc; margin-right: 8px; font-weight: bold; }
                .name { font-weight: 600; color: #000; }
                .dates { color: #888; margin: 0 5px; }
                .spouses { color: #FF2D55; font-style: italic; font-size: 13px; }
            </style>
        </head>
        <body>
            <h1>Family Tree Ancestor Report (Text Format)</h1>
            ${rootNodes.map(root => `
                <div class="ancestor-section">
                    <h2>Family of ${root.full_name}</h2>
                    ${renderNodeText(root)}
                </div>
            `).join('')}
        </body>
        </html>
    `;
}
