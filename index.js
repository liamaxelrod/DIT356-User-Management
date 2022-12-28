require('dotenv').config();
var mqtt = require('mqtt');
var mongoose = require('mongoose');
var validator = require('email-validator');
var bcrypt = require('bcrypt');
var jwt = require('jsonwebtoken');
var nodemailer = require('nodemailer');
//const { sendEmail } = require('./email.js');

// Models
const User = require('./models/user');
const Dentist = require('./models/dentist');

// Topics
const registerUserTopic = 'dentistimo/register/user';
const registerDentistTopic = 'dentistimo/register/dentist';
const registerErrorTopic = 'dentistimo/register/error/';
const loginTopic = 'dentistimo/login';
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
var mongoURI = process.env.MONGODB_URI;
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
    client.subscribe([loginTopic], () => {
        console.log(`Subscribed to topic '${loginTopic}'`);
    });
    client.subscribe([modifyPasswordTopic], () => {
        console.log(`Subscribe to topic '${modifyPasswordTopic}'`);
        console.log(clientId);
    });
    client.subscribe([resetPasswordTopic], () => {
        console.log(`Subscribe to topic '${resetPasswordTopic}'`);
        console.log(clientId);
    });
    client.subscribe([sendEmailcodeTopic], () => {
        console.log(`Subscribe to topic '${sendEmailcodeTopic}'`);
        console.log(clientId);
    });
});

client.on('message', (topic, payload) => {
    console.log('Received Message');
    console.log(payload.toString());
    if (topic == registerUserTopic || topic == registerDentistTopic) {
        register(topic, payload);
    } else if (topic == loginTopic) {
        login(topic, payload);
    } else if (topic == modifyPasswordTopic) {
        modifyPassword(topic, payload);
    } else if (topic == resetPasswordTopic) {
        resetPassword(topic, payload);
    } else if (topic == sendEmailcodeTopic) {
        sendEmailcode(topic, payload);
    } else {
        console.log('Topic not defined in code');
    }
});

async function register(topic, payload) {
    let userInfo = JSON.parse(payload.toString());
    const {
        firstName,
        lastName,
        email,
        password,
        passwordCheck,
        companyName,
        requestId,
    } = userInfo;

    console.log(requestId);

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
    const existingUser = await Dentist.findOne({ email: email });
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
        const salt = await bcrypt.genSalt();
        const passwordHash = await bcrypt.hash(password, salt);
        if (topic == registerDentistTopic) {
            const newDentist = new Dentist({
                firstName,
                lastName,
                email,
                password: passwordHash,
                companyName,
            });
            const savedDentist = await newDentist.save();
            client.publish(
                registerDentistTopic + '/' + requestId,
                savedDentist.toString()
            );
            console.log(savedDentist);
        } else {
            const newUser = new User({
                firstName,
                lastName,
                email,
                password: passwordHash,
            });
            const savedUser = await newUser.save();
            client.publish(
                registerUserTopic + '/' + requestId,
                savedUser.toString()
            );
            console.log(savedUser);
        }
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
        const { email, password, requestId } = JSON.parse(payload.toString());

        console.log(requestId);
        if (!email || !password)
            return client.publish(
                'dentistimo/login-error',
                'not all fields have been entered'
            );

        //TODO ADD USER LOGIN, CURRENTLY ONLY DENTIST CAN LOGIN
        const user = await Dentist.findOne({ email: email });
        console.log(user);

        if (!user)
            return client.publish(
                loginErrorTopic + requestId,
                'User name or password error'
            );

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return client.publish(
                loginErrorTopic + requestId,
                'User name or password error'
            );
        }

        const tokens = {
            id: user._id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
        };

        let token = jwt.sign(tokens, process.env.JWT_SECRET, {
            expiresIn: 3600,
        });
        console.log(token);

        client.publish(
            loginTopic + '/' + requestId,
            JSON.stringify({ IdToken: token })
        );
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
        const { idToken, oldPassword, newPassword } = JSON.parse(
            payload.toString()
        );
        const decoded = jwt.verify(idToken, process.env.JWT_SECRET);
        const userId = decoded.id;
        const user = await User.findOne({ _id: userId });
        if (!user) {
            throw new Error('User not found');
        }
        if (newPassword.length < 8) {
            return client.publish(
                'dentistimo/reset-password/error',
                'Password must be longer than 8 characters long'
            );
        }

        const isMatch = await bcrypt.compare(oldPassword, user.password);
        if (!isMatch) {
            throw new Error('Old password is incorrect');
        }
        const salt = await bcrypt.genSalt();
        const passwordHash = await bcrypt.hash(newPassword, salt);
        const updateResult = await User.updateOne(
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
        const { email } = JSON.parse(payload.toString());
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
        const qwe = await User.updateOne({ email }, { code }, { upsert: true });
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
