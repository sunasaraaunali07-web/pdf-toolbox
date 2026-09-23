# PDF Toolbox

A modern, fast, and privacy-focused client-side PDF utility web application. All PDF operations run directly inside the user's web browser—no documents are ever uploaded to a server or external backend.

---

## Features & Available Tools

The application includes 8 fully functional PDF tools accessible directly from the browser:

1. **Merge PDF (`#merge`)**
   - Combine multiple PDF documents into a single PDF in any desired order.
   - Drag-and-drop file reordering with automatic page count and size calculation.

2. **Compress PDF (`#compress`)**
   - Reduce PDF file size while strictly preserving selectable and copyable text.
   - Adaptive multi-candidate pipeline: strips bloated metadata, re-deflates uncompressed streams with zlib (level 9), downsamples oversized embedded images, and re-encodes raster graphics.
   - Evaluates multiple candidate outputs and guarantees the output is never larger than the original.
   - Supports batch compression of up to 10 files simultaneously.

3. **Split PDF (`#split`)**
   - Extract specific page ranges (e.g., `1-3, 5, 8-10`) into a new PDF.
   - Or split an entire document into individual single-page PDF files bundled as a ZIP download.

4. **PDF to JPG (`#pdf-to-jpg`)**
   - Convert individual PDF pages or full documents into high-resolution JPG images.
   - Interactive visual thumbnail selection with batch conversion and instant ZIP download.

5. **JPG to PDF (`#jpg-to-pdf`)**
   - Convert multiple JPG/PNG images into a single formatted PDF document.
   - Drag-and-drop image reordering and automatic page scaling.

6. **Reorder Pages (`#reorder`)**
   - Visually rearrange pages within a PDF using visual page thumbnails.
   - Simple move-left / move-right controls and drag interactions with real-time preview.

7. **Delete Pages (`#delete-pages`)**
   - Visually select and delete unwanted pages from any PDF document.
   - Generates a clean PDF containing only the retained pages.

8. **Rotate Pages (`#rotate`)**
   - Rotate individual pages or all pages simultaneously by 90°, 180°, or 270° clockwise.
   - Updates page orientation metadata losslessly without re-encoding page content.

---

## Technologies Used

- **Build System & Dev Server:** [Vite 8](https://vitejs.dev/) with Rolldown bundler
- **Language:** [TypeScript 6](https://www.typescriptlang.org/) (Strict mode, ES2023 target)
- **PDF Manipulation:** [pdf-lib](https://pdf-lib.js.org/) (Document creation, merging, splitting, stream manipulation, object streams)
- **PDF Rendering & Thumbnails:** [pdfjs-dist](https://mozilla.github.io/pdf.js/) (Worker-based client-side page rasterization and thumbnail generation)
- **Compression & Deflate:** [pako](https://github.com/nodeca/pako) (High-performance zlib deflate/inflate for stream-level optimization)
- **Image Processing:** [@pdf-lib/upng](https://github.com/photopea/UPNG.js) & HTML5 Canvas API (In-browser raster re-encoding and format conversion)
- **Styling:** Modern CSS with custom properties (CSS variables), responsive flex/grid layouts, and zero heavy UI framework overhead

---

## How to Install and Run

### Prerequisites
- [Node.js](https://nodejs.org/) (version 18 or higher recommended)
- `npm` (bundled with Node.js)

### Installation

Clone or open the project folder, then install dependencies:

```bash
npm install
```

```

Open https://pdf-toolbox-omega.vercel.app/ in your browser.

### Production Build

Typecheck and compile the production bundle into the `dist/` directory:

```bash
npm run build
```

### Preview Production Build

Preview the built production distribution locally:

```bash
npm run preview
```

---

## Project Structure

```
pdf-toolbox/
├── index.html                 # Main application HTML entry point
├── package.json               # Project dependencies and npm scripts
├── tsconfig.json              # TypeScript compiler configuration
├── vite.config.ts             # Vite configuration (worker & chunking setup)
├── public/                    # Static public assets
└── src/
    ├── main.ts                # Application router and lifecycle manager
    ├── components/            # Reusable UI sections
    │   ├── Header.ts          # Application header & branding
    │   ├── Hero.ts            # Landing hero section
    │   ├── ToolGrid.ts        # Main tool selection grid
    │   ├── HowItWorks.ts      # Informational workflow guide
    │   └── Footer.ts          # Application footer
    ├── pages/                 # Individual tool views (UI & event wiring)
    │   ├── MergePage.ts
    │   ├── CompressPage.ts
    │   ├── SplitPage.ts
    │   ├── PdfToJpgPage.ts
    │   ├── JpgToPdfPage.ts
    │   ├── ReorderPage.ts
    │   ├── DeletePagesPage.ts
    │   └── RotatePagesPage.ts
    ├── services/              # Pure PDF processing & transformation logic
    │   ├── pdfMerge.ts        # PDF concatenation engine
    │   ├── pdfCompress.ts     # Multi-candidate compression pipeline
    │   ├── pdfSplit.ts        # Range extraction & page splitting
    │   ├── pdfToImages.ts     # Page rasterization via canvas to JPG
    │   ├── imagesToPdf.ts     # Image embedding into PDF pages
    │   ├── pdfReorder.ts      # Page index reordering engine
    │   ├── pdfDeletePages.ts  # Page deletion and document rebuild
    │   └── pdfRotate.ts       # Lossless rotation angle transformation
    ├── styles/                # Global and modular CSS stylesheets
    │   ├── global.css         # Theme variables, typography, resets
    │   ├── components.css     # Buttons, inputs, drop zones, cards
    │   └── tool-page.css      # Shared tool workspace & thumbnail styles
    ├── tools/
    │   └── registry.ts        # Central tool registry, metadata, routes, icons
    ├── types/                 # Custom TypeScript ambient module declarations
    │   ├── pako.d.ts
    │   └── upng.d.ts
    └── utils/                 # Shared helper functions
        ├── fileUtils.ts       # Validation, byte reading, format conversions
        └── pdfUtils.ts        # PDF.js worker setup & thumbnail generators
```

---

## How the PDF Tools Work

All document processing is performed **100% locally in the client browser**:

1. **Local File Ingestion:**
   When a user selects or drops a PDF, the file is read directly into memory as a `Uint8Array` via the browser's `FileReader` API. No data is sent over the network.

2. **Client-Side Rendering (pdfjs-dist):**
   Tools that require visual page previews (Reorder, Delete Pages, Rotate, PDF to JPG) initialize a dedicated Web Worker running `pdfjs-dist`. Pages are rasterized off the main thread onto HTML5 Canvas elements to display thumbnails smoothly without freezing the UI.

3. **In-Memory Manipulation (pdf-lib):**
   Structural operations (Merge, Split, Reorder, Delete, Rotate) parse the PDF into an in-memory document tree. Pages are copied, re-indexed, or removed, and the document is serialized back into a binary PDF array buffer.

4. **Adaptive Multi-Candidate Compression:**
   The compression tool analyzes document structure, cleans unused metadata, deflates uncompressed streams with `pako` zlib level 9, and re-encodes high-resolution embedded images. It generates multiple valid candidates and picks the smallest result that is strictly smaller than or equal to the input, ensuring text remains selectable.

5. **Direct Download:**
   The processed binary output is converted into an in-memory `Blob` and downloaded directly via a generated `blob:` URL. Once downloaded or cleared, the Blob URLs are revoked to prevent memory leaks.
