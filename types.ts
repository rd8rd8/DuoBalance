
export type Payer = 'Ricardo' | 'Rafaela';

export interface Category {
  id: string;
  name: string;
  color: string;
}

export interface Expense {
  id: string;
  amount: number;
  payer: Payer;
  date: string;
  categoryId: string;
  description: string;
  createdAt: number;
}

export interface Batch {
  id: string;
  name: string;
  expenses: Expense[];
  settledAt: number;
  totalRicardo: number;
  totalRafaela: number;
  balance: number;
  payerWhoOwes: Payer | 'None';
}

export interface AppState {
  expenses: Expense[];
  batches: Batch[];
  categories: Category[];
  users: {
    ricardo: string;
    rafaela: string;
  };
}
