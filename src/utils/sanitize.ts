import DOMPurify from 'isomorphic-dompurify';

/**
 * Sanitizes user-generated content to prevent stored XSS attacks.
 *
 * SECURITY: Any content that originates from user input and will be stored
 * in the database must pass through this function before being saved.
 * This strips all HTML tags and JavaScript — even if the input looks safe.
 *
 * Call sites: review body, product Q&A answers.
 */
export function sanitizeUserContent(input: string): string {
  // ALLOW_TAGS: [] means no HTML tags are allowed — output is plain text only.
  // This is intentionally strict for user-generated content.
  return DOMPurify.sanitize(input, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
}

/**
 * Sanitizes HTML content where some formatting is acceptable (e.g., product descriptions
 * written by admins). Allows a limited safe set of tags.
 *
 * Only use for admin-authored content, never for user-submitted content.
 */
export function sanitizeAdminHtml(input: string): string {
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: ['p', 'br', 'b', 'i', 'strong', 'em', 'ul', 'ol', 'li', 'h3', 'h4'],
    ALLOWED_ATTR: [],
  });
}
