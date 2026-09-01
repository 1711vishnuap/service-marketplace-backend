const { pool } = require('../../config/db'); 
exports.getAllCategories = async (req, res, next) => { try { const [rows] = await 
    pool.query( 'SELECT id, name, icon FROM categories WHERE is_active = 1 ORDER BY name' );
     res.json({ success: true, data: rows }); } catch (err) { next(err); } };