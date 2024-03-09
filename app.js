'use strict';

let express = require('express');
let path = require('path');
let session = require('express-session');
let bodyParser = require('body-parser');
let nodemailer = require('nodemailer');

const FabricCAServices = require('fabric-ca-client');
const { FileSystemWallet, Gateway, X509WalletMixin } = require('fabric-network');
const fs = require('fs');

const ccpPath = path.resolve(__dirname, '..', '..', 'basic-network', 'connection.json');
const ccpJSON = fs.readFileSync(ccpPath, 'utf8');
const ccp = JSON.parse(ccpJSON);

let app = express();
app.use(session({
    secret: 'secret',
    resave: true,
    saveUninitialized: true
}));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.engine('html', require('ejs').renderFile);
app.use("/public", express.static("public"));

let et = "Not Set Yet";

// Main - Enroll Admin if Not already installed
async function main() {
    try {
        // Create a new CA client for interacting with the CA.
        const caURL = ccp.certificateAuthorities['ca.example.com'].url;
        const ca = new FabricCAServices(caURL);

        // Create a new file system based wallet for managing identities.
        const walletPath = path.join(process.cwd(), 'wallet');
        const wallet = new FileSystemWallet(walletPath);
        console.log(`Wallet path: ${walletPath}`);

        // Check to see if we've already enrolled the admin user.
        const adminExists = await wallet.exists('admin');
        if (adminExists) {
            console.log('An identity for the admin user "admin" already exists in the wallet');
            console.log('Please continue');
            return;
        }

        // Enroll the admin user, and import the new identity into the wallet.
        const enrollment = await ca.enroll({ enrollmentID: 'admin', enrollmentSecret: 'adminpw' });
        const identity = X509WalletMixin.createIdentity('Org1MSP', enrollment.certificate, enrollment.key.toBytes());
        wallet.import('admin', identity);
        console.log('Successfully enrolled admin user "admin" and imported it into the wallet');

    } catch (error) {
        console.log(`Failed to enroll admin user "admin": ${error}`);
        console.log('Please run enrollAdmin.js in a seperate terminal window before continuing!\n');
    }
};

app.get('/', function (request, response) {
    request.session.loggedin = false;
    response.render(__dirname + "/public/index.html", { _: et });
});

app.get('/index.html', function (request, response) {
    request.session.loggedin = false;
    response.sendFile(path.join(__dirname + '/public/index.html'));
});

app.post('/home-page', function (request, response) {
    request.session.loggedin = false;
    response.redirect('/');
});

// ---------------------------- Election Council ----------------------------
app.get('/EC-dashboard/index.html', function (request, response) {
    response.sendFile(path.join(__dirname + '/public/EC-dashboard/index.html'));
});

app.post('/EC-dashboard/home-page', function (request, response) {
    request.session.loggedin = false;
    response.redirect('/');
});

app.get('/EC-dashboard/ec-login.html', function (request, response) {
    response.sendFile(path.join(__dirname + '/public/EC-dashboard/ec-login.html'));
});

app.post('/EC-dashboard/EC-lgin', function (request, response) {
    let username = request.body.username;
    let password = request.body.password;
    let flag = 1;

    if (username && password) {
        if (username == 1) {
            if (password == 54321) {
                request.session.loggedin = true;
                request.session.username = username;
            } else {
                let r = "Incorrect password!";
                flag = 0;
                console.log("Credentials not verified!");
                response.render(__dirname + "/public/EC-dashboard/ec-login.html", { _: r });
            }
        } else {
            let r = "Incorrect username!";
            flag = 0;
            console.log("Credentials not verified!");
            response.render(__dirname + "/public/EC-dashboard/ec-login.html", { _: r });
        }
    } else {
        let r = "Please enter your details!";
        flag = 0;
        console.log("Credentials not verified!");
        response.render(__dirname + "/public/EC-dashboard/ec-login.html", { _: r });
    }
    if (flag == 1) {
        console.log("Credentials verified, loggin the EC in!");
        response.redirect('/EC-dashboard/ec-dashboard.html');
    }
    response.end();
});

