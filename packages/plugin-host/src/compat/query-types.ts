/** Common anonymous query hints; other v7 string query hints are passed through unchanged. */
const commonQueryTypes = {
  /** Automatic provider matching. */
  AUTO: 'auto',
  /** Automatic text search. */
  AUTO_SEARCH: 'autoSearch',
  /** Direct HTTP media. */
  ARBITRARY: 'arbitrary',
  /** Local or server-accessible file. */
  FILE: 'file',
} as const;

/** Legacy symbolic query hints. Uppercase underscore keys map to their v7 camel-case string values.
 * Source-specific routing stays in plugins; this object performs no network or URL classification.
 */
export const QueryType = new Proxy(commonQueryTypes as typeof commonQueryTypes & Readonly<Record<string, string>>, {
  get(target, key) {
    if (typeof key !== 'string' || key in target) {
      return Reflect.get(target, key);
    }

    if (!/^[A-Z]+(?:_[A-Z]+)*$/.test(key)) {
      return undefined;
    }

    const [first, ...rest] = key.toLowerCase().split('_');

    return first! + rest.map((part) => part[0]!.toUpperCase() + part.slice(1)).join('');
  },
});

/** Legacy query hint, including provider-defined string values. */
export type SearchQueryType = string;
