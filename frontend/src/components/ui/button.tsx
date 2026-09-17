import React from "react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "filled" | "accent" | "outline" | "ghost" | "link";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = "filled",
      size = "md",
      isLoading = false,
      leftIcon,
      rightIcon,
      className = "",
      disabled,
      ...props
    },
    ref
  ) => {
    // Base styles: Inter Variable font, tight tracking, 300ms ease transition
    const base =
      "inline-flex items-center justify-center font-medium font-sans tracking-tight transition-all duration-300 select-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-lime-pulse";

    const variants = {
      // Primary Filled: #181818 fill, #ddffdc border & text, 12px radius
      filled:
        "bg-ground-iron text-phosphor-white border border-circuit-border hover:border-phosphor-white hover:bg-carbon-veil rounded-buttons shadow-none",
      // Accent Pill: #7fee64 fill, #181818 text, 9999px pill radius (Hero / primary conversion)
      accent:
        "bg-lime-pulse text-void-black font-semibold border border-lime-pulse hover:bg-[#6edc54] rounded-pills shadow-none",
      // Outline: transparent fill, 1px phosphor or circuit border, #ddffdc text
      outline:
        "bg-transparent text-phosphor-white border border-circuit-border hover:border-phosphor-white hover:bg-ground-iron/40 rounded-buttons",
      // Ghost: transparent fill, no border until hover
      ghost:
        "bg-transparent text-sage-60 hover:text-phosphor-white hover:bg-ground-iron/60 rounded-buttons border border-transparent",
      // Pill Ghost Link: 9999px radius, #485346 border, #859984 text
      link:
        "bg-transparent text-fern-link border border-circuit-border/60 hover:border-circuit-border hover:text-phosphor-white rounded-pills",
    };

    const sizes = {
      sm: "text-caption py-1.5 px-3 gap-1.5",
      md: "text-body-sm py-2.5 px-5 gap-2",
      lg: "text-body py-3 px-7 gap-2.5",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
        {...props}
      >
        {isLoading ? (
          <span className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin shrink-0" />
        ) : (
          leftIcon && <span className="shrink-0 flex items-center">{leftIcon}</span>
        )}
        <span>{children}</span>
        {!isLoading && rightIcon && (
          <span className="shrink-0 flex items-center">{rightIcon}</span>
        )}
      </button>
    );
  }
);

Button.displayName = "Button";
