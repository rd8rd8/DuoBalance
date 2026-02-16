
import { neon } from "@netlify/neon";

const sql = neon(process.env.DATABASE_URL);

export default async (req: Request) => {
  const url = new URL(req.url);
  const path = url.pathname.replace('/api', ''); // Simple routing
  const method = req.method;

  try {
    // --- GET DATA ---
    if (method === 'GET' && path === '/data') {
      const categories = await sql`SELECT * FROM categories`;
      const activeExpenses = await sql`
        SELECT 
          id, amount, payer, date, category_id as "categoryId", description, created_at as "createdAt"
        FROM expenses 
        WHERE batch_id IS NULL 
        ORDER BY created_at DESC
      `;
      
      const batchesData = await sql`
        SELECT 
          id, name, settled_at as "settledAt", total_ricardo as "totalRicardo", 
          total_rafaela as "totalRafaela", balance, payer_who_owes as "payerWhoOwes"
        FROM batches 
        ORDER BY settled_at DESC
      `;

      // For each batch, fetch its expenses (this is N+1 but fine for small scale)
      const batches = await Promise.all(batchesData.map(async (batch) => {
        const batchExpenses = await sql`
          SELECT 
            id, amount, payer, date, category_id as "categoryId", description, created_at as "createdAt"
          FROM expenses 
          WHERE batch_id = ${batch.id} 
          ORDER BY created_at DESC
        `;
        return { ...batch, expenses: batchExpenses };
      }));

      // Map DB bigints to numbers for JS
      const formatExpense = (e: any) => ({
        ...e,
        createdAt: Number(e.createdAt),
        amount: Number(e.amount)
      });

      const formatBatch = (b: any) => ({
        ...b,
        settledAt: Number(b.settledAt),
        totalRicardo: Number(b.totalRicardo),
        totalRafaela: Number(b.totalRafaela),
        balance: Number(b.balance),
        expenses: b.expenses.map(formatExpense)
      });

      return new Response(JSON.stringify({
        categories,
        expenses: activeExpenses.map(formatExpense),
        batches: batches.map(formatBatch)
      }), { 
        headers: { 'Content-Type': 'application/json' } 
      });
    }

    // --- ADD EXPENSE ---
    if (method === 'POST' && path === '/expenses') {
      const body = await req.json();
      const { id, amount, payer, date, categoryId, description, createdAt } = body;
      
      await sql`
        INSERT INTO expenses (id, amount, payer, date, category_id, description, created_at)
        VALUES (${id}, ${amount}, ${payer}, ${date}, ${categoryId}, ${description}, ${createdAt})
      `;
      return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
    }

    // --- DELETE EXPENSE ---
    if (method === 'DELETE' && path.startsWith('/expenses/')) {
      const id = path.split('/').pop();
      await sql`DELETE FROM expenses WHERE id = ${id}`;
      return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
    }

    // --- SETTLE ACCOUNTS (CREATE BATCH) ---
    if (method === 'POST' && path === '/batches') {
      const body = await req.json();
      const { id, name, settledAt, totalRicardo, totalRafaela, balance, payerWhoOwes } = body;

      // 1. Create Batch
      await sql`
        INSERT INTO batches (id, name, settled_at, total_ricardo, total_rafaela, balance, payer_who_owes)
        VALUES (${id}, ${name}, ${settledAt}, ${totalRicardo}, ${totalRafaela}, ${balance}, ${payerWhoOwes})
      `;

      // 2. Move active expenses to this batch
      await sql`
        UPDATE expenses 
        SET batch_id = ${id} 
        WHERE batch_id IS NULL
      `;

      return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
    }

    // --- REVERT BATCH ---
    if (method === 'DELETE' && path.startsWith('/batches/')) {
      const id = path.split('/').pop();

      // 1. Release expenses back to pool
      await sql`
        UPDATE expenses 
        SET batch_id = NULL 
        WHERE batch_id = ${id}
      `;

      // 2. Delete batch
      await sql`DELETE FROM batches WHERE id = ${id}`;

      return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
    }

    // --- ADD CATEGORY ---
    if (method === 'POST' && path === '/categories') {
      const body = await req.json();
      const { id, name, color } = body;
      await sql`INSERT INTO categories (id, name, color) VALUES (${id}, ${name}, ${color})`;
      return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
    }

    // --- DELETE CATEGORY ---
    if (method === 'DELETE' && path.startsWith('/categories/')) {
      const id = path.split('/').pop();
      await sql`DELETE FROM categories WHERE id = ${id}`;
      return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
    }

    // --- RESET ---
    if (method === 'DELETE' && path === '/reset') {
        await sql`DELETE FROM expenses`;
        await sql`DELETE FROM batches`;
        // Optionally reset categories? The app logic kept categories but just reset data. 
        // App logic: setState(INITIAL_STATE) which sets default categories.
        // So we should probably delete user categories and restore defaults, OR just delete all categories and let setup-db restore defaults next time, 
        // OR manually insert defaults here.
        // For safety, let's just clear expenses and batches for now, as that's the main data. 
        // But the user requested "LIMPAR TODOS OS DADOS".
        await sql`DELETE FROM categories`;
        // Re-seed defaults immediately or rely on setup endpoint.
        // Let's call the setup logic logic here or just leave empty and expect the FE to handle it?
        // Actually, the FE loads initial state.
        // Let's just delete for now.
        return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
    }

    return new Response("Not Found", { status: 404 });

  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};

export const config = {
  path: "/api/*"
};
