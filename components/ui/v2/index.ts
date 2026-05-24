/**
 * v2 admin-redesign UI primitives — barrel export.
 *
 * Source design: docs/zulu-admin-v2.html
 * Rollout plan: docs/roadmaps/admin-redesign-v2-plan.md
 *
 * These components are used by Phase Դ (13 main page rewrites) and Phase Ե
 * (all detail/edit/new sub-pages) to migrate the admin onto v2 design.
 *
 * The OLD primitives in components/ui/ remain in place during the rollout
 * so unmigrated pages keep working. Once all pages are on v2/*, the old
 * ones can be deleted.
 *
 * Phase Գ.2 — initial v2 component set (2026-05-24):
 */
export { Breadcrumb, type BreadcrumbItem } from "./Breadcrumb";
export { PageHeader, type PageHeaderProps } from "./PageHeader";
export { StatCard, StatGrid, type StatCardTone } from "./StatCard";
export { FilterCard, FilterField } from "./FilterCard";
export { SectionTabs, type SectionTabItem } from "./SectionTabs";
export { IconButton } from "./IconButton";
export { EmptyState } from "./EmptyState";
export { V2Button, type V2ButtonVariant, type V2ButtonSize } from "./Button";
export { V2Card, V2CardHeader, V2CardBody } from "./Card";
