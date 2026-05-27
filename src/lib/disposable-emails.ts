// Minimal disposable-email domain list. Extend as needed.
const DISPOSABLE = new Set<string>([
  "mailinator.com","10minutemail.com","guerrillamail.com","yopmail.com",
  "tempmail.com","temp-mail.org","trashmail.com","getnada.com","fakeinbox.com",
  "dispostable.com","sharklasers.com","throwawaymail.com","maildrop.cc",
  "mintemail.com","mohmal.com","mytemp.email","tempail.com","tempinbox.com",
  "moakt.com","emailondeck.com","temp-mail.io","tmail.ws","tmpmail.org",
  "discard.email","spambox.us","mailnesia.com","tempr.email","linshiyou.com",
]);

export function isDisposableEmail(email: string): boolean {
  const at = email.lastIndexOf("@");
  if (at === -1) return false;
  return DISPOSABLE.has(email.slice(at + 1).toLowerCase().trim());
}
