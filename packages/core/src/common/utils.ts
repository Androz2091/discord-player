/**
 * Resolves the value to a boolean.
 * @param value The value to resolve.
 * @param defaultValue The default value if the value is not a boolean.
 * @private
 * @internal
 */
export function getBoolean(value: unknown, defaultValue?: boolean) {
    return typeof value === 'boolean' ? value : defaultValue ?? false;
}
