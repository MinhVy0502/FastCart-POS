const { Op } = require('sequelize');

/** Đọc page/limit từ query, giới hạn limit tối đa. */
exports.getPaging = (query, defaultLimit = 20, maxLimit = 500) => {
  const page = Math.max(parseInt(query.page) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit) || defaultLimit, 1), maxLimit);
  return { page, limit, offset: (page - 1) * limit };
};

exports.buildPagination = (count, page, limit) => ({
  total: count,
  page,
  limit,
  totalPages: Math.max(Math.ceil(count / limit), 1)
});

/**
 * Chuyển from/to (YYYY-MM-DD, giờ địa phương) thành điều kiện createdAt.
 * Trả về undefined nếu không có bộ lọc.
 */
exports.dateRange = (from, to) => {
  const cond = {};
  if (from) cond[Op.gte] = new Date(`${from}T00:00:00`);
  if (to) cond[Op.lte] = new Date(`${to}T23:59:59.999`);
  return Object.getOwnPropertySymbols(cond).length ? cond : undefined;
};

/** Sinh mã chứng từ: tiền tố + yyMMdd + 6 ký tự ngẫu nhiên. */
exports.generateCode = (prefix) => {
  const d = new Date();
  const ymd = `${String(d.getFullYear()).slice(-2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${prefix}${ymd}${rand}`;
};

exports.toNumber = (v, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};
