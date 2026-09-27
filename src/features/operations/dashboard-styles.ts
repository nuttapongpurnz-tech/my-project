/*
 * Tailwind utility strings for the dashboard shell (src/app/page.tsx).
 * Extracted from the hand-written CSS that used to live in globals.css.
 */

import { button, buttonPrimary, buttonSecondary, iconButton, searchBox, searchInput, statusTone, textButton } from "./module-styles";

export const appShell = "flex min-h-screen";

export const sidebar =
  "flex w-[244px] shrink-0 flex-col border-r border-line bg-surface px-4 pb-[18px] pt-[27px] max-[680px]:fixed max-[680px]:inset-y-0 max-[680px]:left-0 max-[680px]:z-20 max-[680px]:translate-x-full max-[680px]:bg-surface max-[680px]:shadow-[10px_0_30px_#14223820] max-[680px]:transition-transform max-[680px]:duration-200 max-[1100px]:w-[215px]";

export const sidebarOpen = "max-[680px]:translate-x-0";

export const brandRow = "flex items-center gap-2.5 pb-7 pl-[9px]";

export const brandName = "m-0 text-sm font-extrabold tracking-[1.8px] [&>span]:text-brand";

export const brandCaption = "mt-0.5 mb-0 text-[9px] tracking-[.6px] text-[color:var(--color-faint)]";

export const siteSelector = "mb-7 flex items-center gap-2.5 rounded-[9px] border border-line bg-sunken p-2.5";

export const siteDot = "h-2 w-2 rounded-full bg-success shadow-[0_0_0_3px_#dff4e9]";

export const siteName = "m-0 text-[11px] font-bold";

export const mutedIcon = "ml-auto text-steel";

export const navLabel = "mb-2 mt-0 px-3 text-[9px] font-bold tracking-[1.2px] text-faint";

export const navLabelSpaced = "mt-7";

export const navItem =
  "mb-[3px] flex w-full items-center gap-3 rounded-lg border-0 bg-transparent px-3 py-2.5 text-left text-xs font-semibold text-muted hover:bg-sunken hover:text-ink";

export const navItemActive = "bg-brand-soft text-brand";

export const navCount = "ml-auto rounded-[10px] bg-warn-soft px-1.5 py-[3px] text-[10px] text-[color:var(--color-on-warn-soft)]";

export const sidebarFooter = "mt-auto";

export const systemStatus = "flex items-center gap-2.5 border-t border-line py-[17px] px-2";

export const pulseDot = "h-[7px] w-[7px] rounded-full bg-success shadow-[0_0_0_4px_#e4f6ed]";

export const systemTitle = "m-0 text-[10px] font-bold";

export const systemMeta = "mt-[3px] mb-0 text-[9px] text-[color:var(--color-faint)]";

export const userCard = "flex w-full cursor-pointer items-center gap-2.5 rounded-[9px] border border-line bg-surface p-2.5 text-left";

export const avatar = "grid h-[27px] w-[27px] place-items-center rounded-full bg-brand-soft text-[9px] font-extrabold text-[color:var(--color-on-brand-soft)]";

export const topAvatar = "grid h-[29px] w-[29px] place-items-center rounded-full bg-brand-soft text-[9px] font-extrabold text-[color:var(--color-on-brand-soft)]";

export const userCopyName = "m-0 text-[11px] font-bold";

export const userCopyMeta = "text-[9px] text-faint";

export const contentArea = "min-w-0 flex-1";

export const topbar = "flex h-[70px] items-center justify-between border-b border-line bg-surface px-[44px] max-[1100px]:px-7 max-[680px]:h-[58px] max-[680px]:px-[17px]";

export const breadcrumb = "flex gap-[11px] text-[11px] text-faint [&>strong]:text-ink max-[680px]:hidden";

export const topbarActions = "flex items-center gap-[21px] max-[680px]:gap-[9px]";

export const liveIndicator = "flex items-center gap-[7px] text-[10px] text-muted max-[680px]:hidden [&>span]:h-1.5 [&>span]:w-1.5 [&>span]:rounded-full [&>span]:bg-success";

