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
			authHeader = ntlm.createType1Message();
		} else if (ntlmState.status === 1) {
			if (err || !res) {
				return reject(err || new Error('No response received'));
			}

			if (res.statusCode >= 400 && res.statusCode <= 499) {
				try {
					ntlmState.data = ntlm.decodeType2Message(res);
				} catch(e) {
					return reject(new Error('The server didnt respond properly'));
				}

				authHeader = ntlm.createType3Message(ntlmState.data, opts.username, opts.password, opts.workstation, opts.target);
			} else {
				return reject(new Error('The server apparently has no authentication enabled'));
			}
		} else if (ntlmState.status === 2) {
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