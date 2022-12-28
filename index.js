require('dotenv').config();
const mqtt = require('mqtt');
const mongoose = require('mongoose');
const validator = require('email-validator');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
//const { sendEmail } = require('./email.js');

// Models
const User = require('./models/user');
const Dentist = require('./models/dentist');

// Topics
const registerUserTopic = 'dentistimo/register/user';
const registerDentistTopic = 'dentistimo/register/dentist';

const registerErrorTopic = 'dentistimo/register/error/';

const loginUserTopic = 'dentistimo/login/user';
const loginDentistTopic = 'dentistimo/login/dentist';

const loginErrorTopic = 'dentistimo/login/error/';

const modifyPasswordTopic = 'dentistimo/modify-password';
const resetPasswordTopic = 'dentistimo/reset-password';
const sendEmailcodeTopic = 'dentistimo/send-Emailcode';

const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: 465,
    secure: true,
    auth: {
        user: process.env.EMAIL_ADDRESS,
        pass: process.env.EMAIL_PASSWORD,
    },
});
// Mongo setup
const mongoURI = process.env.MONGODB_URI;
mongoose.connect(
    mongoURI,
    { useNewUrlParser: true, useUnifiedTopology: true },
    function (err) {
        if (err) {
            console.error(`Failed to connect to MongoDB with URI: ${mongoURI}`);
            console.error(err.stack);
            process.exit(1);
        }
        console.log(`Connected to MongoDB with URI: ${mongoURI}`);
    }
);

// MQTT setup
const port = '8883';
const clientId = `mqtt_${Math.random().toString(16).slice(3)}`;
const connectUrl = `mqtts://${process.env.MQTT_BROKER}:${port}`;
const client = mqtt.connect(connectUrl, {
    clientId,
    clean: true,
    connectTimeout: 4000,
    username: process.env.MQTT_USER_ID,
    password: process.env.MQTT_PASSWORD,
    reconnectPeriod: 1000,
});

client.on('connect', () => {
    console.log('MQTT connected');
    client.subscribe([registerUserTopic], () => {
        console.log(`Subscribed to topic '${registerUserTopic}'`);
    });
    client.subscribe([registerDentistTopic], () => {
        console.log(`Subscribed to topic '${registerDentistTopic}'`);
    });
    client.subscribe([loginUserTopic], () => {
        console.log(`Subscribed to topic '${loginUserTopic}'`);
    });
    client.subscribe([loginDentistTopic], () => {
        console.log(`Subscribed to topic '${loginDentistTopic}'`);
    });
    client.subscribe([modifyPasswordTopic], () => {
        console.log(`Subscribe to topic '${modifyPasswordTopic}'`);
    });
    client.subscribe([resetPasswordTopic], () => {
        console.log(`Subscribe to topic '${resetPasswordTopic}'`);
    });
    client.subscribe([sendEmailcodeTopic], () => {
        console.log(`Subscribe to topic '${sendEmailcodeTopic}'`);
    });
});

client.on('message', (topic, payload) => {
    switch (topic) {
        case registerUserTopic:
            registerUser(topic, payload);
            break;
        case registerDentistTopic:
            registerDentist(topic, payload);
            break;
        case loginDentistTopic:
        case loginUserTopic:
            login(topic, payload); // Use same login method if user or dentist
            break;
        case modifyPasswordTopic:
            modifyPassword(topic, payload);
            break;
        case resetPasswordTopic:
            resetPassword(topic, payload);
            break;
        case sendEmailcodeTopic:
            sendEmailcode(topic, payload);
            break;
        default:
            console.log('Undefined topic');
    }
});

