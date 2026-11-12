/**
 * Candidate keys for a link label, in the order rustdoc itself normalizes intra-doc links: the label
 * as written, without surrounding backticks, without a trailing `()` or `!`, and without a
 * `kind@` disambiguator prefix.
 */
export function linkKeys(label: string): string[] {
  const keys = [label];
  let current = label.trim();

  if (current.startsWith('`') && current.endsWith('`') && current.length > 2) {
    current = current.slice(1, -1).trim();
    keys.push(current);
  }

  for (const suffix of ['()', '!']) {
    if (current.endsWith(suffix)) {
      current = current.slice(0, -suffix.length);
      keys.push(current);
    }
  }

  const at = current.indexOf('@');

  if (at > 0 && !current.includes(' ')) keys.push(current.slice(at + 1));

  return keys;
}
