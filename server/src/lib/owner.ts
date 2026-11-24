export const OWNER_EMAILS = [
  'pritisinghmgs@gmail.com',
  'arcade.pixelverse@gmail.com',
];

/**
 * Checks whether the given email corresponds to the Supreme Platform Owner.
 * Checks environment variable ADMIN_EMAIL (comma-separated or single) and default owner emails.
 */
export function isOwnerEmail(email?: string | null): boolean {
  if (!email || typeof email !== 'string') return false;
  const userEmail = email.trim().toLowerCase();
  if (!userEmail) return false;

  const rawAdminEnv = process.env.ADMIN_EMAIL || '';
  const adminEmailsFromEnv = rawAdminEnv
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  return (
    adminEmailsFromEnv.includes(userEmail) ||
    OWNER_EMAILS.some((e) => e.toLowerCase() === userEmail)
  );
}
