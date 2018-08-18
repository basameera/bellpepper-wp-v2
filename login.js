var formidable = require('formidable');
var database = require('./strict/database');
var pool = database.mysql_pool;
var dbname = database.dbname;
var aes = require('aes-cross');
var key = new Buffer(process.env.AES_KEY, 'binary');
var fs = require('fs');
var moment = require('moment');
var randomstring = require("randomstring");
var Readable = require('stream').Readable

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
	text: '\n\nLet\'s confirm your email, so you can enjoy our wonderful web platform. Click the link below to confirm your email.\n', // plain text body
	html: null // html body
};

let resetMailOptions = {
	headers: {
		'priority': 'high'
	},
	from: '"[DEV] Bellpepper WebPortal - Ceymoss" <dev@ceymoss.com>', // sender address - change to "bellpepper@ceymoss.com"
	to: '', // list of receivers
	subject: 'Password Reset - Bellpepper WebPortal [Restaurant Name]', // Subject line
	text: '\n\nIt looks like you are trying to reset your password. Click the link below to reset your password.\n', // plain text body
	html: null // html body
};

// transporter.sendMail(resetMailOptions, (error, info) => {
//     if (error) {
//         return console.log(error);
//     }
//     console.log('Message %s sent: %s', info.messageId, info.response);
// });

