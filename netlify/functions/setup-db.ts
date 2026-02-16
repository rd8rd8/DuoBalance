
import { neon } from "@netlify/neon";

const sql = neon(process.env.DATABASE_URL);

export default async (req: Request) => {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        color TEXT NOT NULL
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS batches (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        settled_at BIGINT NOT NULL,
        total_ricardo REAL NOT NULL,
        total_rafaela REAL NOT NULL,
        balance REAL NOT NULL,
        payer_who_owes TEXT NOT NULL
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS expenses (
        id TEXT PRIMARY KEY,
        amount REAL NOT NULL,
        payer TEXT NOT NULL,
        date TEXT NOT NULL,
        category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
        description TEXT,
        created_at BIGINT NOT NULL,
        batch_id TEXT REFERENCES batches(id) ON DELETE CASCADE
      );
    `;

    // Initialize default categories if empty
    const categoryCount = await sql`SELECT COUNT(*) FROM categories`;
    if (categoryCount[0].count === '0') {
      const defaultCategories = [
        { id: crypto.randomUUID(), name: 'Alimentação', color: 'bg-blue-100 text-blue-700' },
        { id: crypto.randomUUID(), name: 'Casa', color: 'bg-orange-100 text-orange-700' },
        { id: crypto.randomUUID(), name: 'Lazer', color: 'bg-pink-100 text-pink-700' },
        { id: crypto.randomUUID(), name: 'Transporte', color: 'bg-green-100 text-green-700' },
        { id: crypto.randomUUID(), name: 'Saúde', color: 'bg-purple-100 text-purple-700' },
        { id: crypto.randomUUID(), name: 'Outros', color: 'bg-gray-100 text-gray-700' }
      ];

      for (const cat of defaultCategories) {
        await sql`INSERT INTO categories (id, name, color) VALUES (${cat.id}, ${cat.name}, ${cat.color})`;
      }
    }

    return new Response("Database initialized successfully", { status: 200 });
  } catch (error) {
    console.error(error);
    return new Response("Error initializing database: " + error.message, { status: 500 });
  }
};

export const config = {
  path: "/setup-db"
};
