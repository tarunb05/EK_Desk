"use client";

import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { type LucideIcon, ChevronDown, Check } from "lucide-react";
import { motion } from "motion/react";

// Adapted from the shadcn-style reference the user pasted (preetsuthar17's
// Select) -- re-themed onto this app's own tokens rather than the
// reference's --background/--primary/--accent-foreground set, which don't
// exist here. Two mappings aren't 1:1 renames:
//   - Reference "accent" means a subtle hover surface; this app's --accent
//     is the brand/primary blue (the Sign in button's color), a different
//     concept entirely. Hover states below use --surface-accent (the tint
//     table rows already hover to), not --accent, to avoid that collision.
//   - Reference "primary" (the selected-state color) maps to this app's
//     actual --accent, matching how every other selected/primary control
//     in the app already looks (primaryButtonClassName: bg-accent +
//     text-surface).
// Radius is capped at rounded-md (6px) -- CLAUDE.md's ceiling -- rather than
// the reference's rounded-ele/rounded-lg. The reference's tailwindcss-
// animate open/close classes are dropped (that package isn't installed and
// wasn't in the approved dependency list) in favor of this app's own
// animate-pop-in, already used by every other popover here.

const selectTriggerVariants = cva(
  "flex h-9 w-full items-center justify-between gap-3 rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink transition-colors placeholder:text-ink-muted outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1",
  {
    variants: {
      variant: {
        default: "hover:bg-surface-accent",
        outline: "border-2 hover:border-accent",
        ghost: "border-transparent hover:bg-surface-accent",
      },
      size: {
        sm: "h-8 p-2 text-xs gap-2",
        default: "h-9 p-3 gap-3",
        lg: "h-10 p-4 text-base gap-4",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

const Select = SelectPrimitive.Root;
const SelectGroup = SelectPrimitive.Group;

const SelectValue = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Value>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Value> & {
    placeholder?: string;
  }
>(({ className, placeholder, ...props }, ref) => (
  <SelectPrimitive.Value
    ref={ref}
    className={cn("select-none text-sm", className)}
    placeholder={
      placeholder && (
        <span className="select-none text-ink-muted">{placeholder}</span>
      )
    }
    {...props}
  />
));
SelectValue.displayName = SelectPrimitive.Value.displayName;

interface SelectTriggerProps
  extends React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>,
    VariantProps<typeof selectTriggerVariants> {
  icon?: LucideIcon;
  placeholder?: string;
}

const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  SelectTriggerProps
>(({ className, children, variant, size, icon: Icon, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn("group", selectTriggerVariants({ variant, size }), className)}
    {...props}
  >
    <div className="flex min-w-0 flex-1 items-center gap-2">
      {Icon ? <Icon size={16} className="shrink-0 text-ink-muted" /> : null}
      <span className="truncate">{children}</span>
    </div>
    <SelectPrimitive.Icon asChild>
      <ChevronDown
        size={16}
        className="shrink-0 text-ink-muted transition-transform duration-150 group-data-[state=open]:rotate-180"
      />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
));
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName;

interface SelectContentProps
  extends React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content> {
  position?: "popper" | "item-aligned";
}

const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  SelectContentProps
>(({ className, children, position = "popper", ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      className={cn(
        "animate-pop-in relative z-50 max-h-[300px] min-w-[8rem] overflow-hidden rounded-md border border-border bg-surface text-ink shadow-[0_1px_2px_rgba(0,0,0,.05)]",
        position === "popper" &&
          "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
        className,
      )}
      position={position}
      {...props}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.15 }}
      >
        <SelectPrimitive.Viewport
          className={cn(
            "max-h-[280px] overflow-y-auto p-1",
            position === "popper" &&
              "h-fit w-full min-w-[var(--radix-select-trigger-width)]",
          )}
        >
          {children}
        </SelectPrimitive.Viewport>
      </motion.div>
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
));
SelectContent.displayName = SelectPrimitive.Content.displayName;

const SelectLabel = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Label
    ref={ref}
    className={cn("px-3 py-2 text-2xs font-medium uppercase tracking-wide text-ink-muted", className)}
    {...props}
  />
));
SelectLabel.displayName = SelectPrimitive.Label.displayName;

interface SelectItemProps
  extends React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item> {
  icon?: LucideIcon;
}

const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  SelectItemProps
>(({ className, children, icon: Icon, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex w-full cursor-default select-none items-center rounded-md py-2 pl-3 pr-8 text-sm text-ink outline-none data-[highlighted]:bg-surface-accent data-[disabled]:pointer-events-none data-[disabled]:text-ink-muted data-[disabled]:opacity-50",
      className,
    )}
    {...props}
  >
    <span className="flex w-full items-center gap-2">
      {Icon ? <Icon size={16} className="shrink-0" /> : null}
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </span>
    <span className="absolute right-3 flex h-3.5 w-3.5 items-center justify-center text-accent">
      <SelectPrimitive.ItemIndicator>
        <Check size={16} />
      </SelectPrimitive.ItemIndicator>
    </span>
  </SelectPrimitive.Item>
));
SelectItem.displayName = SelectPrimitive.Item.displayName;

const SelectSeparator = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Separator
    ref={ref}
    className={cn("-mx-1 my-1 h-px bg-hairline", className)}
    {...props}
  />
));
SelectSeparator.displayName = SelectPrimitive.Separator.displayName;

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  selectTriggerVariants,
};
