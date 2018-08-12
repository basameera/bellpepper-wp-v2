var formidable = require('formidable');
var database = require('./strict/database');
var pool = database.mysql_pool;
var dbname = database.dbname;
var aes = require('aes-cross');
var key = new Buffer(process.env.AES_KEY, 'binary');
var fs = require('fs');
var moment = require('moment');

/**
 * inject link to email
 * generate link parameter (code)
 * code expire time - mysql
 * reset webpage
 * reset invalid webpage
 */

//---------- Email NodeJS ----------
var nodeMailer = require('nodemailer')
let transporter = nodeMailer.createTransport({
	host: 'smtp.gmail.com',
	port: 465,
	secure: true,
	auth: {
		user: process.env.EMAIL,
		pass: process.env.EMAIL_PASSWORD
	}
});
///NOTE: use email-template package to inject data to the webpage
// var htmlstream = fs.createReadStream(__dirname + '/Email/email.html');
// var htmlstream = fs.readFileSync(__dirname+'/Email/email.html');

let confirmMailOptions = {
	headers: {
		'priority': 'high'
	},
	from: '"[DEV] Bellpepper WebPortal - Ceymoss" <dev@ceymoss.com>', // sender address - change to "bellpepper@ceymoss.com"
	to: '', // list of receivers
	subject: 'Confirm Email - Bellpepper WebPortal [Restaurant Name]', // Subject line
	text: '\n\nLet\' confirm your email, so you can enjoy our wonderful web platform. Click the link below to confirm your email.\n' // plain text body
	// html: htmlstream // html body
};

let resetMailOptions = {
	headers: {
		'priority': 'high'
	},
	from: '"[DEV] Bellpepper WebPortal - Ceymoss" <dev@ceymoss.com>', // sender address - change to "bellpepper@ceymoss.com"
	to: 'basameera.sjc@gmail.com', // list of receivers
	subject: 'Password Reset - Bellpepper WebPortal [Restaurant Name]', // Subject line
	text: '\n\nIt looks like you are trying to reset your password. Click the link below to reset your password.\n' // plain text body
	// html: htmlstream // html body
};

// transporter.sendMail(resetMailOptions, (error, info) => {
//     if (error) {
//         return console.log(error);
//     }
//     console.log('Message %s sent: %s', info.messageId, info.response);
// });

