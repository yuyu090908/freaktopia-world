/** The translator a component passes to module-level option lists (`STEPS(tu)`): next-intl's t() for one namespace. */
export type Tu = (key: string, values?: Record<string, string | number | Date>) => string;
