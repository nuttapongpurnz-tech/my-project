/*
 * Shared Tailwind utility strings for the module pages (dashboard, machines,
 * alarms, maintenance, users, reports, settings).
 *
 * These were previously hand-written CSS classes. They are plain Tailwind
 * utilities so the styling now flows through the Tailwind pipeline, but keeping
 * them here avoids repeating the same long string in seven different files.
 */

export const shell = "min-h-screen bg-canvas px-[clamp(20px,6vw,82px)] py-12 max-[760px]:px-4 max-[760px]:py-7";

export const topbar =
  "-mt-[18px] mx-auto mb-[30px] flex min-h-[54px] max-w-[1180px] items-center gap-6 border-b border-line pb-4 max-[760px]:-mt-2 max-[760px]:flex-wrap max-[760px]:gap-3";

export const brandMark = "grid h-[31px] w-[31px] shrink-0 place-items-center rounded-[9px] bg-brand text-white shadow-[0_5px_12px_#3478f633]";

export const brandName = "block text-xs tracking-[1.4px] [&>span]:text-brand";

export const brandCaption = "mt-0.5 block text-[8px] text-[color:var(--color-faint)]";

export const nav = "ml-auto flex items-center gap-[15px] max-[760px]:order-3 max-[760px]:w-full max-[760px]:overflow-x-auto max-[760px]:pb-0.5";

export const navLink = "text-[10px] font-bold text-muted hover:text-brand";

export const topbarActions = "ml-auto flex items-center gap-2";

export const rolePill = "rounded-full px-2 py-[5px] text-[9px] font-extrabold uppercase tracking-[.5px]";

export const rolePillTone: Record<string, string> = {
  admin: "bg-grape-soft text-[color:var(--color-on-grape-soft)]",
  technician: "bg-success-soft text-[color:var(--color-on-success-soft)]",
  viewer: "bg-brand-soft text-[color:var(--color-on-brand-soft)]",
};

export const button = "flex items-center gap-[7px] rounded-[7px] border border-line px-3 py-[9px] text-[11px] font-bold";

export const buttonPrimary = "border-brand bg-brand text-white shadow-[0_4px_10px_#3478f633]";

export const buttonSecondary = "bg-surface text-muted";

export const buttonSmall = "px-[10px] py-2 text-[10px]";

export const heading = "mx-auto mb-7 flex max-w-[1180px] items-end justify-between max-[760px]:flex-col max-[760px]:items-start max-[760px]:gap-4";

export const headingCopy = "max-w-[650px]";

export const headingTitle = "my-1.5 text-[30px] max-[760px]:text-[25px]";

export const headingLead = "m-0 text-xs text-muted";

export const eyebrow = "mb-[3px] text-[9px] font-bold tracking-[1px] text-[color:var(--color-faint)]";

export const eyebrowAccent = "text-brand tracking-[1.4px]";

export const toolbar = "mx-auto mb-4 flex max-w-[1180px] gap-2.5 max-[760px]:flex-col";

export const searchBox = "flex h-[31px] flex-1 items-center rounded-[6px] border border-line bg-surface px-[9px] text-faint max-[760px]:h-[38px]";

export const searchInput = "ml-2 w-full min-w-0 border-0 bg-transparent text-[10px] text-ink outline-none";

export const select = "rounded-[6px] border border-line bg-surface px-[10px] text-[11px] text-muted disabled:cursor-not-allowed disabled:opacity-60";

export const tableCard = "mx-auto max-w-[1180px] overflow-hidden rounded-[10px] border border-line bg-surface max-[760px]:overflow-x-auto";

export const tableGrid = "grid grid-cols-[1.1fr_1.4fr_1.3fr_.7fr] items-center gap-[18px] px-[19px] py-[15px] max-[760px]:min-w-[670px]";

export const tableHead = `${tableGrid} bg-sunken text-[9px] font-extrabold uppercase tracking-[.7px] text-muted`;

export const tableRow = `${tableGrid} min-h-[62px] border-t border-line text-[11px] text-muted`;

export const rowStrong = "text-[11px] text-ink";

export const rowSub = "mt-1 block text-[9px] font-normal text-[color:var(--color-faint)]";

export const rowDescription = "mt-1 block text-[10px] text-faint";

export const recordStatus = "inline-block w-max rounded-[4px] px-[7px] py-[5px] text-[9px] capitalize";