module.exports = function (app, auth, getRandom) {

	app.get('/invalid', function (req, res) {
		res.sendFile(__dirname + '/public/404.html');
	});

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

	// ---------- User management ----------
	app.get('/usermanage', auth, function (req, res) {
		res.sendFile(__dirname + '/html/usermanage.html');
	});

	app.get('/getusers', function (req, res) {
		pool.getConnection(function (err, connection) {
			connection.query("SELECT * FROM `" + dbname + "`.portal_user where status=0;",
				function (err, result) {
					connection.release();
					if (!err) {
						//console.log(result);
						var jarr = [];
						if (result.length > 0) {
							for (var x = 0; x < result.length; x++) {
								var job = {
									"NAME": result[x].db_username,
									"ID": result[x].id,
									"EMAIL": result[x].email
								}
								jarr.push(job);

							}

						}
						console.log(jarr);
						res.json(jarr);
					} else {
						res.end(err);
						console.error(err);
						// throw err;
					}
				});
		});

	});

	app.post('/registeruser', function (req, res) {

		const code = getRandom().toString();
		confirmMailOptions.text = 'Hi '+req.body.us+'!,'+confirmMailOptions.text+'\nhttp://localhost/auth/user/confirm/ler7wsd98fjv/email?code=' + code + '&email=' + req.body.email;
		confirmMailOptions.text += '\n\nEnjoy your browsing,\nBellpepper Team @ Ceymoss\n';
		confirmMailOptions.to = req.body.email;
		console.log(confirmMailOptions.text);
		transporter.sendMail(confirmMailOptions, (error, info) => {
			if (error) {
				res.json({ status: false });
				return console.log(error);
			}
			console.log('Message %s sent: %s', info.messageId, info.response);
			// res.json({ status: true });
			pool.getConnection(function (err, connection) {
				connection.query("INSERT INTO `" + dbname + "`.`portal_user` (`db_username`, `db_password`, `email`, `confirm_code`, `confirm_tm`) VALUES (?,?,?,?,NOW());",
					[req.body.us, aes.encText(req.body.pw, key), req.body.email, code],
					function (err, result) {
						connection.release();
						if (!err) {
							res.json({ status: true });
						} else {
							res.json({ status: false });
							console.error(err);
						}
					});
			});
		});

	});

	app.get('/auth/user/confirm/ler7wsd98fjv/email', function (req, res) {
		pool.getConnection(function (err, connection) {
			connection.query("SELECT * FROM `" + dbname + "`.`portal_user` where email=? and confirm_code=?;",
				[req.query.email, req.query.code],
				function (err, result) {
					connection.release();
					if (!err) {
						if (result.length > 0) {
							const user_id = result[0].id;
							const ctm = result[0].confirm_tm;
							pool.getConnection(function (err, connection) {
								connection.query("UPDATE `" + dbname + "`.`portal_user` SET `email_confirm`='1' WHERE `id`=?;",
									[user_id],
									function (err, result) {
										connection.release();
										if (!err) {
											res.redirect('/emailconfirmed');
										} else {
											res.redirect('/login');
											console.error(err);
										}
									});
							});
						} else {
							res.redirect('/invalid');
						}
					} else {
						res.redirect('/invalid');
						console.error(err);
					}
				});
		});
	});

	app.get('/emailconfirmed', function (req, res) {
		res.sendFile(__dirname + '/public/confirm.html');
	});

	app.delete('/deluser', function (req, res) {
		console.log(req.body);

		pool.getConnection(function (err, connection) {
			connection.query("SELECT * FROM `" + dbname + "`.`portal_user`;",
				[req.body.id],
				function (err, result) {
					connection.release();
					if (!err) {
						console.log('table len : ', result.length);
						if (result.length > 3) {//cant delete the last user
							pool.getConnection(function (err, connection) {
								connection.query("DELETE FROM `" + dbname + "`.`portal_user` WHERE `id`=?;",
									[req.body.id],
									function (err, result) {
										connection.release();
										if (!err) {
											res.json({ status: true });
										} else {
											res.json({ status: false });
											console.error(err);
											// throw err;
										}
									});
							});
						} else {
							res.json({ status: false });
						}
					} else {
						res.json({ status: false });
						console.error(err);
						// throw err;
					}
				});
		});
	});

	app.get('/forgotpassword', function (req, res) {
		res.sendFile(__dirname + '/public/forgot.html');
	});

	app.post('/resetpassword', function (req, res) {
		pool.getConnection(function (err, connection) {
			connection.query("SELECT * FROM `" + dbname + "`.`portal_user` where email=?;",
				[req.body.email],
				function (err, result) {
					connection.release();
					if (!err) {
						if (result.length > 0) {
							const code = getRandom().toString();
							resetMailOptions.text = 'Hi '+result[0].db_username+'!,'+resetMailOptions.text+'\n\nhttp://localhost/auth/user/reset/ssl_zY2sdgspN/password?code=' + code + '&email=' + req.body.email;
							resetMailOptions.text += '\nEnjoy your browsing,\nBellpepper Team @ Ceymoss\n';
							console.log(resetMailOptions.text);
							pool.getConnection(function (err, connection) {
								connection.query("UPDATE `" + dbname + "`.`portal_user` SET `reset_code`=?, `reset_tm`=NOW() WHERE `email`=?;",
									[code, req.body.email],
									function (err, result) {
										connection.release();
										if (!err) {

											transporter.sendMail(resetMailOptions, (error, info) => {
												if (error) {
													res.json({ status: false });
													return console.log(error);
												}
												console.log('Message %s sent: %s', info.messageId, info.response);
												res.json({ status: true });
											});
											// res.json({ status: true });


										} else {
											res.json({ status: false });
											console.error(err);
											//throw err;
										}
									});
							});
							// res.json({ status: true });
						}
						else {
							res.json({ status: false });
						}

					} else {
						res.json({ status: false });
						console.error(err);
						//throw err;
					}
				});
		});
	});

	app.get('/auth/user/reset/ssl_zY2sdgspN/password', function (req, res) {
		// console.log(req.query.code, req.query.email);

		// bellp.portal_user 
		pool.getConnection(function (err, connection) {
			connection.query("SELECT * FROM `" + dbname + "`.`portal_user` where email=? and reset_code=?;",
				[req.query.email, req.query.code],
				function (err, result) {
					connection.release();
					if (!err) {
						if (result.length > 0) {
							const id = result[0].id;
							const tm = result[0].reset_tm;
							var time_now = new Date();

							var startDate = moment(tm, 'YYYY-M-DD HH:mm:ss')
							var endDate = moment(time_now, 'YYYY-M-DD HH:mm:ss')
							var secondsDiff = endDate.diff(startDate, 'seconds')
							var minutesDiff = endDate.diff(startDate, 'minutes')

							if (minutesDiff < 10) {
								req.session.user_id = id;
								req.session.resetReady = true;
								req.session.email = req.query.email;

								// res.send('reset Ready');

								res.redirect('/resetpasswordnow')
							} else {
								res.send('Reset Timeout');
							}
						} else {
							res.send('Invalid User');
						}
					} else {
						res.redirect('/forgotpassword');
						console.error(err);
						//throw err;
					}
				});
		});
	});

	app.get('/resetpasswordnow', function (req, res) {
		if (req.session.user_id && req.session.resetReady) {
			res.sendFile(__dirname + '/public/resetpassword.html');
		} else {
			res.redirect('/forgotpassword');
		}
	});

	app.post('/resetpasswordnew', function (req, res) {

		var form = new formidable.IncomingForm();
		form.parse(req, function (err, fields, files) {
			if (!err) {
				if (fields.email != '' && fields.password1 != '' && fields.password2 != '' && fields.password2 == fields.password1 && req.session.email == fields.email && req.session.resetReady) {

					pool.getConnection(function (err, connection) {
						if (err) {
							errData = {
								error: 1,
								data: 'Internal Server Error'
							}
							res.status(SERVER_ERR).json(errData);
						}
						//UPDATE `bellp`.`portal_user` SET `db_password`='sdf' WHERE `id`='20';
						connection.query("UPDATE `" + dbname + "`.portal_user SET `db_password`=? WHERE `id`=?;",
							[aes.encText(fields.password1, key), req.session.user_id],
							function (err, result) {
								connection.release();
								if (!err) {

									req.session.resetReady = false;
									res.redirect('/login');
								} else {
									res.redirect('/resetpasswordnow');
								}
							});
					});
				} else res.redirect('/resetpasswordnow');
			} else {
				res.redirect('/resetpasswordnow');
			}
		});
	});
}

