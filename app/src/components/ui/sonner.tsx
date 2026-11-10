import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

// Estilos por default de shadcn (sombra genérica, radius de 8px, sin acento
// de marca) nunca se tocaron desde que se instaló el componente — el toast
// es de los momentos más vistos de toda la app (cada "Foto guardada", cada
// error) y se veía 100% template. Radius/sombra/tipografía ahora calzan con
// el resto del diseño, y success/error tienen un acento de color en vez de
// verse todos iguales.
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:rounded-2xl group-[.toaster]:border-l-4 group-[.toaster]:border-y group-[.toaster]:border-r group-[.toaster]:border-border group-[.toaster]:font-semibold group-[.toaster]:shadow-[0_12px_32px_-10px_rgba(10,10,10,0.35)]",
          description: "group-[.toast]:text-muted-foreground group-[.toast]:font-normal",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          success: "group-[.toaster]:!border-l-[#E8624A]",
          error: "group-[.toaster]:!border-l-[#ef4444]",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
