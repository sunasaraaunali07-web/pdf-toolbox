/**
 * Tool Registry
 * Add a new tool here and it will automatically appear in the UI.
 * Each tool module should live in its own file under src/tools/.
 */

export type ToolStatus = 'available' | 'coming-soon';

export interface ToolDefinition {
  id: string;
  title: string;
  description: string;
  icon: string;          // inline SVG path data (24×24 viewBox)
  status: ToolStatus;
  /** Route fragment, e.g. "#merge" */
  href: string;
  /** Optional accent color token (CSS custom property name, without --) */
  accentColor?: string;
}

export const TOOLS: ToolDefinition[] = [
  {
    id: 'merge',
    title: 'Merge PDF',
    description: 'Combine multiple PDF files into one document in any order.',
    icon: `<path d="M8 2H4a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-6-6H8Z"/>
           <polyline points="14 2 14 8 20 8"/>
           <line x1="12" y1="12" x2="12" y2="18"/>
           <line x1="9" y1="15" x2="15" y2="15"/>`,
    status: 'coming-soon',
    href: '#merge',
    accentColor: 'accent-blue',
  },
  {
    id: 'compress',
    title: 'Compress PDF',
    description: 'Reduce PDF file size while maintaining the best quality possible.',
    icon: `<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
           <polyline points="7 10 12 15 17 10"/>
           <line x1="12" y1="15" x2="12" y2="3"/>`,
    status: 'coming-soon',
    href: '#compress',
    accentColor: 'accent-green',
  },
  {
    id: 'split',
    title: 'Split PDF',
    description: 'Extract pages or split a PDF into multiple separate files.',
    icon: `<path d="M8 2H4a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-6-6H8Z"/>
           <polyline points="14 2 14 8 20 8"/>
           <line x1="9" y1="12" x2="15" y2="12"/>`,
    status: 'coming-soon',
    href: '#split',
    accentColor: 'accent-orange',
  },
  {
    id: 'pdf-to-jpg',
    title: 'PDF to JPG',
    description: 'Convert every PDF page into a high-quality JPG image.',
    icon: `<rect width="18" height="18" x="3" y="3" rx="2"/>
           <circle cx="8.5" cy="8.5" r="1.5"/>
           <polyline points="21 15 16 10 5 21"/>`,
    status: 'coming-soon',
    href: '#pdf-to-jpg',
    accentColor: 'accent-purple',
  },
  {
    id: 'jpg-to-pdf',
    title: 'JPG to PDF',
    description: 'Convert one or more JPG images into a single PDF document.',
    icon: `<path d="M8 2H4a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-6-6H8Z"/>
           <polyline points="14 2 14 8 20 8"/>
           <polyline points="10 13 8 15 10 17"/>
           <polyline points="14 13 16 15 14 17"/>`,
    status: 'coming-soon',
    href: '#jpg-to-pdf',
    accentColor: 'accent-pink',
  },
  {
    id: 'reorder',
    title: 'Reorder Pages',
    description: 'Drag and drop PDF pages into any order you want.',
    icon: `<line x1="3" y1="6" x2="21" y2="6"/>
           <line x1="3" y1="12" x2="21" y2="12"/>
           <line x1="3" y1="18" x2="21" y2="18"/>
           <polyline points="15 9 18 6 21 9"/>
           <polyline points="15 15 18 18 21 15"/>`,
    status: 'coming-soon',
    href: '#reorder',
    accentColor: 'accent-teal',
  },
  {
    id: 'delete-pages',
    title: 'Delete Pages',
    description: 'Remove one or more pages from your PDF document.',
    icon: `<path d="M8 2H4a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-6-6H8Z"/>
           <polyline points="14 2 14 8 20 8"/>
           <line x1="9" y1="15" x2="15" y2="15"/>`,
    status: 'coming-soon',
    href: '#delete-pages',
    accentColor: 'accent-red',
  },
  {
    id: 'rotate',
    title: 'Rotate Pages',
    description: 'Rotate individual pages or all pages to the correct orientation.',
    icon: `<path d="M21.5 2v6h-6"/>
           <path d="M21.34 15.57a10 10 0 1 1-.57-8.38"/>`,
    status: 'coming-soon',
    href: '#rotate',
    accentColor: 'accent-yellow',
  },
];