async function registerUser(topic, payload) {
    let userInfo = JSON.parse(payload.toString());
    let { firstName, lastName, email, password, passwordCheck, requestId } =
        userInfo;

    if (!firstName || !lastName || !email || !password || !passwordCheck) {
        return client.publish(
            registerErrorTopic + requestId,
            'All fields are required'
        );
    }

    // Validate email address
    if (!validator.validate(email)) {
        return client.publish(
            registerErrorTopic + requestId,
            'Invalid email address'
        );
    }

    // Check if email is already registered
    let existingUser = await User.findOne({ email });
    if (existingUser) {
        return client.publish(
            registerErrorTopic + requestId,
            'Email is already in use'
        );
    }

    // Check if passwords match
    if (password !== passwordCheck) {
        return client.publish(
            registerErrorTopic + requestId,
            'Passwords do not match'
        );
    }

    // Check if password is longer than 8 characters
    if (password.length < 8) {
        return client.publish(
            registerErrorTopic + requestId,
            'Password must be longer than 8 characters long'
        );
    }

    try {
        let salt = await bcrypt.genSalt();
        let passwordHash = await bcrypt.hash(password, salt);
        let newUser = new User({
            firstName,
            lastName,
            email,
            password: passwordHash,
        });
        let savedUser = await newUser.save();
        client.publish(
            registerUserTopic + '/' + requestId,
            JSON.stringify({
                firstName: savedUser.firstName,
                lastName: savedUser.lastName,
                email: savedUser.email,
            })
        );
    } catch (error) {
        console.error('[register]', error);
        return client.publish(
            registerErrorTopic + requestId,
            'An unexpected error occurred'
        );
    }
}

async function registerDentist(topic, payload) {
    let userInfo = JSON.parse(payload.toString());
    let {
        firstName,
        lastName,
        email,
        password,
        passwordCheck,
        companyName,
        requestId,
    } = userInfo;

    if (
        !firstName ||
        !lastName ||
        !email ||
        !password ||
        !passwordCheck ||
        !companyName
    ) {
        return client.publish(
            registerErrorTopic + requestId,
            'All fields are required'
        );
    }

    // Validate email address
    if (!validator.validate(email)) {
        return client.publish(
            registerErrorTopic + requestId,
            'Invalid email address'
        );
    }

    // Check if email is already registered
    let existingUser = await Dentist.findOne({ email: email });
    if (existingUser) {
        return client.publish(
            registerErrorTopic + requestId,
            'Email is already in use'
        );
    }

    // Check if passwords match
    if (password !== passwordCheck) {
        return client.publish(
            registerErrorTopic + requestId,
            'Passwords do not match'
        );
    }

    // Check if password is longer than 8 characters
    if (password.length < 8) {
        return client.publish(
            registerErrorTopic + requestId,
            'Password must be longer than 8 characters long'
        );
    }

    try {
        let salt = await bcrypt.genSalt();
        let passwordHash = await bcrypt.hash(password, salt);
        let newDentist = new Dentist({
            firstName,
            lastName,
            email,
            password: passwordHash,
            companyName,
        });
        let savedDentist = await newDentist.save();
        client.publish(
            registerDentistTopic + '/' + requestId,
            JSON.stringify({
                firstName: savedDentist.firstName,
                lastName: savedDentist.lastName,
                email: savedDentist.email,
                companyName: savedDentist.companyName,
            })
        );
    } catch (error) {
        console.error('[register]', error);
        return client.publish(
            registerErrorTopic + requestId,
            'An unexpected error occurred'
        );
    }
}

