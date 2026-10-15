import { Toaster as Sonner, ToasterProps } from "sonner";

// Los avisos siguen el tema del sistema. Antes lo leía de next-themes, pero la
// app nunca montó su ThemeProvider y siempre caía en "system".
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="system"
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
