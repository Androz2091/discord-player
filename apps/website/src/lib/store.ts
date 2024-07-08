import { docs } from './docs';

export const DocumentationStore = {
    libraries: Object.values(docs.modules),
    libNames: Object.values(docs.modules).map((m) => m.name),
};
