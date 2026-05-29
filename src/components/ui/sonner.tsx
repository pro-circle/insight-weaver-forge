import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:border group-[.toaster]:shadow-lg",
          description: "opacity-90",
          success:
            "!bg-green-600 !text-white !border-green-700 [&_[data-icon]]:!text-white [&_[data-close-button]]:!text-white",
          error:
            "!bg-red-600 !text-white !border-red-700 [&_[data-icon]]:!text-white [&_[data-close-button]]:!text-white",
          warning:
            "!bg-amber-500 !text-white !border-amber-600 [&_[data-icon]]:!text-white",
          info:
            "!bg-blue-600 !text-white !border-blue-700 [&_[data-icon]]:!text-white",
          actionButton: "group-[.toast]:bg-white group-[.toast]:text-black",
          cancelButton: "group-[.toast]:bg-white/20 group-[.toast]:text-white",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
