# OpenPOS --- Dashboard Redesign Prompt

## Scope

Redesign **only the Dashboard page of OpenPOS**.

Do not redesign or modify the UI of: - POS Kasir - Transaksi - Produk -
Stok - Laporan - User Management - Pengaturan

Do not change routing, authentication, API, database, business logic,
data flow, or existing functionality.

The goal is to improve the Dashboard's **layout, information hierarchy,
UX, spacing, component structure, responsiveness, and visual polish**
while preserving the existing application architecture.

------------------------------------------------------------------------

## Critical Design-System Rules

### DO NOT CHANGE THE EXISTING FONT

The project already has an established typography/font system.

**Do not change, replace, import, or override the existing font.**

Keep: - existing font family - existing font loading - existing font
weights - existing typography tokens

Only adjust typography sizing, weight, spacing, and hierarchy where
necessary using the existing design system.

### DO NOT CHANGE THE EXISTING COLOR SYSTEM

The project already has an established color system.

**Do not create a new color palette. Do not replace the existing
primary, secondary, background, text, border, success, warning, or
destructive colors.**

Reuse the project's existing: - color tokens - CSS variables - Tailwind
colors - semantic colors - background colors - border colors - text
colors - status colors

The redesign must feel like a refinement of the current OpenPOS design
system, not a new visual identity.

If an existing design token already exists for a color or component,
reuse it instead of hardcoding a new value.

------------------------------------------------------------------------

# 1. Overall Dashboard Direction

Transform the Dashboard into a modern, clean, professional POS
dashboard.

The target feeling:

> Professional POS software that a store owner or cashier can understand
> immediately.

Prioritize:

1.  Information hierarchy
2.  Readability
3.  Scanability
4.  Usability
5.  Consistency
6.  Visual polish

Avoid making the dashboard look like a generic admin template.

The dashboard should be: - clean - compact - structured -
information-dense without feeling crowded - visually balanced - easy to
scan - practical for daily store operations

Avoid: - unnecessary decorative elements - excessive gradients -
glassmorphism - excessive shadows - oversized cards - huge
illustrations - unnecessary animations - excessive colors - redundant
statistics

------------------------------------------------------------------------

# 2. Preserve Existing Sidebar

Keep the existing OpenPOS sidebar and its navigation structure.

Do not redesign the sidebar as part of this task.

Only ensure the Dashboard active state remains visually correct using
the existing design system.

The Dashboard content should align naturally with the existing sidebar.

------------------------------------------------------------------------

# 3. Dashboard Page Structure

Use this overall hierarchy:

``` text
Dashboard
├── Header
│   ├── Page title
│   ├── Subtitle
│   └── Date / notification controls
│
├── KPI Section
│   ├── Omzet Hari Ini
│   ├── Transaksi Hari Ini
│   ├── Produk Terjual
│   └── Stok Menipis
│
├── Analytics Section
│   ├── Penjualan
│   └── Metode Pembayaran
│
└── Activity Section
    ├── Transaksi Terbaru
    └── Produk Terlaris
```

Use a clear vertical rhythm between sections.

Recommended spacing: - page horizontal padding: approximately 24--32px -
page top/bottom padding: approximately 24px - section gap: approximately
20--24px - card internal padding: approximately 18--20px

Use the project's existing spacing tokens when available.

Do not introduce random spacing values if equivalent design tokens
already exist.

------------------------------------------------------------------------

# 4. Dashboard Header

Create a compact header at the top of the content area.

Left side:

``` text
Ringkasan toko
Pantau aktivitas dan performa toko Anda hari ini
```

Right side: - notification icon - current date - existing date/calendar
control if already available

The header should not consume excessive vertical space.

The title should be visually prominent, while the subtitle should remain
secondary.

Do not introduce a large hero section.

------------------------------------------------------------------------

# 5. KPI Cards

Place four KPI cards in a single row on large desktop screens.

Order:

1.  Omzet Hari Ini
2.  Transaksi Hari Ini
3.  Produk Terjual
4.  Stok Menipis

Example content:

``` text
Omzet Hari Ini
Rp 4.827.000
↑ 12% dari kemarin
```

``` text
Transaksi Hari Ini
48
↑ 8% dari kemarin
```

