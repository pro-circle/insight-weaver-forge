import { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/**
 * Phone input split into [country-code | 10-digit local].
 * Country auto-detected from `navigator.language` (e.g. en-IN → +91, en-US → +1).
 * Stored value format: "+<cc><10digits>" (e.g. "+919876543210") — keeps the
 * existing `isValidPhone()` rule (10–15 digits incl. country code) happy.
 */

type CC = { code: string; dial: string; flag: string };

// Small curated list — extend as needed. First match by region wins.
export const COUNTRY_CODES: CC[] = [
  { code: "IN", dial: "+91",  flag: "🇮🇳" },
  { code: "US", dial: "+1",   flag: "🇺🇸" },
  { code: "GB", dial: "+44",  flag: "🇬🇧" },
  { code: "AE", dial: "+971", flag: "🇦🇪" },
  { code: "SG", dial: "+65",  flag: "🇸🇬" },
  { code: "AU", dial: "+61",  flag: "🇦🇺" },
  { code: "CA", dial: "+1",   flag: "🇨🇦" },
  { code: "DE", dial: "+49",  flag: "🇩🇪" },
  { code: "FR", dial: "+33",  flag: "🇫🇷" },
  { code: "JP", dial: "+81",  flag: "🇯🇵" },
];

function detectDefaultDial(): string {
  try {
    const region = (Intl.DateTimeFormat().resolvedOptions() as { locale: string }).locale
      ?.split("-")[1]?.toUpperCase()
      ?? navigator.language?.split("-")[1]?.toUpperCase()
      ?? "IN";
    return COUNTRY_CODES.find((c) => c.code === region)?.dial ?? "+91";
  } catch { return "+91"; }
}

export function splitPhone(full: string | null | undefined): { dial: string; local: string } {
  if (!full) return { dial: detectDefaultDial(), local: "" };
  const m = full.trim().match(/^\+(\d{1,3})(\d{0,10})$/);
  if (m) return { dial: `+${m[1]}`, local: m[2] };
  const digits = full.replace(/\D/g, "").slice(-10);
  return { dial: detectDefaultDial(), local: digits };
}

export function CountryPhoneInput({
  id, name, autoComplete, value, onChange, placeholder = "10-digit number",
}: { id?: string; name?: string; autoComplete?: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  const { dial, local } = useMemo(() => splitPhone(value), [value]);

  function update(nextDial: string, nextLocal: string) {
    const clean = nextLocal.replace(/\D/g, "").slice(0, 10);
    onChange(clean ? `${nextDial}${clean}` : "");
  }

  return (
    <div className="flex gap-2">
      <Select value={dial} onValueChange={(d) => update(d, local)}>
        <SelectTrigger className="w-[110px] shrink-0"><SelectValue /></SelectTrigger>
        <SelectContent>
          {COUNTRY_CODES.map((c) => (
            <SelectItem key={c.code + c.dial} value={c.dial}>
              <span className="mr-1">{c.flag}</span>{c.dial}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        id={id}
        name={name}
        autoComplete={autoComplete}
        inputMode="numeric"
        maxLength={10}
        value={local}
        onChange={(e) => update(dial, e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}
