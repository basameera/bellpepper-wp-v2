var formidable = require('formidable');
var database = require('./strict/database');
var pool = database.mysql_pool;
var dbname = database.dbname;
var aes = require('aes-cross');
var key = new Buffer(process.env.AES_KEY, 'binary');

module.exports = function (app) {

    app.get('/login', function (req, res) {
        res.sendFile(__dirname + '/public/login.html');
    });

    app.post('/login', function (req, res) {
        var form = new formidable.IncomingForm();
        form.parse(req, function (err, fields, files) {
            if (!err) {
                // console.log(fields);
                if (fields.username != '' && fields.password != '') {
                    // if (fields.username == 'sam' && fields.password == 'san') {

                    pool.getConnection(function (err, connection) {
                        if (err) {
                            errData = {
                                error: 1,
                                data: 'Internal Server Error'
                            }
                            res.status(SERVER_ERR).json(errData);
                        }
                        connection.query("SELECT id FROM `" + dbname + "`.portal_user WHERE db_username=? AND db_password=?;",
                            [fields.username, aes.encText(fields.password, key)],
                            function (err, result) {
                                connection.release();

                                if (!err) {
                                    if (result.length > 0) {
                                        req.session.user = "admin";
                                        req.session.admin = true;
                                        req.session.username = fields.username;
                                        res.redirect('/index');
                                    }
                                    else res.redirect('/');

                                } else {
                                    res.redirect('/');
                                }
                            });

                    });

                    // } else res.redirect('/');
                } else res.redirect('/');
            } else {
                res.redirect('/');
            }
        });
    });

    app.get('/logout', function (req, res) {
        req.session.destroy();
        res.redirect('/');
    });

    //other routes..
}