``` text
Produk Terjual
132
↑ 15% dari kemarin
```

``` text
Stok Menipis
3
Perlu perhatian
```

Each card should: - have equal height - have consistent internal
padding - use the existing card component/style when available - use a
small relevant icon - make the primary number visually dominant - keep
secondary information clearly subordinate - avoid oversized decorative
icons

Suggested internal structure:

``` text
┌─────────────────────────────┐
│ Label                   Icon│
│                             │
│ Primary value               │
│ Trend / status              │
└─────────────────────────────┘
```

The KPI cards should be optimized for quick scanning.

A user should be able to understand the four most important store
metrics within a few seconds.

------------------------------------------------------------------------

# 6. KPI Trend and Status UX

For positive performance changes, use the project's existing semantic
success styling.

For stock warnings, use the project's existing warning styling.

Do not invent new status colors.

Keep trend information concise:

``` text
↑ 12% dari kemarin
```

Avoid overly detailed explanations inside KPI cards.

For "Stok Menipis", make the warning noticeable but not visually
aggressive.

------------------------------------------------------------------------

# 7. Sales Analytics Layout

Below the KPI cards, create a two-column analytics section.

Recommended ratio:

``` text
Sales Chart: approximately 2/3
Payment Method: approximately 1/3
```

Structure:

``` text
┌──────────────────────────────────────┬────────────────────┐
│ Penjualan                            │ Metode Pembayaran  │
│ 7 hari terakhir                      │                    │
│                                      │      Donut         │
│             Bar Chart                │                    │
│                                      │  Payment legend    │
└──────────────────────────────────────┴────────────────────┘
```

Both cards should have matching visual height where practical.

------------------------------------------------------------------------

# 8. Sales Chart

Title:

``` text
Penjualan
```

Subtitle:

``` text
7 hari terakhir
```

Include a compact period selector if the existing Dashboard
functionality supports it.

Example:

``` text
7 hari terakhir ▾
```

Use a **bar chart** for daily sales.

X-axis:

``` text
3 Sep
4 Sep
5 Sep
6 Sep
7 Sep
8 Sep
9 Sep
```

The chart must: - stay completely inside its card - never overflow - be
responsive - have readable labels - use the existing chart/color
tokens - use subtle grid lines - avoid unnecessary visual decoration -
provide a useful hover tooltip if chart interaction already exists or
can be implemented safely

Tooltip example:

``` text
9 Sep
Penjualan
Rp 4.827.000
```

Do not use a 3D chart.

Do not use excessive chart animations.

Do not add a chart legend if it provides no additional information.

------------------------------------------------------------------------

# 9. Chart Container Safety

This is important.

The chart must always respect the card boundaries.

Ensure: - chart wrapper has proper width constraints - chart has no
horizontal overflow - labels do not escape the card - tooltip does not
permanently affect layout - responsive resizing works correctly - card
remains stable during rendering - chart does not overlap adjacent cards

Test the Dashboard at multiple desktop widths.

------------------------------------------------------------------------

# 10. Payment Method Card

Create a compact payment-method visualization.

Title:

``` text
Metode Pembayaran
```

Subtitle:

``` text
Total pembayaran hari ini
```

Use a donut chart.

Place the total value in the center:

``` text
Rp 4.827.000
Total Omzet
```

Show payment methods as a readable legend:

``` text
Tunai       45%
QRIS        32%
Transfer    18%
Kartu        5%
```

Use the project's existing semantic/chart colors.

Do not introduce new colors.

Do not make the donut excessively large.

The card should remain compact and balanced relative to the sales chart.

------------------------------------------------------------------------

# 11. Recent Transactions

Below the analytics section, create a two-column content section.

Left side should contain:

``` text
Transaksi Terbaru
Transaksi terbaru hari ini
```

Add:

``` text
Lihat semua →
```

The action should navigate to the existing Transaksi page if that
functionality already exists.

Use a compact table.

Columns:

``` text
Waktu
No. Invoice
Kasir
Metode
Total
Status
```

Example:

``` text
09 Sep 16:42   #TRX-00048   Andika   Tunai      Rp 156.000   Selesai
09 Sep 16:10   #TRX-00047   Budi     QRIS       Rp 342.000   Selesai
09 Sep 16:21   #TRX-00046   Andika   Transfer   Rp 278.000   Selesai
```

