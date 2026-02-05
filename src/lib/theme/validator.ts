/**
 * Theme Validator
 * Validates theme manifests against the schema defined in RFC-001.
 */

import {
  ThemeManifest,
  ThemeColors,
  ThemeManifestVersion,
  ThemeVariant,
  SUPPORTED_THEME_VERSIONS,
} from '@/types/theme';

/**
 * Error thrown when theme validation fails.
 */
export class ThemeValidationError extends Error {
  constructor(message: string, public readonly details?: string[]) {
    super(message);
    this.name = 'ThemeValidationError';
  }
}

/**
 * Required color categories and their tokens.
 */
const REQUIRED_COLOR_TOKENS: Record<keyof ThemeColors, string[]> = {
  background: ['primary', 'secondary', 'tertiary'],
  text: ['primary', 'secondary', 'tertiary'],
  accent: ['primary', 'subtle'],
  border: ['default', 'subtle', 'focus'],
  shadows: ['sm', 'md', 'lg'],
  highlights: ['clarity', 'grammar', 'style', 'structure', 'economy'],
  syntax: ['heading', 'emphasis', 'codeBackground', 'codeText', 'link', 'listMarker'],
};

/**
 * Regex pattern for valid theme IDs.
 * Must be lowercase alphanumeric with hyphens.
 */
const THEME_ID_PATTERN = /^[a-z0-9-]+$/;

/**
 * CSS color formats we accept.
 */
const CSS_COLOR_PATTERNS = [
  // Hex colors: #RGB, #RGBA, #RRGGBB, #RRGGBBAA
  /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/,
  // RGB/RGBA
  /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*(0|1|0?\.\d+))?\s*\)$/,
  // Modern RGB/RGBA with slash
  /^rgba?\(\s*\d{1,3}\s+\d{1,3}\s+\d{1,3}\s*(\/\s*(0|1|0?\.\d+|\d{1,3}%))?\s*\)$/,
  // HSL/HSLA
  /^hsla?\(\s*\d{1,3}(deg)?\s*,\s*\d{1,3}%\s*,\s*\d{1,3}%\s*(,\s*(0|1|0?\.\d+))?\s*\)$/,
  // Modern HSL/HSLA with slash
  /^hsla?\(\s*\d{1,3}(deg)?\s+\d{1,3}%\s+\d{1,3}%\s*(\/\s*(0|1|0?\.\d+|\d{1,3}%))?\s*\)$/,
];

/**
 * Named CSS colors (subset of commonly used ones).
 */
const NAMED_COLORS = new Set([
  'transparent', 'currentcolor', 'inherit',
  'black', 'white', 'red', 'green', 'blue', 'yellow', 'cyan', 'magenta',
  'gray', 'grey', 'orange', 'pink', 'purple', 'brown',
  'aliceblue', 'antiquewhite', 'aqua', 'aquamarine', 'azure',
  'beige', 'bisque', 'blanchedalmond', 'blueviolet', 'burlywood',
  'cadetblue', 'chartreuse', 'chocolate', 'coral', 'cornflowerblue',
  'cornsilk', 'crimson', 'darkblue', 'darkcyan', 'darkgoldenrod',
  'darkgray', 'darkgrey', 'darkgreen', 'darkkhaki', 'darkmagenta',
  'darkolivegreen', 'darkorange', 'darkorchid', 'darkred', 'darksalmon',
  'darkseagreen', 'darkslateblue', 'darkslategray', 'darkslategrey',
  'darkturquoise', 'darkviolet', 'deeppink', 'deepskyblue', 'dimgray',
  'dimgrey', 'dodgerblue', 'firebrick', 'floralwhite', 'forestgreen',
  'fuchsia', 'gainsboro', 'ghostwhite', 'gold', 'goldenrod', 'greenyellow',
  'honeydew', 'hotpink', 'indianred', 'indigo', 'ivory', 'khaki',
  'lavender', 'lavenderblush', 'lawngreen', 'lemonchiffon', 'lightblue',
  'lightcoral', 'lightcyan', 'lightgoldenrodyellow', 'lightgray', 'lightgrey',
  'lightgreen', 'lightpink', 'lightsalmon', 'lightseagreen', 'lightskyblue',
  'lightslategray', 'lightslategrey', 'lightsteelblue', 'lightyellow',
  'lime', 'limegreen', 'linen', 'maroon', 'mediumaquamarine', 'mediumblue',
  'mediumorchid', 'mediumpurple', 'mediumseagreen', 'mediumslateblue',
  'mediumspringgreen', 'mediumturquoise', 'mediumvioletred', 'midnightblue',
  'mintcream', 'mistyrose', 'moccasin', 'navajowhite', 'navy', 'oldlace',
  'olive', 'olivedrab', 'orangered', 'orchid', 'palegoldenrod', 'palegreen',
  'paleturquoise', 'palevioletred', 'papayawhip', 'peachpuff', 'peru',
  'plum', 'powderblue', 'rebeccapurple', 'rosybrown', 'royalblue',
  'saddlebrown', 'salmon', 'sandybrown', 'seagreen', 'seashell', 'sienna',
  'silver', 'skyblue', 'slateblue', 'slategray', 'slategrey', 'snow',
  'springgreen', 'steelblue', 'tan', 'teal', 'thistle', 'tomato',
  'turquoise', 'violet', 'wheat', 'whitesmoke', 'yellowgreen',
]);

