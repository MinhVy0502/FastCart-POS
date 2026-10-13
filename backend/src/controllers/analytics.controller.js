const { QueryTypes } = require('sequelize');
const { Sale, Purchase, Product, Customer, sequelize } = require('../models');

const TZ = process.env.TZ_NAME || 'Asia/Ho_Chi_Minh';

const pad = (n) => String(n).padStart(2, '0');
const localDateKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const endOfDay = (d) => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; };
const num = (v) => Number(v) || 0;

const query = (sql, replacements) => sequelize.query(sql, { replacements, type: QueryTypes.SELECT });

/** Doanh thu, giá vốn, lợi nhuận của các hóa đơn hoàn tất trong khoảng thời gian. */
const summarize = async (userId, from, to) => {
  const [row] = await query(`
    WITH s AS (
      SELECT id, "finalAmount", discount FROM "Sales"
      WHERE "userId" = :userId AND status = 'COMPLETED' AND "createdAt" BETWEEN :from AND :to
    ), c AS (
      SELECT si."saleId", SUM(si.quantity * si."costPrice") AS cogs
      FROM "SaleItems" si JOIN s ON s.id = si."saleId" GROUP BY si."saleId"
    )
    SELECT COUNT(s.id) AS orders,
           COALESCE(SUM(s."finalAmount"), 0) AS revenue,
           COALESCE(SUM(s.discount), 0) AS discount,
           COALESCE(SUM(c.cogs), 0) AS cogs
    FROM s LEFT JOIN c ON c."saleId" = s.id
  `, { userId, from, to });
  const revenue = num(row.revenue);
  const cogs = num(row.cogs);
  const orders = num(row.orders);
  return {
    orders,
    revenue,
    discount: num(row.discount),
    cogs,
    profit: revenue - cogs,
    avgOrder: orders ? revenue / orders : 0
  };
};

/** Chuỗi doanh thu/lợi nhuận theo ngày hoặc tháng (điền 0 cho kỳ trống). */
const timeSeries = async (userId, from, to, unit = 'day') => {
  const rows = await query(`
    WITH s AS (
      SELECT id, "finalAmount", "createdAt" FROM "Sales"
      WHERE "userId" = :userId AND status = 'COMPLETED' AND "createdAt" BETWEEN :from AND :to
    ), c AS (
      SELECT si."saleId", SUM(si.quantity * si."costPrice") AS cogs
      FROM "SaleItems" si JOIN s ON s.id = si."saleId" GROUP BY si."saleId"
    )
    SELECT to_char(date_trunc(:unit, s."createdAt" AT TIME ZONE :tz), :fmt) AS bucket,
           COUNT(*) AS orders,
           SUM(s."finalAmount") AS revenue,
           SUM(s."finalAmount" - COALESCE(c.cogs, 0)) AS profit
    FROM s LEFT JOIN c ON c."saleId" = s.id
    GROUP BY bucket ORDER BY bucket
  `, { userId, from, to, tz: TZ, unit, fmt: unit === 'month' ? 'YYYY-MM' : 'YYYY-MM-DD' });

  const map = Object.fromEntries(rows.map(r => [r.bucket, r]));
  const out = [];
  const cursor = new Date(from);
  while (cursor <= to) {
    const key = unit === 'month' ? `${cursor.getFullYear()}-${pad(cursor.getMonth() + 1)}` : localDateKey(cursor);
    const r = map[key];
    const label = unit === 'month'
      ? `${pad(cursor.getMonth() + 1)}/${cursor.getFullYear()}`
      : `${cursor.getDate()}/${cursor.getMonth() + 1}`;
    out.push({ key, name: label, orders: num(r?.orders), revenue: num(r?.revenue), profit: num(r?.profit) });
    if (unit === 'month') { cursor.setDate(1); cursor.setMonth(cursor.getMonth() + 1); }
    else cursor.setDate(cursor.getDate() + 1);
  }
  return out;
};

const topProducts = (userId, from, to, limit = 10) => query(`
  SELECT p.id, p.name, p.sku, p."currentStock",
         SUM(si.quantity)::int AS quantity,
         SUM(si.quantity * si.price) AS revenue,
         SUM(si.quantity * (si.price - si."costPrice")) AS profit
  FROM "SaleItems" si
  JOIN "Sales" s ON s.id = si."saleId"
  JOIN "Products" p ON p.id = si."productId"
  WHERE s."userId" = :userId AND s.status = 'COMPLETED' AND s."createdAt" BETWEEN :from AND :to
  GROUP BY p.id ORDER BY quantity DESC LIMIT :limit
`, { userId, from, to, limit });

exports.getDashboardData = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const now = new Date();
    const todayStart = startOfDay(now);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const sevenDaysAgo = startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6));
    const thirtyDaysAgo = startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29));
    const end = endOfDay(now);

    const [today, month, chartData, top, totalRevenue, totalCost, totalProducts, lowStockRow, recentSales] = await Promise.all([
      summarize(userId, todayStart, end),
      summarize(userId, monthStart, end),
      timeSeries(userId, sevenDaysAgo, end, 'day'),
      topProducts(userId, thirtyDaysAgo, end, 5),
      Sale.sum('finalAmount', { where: { userId, status: 'COMPLETED' } }),
      Purchase.sum('totalAmount', { where: { userId } }),
      Product.count({ where: { userId } }),
      query(`SELECT COUNT(*)::int AS count FROM "Products" WHERE "userId" = :userId AND "currentStock" <= "minStock"`, { userId }),
      Sale.findAll({
        where: { userId },
        limit: 6,
        order: [['createdAt', 'DESC']],
        include: [{ model: Customer, as: 'customer', attributes: ['name'] }]
      })
    ]);

    res.json({
      success: true,
      data: {
        summary: {
          revenue: num(totalRevenue),
          cost: num(totalCost),
          products: totalProducts,
          lowStock: lowStockRow[0]?.count || 0
        },
        today,
        month,
        recentSales,
        chartData,
        topProducts: top.map(p => ({ ...p, revenue: num(p.revenue), profit: num(p.profit) }))
      }
    });
  } catch (err) { next(err); }
};

