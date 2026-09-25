import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
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
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const dropdownRef = useRef<HTMLDivElement>(null);

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
      if (containerRef.current && !containerRef.current.contains(event.target as Node) &&
          !dropdownRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useLayoutEffect(() => {
    if (!isOpen) return;

    const updatePosition = () => {
      const trigger = containerRef.current;
      const dropdown = dropdownRef.current;
      if (!trigger || !dropdown) return;

      const rect = trigger.getBoundingClientRect();
      const margin = 8;
      const gap = 4;
      const viewport = window.visualViewport;
      const viewportLeft = viewport?.offsetLeft ?? 0;
      const viewportTop = viewport?.offsetTop ?? 0;
      const viewportWidth = viewport?.width ?? window.innerWidth;
      const viewportHeight = viewport?.height ?? window.innerHeight;
      const minLeft = viewportLeft + margin;
      const minTop = viewportTop + margin;
      const maxRight = viewportLeft + viewportWidth - margin;
      const maxBottom = viewportTop + viewportHeight - margin;
      const maxWidth = Math.max(0, viewportWidth - margin * 2);
      const width = Math.min(Math.max(rect.width, dropdown.scrollWidth + 2), maxWidth);
      const spaceBelow = Math.max(0, maxBottom - rect.bottom - gap);
      const spaceAbove = Math.max(0, rect.top - gap - minTop);
      const desiredHeight = Math.min(dropdown.scrollHeight + 2, 240);
      const upward = spaceBelow < desiredHeight && spaceAbove > spaceBelow;
      const maxHeight = Math.min(240, upward ? spaceAbove : spaceBelow);

      setDropdownStyle({
        position: 'fixed',
        left: Math.max(minLeft, Math.min(rect.left, maxRight - width)),
        top: Math.max(minTop, Math.min(
          upward ? rect.top - gap - Math.min(desiredHeight, maxHeight) : rect.bottom + gap,
          maxBottom - Math.min(desiredHeight, maxHeight)
        )),
        minWidth: Math.min(rect.width, maxWidth),
        maxWidth,
        maxHeight,
      });
    };

    updatePosition();
    const observer = new ResizeObserver(updatePosition);
    if (containerRef.current) observer.observe(containerRef.current);
    if (dropdownRef.current) observer.observe(dropdownRef.current);
    window.addEventListener('resize', updatePosition);
    document.addEventListener('scroll', updatePosition, true);
    window.visualViewport?.addEventListener('resize', updatePosition);
    window.visualViewport?.addEventListener('scroll', updatePosition);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updatePosition);
      document.removeEventListener('scroll', updatePosition, true);
      window.visualViewport?.removeEventListener('resize', updatePosition);
      window.visualViewport?.removeEventListener('scroll', updatePosition);
    };
  }, [isOpen, children]);

  const handleToggle = () => {
    if (!disabled) setIsOpen((prev) => !prev);
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

      {isOpen && createPortal(
        <div
          ref={dropdownRef}
          style={dropdownStyle}
          className="fixed z-[1000] w-max overflow-y-auto overflow-x-hidden whitespace-normal rounded-xl border border-gray-100 bg-white p-1 shadow-lg outline-none"
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
              <span className="min-w-0 [overflow-wrap:anywhere]">{option.label}</span>
              {String(value) === String(option.value) && (
                <span className="absolute right-3 flex items-center justify-center text-slate-700">
                  <Check className="h-4 w-4" />
                </span>
              )}
            </div>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}