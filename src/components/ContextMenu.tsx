import { useRef, useEffect } from 'react';
import { cn } from '../lib/utils';

interface ContextMenuProps {
    x: number;
    y: number;
    onClose: () => void;
    children: React.ReactNode;
}

export function ContextMenu({ x, y, onClose, children }: ContextMenuProps) {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (ref.current && !ref.current.contains(event.target as Node)) {
                onClose();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [onClose]);

    // Simple bounds checking to keep menu on screen
    const adjustedX = Math.min(x, window.innerWidth - 160);
    const adjustedY = Math.min(y, window.innerHeight - 200);

    return (
        <div
            ref={ref}
            className="fixed z-50 min-w-[160px] py-1.5 flex flex-col rounded-xl border shadow-xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-100 bg-white/90 dark:bg-[#1e1e1e]/90 border-black/5 dark:border-white/10"
            style={{ top: adjustedY, left: adjustedX }}
            onClick={(e) => e.stopPropagation()}
        >
            {children}
        </div>
    );
}

interface ContextMenuItemProps {
    onClick: () => void;
    icon?: React.ReactNode;
    children: React.ReactNode;
    danger?: boolean;
    className?: string;
}

export function ContextMenuItem({ onClick, icon, children, danger, className }: ContextMenuItemProps) {
    return (
        <button
            onClick={(e) => {
                e.stopPropagation();
                // Close menu first (handled by parent click outside or specific logic depending on usage, 
                // but usually the action triggers a state change that closes it)
                onClick();
            }}
            className={cn(
                "mx-1.5 my-0.5 px-2 py-1.5 text-[13px] flex items-center gap-2 rounded-[6px] transition-colors text-left font-medium select-none",
                danger
                    ? "text-red-500 hover:bg-red-500 hover:text-white dark:text-red-400 dark:hover:bg-red-500/90 dark:hover:text-white"
                    : "text-gray-700 dark:text-gray-200 hover:bg-blue-500 hover:text-white dark:hover:bg-blue-500",
                className
            )}
        >
            {icon && <span className="w-3.5 h-3.5 flex items-center justify-center -ml-0.5">{icon}</span>}
            <span className="flex-1 truncate">{children}</span>
        </button>
    );
}

export function ContextMenuSeparator() {
    return <div className="h-px bg-black/5 dark:bg-white/10 my-1.5 w-full" />;
}