async function login(topic, payload) {
    try {
        let user;
        let role;
        let { email, password, requestId } = JSON.parse(payload.toString());

        if (!email || !password)
            return client.publish(
                loginErrorTopic + requestId,
                'not all fields have been entered'
            );

        if (topic == loginUserTopic) {
            user = await User.findOne({ email });
        } else {
            user = await Dentist.findOne({ email });
        }

        if (!user)
            return client.publish(
                loginErrorTopic + requestId,
                'User name or password error'
            );

        let isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return client.publish(
                loginErrorTopic + requestId,
                'User name or password error'
            );
        }

        if (topic == loginUserTopic) {
            role = 'User';
        } else {
            role = 'Dentist';
        }

        let tokens = {
            id: user._id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: role,
        };

        let token = jwt.sign(tokens, process.env.JWT_SECRET, {
            issuer: 'Dentistimo-User-Management',
            audience: user._id.toString(),
            expiresIn: 3600,
        });

        if (topic == loginUserTopic) {
            client.publish(
                loginUserTopic + '/' + requestId,
                JSON.stringify({
                    IdToken: token,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    email: user.email,
                })
            );
        } else {
            client.publish(
                loginDentistTopic + '/' + requestId,
                JSON.stringify({
                    IdToken: token,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    email: user.email,
                    companyName: user.companyName,
                })
            );
        }
    } catch (error) {
        console.log('[login]', error);
        return client.publish(
            loginErrorTopic + requestId,
            JSON.stringify({
                success: false,
                msg: error,
            })
        );
    }
}

//Method 1:   Change password
async function modifyPassword(topic, payload) {
    try {
        let { idToken, oldPassword, newPassword } = JSON.parse(
            payload.toString()
        );
        let decoded = jwt.verify(idToken, process.env.JWT_SECRET);
        let userId = decoded.id;
        let user = await User.findOne({ _id: userId });
        if (!user) {
            throw new Error('User not found');
        }
        if (newPassword.length < 8) {
            return client.publish(
                'dentistimo/reset-password/error',
                'Password must be longer than 8 characters long'
            );
        }

        let isMatch = await bcrypt.compare(oldPassword, user.password);
        if (!isMatch) {
            throw new Error('Old password is incorrect');
        }
        let salt = await bcrypt.genSalt();
        let passwordHash = await bcrypt.hash(newPassword, salt);
        let updateResult = await User.updateOne(
            { _id: userId },
            { password: passwordHash }
        );
        if (!updateResult) {
            throw new Error('Failed to update password');
        }
        client.publish('dentistimo/modifyPassword-success', 'Reset successful');
    } catch (error) {
        console.error('[modifyPassword]', error);
        client.publish('dentistimo/reset-password/error', error.message);
    }
}

//Method 2:  Change password
async function resetPassword(topic, payload) {
    try {
        let { email, userCode, newPassword } = JSON.parse(payload.toString());

        let user = await User.findOne({ email });
        if (!user) return client.publish('dentistimo/not_this_email');

        //Verify that the code is correct
        if (!user.code === userCode)
            return client.publish('dentistimo/code-error');

        if (newPassword.length < 8) {
            return client.publish(
                'dentistimo/reset-password/error',
                'Password must be longer than 8 characters long'
            );
        }

        //Change password
        let salt = await bcrypt.genSalt();
        let passwordHash = await bcrypt.hash(newPassword, salt);

        console.log(user._id);

        let updateResult = await User.updateOne(
            { email },
            { password: passwordHash }
        );

        if (!updateResult)
            return client.publish('dentistimo/resetPassword-error');
        console.log(user.password);
        return client.publish(
            'dentistimo/resetPassword-success',
            'Reset successful'
        );
    } catch (error) {
        console.error('[resetPassword]', error);
        client.publish('dentistimo/reset-password/error', error.message);
    }
}

async function sendEmailcode(topic, payload) {
    try {
        let { email } = JSON.parse(payload.toString());
        let code = '';
        for (let i = 0; i < 6; i++) {
            code += parseInt(Math.random() * 10);
        }
        console.log(code);

        let mailOptions = {
            name: 'Dentistimo',
            from: 'Dentistimo',
            to: email,
            subject: 'resert Password', // Subject line
            text: code,
            sendmail: true,
        };
        //???
        let qwe = await User.updateOne({ email }, { code }, { upsert: true });
        console.log(qwe);

        await transporter.sendMail(mailOptions, (error) => {
            if (error) {
                return console.log(error);
            }
        });
    } catch (error) {
        console.error('[resetPassword]', error);
        client.publish('dentistimo/reset-password/error', error.message);
    }
}

console.log('running...');