/** Báo cáo theo khoảng ngày: ?from=YYYY-MM-DD&to=YYYY-MM-DD */
exports.getReports = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const now = new Date();
    const from = req.query.from ? new Date(`${req.query.from}T00:00:00`) : new Date(now.getFullYear(), now.getMonth(), 1);
    const to = req.query.to ? new Date(`${req.query.to}T23:59:59.999`) : endOfDay(now);
    if (isNaN(from) || isNaN(to) || from > to) {
      return res.status(400).json({ success: false, message: 'Khoảng thời gian không hợp lệ' });
    }
    const days = Math.ceil((to - from) / 86400000);
    const unit = days > 92 ? 'month' : 'day';

    const [summary, series, top, slow, customers, categories, payments, cancelled, purchaseRow] = await Promise.all([
      summarize(userId, from, to),
      timeSeries(userId, from, to, unit),
      topProducts(userId, from, to, 10),
      query(`
        SELECT p.id, p.name, p.sku, p."currentStock",
               COALESCE(SUM(si.quantity) FILTER (WHERE s.id IS NOT NULL), 0)::int AS quantity
        FROM "Products" p
        LEFT JOIN "SaleItems" si ON si."productId" = p.id
        LEFT JOIN "Sales" s ON s.id = si."saleId" AND s.status = 'COMPLETED' AND s."createdAt" BETWEEN :from AND :to
        WHERE p."userId" = :userId
        GROUP BY p.id ORDER BY quantity ASC, p."currentStock" DESC LIMIT 10
      `, { userId, from, to }),
      query(`
        SELECT c.id, c.name, c.phone, COUNT(s.id)::int AS orders, SUM(s."finalAmount") AS spent
        FROM "Sales" s JOIN "Customers" c ON c.id = s."customerId"
        WHERE s."userId" = :userId AND s.status = 'COMPLETED' AND s."createdAt" BETWEEN :from AND :to
        GROUP BY c.id ORDER BY spent DESC LIMIT 10
      `, { userId, from, to }),
      query(`
        SELECT COALESCE(cat.name, 'Chưa phân loại') AS name, SUM(si.quantity * si.price) AS revenue
        FROM "SaleItems" si
        JOIN "Sales" s ON s.id = si."saleId"
        JOIN "Products" p ON p.id = si."productId"
        LEFT JOIN "Categories" cat ON cat.id = p."categoryId"
        WHERE s."userId" = :userId AND s.status = 'COMPLETED' AND s."createdAt" BETWEEN :from AND :to
        GROUP BY cat.name ORDER BY revenue DESC
      `, { userId, from, to }),
      query(`
        SELECT "paymentMethod" AS method, COUNT(*)::int AS orders, SUM("finalAmount") AS amount
        FROM "Sales"
        WHERE "userId" = :userId AND status = 'COMPLETED' AND "createdAt" BETWEEN :from AND :to
        GROUP BY "paymentMethod"
      `, { userId, from, to }),
      query(`
        SELECT COUNT(*)::int AS count, COALESCE(SUM("finalAmount"), 0) AS amount
        FROM "Sales" WHERE "userId" = :userId AND status = 'CANCELLED' AND "createdAt" BETWEEN :from AND :to
      `, { userId, from, to }),
      query(`
        SELECT COUNT(*)::int AS count, COALESCE(SUM("totalAmount"), 0) AS amount
        FROM "Purchases" WHERE "userId" = :userId AND "createdAt" BETWEEN :from AND :to
      `, { userId, from, to })
    ]);

    res.json({
      success: true,
      data: {
        range: { from: localDateKey(from), to: localDateKey(to), unit },
        summary: {
          ...summary,
          cancelledCount: cancelled[0].count,
          cancelledAmount: num(cancelled[0].amount),
          purchaseCount: purchaseRow[0].count,
          purchaseAmount: num(purchaseRow[0].amount)
        },
        series,
        topProducts: top.map(p => ({ ...p, revenue: num(p.revenue), profit: num(p.profit) })),
        slowProducts: slow,
        topCustomers: customers.map(c => ({ ...c, spent: num(c.spent) })),
        categories: categories.map(c => ({ ...c, revenue: num(c.revenue) })),
        payments: payments.map(p => ({ ...p, amount: num(p.amount) }))
      }
    });
  } catch (err) { next(err); }
};

/** Danh sách sản phẩm sắp hết hàng (dùng cho chuông thông báo). */
exports.getLowStock = async (req, res, next) => {
  try {
    const rows = await query(`
      SELECT id, name, sku, "currentStock", "minStock" FROM "Products"
      WHERE "userId" = :userId AND "currentStock" <= "minStock"
      ORDER BY "currentStock" ASC, name ASC LIMIT 50
    `, { userId: req.user.id });
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};
