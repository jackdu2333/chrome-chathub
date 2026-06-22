import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ChatFrame } from './ChatFrame';
import type { ChatBot } from '../types';

interface SortableChatFrameProps {
    bot: ChatBot;
    isFocused: boolean;
    onToggleFocus: () => void;
    onRemove: () => void;
    onSetPrimary?: () => void;
}

export function SortableChatFrame({ bot, isFocused, onToggleFocus, onRemove, onSetPrimary }: SortableChatFrameProps) {

    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({
        id: bot.instanceId,
        disabled: isFocused // CRITICAL: Disable DnD when focused to prevent transform/layout interference
    });

    // Apply transform and transition to the wrapper
    const style = {
        // use Translate instead of Transform to avoid scaling issues
        // When focused, we MUST NOT apply ANY transform, as it creates a new stacking context
        // which breaks fixed positioning (popup becomes relative to this wrapper instead of viewport)
        transform: isFocused ? undefined : CSS.Translate.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1, // Visual feedback for original item leaving
        zIndex: isDragging ? 50 : 'auto', // Ensure dragging item is above others
        position: 'relative' as const,
        height: '100%', // FORCE height to fill grid cell
    };

    return (
        // Attributes belong on the root draggable element
        // Listeners belong on the handle (passed via ChatFrame)
        <div
            ref={setNodeRef}
            style={{ ...style, height: '100%', width: '100%' }} // Enforce 100% dimensions
            {...attributes}
            // Only attach listeners if NOT focused. This allows text selection in header when focused.
            // But wait, the listeners are on the header handle usually.
            // If main drag is disabled, we should probably disable useSortable?
            // dnd-kit `useSortable` has `disabled` prop.
            className="flex flex-col min-h-0 min-w-0 touch-none outline-none"
        >
            <ChatFrame
                bot={bot}
                isFocused={isFocused}
                onToggleFocus={onToggleFocus}
                onRemove={onRemove}
                onSetPrimary={onSetPrimary}
                // Pass listeners only if NOT focused
                dragListeners={!isFocused ? listeners : undefined}
                isDragging={isDragging}
            />
        </div>
    );
}
