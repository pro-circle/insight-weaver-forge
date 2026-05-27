import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";

/**
 * Standard phone input. Default country code is +91 (India). Users can
 * overwrite the prefix to type any international number. Stored value
 * is the full string including the leading "+" (e.g. "+919876543210").
 *
 * Kept the export name `CountryPhoneInput` so existing imports keep working.
 */
export function CountryPhoneInput({
  id,
  name,
  autoComplete,
  value,
  onChange,
  placeholder = "+91XXXXXXXXXX",
}: {
  id?: string;
  name?: string;
  autoComplete?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [local, setLocal] = useState(value || "");

  useEffect(() => {
    setLocal(value || "");
  }, [value]);

  function handleChange(raw: string) {
    // Keep only "+" (only as first char) and digits, cap at 15 digits + "+"
    let cleaned = raw.replace(/[^\d+]/g, "");
    // Only allow one leading "+"
    cleaned = cleaned.replace(/(?!^)\+/g, "");
    const digits = cleaned.replace(/\+/g, "");
    const capped = digits.slice(0, 15);
    const final = cleaned.startsWith("+") ? `+${capped}` : capped;
    setLocal(final);
    onChange(final);
  }

  function handleFocus() {
    if (!local) {
      setLocal("+91");
      onChange("+91");
    }
  }

  return (
    <Input
      id={id}
      name={name}
      autoComplete={autoComplete}
      inputMode="tel"
      type="tel"
      value={local}
      onFocus={handleFocus}
      onChange={(e) => handleChange(e.target.value)}
      placeholder={placeholder}
      maxLength={16}
    />
  );
}