export const notificationButton = "relative [&>i]:absolute [&>i]:right-1 [&>i]:top-1 [&>i]:h-1.5 [&>i]:w-1.5 [&>i]:rounded-full [&>i]:border [&>i]:border-surface [&>i]:bg-danger";

export const pageContent = "mx-auto max-w-[1440px] px-[44px] pb-[34px] pt-[38px] max-[1100px]:px-7 max-[680px]:px-[17px] max-[680px]:pb-6 max-[680px]:pt-[26px]";

export const pageHeading = "mb-[30px] flex items-end justify-between max-[680px]:mb-[22px] max-[680px]:block";

export const pageHeadingTitle = "my-[5px] text-[27px] tracking-[-.7px] max-[680px]:text-[23px]";

export const headingSubtitle = "m-0 text-xs text-faint";

export const headingActions = "flex gap-[9px] max-[680px]:mt-[17px] max-[680px]:[&>*]:flex-1 max-[680px]:[&>*]:justify-center";

export { button, buttonPrimary, buttonSecondary, iconButton, searchBox, searchInput, textButton };

export const metricGrid = "mb-6 grid grid-cols-4 gap-[15px] max-[1100px]:grid-cols-2 max-[680px]:mb-[15px] max-[680px]:gap-[9px]";

export const metricCard =
  "relative min-h-[147px] overflow-hidden rounded-[10px] border border-line bg-surface px-[19px] py-[17px] after:absolute after:bottom-[-45px] after:right-[-35px] after:h-[95px] after:w-[95px] after:rounded-full max-[680px]:min-h-[130px] max-[680px]:p-[14px]";

/** `tone` drives the decorative corner circle and the icon chip. */
export const metricTones: Record<string, { card: string; icon: string; delta: string }> = {
  blue: { card: "after:bg-brand-soft", icon: "bg-brand-soft text-brand", delta: "text-success" },
  orange: { card: "after:bg-warn-soft", icon: "bg-warn-soft text-warn", delta: "text-danger" },
  green: { card: "after:bg-success-soft", icon: "bg-success-soft text-success", delta: "text-success" },
  violet: { card: "after:bg-grape-soft", icon: "bg-grape-soft text-grape", delta: "text-success" },
};

export const metricTop = "flex h-6 items-center justify-between";

export const metricIcon = "grid h-[30px] w-[30px] place-items-center rounded-[7px]";

export const attentionDot = "text-[9px] font-bold text-danger";

export const metricLabel = "mb-[3px] mt-4 text-[11px] text-muted max-[680px]:mt-[13px]";

export const metricValueRow = "flex items-baseline gap-[9px]";

export const metricValue = "text-[27px] tracking-[-.8px] max-[680px]:text-[24px]";

export const metricDelta = "text-[10px] font-bold";

export const metricNote = "mt-0.5 mb-0 text-[9px] text-faint";

export const sectionGrid = "grid grid-cols-[minmax(0,1.4fr)_minmax(370px,.9fr)] gap-4 max-[1100px]:grid-cols-1 max-[680px]:gap-[15px]";

export const panel = "rounded-[10px] border border-line bg-surface p-5 max-[680px]:p-[15px]";

export const panelHeader = "flex items-start justify-between";

export const panelTitleRow = "flex items-center gap-[9px]";

export const panelTitle = "m-0 text-[15px] tracking-[-.2px]";

export const panelSubtitle = "mt-[5px] mb-0 text-[10px] text-faint";

export const countBadge = "rounded-[10px] bg-danger-soft px-[7px] py-1 text-[9px] font-bold text-danger";

export const tableToolbar = "mb-[13px] mt-[23px] flex gap-2";

export const filterButton = "flex items-center gap-1.5 rounded-[6px] border border-line bg-surface px-2.5 text-[10px] text-muted";

export const filterButtonSelected = "border-brand/40 bg-brand-soft text-brand";

export const filterStrip = "mb-2.5 flex items-center gap-2 rounded-[6px] bg-sunken px-2.5 py-2 text-[9px] text-muted";

export const filterStripClear = "ml-auto border-0 bg-transparent px-1.5 py-1 text-[9px] text-brand";

/** The running tally inside the filter strip, so the scope is visible. */
export const filterStripCount = "text-muted";

export const alarmList = "border-t border-line";