app.get('/EC-dashboard/ec-registration.html', function (request, response) {
    response.sendFile(path.join(__dirname + '/public/EC-dashboard/ec-registration.html'));
});

app.post('/EC-dashboard/EC-reg', function (request, response) {
    let username = request.body.username;
    let password = request.body.password;
    let flag = 1;

    if (username && password) {
        if (username == 1) {
            if (password == 54321) {
                request.session.loggedin = true;
                request.session.username = username;
            } else {
                let r = "Incorrect password!";
                flag = 0;
                console.log("Credentials not verified!");
                response.render(__dirname + "/public/EC-dashboard/ec-registration.html", { _: r });
                response.end();
            }
        } else {
            let r = "Incorrect username!";
            flag = 0;
            console.log("Credentials not verified!");
            response.render(__dirname + "/public/EC-dashboard/ec-registration.html", { _: r });
            response.end();
        }
    } else {
        let r = "Please enter your details!";
        flag = 0;
        console.log("Credentials not verified!");
        response.render(__dirname + "/public/EC-dashboard/ec-registration.html", { _: r });
        response.end();
    }
    if (flag == 1) {
        console.log("Credentials verified, Registering EC account!");

        if (request.session.loggedin) {
            async function registerEC() {
                let EC_ID = '1';

                try {
                    // Create a new file system based wallet for managing identities.
                    const walletPath = path.join(process.cwd(), 'wallet');
                    const wallet = new FileSystemWallet(walletPath);
                    console.log(`Wallet path: ${walletPath}`);

                    // Check to see if we've already enrolled the EC.
                    const EC_Exists = await wallet.exists(EC_ID);
                    if (EC_Exists) {
                        console.log(`An identity for the EC already exists in the wallet`);
                        response.redirect('/EC-dashboard/index.html');
                        return;
                    }

                    // Check to see if we've already enrolled the admin user.
                    const adminExists = await wallet.exists('admin');
                    if (!adminExists) {
                        console.log('An identity for the admin user "admin" does not exist in the wallet');
                        console.log('Run the enrollAdmin.js application before retrying');
                        response.redirect('/');
                        return;
                    }

                    // Create a new gateway for connecting to our peer node.
                    const gateway = new Gateway();
                    await gateway.connect(ccp, { wallet, identity: 'admin', discovery: { enabled: false } });

                    // Get the CA client object from the gateway for interacting with the CA.
                    const ca = gateway.getClient().getCertificateAuthority();
                    const adminIdentity = gateway.getCurrentIdentity();

                    // Register the user, enroll the user, and import the new identity into the wallet.
                    const secret = await ca.register({
                        affiliation: 'org1.department1',
                        enrollmentID: EC_ID,
                        role: 'client'
                    }, adminIdentity);

                    const enrollment = await ca.enroll({ enrollmentID: EC_ID, enrollmentSecret: secret });
                    const userIdentity = X509WalletMixin.createIdentity('Org1MSP', enrollment.certificate, enrollment.key.toBytes());
                    wallet.import(EC_ID, userIdentity);
                    console.log(`Successfully registered and enrolled EC with enrollment ID 1 and imported it into the wallet`);

                } catch (error) {
                    console.log(`Failed to register EC: ${error}`);
                }
            }
            registerEC();
        }
        response.redirect('/EC-dashboard/ec-dashboard.html');
    }
});

app.get('/EC-dashboard/ec-dashboard.html', function (request, response) {
    response.sendFile(path.join(__dirname + '/public/EC-dashboard/ec-dashboard.html'));
});

app.post('/EC-dashboard/ec-dash-page', function (request, response) {
    response.sendFile(path.join(__dirname + '/public/EC-dashboard/ec-dashboard.html'));
});

app.get('/EC-dashboard/ec-dashboard-add-voter.html', function (request, response) {
    response.sendFile(path.join(__dirname + '/public/EC-dashboard/ec-dashboard-add-voter.html'));
});

/**
 * Returns a random number between min (inclusive) and max (exclusive)
 */
function random_pin(min, max) {
    return Math.floor(
        Math.random() * (max - min) + min
    )
}

//Global current vote id and current voter id for sequential allocation
let curr_voter_id = 100;
let currVoteId = -1;