------------------------------------------------------------------------

# 12. Recent Transactions Table UX

Do not make the table feel like a spreadsheet.

Use: - subtle header styling - clean row spacing - minimal dividers -
hover state - readable alignment - right-aligned monetary values -
compact status badges

Status badges should use the existing semantic status component/token if
available.

Avoid: - heavy borders around every cell - excessive colors - excessive
row height - unnecessary action buttons

Keep the table information-dense but easy to scan.

------------------------------------------------------------------------

# 13. Top Products

Right side of the bottom section:

``` text
Produk Terlaris
Produk dengan penjualan tertinggi
```

Add:

``` text
Lihat semua →
```

Show the top five products.

Example:

``` text
01  Air Mineral 600ml
    36 terjual                 Rp 180.000

02  Kopi Susu Dingin
    28 terjual                 Rp 560.000

03  Mie Instan
    24 terjual                 Rp 192.000
```

If product images already exist in the data, use small thumbnails around
32--36px.

If images are not available, use the existing product/category icon
system.

Do not introduce decorative images merely for visual purposes.

Make the ranking easy to scan.

------------------------------------------------------------------------

# 14. Information Hierarchy

The Dashboard must visually communicate importance in this order:

``` text
1. KPI / current store condition
2. Sales performance
3. Payment distribution
4. Recent transactions
5. Top-selling products
```

Do not give every section the same visual weight.

Primary information should have stronger typography and positioning.

Secondary information should remain visually quieter.

------------------------------------------------------------------------

# 15. Card Consistency

All Dashboard cards should feel like members of the same component
system.

Use the existing card design system.

If the project already has reusable Card components, reuse them.

Maintain consistency in: - border radius - border - shadow - padding -
header spacing - title hierarchy - action placement

Do not create a different card style for every widget.

------------------------------------------------------------------------

# 16. Typography Rules

Do not change the project's font.

Use the existing font family and typography system.

Only establish hierarchy through: - size - weight - line height -
spacing

Suggested hierarchy if compatible with the existing system:

``` text
Page title:        24–28px
Section title:     15–17px
Card label:        12–13px
KPI value:         24–28px
Body:              13–14px
Secondary text:    12–13px
```

If the existing design system has different typography tokens, use those
instead.

Do not hardcode a new font.

------------------------------------------------------------------------

# 17. Color Rules

Do not change the existing OpenPOS color system.

Do not create: - new primary color - new background palette - new text
palette - new success color - new warning color - new chart palette

Use the existing tokens.

The Dashboard should remain visually consistent with the rest of
OpenPOS.

Color should communicate meaning, not decoration.

------------------------------------------------------------------------

# 18. Responsive Design

### Large desktop

At approximately 1280px and above:

``` text
4 KPI cards
2-column analytics
2-column bottom section
```

### Tablet

Use:

``` text
2 × 2 KPI cards
1-column analytics
1-column bottom section
```

### Mobile

Use:

``` text
1-column KPI cards
1-column charts
1-column content sections
```

Avoid page-level horizontal overflow.

Tables should receive a sensible responsive treatment using the
project's existing table patterns.

Do not simply shrink everything until text becomes unreadable.

------------------------------------------------------------------------

# 19. Empty States

Every data widget should have a useful empty state.

Example:

``` text
Belum ada transaksi

Transaksi yang masuk hari ini
akan muncul di sini.
```

Empty states should preserve the card's normal visual structure.

Do not leave blank white areas.

Use the existing empty-state component if one exists.

------------------------------------------------------------------------

# 20. Loading States

Use skeleton loading where appropriate for: - KPI cards - charts -
recent transactions - top products

Skeletons should resemble the shape of the actual content.

Avoid replacing the whole Dashboard with a large loading spinner.

Reuse existing loading/skeleton components when available.

------------------------------------------------------------------------

# 21. Interaction and Micro-Animations

Keep interaction subtle.

Use animations only where they improve usability: - hover state - chart
tooltip - table row hover - button transitions - navigation state

Avoid: - bouncing - excessive scaling - flashy transitions - animated
backgrounds - large entrance animations - unnecessary motion

The interface should feel fast and professional.

------------------------------------------------------------------------