/**
 * Validates a CSS color value.
 */
export function isValidCssColor(color: string): boolean {
  if (!color || typeof color !== 'string') return false;

  const trimmed = color.trim().toLowerCase();

  // Check named colors
  if (NAMED_COLORS.has(trimmed)) return true;

  // Check patterns
  for (const pattern of CSS_COLOR_PATTERNS) {
    if (pattern.test(trimmed)) return true;
  }

  return false;
}

/**
 * Validates a CSS box-shadow value.
 * This is a basic validation - we check that it's a non-empty string
 * and doesn't contain potentially dangerous content.
 */
export function isValidCssShadow(shadow: string): boolean {
  if (!shadow || typeof shadow !== 'string') return false;

  const trimmed = shadow.trim();

  // Must not be empty
  if (trimmed.length === 0) return false;

  // Basic sanity check - should not contain script-like content
  const dangerous = /javascript:|expression\(|url\(/i;
  if (dangerous.test(trimmed)) return false;

  // Allow 'none' keyword
  if (trimmed.toLowerCase() === 'none') return true;

  // Basic pattern: should contain numbers and color-like values
  // This is intentionally permissive to allow various shadow formats
  return true;
}

/**
 * Validates a URL string.
 */
export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Checks custom CSS for potentially dangerous patterns.
 */
export function containsDangerousPatterns(css: string): boolean {
  const dangerousPatterns = [
    /@import\s/i,           // No @import
    /expression\s*\(/i,     // No IE expression
    /javascript:/i,         // No javascript: URLs
    /behavior:/i,           // No IE behaviors
    /-moz-binding/i,        // No XBL bindings
  ];

  // Check for external URLs (allow data: URIs for inline content)
  const urlPattern = /url\s*\(\s*['"]?\s*(https?:\/\/)/i;

  for (const pattern of dangerousPatterns) {
    if (pattern.test(css)) return true;
  }

  if (urlPattern.test(css)) return true;

  return false;
}

/**
 * Validates a theme manifest.
 * @param manifest - The parsed JSON object to validate
 * @returns The validated ThemeManifest
 * @throws ThemeValidationError if validation fails
 */
export function validateTheme(manifest: unknown): ThemeManifest {
  const errors: string[] = [];

  // Type guard
  if (!manifest || typeof manifest !== 'object') {
    throw new ThemeValidationError('Theme manifest must be an object');
  }

  const m = manifest as Record<string, unknown>;

  // 1. Check required fields exist
  const requiredFields = ['version', 'id', 'name', 'variant', 'colors', 'author', 'description'];
  for (const field of requiredFields) {
    if (!(field in m)) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  if (errors.length > 0) {
    throw new ThemeValidationError('Missing required fields', errors);
  }

  // 2. Validate version
  if (!SUPPORTED_THEME_VERSIONS.includes(m.version as ThemeManifestVersion)) {
    throw new ThemeValidationError(
      `Unsupported theme version: ${m.version}`,
      [`Supported versions: ${SUPPORTED_THEME_VERSIONS.join(', ')}`]
    );
  }

  // 3. Validate id format
  const id = m.id as string;
  if (typeof id !== 'string') {
    throw new ThemeValidationError('Theme ID must be a string');
  }
  if (!THEME_ID_PATTERN.test(id)) {
    throw new ThemeValidationError(
      'Invalid theme ID format',
      ['Theme ID must be lowercase alphanumeric with hyphens only']
    );
  }
  if (id.length < 2 || id.length > 50) {
    throw new ThemeValidationError(
      'Invalid theme ID length',
      ['Theme ID must be 2-50 characters']
    );
  }

  // 4. Validate name
  if (typeof m.name !== 'string' || m.name.length === 0) {
    throw new ThemeValidationError('Theme name must be a non-empty string');
  }

  // 5. Validate description
  if (typeof m.description !== 'string') {
    throw new ThemeValidationError('Theme description must be a string');
  }

  // 6. Validate variant
  const validVariants: ThemeVariant[] = ['light', 'dark'];
  if (!validVariants.includes(m.variant as ThemeVariant)) {
    throw new ThemeValidationError(
      `Invalid variant: ${m.variant}`,
      ["Variant must be 'light' or 'dark'"]
    );
  }

  // 7. Validate author
  if (!m.author || typeof m.author !== 'object') {
    throw new ThemeValidationError('Author must be an object');
  }
  const author = m.author as Record<string, unknown>;
  if (typeof author.name !== 'string' || author.name.length === 0) {
    throw new ThemeValidationError('Author name must be a non-empty string');
  }
  if (author.url !== undefined && typeof author.url === 'string' && author.url.length > 0) {
    if (!isValidUrl(author.url)) {
      errors.push('Invalid author URL');
    }
  }

  // 8. Validate colors structure
  if (!m.colors || typeof m.colors !== 'object') {
    throw new ThemeValidationError('Colors must be an object');
  }

  const colors = m.colors as Record<string, unknown>;

  for (const [category, tokens] of Object.entries(REQUIRED_COLOR_TOKENS)) {
    if (!colors[category] || typeof colors[category] !== 'object') {
      errors.push(`Missing color category: ${category}`);
      continue;
    }

    const categoryColors = colors[category] as Record<string, unknown>;

    for (const token of tokens) {
      if (!(token in categoryColors)) {
        errors.push(`Missing color token: colors.${category}.${token}`);
        continue;
      }

      const value = categoryColors[token];
      if (typeof value !== 'string') {
        errors.push(`Invalid color value type: colors.${category}.${token} must be a string`);
        continue;
      }

      // Shadows use different validation
      if (category === 'shadows') {
        if (!isValidCssShadow(value)) {
          errors.push(`Invalid shadow value: colors.${category}.${token}`);
        }
      } else {
        if (!isValidCssColor(value)) {
          errors.push(`Invalid color value: colors.${category}.${token} = "${value}"`);
        }
      }
    }
  }

  // 9. Validate homepage (if present)
  if (m.homepage !== undefined && typeof m.homepage === 'string' && m.homepage.length > 0) {
    if (!isValidUrl(m.homepage)) {
      errors.push('Invalid homepage URL');
    }
  }

  // 10. Validate customCss (if present)
  if (m.customCss !== undefined) {
    if (typeof m.customCss !== 'string') {
      errors.push('Custom CSS must be a string');
    } else {
      if (m.customCss.length > 50000) {
        errors.push('Custom CSS exceeds 50KB limit');
      }
      if (containsDangerousPatterns(m.customCss)) {
        errors.push('Custom CSS contains potentially dangerous patterns');
      }
    }
  }

  if (errors.length > 0) {
    throw new ThemeValidationError('Theme validation failed', errors);
  }

  return m as unknown as ThemeManifest;
}

/**
 * Validates a partial theme for updates.
 * Less strict than full validation - used for patching themes.
 */
export function validatePartialTheme(partial: unknown): Partial<ThemeManifest> {
  if (!partial || typeof partial !== 'object') {
    throw new ThemeValidationError('Partial theme must be an object');
  }

  const p = partial as Record<string, unknown>;
  const errors: string[] = [];

  // Validate only the fields that are present
  if ('id' in p && typeof p.id === 'string') {
    if (!THEME_ID_PATTERN.test(p.id)) {
      errors.push('Invalid theme ID format');
    }
  }

  if ('variant' in p) {
    const validVariants: ThemeVariant[] = ['light', 'dark'];
    if (!validVariants.includes(p.variant as ThemeVariant)) {
      errors.push('Invalid variant');
    }
  }

  if (errors.length > 0) {
    throw new ThemeValidationError('Partial theme validation failed', errors);
  }

  return p as Partial<ThemeManifest>;
}
