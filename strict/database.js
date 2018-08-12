if (process.env.NODE_ENV !== 'production') {
    require('dotenv').load();
}

var mysql = require('mysql');
var dbname = process.env.DB_NAME//'asiri';

var connection = mysql.createPool({
    connectionLimit: 100,
    host: process.env.DB_HOST,//'127.0.0.1',
    user: process.env.DB_USER,//'root',
    password: process.env.DB_PASSWORD,//'earlteknkas',
    database: dbname,
    port: 3306,
    debug: false,
    multipleStatements: true
});

/// NOTE : set ENV variables for production in Heroku

// module.exports.mysql_pool = connection;
// console.log(connection.config.connectionConfig.host)
module.exports = {
    mysql_pool: connection,
    dbname: dbname
}