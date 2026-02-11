import {
    useSensor,
    useSensors,
    PointerSensor,
    KeyboardSensor,
    DragStartEvent,
    DragEndEvent,
} from '@dnd-kit/core';
import {
    sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { useState } from 'react';
import { useStore } from '../store';

export function useBotDragAndDrop() {
    const activeBots = useStore((state) => state.activeBots);
    const reorderBots = useStore((state) => state.reorderBots);
    const [activeDragId, setActiveDragId] = useState<string | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 10,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragStart = (event: DragStartEvent) => {
        setActiveDragId(event.active.id as string);
        document.body.classList.add('is-dragging');
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveDragId(null);
        document.body.classList.remove('is-dragging');

        if (over && active.id !== over.id) {
            const oldIndex = activeBots.findIndex((bot) => bot.instanceId === active.id);
            const newIndex = activeBots.findIndex((bot) => bot.instanceId === over.id);
            reorderBots(oldIndex, newIndex);
        }
    };

    return {
        sensors,
        activeDragId,
        handleDragStart,
        handleDragEnd
    };
}
