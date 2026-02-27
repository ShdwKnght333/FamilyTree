/**
 * Utility to handle date transformations for birth and death dates.
 * 
 * Rules:
 * - Death Date: Stored as YYYY-01-01 if only YYYY is provided. Displayed as YYYY.
 * - Birth Date: 
 *   - If year is missing (MM-DD), stored as 1111-MM-DD.
 *   - If only year is provided (YYYY), stored as YYYY-01-01.
 *   - If 1111 is the year, displayed as MM-DD.
 */

export const toDBDate = (input: string, type: 'birth' | 'death'): string | null => {
    if (!input) return null;

    const trimmed = input.trim();

    if (type === 'death') {
        // Death date is now year only, but we store as YYYY-01-01
        // Handle if user already typed YYYY-MM-DD
        if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
            return trimmed;
        }
        if (/^\d{4}$/.test(trimmed)) {
            return `${trimmed}-01-01`;
        }
        return null;
    }

    if (type === 'birth') {
        // Full date: YYYY-MM-DD
        if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
            return trimmed;
        }
        // Missing year: MM-DD -> 1111-MM-DD
        if (/^\d{2}-\d{2}$/.test(trimmed)) {
            return `1111-${trimmed}`;
        }
        // Year only: YYYY -> YYYY-01-01
        if (/^\d{4}$/.test(trimmed)) {
            return `${trimmed}-01-01`;
        }
        return null;
    }

    return null;
};

export const toDisplayDate = (dbDate: string | null | undefined, type: 'birth' | 'death'): string => {
    if (!dbDate) return type === 'death' ? '' : 'Unknown';

    const parts = dbDate.split('-');
    const year = parts[0];
    const month = parts[1];
    const day = parts[2];

    if (type === 'death') {
        // For death date, we display just the year as requested.
        // It's stored as YYYY-01-01.
        return year;
    }

    if (type === 'birth') {
        if (year === '1111') {
            if (month === '01' && day === '01') return 'Unknown';
            return `${day}/${month}`;
        }
        if (month === '01' && day === '01') {
            return year;
        }
        return `${day}/${month}/${year}`;
    }

    return dbDate;
};

export const parseDBDate = (dbDate: string | null | undefined): { year: string, month: string, day: string } => {
    if (!dbDate) return { year: '', month: '', day: '' };

    const [year, month, day] = dbDate.split('-');
    return {
        year: year === '1111' ? '' : year,
        month: month || '',
        day: day || ''
    };
};

export const formatToDBDate = (year: string, month: string, day: string, type: 'birth' | 'death'): string | null => {
    if (type === 'death') {
        const y = year.trim();
        if (/^\d{4}$/.test(y)) return `${y}-01-01`;
        return null;
    }

    if (type === 'birth') {
        const y = year.trim() || '1111';
        const m = month.trim();
        const d = day.trim();

        if (!m || !d) return null;

        const pad = (s: string) => s.padStart(2, '0');

        // Basic validation
        if (/^\d{4}$/.test(y) && /^\d{1,2}$/.test(m) && /^\d{1,2}$/.test(d)) {
            return `${y}-${pad(m)}-${pad(d)}`;
        }
    }

    return null;
};
