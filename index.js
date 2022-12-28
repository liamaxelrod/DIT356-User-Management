const mqtt = require('mqtt');
require('dotenv').config();
var mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
var validator = require('email-validator');

const User = require('./models/user');
const Dentist = require('./models/dentist');

// Topics
const registerUserTopic = 'dentistimo/register/user';
const registerDentistTopic = 'dentistimo/register/dentist';
const registerErrorTopic = 'dentistimo/register/error/';
const loginTopic = 'dentistimo/login';
const loginErrorTopic = 'dentistimo/login/error/';

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
});

client.on('message', (topic, payload) => {
    console.log('Received Message');
    console.log(payload.toString());
    if (topic == registerUserTopic || topic == registerDentistTopic) {
        register(topic, payload);
    } else if (topic == loginTopic) {
        login(topic, payload);
    } else {
        console.log('Topic undefined');
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
            client.publish(registerUserTopic + '/' + requestId, savedUser.toString());
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
        const { email, password, requestId} = JSON.parse(payload.toString());

        console.log(requestId);

        if (!email || !password)
            return client.publish(
                loginErrorTopic + requestId,
                'Not all fields have been entered'
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
            lastName: user.lastName
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
        return client.publish(loginErrorTopic + requestId, JSON.stringify({
            success: false,
            msg: error,
        }));
    }
}
console.log('running...');
