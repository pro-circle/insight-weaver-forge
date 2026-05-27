import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff } from "lucide-react";

/**
 * Masked input that reveals on click of the eye icon.
 * Use for any value that should not be shoulder-surfed (UPI ID, SMTP app
 * password, payee name, etc.). The value is the actual secret; only the
 * rendered text is masked.
 */
export function SecretInput({
  id, name, autoComplete, value, onChange, placeholder, maxLength,
}: { id?: string; name?: string; autoComplete?: string; value: string; onChange: (v: string) => void; placeholder?: string; maxLength?: number }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        id={id}
        name={name}
        type={show ? "text" : "password"}
        value={value}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete ?? "off"}
        className="pr-10"
      />
      <Button
        type="button" size="icon" variant="ghost"
        aria-label={show ? "Hide" : "Show"}
        onClick={() => setShow((s) => !s)}
        className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 text-muted-foreground hover:bg-blue-100 hover:text-blue-900"
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </Button>
    </div>
  );
}
