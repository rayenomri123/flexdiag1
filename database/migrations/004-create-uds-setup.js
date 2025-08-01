module.exports.up = function(db) {
  db.run(`
    CREATE TABLE IF NOT EXISTS uds_setup (
      logical_add TEXT PRIMARY KEY
    )
  `, err => {
    if (err) console.error('Error creating uds_setup table:', err);
    else console.log('uds_setup table is ready');
  });
};