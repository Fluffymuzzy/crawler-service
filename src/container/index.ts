import 'reflect-metadata';
import { configureContainer } from './container.config';
import { TYPES } from './types';

// Create and configure container
const container = configureContainer();

// Export for use in the app
export { container, TYPES };
