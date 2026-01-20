

import { Category, InventoryItem, Client, ClientType, User, Installer } from './types';

export const MOCK_INVENTORY: InventoryItem[] = [];

export const MOCK_CLIENTS: Client[] = [];

export const MOCK_USERS: User[] = [
  {
    id: '1',
    username: 'admin',
    password: 'admin123',
    nickname: 'Admin',
    role: 'SUPER_ADMIN'
  }
];

export const APP_NAME = "SolarFlux Manager";