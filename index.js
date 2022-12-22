const mqtt = require('mqtt');
require('dotenv').config();
var mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
var validator = require('email-validator');

const User = require('./models/user');

// Topics
const registerTopic = 'dentistimo/register/';
const registerTopicError = 'dentistimo/register/error/';
const loginTopic = 'dentistimo/login/';

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
    client.subscribe([registerTopic], () => {
        console.log(`Subscribed to topic '${registerTopic}'`);
    });
    client.subscribe([loginTopic], () => {
        console.log(`Subscribed to topic '${loginTopic}'`);
    });
});

client.on('message', (topic, payload) => {
    console.log('Received Message');
    if (topic == registerTopic) {
        register(topic, payload);
    } else if (topic == loginTopic) {
        login(topic, payload);
    } else {
        console.log('Topic undefined');
    }
});

async function register(topic, payload) {
    let userInfo = JSON.parse(payload.toString());
    const { firstName, lastName, email, password, passwordCheck, requestId } =
        userInfo;

    if (!firstName || !lastName || !email || !password || !passwordCheck) {
        return client.publish(
            registerTopicError + requestId,
            'All fields are required'
        );
    }

    // Validate email address
    if (!validator.validate(email)) {
        return client.publish(
            registerTopicError + requestId,
            'Invalid email address'
        );
    }

    // Check if email is already registered
    const existingUser = await User.findOne({ email });
    if (existingUser) {
        return client.publish(
            registerTopicError + requestId,
            'Email is already in use'
        );
    }

    // Check if passwords match
    if (password !== passwordCheck) {
        return client.publish(
            registerTopicError + requestId,
            'Passwords do not match'
        );
    }

    // Check if password is longer than 8 characters
    if (password.length < 8) {
        return client.publish(
            registerTopicError + requestId,
            'Password must be longer than 8 characters'
        );
    }

    try {
        const salt = await bcrypt.genSalt();
        const passwordHash = await bcrypt.hash(password, salt);
        const newUser = new User({
            firstName,
            lastName,
            email,
            password: passwordHash,
        });
        const savedUser = await newUser.save();
        client.publish(registerTopic + requestId, savedUser.toString());
        console.log(savedUser);
    } catch (error) {
        console.error('[register]', error);
        return client.publish(
            registerTopicError + requestId,
            'An unexpected error occurred'
        );
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
            return client.publish(
                'dentistimo/login-error',
                'User name or password error'
            );
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