export const statusTone: Record<string, string> = {
  running: "bg-success-soft text-success",
  completed: "bg-success-soft text-success",
  closed: "bg-success-soft text-success",
  alarm: "bg-danger-soft text-danger",
  open: "bg-danger-soft text-danger",
  critical: "bg-danger-soft text-danger",
  maintenance: "bg-warn-soft text-[color:var(--color-on-warn-soft)]",
  in_progress: "bg-warn-soft text-[color:var(--color-on-warn-soft)]",
  waiting_part: "bg-grape-soft text-[color:var(--color-on-grape-soft)]",
  warning: "bg-warn-soft text-[color:var(--color-on-warn-soft)]",
  stop: "bg-sunken text-muted",
  resolved: "bg-success-soft text-success",
};

export const statusToneMuted = "bg-line text-muted";

export const machineColumns = "grid-cols-[1.2fr_1fr_1.1fr_.7fr_.55fr]";

export const alarmColumns = "grid-cols-[1.5fr_1fr_1.2fr_.8fr]";

export const moduleError = "mx-auto mb-3.5 max-w-[1180px] rounded-[6px] bg-danger-soft px-[13px] py-[10px] text-[11px] text-danger";

/**
 * The same message, inside a modal.
 *
 * The page-level banner sits behind the modal backdrop, so a validation failure
 * raised while a form is open was dimmed and easy to miss. This one renders in
 * the card the user is actually looking at.
 */
export const modalError = "rounded-[6px] bg-danger-soft px-[11px] py-[9px] text-[11px] text-danger";

export const moduleEmpty = "px-5 py-8 text-center text-xs text-[color:var(--color-faint)]";

/**
 * An informational strip, as opposed to moduleError which is a failure.
 *
 * Used when the page is showing something because of a link rather than because
 * the user asked for it, so the reason is stated and can be dismissed.
 */
export const moduleNotice =
  "mx-auto mb-3.5 flex items-center gap-2.5 rounded-[6px] border border-brand/30 bg-brand-soft px-[13px] py-[10px] text-[11px] text-[color:var(--color-on-brand-soft)]";

/** The row a deep link pointed at, marked so it is findable in a long list. */
export const tableRowFocused =
  "bg-brand-soft outline outline-2 -outline-offset-2 outline-brand/60";

export const moduleFootnote = "mx-auto mt-3.5 max-w-[1180px] text-[10px] text-muted";

// A pale amber box does not survive a dark theme, so this uses the warn tokens
// rather than fixed hex values.
export const permissionNote =
  "inline-flex items-center gap-[7px] rounded-[6px] border border-warn/40 bg-warn-soft px-3 py-2 text-[11px] text-[color:var(--color-on-warn-soft)]";

export const modalBackdrop = "fixed inset-0 z-30 grid place-items-center bg-[#13223888] p-5";

export const modalCard =
  "grid w-[min(100%,430px)] max-h-[min(760px,calc(100vh-32px))] gap-3.5 overflow-y-auto rounded-xl bg-surface p-[23px] shadow-[0_20px_60px_#12243a30]";

export const modalHeader = "mb-1 flex items-start justify-between";

export const modalTitle = "my-1 text-xl";

export const modalLabel = "grid gap-[7px] text-[11px] font-bold text-muted";

export const modalControl =
  "w-full rounded-[6px] border border-line bg-surface px-[11px] py-2.5 text-xs text-ink outline-none focus:border-brand focus:shadow-[0_0_0_3px_#3478f615] read-only:bg-sunken read-only:text-muted";

export const modalControlRow = `${modalControl} h-[38px] py-0`;

export const modalTextarea = "min-h-[82px] resize-y";

export const formGrid = "grid grid-cols-[repeat(2,minmax(0,1fr))] gap-3.5 max-[760px]:grid-cols-1";

export const formGridFull = "col-span-full max-[760px]:col-auto";

export const modalActions = "mt-5 flex justify-end gap-2";

export const iconButton =
  "grid place-items-center rounded-[7px] border-0 bg-transparent p-1.5 text-muted hover:bg-sunken hover:text-ink";

export const textButton = "border-0 bg-transparent py-1 text-[10px] font-bold text-brand";

export const formHint = "mt-[14px] text-[10px] text-muted";

export const reportGrid = "mx-auto grid max-w-[1180px] grid-cols-2 gap-3.5 max-[760px]:grid-cols-1";

export const reportCard = "rounded-[10px] border border-line bg-surface p-6 [&>svg]:text-brand";

export const settingsList = "mx-auto grid max-w-[1180px] gap-3.5";

export const settingsRow = "flex items-start gap-3 rounded-[9px] border border-line bg-surface p-[17px] [&>svg]:text-brand";
