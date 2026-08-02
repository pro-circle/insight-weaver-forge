import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export function BackButton({ className = "" }: { className?: string }) {
  const nav = useNavigate();
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      aria-label="Go back"
      className={`-ml-2 h-8 gap-1 px-2 text-muted-foreground hover:bg-blue-50 hover:text-blue-700 ${className}`}
      onClick={() => (window.history.length > 1 ? nav(-1) : nav("/"))}
    >
      <ArrowLeft className="h-4 w-4" /> Back
    </Button>
  );
}
