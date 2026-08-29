import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '@/utils/cn';

interface CustomSelectProps {
  value?: string | number;
  onChange?: (e: { target: { value: string } }) => void;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}

export function CustomSelect({
  value,
  onChange,
  children,
  className,
  disabled
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // Extract options from children
  const options = React.Children.toArray(children)
    .filter((child): child is React.ReactElement<React.OptionHTMLAttributes<HTMLOptionElement>> => 
      React.isValidElement(child) && child.type === 'option'
    )
    .map(child => ({
      value: child.props.value as string,
      label: child.props.children as React.ReactNode,
      disabled: child.props.disabled as boolean | undefined
    }));

    const dropdownOptions = options.filter(
  (option) => String(option.value) !== ""
);

  const selectedOption = options.find(opt => String(opt.value) === String(value)) || options[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggle = () => {
  if (disabled) return;

  if (!isOpen) {
    const rect = containerRef.current?.getBoundingClientRect();

    if (rect) {
      const dropdownHeight = Math.min(dropdownOptions.length * 40 + 8, 240);
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;

      setOpenUpward(
        spaceBelow < dropdownHeight && spaceAbove > spaceBelow
      );
    }
  }

  setIsOpen((prev) => !prev);
};

  const handleSelect = (optionValue: string) => {
    if (onChange) {
      // Mock native select onChange event
      onChange({ target: { value: optionValue } });
    }
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className={cn("relative w-full", className && className.match(/mt-\d(\.\d)?/)?.[0])}>
      <button
        type="button"
        disabled={disabled}
        // onClick={() => !disabled && setIsOpen(!isOpen)}
        onClick={handleToggle}
        className={cn(
          "flex w-full items-center justify-between rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-normal text-gray-900 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-slate-800/20 focus:border-slate-800 disabled:cursor-not-allowed disabled:opacity-50",
          isOpen && "border-slate-800 ring-2 ring-slate-800/20",
          className?.replace(/mt-\d(\.\d)?/, '') // Extract mt-* to wrapper
        )}
      >
        <span className="truncate">{selectedOption?.label}</span>
        <ChevronDown className={cn("ml-2 h-4 w-4 text-gray-500 transition-transform duration-200 shrink-0", isOpen && "rotate-180")} />
      </button>

      {isOpen && (
        // <div className="absolute z-50 mt-1 min-w-full w-max whitespace-nowrap max-h-60 overflow-auto rounded-xl border border-gray-100 bg-white p-1 shadow-lg outline-none animate-in fade-in zoom-in-95">
        <div
  className={cn(
    "absolute z-50 min-w-full w-max whitespace-nowrap max-h-60 overflow-auto rounded-xl border border-gray-100 bg-white p-1 shadow-lg outline-none animate-in fade-in zoom-in-95",
    openUpward
      ? "bottom-full mb-1"
      : "top-full mt-1"
  )}
>
          
        {dropdownOptions.map((option, index) => (
            <div
              key={index}
            //   onClick={() => !option.disabled && handleSelect(option.value)}
            onMouseDown={(event) => {
  event.preventDefault();
  event.stopPropagation();

  if (!option.disabled) {
    handleSelect(option.value);
  }
}}
              className={cn(
                "relative flex w-full cursor-pointer select-none items-center rounded-lg py-2 pl-3 pr-9 text-sm text-gray-700 outline-none transition-colors hover:bg-gray-100 hover:text-gray-900",
                option.disabled && "cursor-not-allowed opacity-50",
                String(value) === String(option.value) && "bg-slate-100 text-slate-900 font-normal"
              )}
            >
              <span>{option.label}</span>
              {String(value) === String(option.value) && (
                <span className="absolute right-3 flex items-center justify-center text-slate-700">
                  <Check className="h-4 w-4" />
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}