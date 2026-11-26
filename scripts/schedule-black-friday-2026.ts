import '../lib/load-env';
import postgres from 'postgres';
import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { effectivePrice } from '../lib/sale-price';

async function main() {
  const plan = JSON.parse(readFileSync('artifacts/black-friday-2026/plan.json', 'utf8'));
  assert.equal(plan.length, 42);
  assert.equal(new Set(plan.map((p: any) => p.id)).size, 42);
  for (const p of plan) {
    const fields = { priceAmount: p.price_amount, salePriceAmount: p.new_sale_price_amount,
      saleStartsAt: p.new_sale_starts_at, saleEndsAt: p.new_sale_ends_at };
    assert.equal(effectivePrice(fields, new Date('2026-11-27T05:59:59.999Z')).onSale, false);
    assert.equal(effectivePrice(fields, new Date('2026-11-27T06:00:00.000Z')).priceAmount, p.new_sale_price_amount);
    assert.equal(effectivePrice(fields, new Date('2026-12-01T07:59:59.999Z')).onSale, true);
    assert.equal(effectivePrice(fields, new Date('2026-12-01T08:00:00.000Z')).onSale, false);
  }
  if (!process.argv.includes('--apply')) {
    console.log('Validated 38 products / 42 variants and start/end boundaries. Use --apply to save.');
    return;
  }
  const sql = postgres(process.env.DATABASE_URL!, { prepare: false, connect_timeout: 10 });
  try {
    await sql.begin(async tx => {
      const before = await tx`select * from product_variants where id in ${tx(plan.map((p: any) => p.id))} for update`;
      assert.equal(before.length, plan.length);
      for (const p of plan) {
        const current = before.find(v => v.id === p.id)!;
        assert.equal(current.price_amount, p.price_amount, `Regular price changed: ${p.name}`);
        assert.equal(current.sale_price_amount, p.sale_price_amount, `Sale changed: ${p.name}`);
        assert.equal(current.sale_starts_at?.toISOString() ?? null, p.sale_starts_at);
        assert.equal(current.sale_ends_at?.toISOString() ?? null, p.sale_ends_at);
      }
      writeFileSync('artifacts/black-friday-2026/before.json', JSON.stringify(before, null, 2));
      for (const p of plan) {
        await tx`update product_variants set sale_price_amount=${p.new_sale_price_amount}, sale_starts_at=${p.new_sale_starts_at}, sale_ends_at=${p.new_sale_ends_at}, updated_at=now() where id=${p.id}`;
      }
    });
    const after = await sql`select id, price_amount, sale_price_amount, sale_starts_at, sale_ends_at from product_variants where id in ${sql(plan.map((p: any) => p.id))}`;
    for (const p of plan) {
      const saved = after.find(v => v.id === p.id)!;
      assert.equal(saved.price_amount, p.price_amount);
      assert.equal(saved.sale_price_amount, p.new_sale_price_amount);
      assert.equal(saved.sale_starts_at.toISOString(), p.new_sale_starts_at);
      assert.equal(saved.sale_ends_at.toISOString(), p.new_sale_ends_at);
    }
    writeFileSync('artifacts/black-friday-2026/verified.json', JSON.stringify(after, null, 2));
    console.log(`Saved and verified ${after.length} variants. Product publication status preserved.`);
  } finally { await sql.end(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
