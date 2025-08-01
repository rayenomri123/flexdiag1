module.exports.up = function(db) {
  db.run(`
    CREATE TABLE IF NOT EXISTS network_setup (
      interface   TEXT PRIMARY KEY,
      ip_host     TEXT NOT NULL,
      subnet      TEXT NOT NULL,
      pool_val1   TEXT NOT NULL,
      pool_val2   TEXT NOT NULL
    )
  `, err => {
    if (err) console.error('Error creating network_setup table:', err);
    else console.log('network_setup table is ready');
  });
};