app.post('/EC-dashboard/EC-addNewVoter', function (request, response) {
    let voter_email = request.body.newVoterEmail;

    curr_voter_id = curr_voter_id + 1;

    let voter_id = curr_voter_id.toString();
    let voter_pin = random_pin(111, 999).toString();

    //  START - Reading Voters List and Writing to it
    let rawdata_voters = fs.readFileSync('voters.json');
    let voters_list = JSON.parse(rawdata_voters);

    let new_voter_json = { "voterId": voter_id, "pin": voter_pin };
    voters_list.push(new_voter_json);

    let new_voters_list = JSON.stringify(voters_list);
    fs.writeFileSync('voters.json', new_voters_list);
    //  END - Reading Voters List and Writing to it

    currVoteId += 1;

    console.log(`Voter ID: ${voter_id}
        Voter PIN: ${voter_pin}
        Vote ID: ${currVoteId}`);

    if (voter_email) {
        let transporter = nodemailer.createTransport({
            service: 'Gmail',
            auth: {
                user: 'cmyaeaung124@gmail.com',
                pass: 'iaaiokhubbouisfp'
            }
        });

        let mailOptions = {
            from: 'cmyaeaung124@gmail.com',
            to: voter_email,
            subject: 'Voter Details for Elections',
            text:
                `Hello Voter,
                    Your voting details for the upcoming election are as follows:
                    Voter ID: ${voter_id}
                    Voter PIN: ${voter_pin}`,
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.log(error);
            } else {
                console.log('Email sent: ' + info.response);
            }
        });
    };

    // Creating Corresponding Vote Object
    if (request.session.loggedin) {
        if (request.session.username == 1) {
            async function createVoteObj() {
                let userId = '1';
                try {
                    // Create a new file system based wallet for managing identities.
                    const walletPath = path.join(process.cwd(), 'wallet');
                    const wallet = new FileSystemWallet(walletPath);
                    console.log(`Wallet path: ${walletPath}`);

                    // Check to see if we've already enrolled the user.
                    const userExists = await wallet.exists(userId);
                    if (!userExists) {
                        console.log(`An identity for the EC ${userId} does not exist in the wallet! Register EC first !`);
                        response.redirect('/EC-dashboard/index.html');
                        return;
                    }

                    // Create a new gateway for connecting to our peer node.
                    const gateway = new Gateway();
                    await gateway.connect(ccp, { wallet, identity: userId, discovery: { enabled: false } });

                    // Get the network (channel) our contract is deployed to.
                    const network = await gateway.getNetwork('mychannel');

                    // Get the contract from the network.
                    const contract = network.getContract('blockchain_voting');

                    let sendTo = voter_id;

                    await contract.submitTransaction('createVoteObj', sendTo);
                    console.log("Added Voter and created VOTE Obj successfully!\n");

                    await gateway.disconnect();

                } catch (error) {
                    console.log(`Failed to submit transaction: ${error}`);
                    //response.redirect('/EC-dashboard/ec-dashboard.html');
                    process.exit(1);
                }
            }
            createVoteObj();
        }
    }
    response.redirect('/EC-dashboard/ec-dashboard-add-voter.html');
});

app.get('/EC-dashboard/ec-dashboard-add-candidate.html', function (request, response) {
    let rawdata_c = fs.readFileSync('candidates.json');
    let c_list = JSON.parse(rawdata_c);

    let candidates_string = "";

    for (let i = 0; i < c_list.length; i++) {
        let temp = "Candidate Name: " + c_list[i].name + "    , Candidate ID: " + c_list[i].candidateId + "<br></br>";
        candidates_string += temp;
    }

    response.render(__dirname + "/public/EC-dashboard/ec-dashboard-add-candidate.html", { _: JSON.stringify(candidates_string) });
});

//Global current candidate id for sequential allocation
let curr_candidate_id = 1;

