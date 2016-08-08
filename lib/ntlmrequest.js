'use strict';

const request = require('request'),
	extend = require('extend'),
	ntlm = require('./ntlm');


function ntlmRequest(opts) {
	if (opts === undefined
		|| !'uri' in opts
		|| !'method' in opts
		|| !'username' in opts
		|| !'password' in opts) {
		throw new Error('Required options missing');
	}

	let ntlmState = {
			status: 0,
			data: null
		},
		ntlmRequestObj = request.defaults({
			jar: true,
			forever: true,
			headers: {
				'User-Agent': 'node.js',
				'Accept': '*/*',
				'Connection': 'keep-alive'
			}
		});

	function createRequestOptions(authHeader) {
		let obj = {
			uri: opts.uri,
			method: opts.method
		};

		if (opts.request) {
			extend(true, obj, opts.request, {
				headers: {
					'Authorization': authHeader
				}
			});
		}

		return obj;
	}

	function sendRequest(resolve, reject, err, res, body) {
		let authHeader;

		if (ntlmState.status === 0) {
			authHeader = undefined;
		} else if (ntlmState.status === 1) {
			if (err || !res) {
				return reject(err || new Error('No response received'));
			}

			if (res.statusCode === 401) {
				let supportedAuthSchemes = [];

				for (let i = 0; i < res.rawHeaders.length; i = i + 2) {
					let headerName = res.rawHeaders[i].toLowerCase(),
						headerValue = res.rawHeaders[i + 1];

					if (headerName === 'www-authenticate') {
						headerValue.split(',').forEach((authMethod) => {
							authMethod = authMethod.trim();

							if (!/^[^\s=]+=.+/.test(authMethod)) {
								supportedAuthSchemes.push(authMethod.split(/\s/)[0].toLowerCase());
							}
						});
					}
				}

				if (supportedAuthSchemes.indexOf('ntlm') !== -1) {
					authHeader = ntlm.createType1Message();
				} else if (supportedAuthSchemes.indexOf('basic') !== -1) {
					authHeader = 'Basic ' + new Buffer(opts.username + ':' + opts.password).toString('base64');
					ntlmState.status = 2;
				} else {
					return reject(new Error('Could not negotiate on an authentication scheme'));
				}
			} else {
				return resolve({
					request: ntlmRequestObj,
					response: res,
					body: body
				});
			}
		} else if (ntlmState.status === 2) {
			if (err || !res) {
				return reject(err || new Error('No response received'));
			}

			if (res.statusCode >= 400 && res.statusCode <= 499) {
				try {
					ntlmState.data = ntlm.decodeType2Message(res);
				} catch(e) {
					return reject(new Error('The server didnt respond properly: ' + (e.stack || e.toString())));
				}

				authHeader = ntlm.createType3Message(ntlmState.data, opts.username, opts.password, opts.workstation, opts.target);
			} else {
				return resolve({
					request: ntlmRequestObj,
					response: res,
					body: body
				});
			}
		} else if (ntlmState.status === 3) {
			if (err || !res || res.statusCode < 200 || res.statusCode > 299) {
				return reject(err || new Error('HTTP ' + res.statusCode + ': ' + res.statusMessage));
			}

			return resolve({
				request: ntlmRequestObj,
				response: res,
				body: body
			});
		}

		ntlmState.status++;

		ntlmRequestObj(createRequestOptions(authHeader), sendRequest.bind(this, resolve, reject));
	}

	return new Promise(sendRequest);
}

module.exports = ntlmRequest;