# 22. Data Formatting

Use the existing formatting utilities if they exist.

Currency must be displayed as Indonesian Rupiah.

Example:

``` text
Rp 4.827.000
```

not:

``` text
4827000
```

Dates and times should follow the application's existing Indonesian/date
formatting conventions.

Do not create a new formatting system if one already exists.

------------------------------------------------------------------------

# 23. Reuse Existing Components

Before creating new components:

1.  Inspect the existing project.
2.  Identify existing Card components.
3.  Identify existing Button components.
4.  Identify existing Badge components.
5.  Identify existing Table components.
6.  Identify existing Chart components.
7.  Identify existing Icon system.
8.  Identify existing Skeleton/Loading components.
9.  Reuse them whenever practical.

Do not duplicate components unnecessarily.

The redesign should integrate naturally into the existing codebase.

------------------------------------------------------------------------

# 24. Component Structure

A structure similar to this is acceptable if it fits the current
architecture:

``` text
Dashboard
├── DashboardHeader
├── DashboardStats
│   └── StatCard
├── SalesOverview
│   ├── SalesChart
│   └── PaymentMethodCard
└── DashboardActivity
    ├── RecentTransactions
    └── TopProducts
```

However:

**Do not force this structure if the existing project architecture uses
another pattern.**

Prioritize consistency with the existing codebase.

------------------------------------------------------------------------

# 25. Technical Safety

Before modifying anything:

1.  Inspect the current Dashboard implementation.
2.  Understand the current data sources.
3.  Understand how existing charts receive data.
4.  Understand existing reusable UI components.
5.  Preserve existing functionality.
6.  Make the smallest architectural changes necessary.
7.  Keep the redesign isolated to Dashboard.

Do not rewrite unrelated files.

Do not modify other pages simply to make the Dashboard work.

If a shared component must be adjusted, ensure the change does not
unintentionally alter unrelated pages.

------------------------------------------------------------------------

# 26. Final Visual Goal

The final Dashboard should communicate:

> "I can open OpenPOS and immediately understand how my store is
> performing today."

It should feel:

-   modern
-   clean
-   professional
-   compact
-   organized
-   trustworthy
-   easy to scan
-   visually polished

It should **not** feel:

-   empty
-   overly decorative
-   crowded
-   like a generic admin template
-   like a marketing landing page
-   like a spreadsheet
-   overly colorful
-   overly animated

The core principle is:

> **Better hierarchy, better information density, better usability ---
> without changing the existing OpenPOS design system.**

------------------------------------------------------------------------

# 27. Final QA Checklist

Before considering the redesign complete, verify:

## Scope

-   [ ] Only Dashboard UI was redesigned.
-   [ ] Other pages were not redesigned.
-   [ ] Existing routing remains unchanged.
-   [ ] Existing business logic remains unchanged.
-   [ ] Existing API/data flow remains unchanged.

## Design System

-   [ ] Existing font is unchanged.
-   [ ] Existing color system is unchanged.
-   [ ] Existing design tokens are reused.
-   [ ] Existing components are reused where practical.

## Layout

-   [ ] Header is compact.
-   [ ] Four KPI cards are aligned.
-   [ ] Analytics section has a clear 2-column hierarchy.
-   [ ] Recent transactions and top products are balanced.
-   [ ] Spacing is consistent.
-   [ ] Cards are visually consistent.

## UX

-   [ ] Important information is immediately visible.
-   [ ] Tables are easy to scan.
-   [ ] Charts are understandable.
-   [ ] Actions such as "Lihat semua" are discoverable.
-   [ ] Empty states are handled.
-   [ ] Loading states are handled.

## Responsive

-   [ ] 1440px works correctly.
-   [ ] 1280px works correctly.
-   [ ] 1024px works correctly.
-   [ ] 768px works correctly.
-   [ ] 375px works correctly.
-   [ ] No horizontal page overflow.
-   [ ] Charts stay inside their containers.
-   [ ] Cards do not overlap.
-   [ ] Text does not become unusable.

## Code Quality

-   [ ] No unnecessary dependencies were introduced.
-   [ ] No duplicated components were created unnecessarily.
-   [ ] No TypeScript errors.
-   [ ] No console errors.
-   [ ] Existing functionality still works.
