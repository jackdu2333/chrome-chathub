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
            className="fixed z-50 bg-gray-800 border border-gray-700 rounded-lg shadow-xl py-1 min-w-[140px] animate-in fade-in zoom-in-95 duration-100 flex flex-col"
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
                onClick();
            }}
            className={cn(
                "w-full px-3 py-2 text-sm flex items-center gap-2 transition-colors text-left",
                danger
                    ? "text-red-400 hover:bg-red-500/10"
                    : "text-gray-300 hover:bg-gray-700 hover:text-white",
                className
            )}
        >
            {icon && <span className="w-4 h-4 flex items-center justify-center">{icon}</span>}
            <span className="flex-1">{children}</span>
        </button>
    );
}

export function ContextMenuSeparator() {
    return <div className="h-px bg-gray-700 my-1 w-full" />;
}