export const alarmRow = "flex min-h-[57px] items-center gap-[11px] border-b border-bg-sunken";

export const alarmSeverity = "grid h-[27px] w-[27px] shrink-0 place-items-center rounded-[7px]";

export const alarmSeverityTones: Record<string, string> = {
  critical: "bg-danger-soft text-danger",
  warning: "bg-warn-soft text-warn",
  resolved: "bg-success-soft text-success [&>svg]:rotate-180",
};

export const alarmCopy = "min-w-0 flex-1";

export const alarmCopyHead = "flex items-center gap-2 [&>strong]:text-[10px]";

export const machineTag = "rounded-[3px] bg-sunken px-[5px] py-[3px] text-[8px] font-bold text-muted";

export const alarmDescription = "mt-1 mb-0 truncate text-[10px] text-muted";

export const alarmTime = "whitespace-nowrap text-[9px] text-faint max-[680px]:hidden";

export const alarmStatusBadge = "whitespace-nowrap rounded-[4px] px-1.5 py-1 text-[9px] max-[680px]:text-[8px]";

export const healthSummary = "mx-[14px] my-[25px] flex items-center gap-[25px] max-[680px]:mx-[3px] max-[680px]:gap-[18px]";

export const donut =
  "relative grid h-[116px] w-[116px] shrink-0 place-items-center rounded-full after:absolute after:inset-3 after:rounded-full after:bg-surface max-[680px]:h-[100px] max-[680px]:w-[100px]";

export const donutCenter = "relative z-1 text-center [&>strong]:block [&>strong]:text-[23px] [&>span]:text-[9px] [&>span]:text-[color:var(--color-faint)]";

export const legend = "grid w-full gap-2.5";

export const legendRow = "grid grid-cols-[8px_1fr_auto] items-center gap-2 text-[10px] text-muted [&>strong]:text-[11px] [&>strong]:text-ink";

export const legendDot = "h-1.5 w-1.5 rounded-full";

export const machineList = "border-t border-line";

export const machineRow = "flex min-h-[53px] items-center gap-[9px] border-b border-bg-sunken";

export const machineIcon = "grid h-[27px] w-[27px] place-items-center rounded-[6px] bg-brand-soft text-[color:var(--color-on-brand-soft)]";

export const machineInfo = "min-w-[125px] flex-1 max-[680px]:min-w-0";

export const machineNameRow = "flex items-center gap-[7px] [&>strong]:text-[10px]";

export const machineMeta = "mt-1 block truncate text-[8px] text-faint";

export const machineStatusTag = "rounded-[3px] px-[5px] py-[3px] text-[8px]";

export const healthBar = "h-1 w-[47px] rounded-[3px] bg-line";

export const healthBarFill = "h-full rounded-[inherit] bg-success";

export const healthBarFillLow = "h-full rounded-[inherit] bg-danger";

export const healthValue = "w-[25px] text-right text-[9px] text-faint";

export const bottomStrip = "mt-4 flex items-center gap-3 rounded-[10px] border border-line bg-sunken px-[18px] py-[14px] max-[680px]:p-3";

export const stripIcon = "grid h-[31px] w-[31px] place-items-center rounded-[7px] bg-brand-soft text-[color:var(--color-on-brand-soft)]";

export const stripTitle = "block text-[11px] max-[680px]:truncate";

export const stripBody = "min-w-0 max-[680px]:truncate";

export const stripMeta = "mt-[3px] block text-[9px] text-muted max-[680px]:truncate";

export const stripProgress = "ml-auto w-[190px] max-[680px]:hidden";

export const stripProgressLabels = "mb-[5px] flex justify-between text-[8px] text-muted [&>span:first-child]:font-extrabold [&>span:first-child]:text-brand";

export const progressTrack = "h-[5px] rounded-[5px] bg-line";

export const progressFill = "h-full rounded-[inherit] bg-brand";

export const stripLink = "max-[680px]:ml-auto";

export const emptyState = "px-4 py-7 text-center text-[11px] text-[color:var(--color-faint)]";

/** Map a machine status to its badge utilities. */
export const machineStatusTone: Record<string, string> = {
  alarm: statusTone.alarm,
  maintenance: statusTone.maintenance,
  running: statusTone.running,
  stop: statusTone.stop,
};
