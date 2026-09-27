/**
 * Small presentation helpers shared by more than one module.
 */

/**
 * Joins a count to the right word: "1 machine" but "4 machines".
 *
 * The dashboard shows counters next to a label, so an uninflected count reads
 * as a bug ("1 machines"). Passing an irregular plural keeps it correct for
 * words that need one.
 */
export function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}
