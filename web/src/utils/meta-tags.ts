/** Strip markdown and collapse wrapped lines, so prose is safe to use in a meta tag */
export const plainText = (markdown?: string) =>
  (markdown || '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_`~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/** Cut sentance off after 155 chars rounded to nearest next word */
export const truncate = (text: string, max = 155) =>
  text.length <= max ? text : `${text.slice(0, text.lastIndexOf(' ', max))}…`;
