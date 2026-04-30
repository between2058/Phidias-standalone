import * as React from 'react';
import { cn } from '@/lib/utils';

export interface SwitchProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label?: React.ReactNode;
  labelPosition?: 'left' | 'right';
  disabled?: boolean;
}

/**
 * Shadcn/ui-style Switch component.
 *
 * A control that allows the user to toggle between checked and not checked.
 *
 * @example
 * <Switch
 *   checked={enabled}
 *   onCheckedChange={setEnabled}
 *   label="Enable notifications"
 * />
 */
export const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  (
    {
      checked,
      onCheckedChange,
      label,
      labelPosition = 'left',
      disabled = false,
      className,
      ...props
    },
    ref
  ) => {
    const handleClick = React.useCallback(() => {
      if (!disabled) {
        onCheckedChange(!checked);
      }
    }, [checked, disabled, onCheckedChange]);

    // Label can be on left or right, default left for forms
    const showLabelLeft = label && labelPosition === 'left';
    const showLabelRight = label && labelPosition === 'right';

    // When no label, render just the toggle button (for external layout control)
    const toggleButton = (
      <button
        ref={ref}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={handleClick}
        className={cn(
          'relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7c3aed] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1a1a2e]',
          checked ? 'bg-[#7c3aed]' : 'bg-[#3a3d52]',
          disabled && 'opacity-50 cursor-not-allowed',
          className
        )}
        {...props}
      >
        <span
          className={cn(
            'absolute h-3.5 w-3.5 rounded-full bg-white shadow-sm',
            'transition-all duration-200 ease-in-out',
            checked ? 'left-[18px]' : 'left-[2px]'
          )}
        />
      </button>
    );

    // No label: return just the toggle for external layout control
    if (!label) {
      return toggleButton;
    }

    // With label: wrap in label element
    return (
      <label
        className={cn(
          'inline-flex items-center gap-3 select-none',
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
        )}
      >
        {showLabelLeft && (
          <span className="text-xs text-[#94a3b8]">{label}</span>
        )}

        {toggleButton}

        {showLabelRight && (
          <span className="text-xs text-[#94a3b8]">{label}</span>
        )}
      </label>
    );
  }
);

Switch.displayName = 'Switch';

export default Switch;
