require('dotenv').config();
var mqtt = require('mqtt');
var mongoose = require('mongoose');
var bcrypt = require('bcrypt');
var jwt = require('jsonwebtoken');
var nodemailer = require('nodemailer');
const { sendEmail } = require('./email.js');

// Models
const User = require('./models/user');

// Topics
const registerTopic = 'dentistimo/register';
const loginTopic = 'dentistimo/login';

let transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: 587,
    secure: false, // true for 465, false for other ports
    auth: {
        type: process.env.EMAIL_TYPE,
        user: process.env.EMAIL_ADDRESS,
        pass: process.env.EMAIL_PASSWORD,
        clientId: process.env.EMAIL_CLIENT_ID,
        clientSecret: process.env.EMAIL_CLIENT_SECRET,
        refreshToken: process.env.EMAIL_REFRESH_TOKEN,
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
    console.log('Connected');
    client.subscribe([registerTopic], () => {
        console.log(`Subscribe to topic '${registerTopic}'`);
        console.log(clientId);
    });
    client.subscribe([loginTopic], () => {
        console.log(`Subscribe to topic '${loginTopic}'`);
        console.log(clientId);
    });
});

client.on('message', (topic, payload) => {
    console.log('Received Message:', topic, payload.toString());
    if (topic == registerTopic) {
        register(topic, payload);
    } else if (topic == loginTopic) {
        login(topic, payload);
    } else {
        console.log('Topic not defined in code');
    }
});

async function register(topic, payload) {
    try {
        let o;
        try {
            o = JSON.parse(payload.toString());
            const {
                firstName,
                lastName,
                email,
                password,
                passwordCheck,
                role,
            } = o;

            if (
                !firstName ||
                !lastName ||
                !email ||
                !password ||
                !passwordCheck ||
                !role
            ) {
                client.publish(
                    'dentistimo/register-error',
                    'not all fields have been entered'
                );
            }

            const salt = await bcrypt.genSalt();
            const passwordHash = await bcrypt.hash(password, salt);

            const newUser = await new User({
                firstName: firstName,
                lastName: lastName,
                email: email,
                password: passwordHash,
                role: role,
            });
            const savedUser = await newUser.save();

            console.log(savedUser._id);
            client.publish(
                'dentistimo/register-success',
                JSON.stringify({ user: savedUser })
            );

            sendEmail(transporter, email, 'Welcome to Dentistimo!', 'Thank you for registering!'); // Send an email to the newly registered user

        } catch (error) {
            console.log(error);
        }
    } catch (error) {
        console.log(error);
    }
}

async function login(topic, payload) {
    try {
        const { email, password } = JSON.parse(payload.toString());

        if (!email || !password)
            return client.publish(
                'dentistimo/login-error',
                'not all fields have been entered'
            );

        const user = await User.findOne({ email });
        console.log(user);

        if (!user)
            return client.publish(
                'dentistimo/login-error',
                'User name or password error'
            );

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            client.publish(
                'dentistimo/login-error',
                'User name or password error'
            );
            return;
        }

        const tokens = {
            id: user._id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
        };

        let token = jwt.sign(tokens, process.env.JWT_SECRET, {
            expiresIn: 3600,
        });
        console.log(token);

        client.publish(
            'dentistimo/login-success',
            JSON.stringify({ token: token })
        );
    } catch (error) {
        console.log('[login]', error);
        return client.publish({
            success: false,
            msg: error,
        });
    }
}
console.log('running...');
