const fs = require('fs');
const { expect } = require('chai');

const ntlmRequest = require('../lib/index').request;

if (fs.existsSync('.env')) {
    // eslint-disable-next-line global-require
    require('dotenv').config();
}

describe('Integration Tests', function() {
    let username;
    let password;
    let url;

   this.timeout(50000);

   ['NTLM_V2', 'NTLM_V1', 'BASIC'].forEach(authType => {
       if(process.env[`${authType}_USERNAME`] && process.env[`${authType}_PASSWORD`] && process.env[`${authType}_URL`]) {
           console.log(`Detected Authorization Configuration For ${authType}`);
           describe(`${authType} Tests`, function () {
               before(() => {
                   username = process.env[`${authType}_USERNAME`];
                   password = process.env[`${authType}_PASSWORD`];
                   url = process.env[`${authType}_URL`];
               });

               it('Correct Password', async() => {
                   const { response } = await ntlmRequest({
                       username,
                       password,
                       uri: url,
                       method: 'GET'
                   });

                   expect(response.statusCode).to.be.equal(200);
               });

               it('Incorrect Password', async() => {
                   const { response } = await ntlmRequest({
                       username,
                       password: 'Wrong Password',
                       uri: url,
                       method: 'GET'
                   });

                   expect(response.statusCode).to.be.equal(401);
               });
           });
       } else {
           console.log(`Missing Required Authorization Configuration For ${authType}`);
       }
   });
});
