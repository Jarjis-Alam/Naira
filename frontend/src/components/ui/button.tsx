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
    // Base styles: Inter Variable font, tight tracking, 200ms transition
    const base =
      "inline-flex items-center justify-center font-medium font-sans tracking-tight transition-all duration-200 select-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary-green";

    const variants = {
      // Primary Filled: #8CFF5A fill, #050605 text, 12px radius
      filled:
        "bg-primary-green text-void-black font-semibold border border-primary-green hover:bg-bright-green rounded-buttons shadow-none",
      // Accent Pill: #8CFF5A fill, #050605 text, 9999px pill radius
      accent:
        "bg-primary-green text-void-black font-semibold border border-primary-green hover:bg-bright-green rounded-pills shadow-none",
      // Outline / Secondary: dark elevated surface, 1px green border, off-white text
      outline:
        "bg-card-elevated/80 text-text-primary border border-green-border hover:border-primary-green hover:text-primary-green rounded-buttons",
      // Ghost: transparent fill, subtle hover
      ghost:
        "bg-transparent text-text-secondary hover:text-text-primary hover:bg-card-standard rounded-buttons border border-transparent",
      // Link: inline text link
      link:
        "bg-transparent text-primary-green hover:text-bright-green underline-offset-4 hover:underline rounded-none",
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