module.exports = function (app, auth, getRandom) {

	//404 page
	app.get('/invalid', function (req, res) {
		res.sendFile(__dirname + '/public/404.html');
	});

	//send login page
	app.get('/login', function (req, res) {
		res.sendFile(__dirname + '/public/login.html');
	});

	//process login
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
						connection.query("SELECT id, email_confirm FROM `" + dbname + "`.portal_user WHERE db_username=? AND db_password=?",
							[fields.username, aes.encText(fields.password, key)],
							function (err, result) {
								connection.release();

								if (!err) {
									if (result.length > 0) {
										if (result[0].email_confirm == '1') {
											req.session.user = "admin";
											req.session.admin = true;
											req.session.username = fields.username;
											req.session.usid = result[0].id;
											res.redirect('/index');
										}
										else {
											res.sendFile(__dirname + '/public/pleaseconfirmemail.html');
											// res.send('pleaseconfirmemail');
										}
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

	// logout
	app.get('/logout', function (req, res) {
		req.session.destroy();
		res.redirect('/');
	});

	// ---------- User management ----------
	// 
	app.get('/usermanage', auth, function (req, res) {
		res.sendFile(__dirname + '/html/usermanage.html');
	});
	// query all users
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
								var con = 'btn btn-danger btn-simple btn-xs'
								if (parseInt(result[x].email_confirm) == 1) con = 'btn btn-success btn-simple btn-xs'
								var job = {
									"NAME": result[x].db_username,
									"ID": result[x].id,
									"CON": con,
									"EMAIL": result[x].email
								}
								jarr.push(job);

							}

						}
						// console.log(jarr);
						res.json(jarr);
					} else {
						res.end(err);
						console.error(err);
						// throw err;
					}
				});
		});

	});

	// register a new user - insert data to db & send the confirmation email
	app.post('/registeruser', function (req, res) {
		const code = getRandom().toString();
		const confirmLink = randomstring.generate(10);
		var confirm_URL = 'http://' + process.env.HOST_URL + '/auth/user/confirm/' + confirmLink + '/email?code=' + code + '&email=' + req.body.email;
		confirmMailOptions.text = 'Hi ' + req.body.us + '!,' + confirmMailOptions.text + '\n';
		confirmMailOptions.text += '\n\nEnjoy your browsing,\nBellpepper Team @ Ceymoss\n';
		confirmMailOptions.to = req.body.email;

		console.log(confirm_URL);
		fs.readFile(__dirname + '/Email/confirm_email_1.html', (err, data1) => {
			if (err) throw err;
			// console.log(data.toString());
			fs.readFile(__dirname + '/Email/confirm_email_2.html', (err, data2) => {
				if (err) throw err;
				var emailData = data1.toString() + confirm_URL + data2.toString()
				var s = new Readable
				s.push(emailData)    // the string you want
				s.push(null)
				confirmMailOptions.html = s;
				transporter.sendMail(confirmMailOptions, (error, info) => {
					if (error) {
						res.json({ status: false });
						return console.log(error);
					}
					console.log('Message %s sent: %s', info.messageId, info.response);
					// res.json({ status: true });


					pool.getConnection(function (err, connection) {
						connection.query("INSERT INTO `" + dbname + "`.`portal_user` (`db_username`, `db_password`, `email`, `confirm_code`, `confirm_tm`, `confirm_link`) VALUES (?, ?, ?, ?, NOW(), ?);",
							[req.body.us, aes.encText(req.body.pw, key), req.body.email, code, confirmLink],
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
		});

	});

	// confirmation email link
	app.get('/auth/user/confirm/:confirmlink/email', function (req, res) {
		pool.getConnection(function (err, connection) {
			connection.query("SELECT * FROM `" + dbname + "`.`portal_user` where email=? and confirm_code=? and confirm_link=?;",
				[req.query.email, req.query.code, req.params.confirmlink],
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

	// Email confirmation SUccess link
	app.get('/emailconfirmed', function (req, res) {
		res.sendFile(__dirname + '/public/confirm.html');
	});

	// delete users
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

	//forgot password page
	app.get('/forgotpassword', function (req, res) {
		res.sendFile(__dirname + '/public/forgot.html');
	});

	// reset password - insert to DB & send reset email
	app.post('/resetpassword', function (req, res) {
		pool.getConnection(function (err, connection) {
			connection.query("SELECT * FROM `" + dbname + "`.`portal_user` where email=?;",
				[req.body.email],
				function (err, result) {
					connection.release();
					if (!err) {
						if (result.length > 0) {
							const code = getRandom().toString();
							const resetLink = randomstring.generate(10);
							var reset_URL = 'http://' + process.env.HOST_URL + '/auth/user/reset/' + resetLink + '/password?code=' + code + '&email=' + req.body.email;
							resetMailOptions.text = 'Hi ' + result[0].db_username + '!,' + resetMailOptions.text + '\n\n' + reset_URL;
							resetMailOptions.text += '\nEnjoy your browsing,\nBellpepper Team @ Ceymoss\n';
							resetMailOptions.to = req.body.email;
							console.log(reset_URL);

							fs.readFile(__dirname + '/Email/reset_email_1.html', (err, data1) => {
								if (err) throw err;
								// console.log(data.toString());
								fs.readFile(__dirname + '/Email/reset_email_2.html', (err, data2) => {
									if (err) throw err;
									var emailData = data1.toString() + reset_URL + data2.toString()
									var s = new Readable
									s.push(emailData)    // the string you want
									s.push(null)
									resetMailOptions.html = s;
									transporter.sendMail(resetMailOptions, (error, info) => {
										if (error) {
											res.json({ status: false });
											return console.log(error);
										}
										console.log('Message %s sent: %s', info.messageId, info.response);

										pool.getConnection(function (err, connection) {
											connection.query("UPDATE `" + dbname + "`.`portal_user` SET `reset_code`=?, `reset_tm`=NOW(), `reset_link`=? WHERE `email`=?;",
												[code, resetLink, req.body.email],
												function (err, result) {
													connection.release();
													if (!err) {
														res.json({ status: true });
													} else {
														res.json({ status: false });
														console.error(err);
														//throw err;
													}
												});
										});
									});
								});
							});

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

	// reset email link

	app.get('/auth/user/reset/:resetlink/password', function (req, res) {
		// console.log(req.query.code, req.query.email);

		// bellp.portal_user 
		pool.getConnection(function (err, connection) {
			connection.query("SELECT * FROM `" + dbname + "`.`portal_user` where email=? and reset_code=? and reset_link=?;",
				[req.query.email, req.query.code, req.params.resetlink],
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

	//new password page
	app.get('/resetpasswordnow', function (req, res) {
		if (req.session.user_id && req.session.resetReady) {
			res.sendFile(__dirname + '/public/resetpassword.html');
		} else {
			res.redirect('/forgotpassword');
		}
	});

	// insert the new password to the DB
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

	// app.get('/auth/user/reset/:resetcode/password', function (req, res) {
	// 	res.send(req.params)
	// });
}