app.post('/EC-dashboard/EC-addNewCandidate', function (request, response) {
    let candidate_id = curr_candidate_id;
    curr_candidate_id += 1;
    let candidate_name = request.body.newCandidateName;

    //  START - Reading Candidates List and Writing to it
    let rawdata_c = fs.readFileSync('candidates.json');
    let c_list = JSON.parse(rawdata_c);
    let new_c_json = {
        "candidateId": candidate_id,
        "name": candidate_name
    };
    c_list.push(new_c_json);
    let new_c_list = JSON.stringify(c_list);
    fs.writeFileSync('candidates.json', new_c_list);
    //  END - Reading candidates List and Writing to it

    response.redirect('/EC-dashboard/ec-dashboard-add-candidate.html');
});

app.get('/EC-dashboard/ec-set-time.html', function (request, response) {
    response.sendFile(path.join(__dirname + '/public/EC-dashboard/ec-set-time.html'));
});

app.post('/EC-dashboard/set-time', function (request, response) {
    let duration_d = request.body.duration_d;
    let duration_h = request.body.duration_h;
    let duration_m = request.body.duration_m;

    let duration = ((parseInt(duration_d) * 24 * 60) + (parseInt(duration_h) * 60) + (parseInt(duration_m))).toString();
    let timestr = null;

    async function setTime() {
        let userId = '1';

        try {
            // Create a new file system based wallet for managing identities.
            const walletPath = path.join(process.cwd(), 'wallet');
            const wallet = new FileSystemWallet(walletPath);
            console.log(`Wallet path: ${walletPath}`);

            // Check to see if we've already enrolled the user.
            const userExists = await wallet.exists(userId);
            if (!userExists) {
                console.log(`An identity for the EC ${userId} does not exist in the wallet`);
                response.redirect('/EC-dashboard/index.html');
                return;
            }

            // Create a new gateway for connecting to our peer node.
            const gateway = new Gateway();
            await gateway.connect(ccp, { wallet, identity: userId, discovery: { enabled: false } });

            // Get the network (channel) our contract is deployed to.
            const network = await gateway.getNetwork('mychannel');

            // Get the contract from the network.
            const contract = network.getContract('blockchain_voting');

            timestr = await contract.submitTransaction('setEndTime', duration);
            timestr = new Date(timestr);
            et = timestr.toLocaleString();

            console.log(`Setting End Time To: ${timestr.toLocaleString()}`);
            console.log("Voting End Time set Successfully!\n");

            let outString = "Voting End Time Set to: " + timestr.toLocaleString();
            response.render(__dirname + "/public/EC-dashboard/ec-set-time.html", { _: outString });

            await gateway.disconnect();

        } catch (error) {
            console.log(`Failed to submit transaction: ${error}`);
            //response.redirect('/EC-dashboard/ec-dashboard.html');
            process.exit(1);
        }
    }
    setTime();
});

// ------------------------------- Voter -------------------------------
app.get('/voter-dashboard/index.html', function (request, response) {
    response.sendFile(path.join(__dirname + '/public/voter-dashboard/index.html'));
});

app.post('/voter-dashboard/home-page', function (request, response) {
    request.session.loggedin = false;
    response.redirect('/');
});

app.get('/voter-dashboard/voter-login.html', function (request, response) {
    response.sendFile(path.join(__dirname + '/public/voter-dashboard/voter-login.html'));
});

app.post('/voter-dashboard/voter-lgin', function (request, response) {
    let username = request.body.username;
    let password = request.body.password;

    let rawdata_voters = fs.readFileSync('voters.json');
    let voters_list = JSON.parse(rawdata_voters);

    let f = 1;
    let flag = 0;

    if (username && password) {
        for (let i = 0; i < voters_list.length; i++) {
            if (voters_list[i].voterId == username) {
                flag = 1;

                if (voters_list[i].pin != password) {
                    let r = "Incorrect PIN";
                    f = 0;

                    console.log("Credentials not verified!");
                    response.render(__dirname + "/public/voter-dashboard/voter-login.html", { _: r });
                    response.end();
                } else {
                    console.log("Identity Verified!\n");
                    request.session.loggedin = true;
                    request.session.username = username;
                    break;
                }
            }
        }

        if (flag != 1) {
            let r = "You have not been pre-approved by EC as a voter!";
            f = 0;
            console.log("Credentials not verified!");
            response.render(__dirname + "/public/voter-dashboard/voter-login.html", { _: r });
            response.end();
        }

        if (f == 1) {
            response.redirect('/voter-dashboard/voter-dashboard.html');
            response.end();
        }
    }
});

