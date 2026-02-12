
import { Category, AppState } from './types';

export const DEFAULT_CATEGORIES: Category[] = [
  { id: '1', name: 'Supermercado', color: 'bg-blue-100 text-blue-700' },
  { id: '2', name: 'Combustível', color: 'bg-orange-100 text-orange-700' },
  { id: '3', name: 'Prendas', color: 'bg-pink-100 text-pink-700' },
  { id: '4', name: 'Casa', color: 'bg-green-100 text-green-700' },
  { id: '5', name: 'Lazer', color: 'bg-purple-100 text-purple-700' },
  { id: '6', name: 'Outros', color: 'bg-gray-100 text-gray-700' }
];

export const INITIAL_STATE: AppState = {
  expenses: [],
  batches: [],
  categories: DEFAULT_CATEGORIES,
  users: {
    ricardo: 'Ricardo',
    rafaela: 'Rafaela'
  }
};

export const LOCAL_STORAGE_KEY = 'duobalance_v1';
