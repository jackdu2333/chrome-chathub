import { useStore } from '../store';

export function useGridLayout() {
    const activeBots = useStore((state) => state.activeBots);

    const getGridClass = () => {
        const count = activeBots.length;
        if (count <= 1) return "grid-cols-1";

        if (count === 2) return "grid-cols-1 md:grid-cols-2";

        if (count === 3) return "grid-cols-1 md:grid-cols-2 lg:grid-cols-3";

        return "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";
    };

    return {
        getGridClass
    };
}