app.get('/voter-dashboard/voter-registration.html', function (request, response) {
    response.sendFile(path.join(__dirname + '/public/voter-dashboard/voter-registration.html'));
});

app.post('/voter-dashboard/voter-reg', function (request, response) {
    let username = request.body.username;
    let password = request.body.password;

    let flag = '0';
    let f = 1;

    let rawdata_voters = fs.readFileSync('voters.json');
    let voters_list = JSON.parse(rawdata_voters);

    if (username && password) {
        for (let i = 0; i < voters_list.length; i++) {
            if (voters_list[i].voterId == username) {
                flag = 1;

                if (voters_list[i].pin != password) {
                    let r = "Incorrect PIN";
                    f = 0;

                    console.log("Credentials not verified!");
                    response.render(__dirname + "/public/voter-dashboard/voter-registration.html", { _: r });
                    response.end();
                } else {
                    console.log("Identity Verified!\n");
                    request.session.loggedin = true;
                    request.session.username = username;
                    break;
                }
            }
        }

        if (flag != 1) {
            let r = "You have not been pre-approved by EC as a voter!";
            f = 0;
            console.log("Credentials not verified!");
            response.render(__dirname + "/public/voter-dashboard/voter-registration.html", { _: r });
        }

        if (f == 1) {
            console.log("Credentials verified, Registering voter account!");
            if (request.session.loggedin) {
                async function registerVoter() {
                    try {
                        let voter = username;
                        // Create a new file system based wallet for managing identities.
                        const walletPath = path.join(process.cwd(), 'wallet');
                        const wallet = new FileSystemWallet(walletPath);
                        console.log(`Wallet path: ${walletPath}`);

                        // Check to see if we've already enrolled the user.
                        const voterExists = await wallet.exists(voter);
                        if (voterExists) {
                            console.log(`An identity for the voter ${voter} already exists in the wallet`);
                            response.redirect('/voter-dashboard/voter-login.html');
                        }

                        // Check to see if we've already enrolled the admin user.
                        const adminExists = await wallet.exists('admin');
                        if (!adminExists) {
                            console.log('An identity for the admin user "admin" does not exist in the wallet');
                            console.log('Run the enrollAdmin.js application before retrying');
                            response.redirect('/');
                            return;
                        }

                        // Create a new gateway for connecting to our peer node.
                        const gateway = new Gateway();
                        await gateway.connect(ccp, { wallet, identity: 'admin', discovery: { enabled: false } });

                        // Get the CA client object from the gateway for interacting with the CA.
                        const ca = gateway.getClient().getCertificateAuthority();
                        const adminIdentity = gateway.getCurrentIdentity();

                        // Register the user, enroll the user, and import the new identity into the wallet.
                        const secret = await ca.register({
                            affiliation: 'org1.department1',
                            enrollmentID: voter,
                            role: 'client'
                        }, adminIdentity);

                        const enrollment = await ca.enroll({ enrollmentID: voter, enrollmentSecret: secret });
                        const userIdentity = X509WalletMixin.createIdentity('Org1MSP', enrollment.certificate, enrollment.key.toBytes());
                        wallet.import(voter, userIdentity);
                        console.log(`Successfully registered and enrolled voter ${voter} and imported it into the wallet`);
                    } catch (error) {
                        console.log(`Failed to register voter: ${error}`);
                        response.render(__dirname + "/public/voter-dashboard/voter-registration.html", { _: "Failer to register!" });
                    }
                }
                registerVoter();
            }
            response.redirect('/voter-dashboard/voter-dashboard.html');
        }
    }
});

app.get('/voter-dashboard/voter-dashboard.html', function (request, response) {
    let rawdata_c = fs.readFileSync('candidates.json');
    let c_list = JSON.parse(rawdata_c);

    let candidates_string = "";

    for (let i = 0; i < c_list.length; i++) {
        let temp = "Candidate Name: " + c_list[i].name + "    , Candidate ID: " + c_list[i].candidateId + "<br></br>";
        candidates_string += temp;
    }

    response.render(__dirname + "/public/voter-dashboard/voter-dashboard.html", { _: JSON.stringify(candidates_string) });
});

