// Text ohne Auszeichnung, so wie man ihn vorliest: {3/4} wird „3 von 4“
export const spoken = (text: string) =>
  text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\[\[(.+?)\]\]/g, '$1')
    .replace(/\{([^{}/]+)\/([^{}/]+)\}/g, '$1 von $2')
    .replace(/\s*\n+\s*/g, ' ')
    .trim()
