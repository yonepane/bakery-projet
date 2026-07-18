/**
 * Opens a WhatsApp conversation with the given phone number and pre-filled message.
 * Returns true if the link was opened, false if the phone number was invalid.
 */
export function openWhatsApp(phone: string, message: string): boolean {
  const clean = phone.replace(/\D/g, '');
  if (clean.length < 8) return false;
  window.open(
    `https://wa.me/${clean}?text=${encodeURIComponent(message)}`,
    '_blank',
    'noopener,noreferrer',
  );
  return true;
}