app.post('/voter-dashboard/voting', function (request, response) {
    let username = request.session.username;
    let candidate = request.body.candidate;

    let userId = username;

    let rawdata_c = fs.readFileSync('candidates.json');
    let c_list = JSON.parse(rawdata_c);

    let f = 0;
    let voting_session_status = '2';

    for (let i = 0; i < c_list.length; i++) {
        if (c_list[i].candidateId == candidate) {
            f = 1;
            break;
        }
    }

    if (f != 1) {
        response.render(__dirname + "/public/voter-dashboard/voter-dashboard.html", { _: "Please enter a valid candidate ID!" });
        response.end();
    } else {
        if (request.session.loggedin) {
            if (request.session.username != 1) {
                async function sendVoteObj() {
                    try {
                        const walletPath = path.join(process.cwd(), 'wallet');
                        const wallet = new FileSystemWallet(walletPath);
                        console.log(`Wallet path: ${walletPath}`);

                        // Check to see if we've already enrolled the user.
                        const userExists = await wallet.exists(userId);
                        if (!userExists) {
                            console.log(`An identity for the ${userId} does not exist in the wallet`);
                            response.redirect('/');
                        }

                        // Create a new gateway for connecting to our peer node.
                        const gateway = new Gateway();
                        await gateway.connect(ccp, { wallet, identity: userId, discovery: { enabled: false } });

                        // Get the network (channel) our contract is deployed to.
                        const network = await gateway.getNetwork('mychannel');

                        // Get the contract from the network.
                        const contract = network.getContract('blockchain_voting');

                        let sendTo = candidate;

                        voting_session_status = await contract.submitTransaction('sendVoteObj', userId, sendTo);

                        if (voting_session_status == '0') {
                            console.log("Voting has not started! You can not cast your vote!\n");
                            await gateway.disconnect();
                            response.redirect('/v_not_started');
                        }
                        if (voting_session_status == '1') {
                            console.log("Voting has ended! You can not cast your vote!\n");
                            await gateway.disconnect();
                            response.redirect('/v_ended');
                        }
                        if (voting_session_status == '2') {
                            console.log("Vote Casted successfully!\n");
                            await gateway.disconnect();
                            response.redirect('/thankyou');
                        }
                        if (voting_session_status == '3') {
                            console.log("Voter has already voted, cannot vote again!\n");
                            await gateway.disconnect();
                            response.redirect('/v_already');
                        }

                    } catch (error) {
                        console.log(`Failed to submit transaction: ${error}`);
                    }
                }
                sendVoteObj();
            }
        }
    }
});

// ---------------------------- Public Bulletin ----------------------------
app.get('/public-bulletin/index.html', function (request, response) {
    response.sendFile(path.join(__dirname + '/public/public-bulletin/index.html'));
});

app.post('/public-bulletin/home-page', function (request, response) {
    request.session.loggedin = false;
    response.redirect('/');
});

app.get('/thankyou', function (request, response) {
    request.session.loggedin = false;
    response.sendFile(path.join(__dirname + '/public/public-bulletin/thankyou_forvoting.html'));
});

app.get('/v_not_started', function (request, response) {
    request.session.loggedin = false;
    response.sendFile(path.join(__dirname + '/public/public-bulletin/voting_not_started.html'));
});

app.get('/v_ended', function (request, response) {
    request.session.loggedin = false;
    response.sendFile(path.join(__dirname + '/public/public-bulletin/voting_ended.html'));
});

app.get('/v_already', function (request, response) {
    request.session.loggedin = false;
    response.sendFile(path.join(__dirname + '/public/public-bulletin/voting_already_done.html'));
});

app.get('/public-bulletin/results.html', function (request, response) {
    response.sendFile(path.join(__dirname + '/public/public-bulletin/results.html'));
});

app.post('/public-bulletin/get-result', function (request, response) {
    async function getResults() {
        try {
            let userId = '1';
            const walletPath = path.join(process.cwd(), 'wallet');
            const wallet = new FileSystemWallet(walletPath);
            console.log(`Wallet path: ${walletPath}`);

            // Check to see if we've already enrolled the user.
            const userExists = await wallet.exists(userId);

            if (!userExists) {
                console.log(`An identity for the ${userId} does not exist in the wallet`);
                response.redirect('/');
            }

            // Create a new gateway for connecting to our peer node.
            const gateway = new Gateway();
            await gateway.connect(ccp, { wallet, identity: userId, discovery: { enabled: false } });

            // Get the network (channel) our contract is deployed to.
            const network = await gateway.getNetwork('mychannel');

            // Get the contract from the network.
            const contract = network.getContract('blockchain_voting');

            let results = await contract.submitTransaction('getResults');
            results = JSON.parse(results.toString('utf8'));

            let resultString = "";

            if (results.len == 0) {
                resultString = "No votes were casted!";
            } else if (parseInt(results[0].candidateId) == -1) {
                resultString = "Voting has not ended yet. Please wait until voting has ended and then try again";
            } else if (parseInt(results[0].candidateId) == -2) {
                resultString = "Voting has not started yet. Please wait until voting has started and then try again";
            } else {
                let resultArr = [];

                for (let i = 0; i < results.length; i++) {
                    resultArr.push({ id: results[i].candidateId, count: parseInt(results[i].voteCount) });
                }

                resultArr.sort((a, b) => b.count - a.count);

                for (let i = 0; i < resultArr.length; i++) {
                    let temp = "Candidate ID: " + (resultArr[i].id) + "    , Vote Count: " + resultArr[i].count + "<br></br>";
                    resultString += temp;
                }
            }

            response.render(__dirname + "/public/public-bulletin/results.html", { _: JSON.stringify(resultString) });
            await gateway.disconnect();

        } catch (error) {
            console.log(`Failed to get Results: ${error}`);
            //response.redirect('/');
        }
    }
    getResults();
});

app.post('/public-bulletin/get-q-all', function (request, response) {
    async function queryAllVote() {
        try {
            // Create a new file system based wallet for managing identities.
            const walletPath = path.join(process.cwd(), 'wallet');
            const wallet = new FileSystemWallet(walletPath);
            console.log(`Wallet path: ${walletPath}`);

            // Check to see if we've already enrolled the user.
            const voterExists = await wallet.exists('1');

            if (!voterExists) {
                console.log(`An identity for the voter ${'1'} does not exist in the wallet`);
                // console.log('Run the registerUser.js application before retrying');
                return;
            }

            // Create a new gateway for connecting to our peer node.
            const gateway = new Gateway();
            await gateway.connect(ccp, { wallet, identity: '1', discovery: { enabled: false } });

            // Get the network (channel) our contract is deployed to.
            const network = await gateway.getNetwork('mychannel');

            // Get the contract from the network.
            const contract = network.getContract('blockchain_voting');

            let query_results = await contract.evaluateTransaction('queryAllVote');

            query_results = JSON.parse(query_results.toString('utf8'));
            let que_res_string = "";

            console.log(query_results);

            if (parseInt(query_results[0].Key) == -1) {
                que_res_string = "Voting has not ended yet. Please try again after voting has ended!";
            } else if (parseInt(query_results[0].Key) == -2) {
                que_res_string = "Voting has not started yet!";
            } else if (query_results.length == 0) {
                que_res_string = "No votes were casted!";
            } else {
                for (let i = 0; i < query_results.length; i++) {
                    let temp = "Vote ID: " + query_results[i].Key + "   ---> " + JSON.stringify(query_results[i].vote) + "<br></br>";
                    que_res_string += temp;
                }
            }
            // console.log(que_res_string);
            response.render(__dirname + "/public/public-bulletin/queryAllVotes.html", { _: JSON.stringify(que_res_string) });

            console.log(`TransactionTypeAll has been evaluated, result is: `);

        } catch {
            console.error(`Failed to evaluate transaction: ${error}`);
            // process.exit(1);
        }
    }
    queryAllVote();
});

main();

let server = app.listen(5000, function () {
    let host = 'localhost'
    let port = server.address().port

    console.log("Example app listening at http://%s:%s", host, port)
})
